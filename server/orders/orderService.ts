import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  Unsubscribe,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import {
  Order,
  OrderItem,
  CreateOrderInput,
  OrderDomainStatus,
  VALID_ORDER_STATUSES,
  PendingOrderConfirmation,
} from '../../src/types/orders';
import { StockMovement, Product } from '../../src/types';
import { handleFirestoreError, OperationType } from '../../src/lib/firestoreErrors';
import { PendingConfirmationService } from './pendingConfirmationService';

export interface MutateStockResult {
  success: boolean;
  order?: Order;
  ledgerMovements?: StockMovement[];
  isAlreadyProcessed?: boolean;
  error?: string;
  code?: 'NOT_FOUND' | 'INVALID_STATUS' | 'INSUFFICIENT_STOCK' | 'ALREADY_PROCESSED' | 'TENANT_MISMATCH' | 'MUTATION_FAILED';
}

export interface OrderValidationError {
  field: string;
  message: string;
}

export class OrderService {
  /**
   * Deterministically calculates lineTotal for an item and verifies integrity
   */
  static calculateLineTotal(quantity: number, unitPrice: number): number {
    return Math.round(quantity * unitPrice * 100) / 100;
  }

  /**
   * Validates order creation input strictly.
   * Throws Error if invalid with descriptive reason.
   */
  static validateCreateOrderInput(input: CreateOrderInput): void {
    if (!input) {
      throw new Error('Order input is required');
    }

    if (!input.businessId || typeof input.businessId !== 'string' || !input.businessId.trim()) {
      throw new Error('businessId is required and must be a non-empty string');
    }

    if (!input.customerId || typeof input.customerId !== 'string' || !input.customerId.trim()) {
      throw new Error('customerId is required and must be a non-empty string');
    }

    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    if (input.status && !VALID_ORDER_STATUSES.includes(input.status)) {
      throw new Error(
        `Invalid order status "${input.status}". Allowed statuses: ${VALID_ORDER_STATUSES.join(', ')}`
      );
    }

    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i];
      if (!item) {
        throw new Error(`Item at index ${i} is invalid`);
      }

      if (!item.productId || typeof item.productId !== 'string' || !item.productId.trim()) {
        throw new Error(`productId is required for item at index ${i}`);
      }

      if (!item.productName || typeof item.productName !== 'string' || !item.productName.trim()) {
        throw new Error(`productName is required for item at index ${i}`);
      }

      if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error(`quantity must be a positive integer for item "${item.productName}" (received: ${item.quantity})`);
      }

      if (typeof item.unitPrice !== 'number' || Number.isNaN(item.unitPrice) || item.unitPrice < 0) {
        throw new Error(`unitPrice must be a non-negative number for item "${item.productName}" (received: ${item.unitPrice})`);
      }
    }
  }

  /**
   * Creates an order with deterministic subtotal and total calculations.
   * Server-side only, no external calls, strictly tenant-isolated.
   */
  static async createOrder(input: CreateOrderInput): Promise<Order> {
    // 1. Validate input strictly
    this.validateCreateOrderInput(input);

    const now = Date.now();
    const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const status: OrderDomainStatus = input.status || 'pending_confirmation';
    const currency = input.currency || 'UZS';

    // 2. Deterministically calculate lineTotals, subtotal, and total
    let calculatedSubtotal = 0;
    const items: OrderItem[] = input.items.map((raw) => {
      const lineTotal = this.calculateLineTotal(raw.quantity, raw.unitPrice);
      calculatedSubtotal += lineTotal;
      const item: OrderItem = {
        productId: raw.productId.trim(),
        productName: raw.productName.trim(),
        quantity: raw.quantity,
        unitPrice: raw.unitPrice,
        lineTotal,
        totalPrice: lineTotal,
      };
      if (raw.sku && raw.sku.trim()) {
        item.sku = raw.sku.trim();
      }
      if (raw.variantName && raw.variantName.trim()) {
        item.variantName = raw.variantName.trim();
      }
      return item;
    });

    calculatedSubtotal = Math.round(calculatedSubtotal * 100) / 100;
    const deliveryFee = typeof input.deliveryPrice === 'number' && input.deliveryPrice > 0
      ? Math.round(input.deliveryPrice * 100) / 100
      : 0;

    const total = Math.round((calculatedSubtotal + deliveryFee) * 100) / 100;

    const order: Order = {
      id: orderId,
      orderId, // Alias
      businessId: input.businessId.trim(),
      customerId: input.customerId.trim(),
      conversationId: input.conversationId || null,
      status,
      items,
      subtotal: calculatedSubtotal,
      total,
      currency,
      createdAt: now,
      updatedAt: now,
    };

    if (input.customerName && input.customerName.trim()) {
      order.customerName = input.customerName.trim();
    }
    if (input.customerPhone && input.customerPhone.trim()) {
      order.customerPhone = input.customerPhone.trim();
    }
    if (input.deliveryAddress && input.deliveryAddress.trim()) {
      order.deliveryAddress = input.deliveryAddress.trim();
    }
    if (input.notes && input.notes.trim()) {
      order.notes = input.notes.trim();
    }
    if (input.customerNote !== undefined) {
      order.customerNote = input.customerNote;
    }
    if (deliveryFee > 0) {
      order.deliveryPrice = deliveryFee;
      order.deliveryFee = deliveryFee;
    }

    // 3. Persist into Firestore orders collection
    try {
      const orderRef = doc(db, 'orders', orderId);
      await setDoc(orderRef, order);
      return order;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
    }
  }

  /**
   * Retrieves an order by ID with tenant verification
   */
  static async getOrder(businessId: string, orderId: string): Promise<Order | null> {
    if (!businessId || !orderId) {
      return null;
    }

    try {
      const snap = await getDoc(doc(db, 'orders', orderId));
      if (!snap.exists()) {
        return null;
      }

      const data = snap.data() as Order;
      // Strict multi-tenant verification
      if (data.businessId !== businessId) {
        console.warn(`[OrderService Security] Tenant mismatch for order ${orderId}. Expected ${businessId}, got ${data.businessId}`);
        return null;
      }

      return data;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `orders/${orderId}`);
    }
  }

  /**
   * Updates an order status with validation and tenant isolation
   */
  static async updateOrderStatus(
    businessId: string,
    orderId: string,
    newStatus: OrderDomainStatus
  ): Promise<Order> {
    if (!businessId || !orderId) {
      throw new Error('businessId and orderId are required');
    }

    if (!VALID_ORDER_STATUSES.includes(newStatus)) {
      throw new Error(`Invalid status "${newStatus}". Must be one of: ${VALID_ORDER_STATUSES.join(', ')}`);
    }

    const existing = await this.getOrder(businessId, orderId);
    if (!existing) {
      throw new Error(`Order "${orderId}" not found for business "${businessId}"`);
    }

    const now = Date.now();
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: now,
      });

      return {
        ...existing,
        status: newStatus,
        updatedAt: now,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  }

  /**
   * Lists orders strictly scoped to a businessId
   */
  static async getOrdersByBusiness(businessId: string): Promise<Order[]> {
    if (!businessId || typeof businessId !== 'string') {
      throw new Error('businessId is required');
    }

    try {
      const q = query(collection(db, 'orders'), where('businessId', '==', businessId));
      const snap = await getDocs(q);
      const orders: Order[] = [];
      snap.forEach((d) => orders.push(d.data() as Order));
      return orders.sort((a, b) => b.createdAt - a.createdAt);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'orders');
    }
  }

  /**
   * Subscribes to orders for a business
   */
  static subscribeOrders(
    businessId: string,
    onData: (orders: Order[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    if (!businessId) {
      throw new Error('businessId is required for order subscription');
    }

    const q = query(collection(db, 'orders'), where('businessId', '==', businessId));
    return onSnapshot(
      q,
      (snap) => {
        const orders: Order[] = [];
        snap.forEach((d) => orders.push(d.data() as Order));
        orders.sort((a, b) => b.createdAt - a.createdAt);
        onData(orders);
      },
      (err) => {
        console.error('[OrderService realtime error]', err);
        if (onError) onError(err);
      }
    );
  }

  /**
   * Deterministic foundation for detecting potential order intent from a message (M3.1 compatibility).
   * Does NOT auto-confirm orders or mutate state.
   */
  static detectOrderIntent(messageText: string): {
    hasOrderIntent: boolean;
    confidence: number;
    reason?: string;
    detectedItems?: Array<{
      query: string;
      quantity: number;
    }>;
  } {
    if (!messageText || typeof messageText !== 'string') {
      return { hasOrderIntent: false, confidence: 0 };
    }

    const text = messageText.toLowerCase().trim();
    let score = 0;
    const reasons: string[] = [];

    // Direct purchase intent keywords (Uzbek & Russian)
    const directKeywords = [
      'olaman',
      'olmoqchiman',
      'buyurtma',
      'zakaz',
      'sotib olmoqchiman',
      'buyurtma beraman',
      'bermoqchiman',
      'yetkazib bering',
      'dostavka qiling',
      'jo\'nating',
      'jo\'natinglar',
      'yuboring',
      'zakaz qilmoqchiman',
      'kupit',
      'zakazat',
    ];

    for (const kw of directKeywords) {
      if (text.includes(kw)) {
        score += 0.45;
        reasons.push(`Topilgan kalit so'z: "${kw}"`);
        break;
      }
    }

    const qtyRegex = /(\d+)\s*(ta|dona|shtuk|sht|d|x)\b/i;
    const qtyMatch = text.match(qtyRegex);
    let detectedQty = 1;
    if (qtyMatch) {
      score += 0.25;
      detectedQty = parseInt(qtyMatch[1], 10) || 1;
      reasons.push(`Topilgan miqdor: ${detectedQty} dona`);
    }

    const phoneRegex = /(?:\+?998|8)?[\s-]?\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/;
    if (phoneRegex.test(text)) {
      score += 0.2;
      reasons.push('Telefon raqami aniqlandi');
    }

    const addressKeywords = ['manzil', 'adres', 'toshkent', 'viloyat', 'ko\'cha', 'dom', 'kvartira'];
    for (const akw of addressKeywords) {
      if (text.includes(akw)) {
        score += 0.1;
        reasons.push(`Manzil belgisi: "${akw}"`);
        break;
      }
    }

    const confidence = Math.min(Number(score.toFixed(2)), 0.95);
    const hasOrderIntent = confidence >= 0.45;

    return {
      hasOrderIntent,
      confidence,
      reason: reasons.join('; '),
      detectedItems: hasOrderIntent
        ? [
            {
              query: text.slice(0, 80),
              quantity: detectedQty,
            },
          ]
        : undefined,
    };
  }

  /**
   * Backwards compatible helper for groundingEngine
   */
  static async createDraftOrder(params: {
    businessId: string;
    customerId: string;
    conversationId?: string | null;
    items?: OrderItem[];
    subtotal?: number;
    deliveryPrice?: number;
    total?: number;
    currency?: string;
    customerNote?: string | null;
    customerName?: string;
    customerPhone?: string;
    deliveryAddress?: string;
  }): Promise<Order> {
    const {
      businessId,
      customerId,
      conversationId = null,
      items = [],
      subtotal = 0,
      deliveryPrice = 0,
      total = subtotal + deliveryPrice,
      currency = 'UZS',
      customerNote = null,
      customerName = '',
      customerPhone = '',
      deliveryAddress = '',
    } = params;

    const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const orderRef = doc(db, 'orders', orderId);
    const now = Date.now();

    const order: Order = {
      id: orderId,
      orderId,
      businessId,
      customerId,
      conversationId,
      source: 'telegram',
      status: 'pending_confirmation',
      items,
      subtotal,
      deliveryPrice,
      total,
      currency,
      customerNote,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      deliveryAddress: deliveryAddress || undefined,
      paymentStatus: 'Kutilmoqda',
      orderStatus: 'Yangi',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await setDoc(orderRef, order);
      return order;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
    }
  }

  /**
   * M4.4.1: Converts a confirmed pending confirmation into a final Order.
   * - Must ONLY create order when pending confirmation status is 'confirmed'.
   * - Uses ONLY trusted values stored in the confirmed pending confirmation.
   * - Deterministic backend calculations (quantity * unitPrice, subtotal, total).
   * - Idempotent: Same confirmed confirmation never creates duplicate orders.
   * - Stores pendingConfirmation.orderId = orderId (remains auditable, not deleted).
   * - Absolutely ZERO stock mutation (stock decrement deferred to M4.4.2).
   * - Strictly tenant-isolated by businessId.
   */
  static async createOrderFromConfirmedPending(params: {
    businessId: string;
    pendingConfirmationId?: string;
    pendingConfirmation?: PendingOrderConfirmation;
    customerId?: string;
    conversationId?: string;
  }): Promise<{
    success: boolean;
    order?: Order;
    isExisting?: boolean;
    error?: string;
  }> {
    const { businessId } = params;
    if (!businessId || typeof businessId !== 'string' || !businessId.trim()) {
      return { success: false, error: 'businessId is required' };
    }

    try {
      // 1. Resolve pending confirmation document
      let pending: PendingOrderConfirmation | null = params.pendingConfirmation || null;

      if (!pending) {
        if (params.pendingConfirmationId) {
          const snap = await getDoc(doc(db, 'pending_confirmations', params.pendingConfirmationId));
          if (snap.exists()) {
            pending = snap.data() as PendingOrderConfirmation;
          }
        } else if (params.customerId && params.conversationId) {
          pending = await PendingConfirmationService.getRawPendingConfirmation(
            businessId,
            params.customerId,
            params.conversationId
          );
        }
      }

      if (!pending) {
        return { success: false, error: 'Pending confirmation record not found' };
      }

      // 2. Strict multi-tenant security verification
      if (pending.businessId !== businessId) {
        console.warn(`[OrderService Security] Tenant isolation violation: confirmation ${pending.id} belongs to ${pending.businessId}, request from ${businessId}`);
        return { success: false, error: 'Tenant isolation violation' };
      }

      // 3. Verify confirmation state is strictly 'confirmed'
      if (pending.status !== 'confirmed') {
        return {
          success: false,
          error: `Order can only be created from confirmed status (current status: "${pending.status}")`,
        };
      }

      // 4. Deterministic order ID: order_${pending.id}
      const deterministicOrderId = `order_${pending.id}`;

      // Idempotency check 1: check if pending.orderId is already linked and exists
      if (pending.orderId) {
        const existingOrder = await this.getOrder(businessId, pending.orderId);
        if (existingOrder) {
          console.log(`[OrderService Idempotency] Pending confirmation ${pending.id} already has order ${existingOrder.id}`);
          return { success: true, order: existingOrder, isExisting: true };
        }
      }

      // Idempotency check 2: check if order document already exists with deterministic ID
      const existingDocSnap = await getDoc(doc(db, 'orders', deterministicOrderId));
      if (existingDocSnap.exists()) {
        const existingOrder = existingDocSnap.data() as Order;
        if (existingOrder.businessId === businessId) {
          // Ensure link is recorded on pending confirmation
          if (!pending.orderId) {
            await setDoc(doc(db, 'pending_confirmations', pending.id), { orderId: deterministicOrderId }, { merge: true });
          }
          console.log(`[OrderService Idempotency] Found existing deterministic order ${deterministicOrderId}`);
          return { success: true, order: existingOrder, isExisting: true };
        } else {
          return { success: false, error: 'Tenant isolation mismatch on existing order' };
        }
      }

      // 5. Extract trusted values ONLY from pendingConfirmation (NO Gemini, NO user message)
      const productId = pending.productId;
      const productName = pending.productName;
      const sku = pending.sku || undefined;
      const quantity = pending.quantity;
      const unitPrice = pending.unitPrice;
      const currency = pending.currency || 'UZS';
      const customerId = pending.customerId;
      const conversationId = pending.conversationId;

      if (!productId || !productName || typeof quantity !== 'number' || quantity <= 0 || typeof unitPrice !== 'number' || unitPrice < 0) {
        return { success: false, error: 'Invalid item data in pending confirmation' };
      }

      // 6. Backend calculations:
      // lineTotal = quantity * unitPrice
      // subtotal = sum(lineTotal)
      // total = subtotal
      const lineTotal = this.calculateLineTotal(quantity, unitPrice);
      const subtotal = lineTotal;
      const total = subtotal;

      const orderItem: OrderItem = {
        productId,
        productName,
        quantity,
        unitPrice,
        lineTotal,
        totalPrice: lineTotal,
      };
      if (sku) {
        orderItem.sku = sku;
      }

      const now = Date.now();
      const order: Order = {
        id: deterministicOrderId,
        orderId: deterministicOrderId,
        businessId,
        customerId,
        conversationId: conversationId || null,
        status: 'confirmed',
        items: [orderItem],
        subtotal,
        total,
        currency,
        createdAt: now,
        updatedAt: now,
      };

      // 7. Atomic-safe write: create order
      // IMPORTANT: ZERO stock mutation, zero reservation, zero warehouse ledger changes
      const orderRef = doc(db, 'orders', deterministicOrderId);
      await setDoc(orderRef, order);

      // 8. Update pending confirmation to link orderId (must NOT delete record, remains auditable)
      const updatedPending: PendingOrderConfirmation = {
        ...pending,
        orderId: deterministicOrderId,
      };
      await setDoc(doc(db, 'pending_confirmations', pending.id), { orderId: deterministicOrderId }, { merge: true });

      if (conversationId) {
        try {
          await setDoc(
            doc(db, 'conversations', conversationId),
            { pendingConfirmation: updatedPending },
            { merge: true }
          );
        } catch {
          // Non-blocking
        }
      }

      console.log(`[OrderService M4.4.1] Successfully created confirmed Order ${deterministicOrderId} from confirmation ${pending.id}`);
      return { success: true, order, isExisting: false };
    } catch (err: any) {
      console.error(`[OrderService M4.4.1] Error creating order from confirmation:`, err);
      return { success: false, error: err?.message || 'Failed to create order from confirmation' };
    }
  }

  /**
   * M4.4.2: Atomically decreases stock and creates warehouse ledger entries for a confirmed order.
   * - Stock is ONLY modified for a valid confirmed order.
   * - Validates currentStock >= orderItem.quantity for all items in order.
   * - Atomic transaction: prevents stock decrement without ledger or ledger without stock decrement.
   * - Prevents negative stock.
   * - Idempotent: detects inventoryProcessedAt, runs only once per order, creates zero duplicate ledger records.
   * - Scoped strictly by businessId (tenant isolation).
   * - Marks order with inventoryProcessed: true, inventoryProcessedAt, inventoryStatus: 'completed'.
   */
  static async mutateStockForConfirmedOrder(params: {
    businessId: string;
    orderId: string;
  }): Promise<MutateStockResult> {
    const { businessId, orderId } = params;

    if (!businessId || typeof businessId !== 'string' || !businessId.trim()) {
      return { success: false, code: 'TENANT_MISMATCH', error: 'businessId is required and must be non-empty' };
    }

    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      return { success: false, code: 'NOT_FOUND', error: 'orderId is required and must be non-empty' };
    }

    try {
      const orderRef = doc(db, 'orders', orderId);

      // 1. Initial pre-check outside transaction
      const preSnap = await getDoc(orderRef);
      if (!preSnap.exists()) {
        return { success: false, code: 'NOT_FOUND', error: `Order "${orderId}" not found` };
      }

      const initialOrder = preSnap.data() as Order;

      // Tenant isolation verification
      if (initialOrder.businessId !== businessId) {
        console.warn(`[OrderService Security] Tenant isolation violation: order ${orderId} belongs to ${initialOrder.businessId}, mutation requested by ${businessId}`);
        return { success: false, code: 'TENANT_MISMATCH', error: 'Tenant isolation violation' };
      }

      // Order status verification: MUST be confirmed
      if (initialOrder.status !== 'confirmed') {
        return {
          success: false,
          code: 'INVALID_STATUS',
          error: `Cannot mutate stock for order with status "${initialOrder.status}". Order must be confirmed.`,
        };
      }

      // Idempotency pre-check: if already processed, return existing order and movements without re-mutating
      if (initialOrder.inventoryProcessedAt || initialOrder.inventoryProcessed || initialOrder.inventoryStatus === 'completed') {
        console.log(`[OrderService Idempotency] Order ${orderId} inventory was already processed at ${initialOrder.inventoryProcessedAt}`);
        const existingMovementsSnap = await getDocs(
          query(
            collection(db, 'businesses', businessId, 'stock_movements'),
            where('referenceId', '==', orderId)
          )
        );
        const existingMovements: StockMovement[] = [];
        existingMovementsSnap.forEach((d) => existingMovements.push(d.data() as StockMovement));

        return {
          success: true,
          isAlreadyProcessed: true,
          order: initialOrder,
          ledgerMovements: existingMovements,
        };
      }

      if (!Array.isArray(initialOrder.items) || initialOrder.items.length === 0) {
        return {
          success: false,
          code: 'MUTATION_FAILED',
          error: `Order "${orderId}" has no items to mutate stock for`,
        };
      }

      // 2. Execute atomic Firestore transaction
      const result = await runTransaction(db, async (txn) => {
        // a) Read fresh order state inside transaction
        const txnOrderSnap = await txn.get(orderRef);
        if (!txnOrderSnap.exists()) {
          throw new Error(`Order "${orderId}" not found`);
        }
        const freshOrder = txnOrderSnap.data() as Order;

        if (freshOrder.businessId !== businessId) {
          const err: any = new Error('Tenant isolation violation');
          err.code = 'TENANT_MISMATCH';
          throw err;
        }

        if (freshOrder.status !== 'confirmed') {
          const err: any = new Error(`Cannot mutate stock for order with status "${freshOrder.status}"`);
          err.code = 'INVALID_STATUS';
          throw err;
        }

        if (freshOrder.inventoryProcessedAt || freshOrder.inventoryProcessed || freshOrder.inventoryStatus === 'completed') {
          return { alreadyProcessed: true, order: freshOrder, ledgerMovements: [] };
        }

        // b) Read all products and validate stock sufficiency inside transaction
        const itemsPlan: Array<{
          item: OrderItem;
          productRef: any;
          prodData: Product;
          currentStock: number;
          newStock: number;
        }> = [];

        for (const item of freshOrder.items) {
          if (!item.productId) {
            throw new Error('OrderItem missing productId');
          }
          if (typeof item.quantity !== 'number' || item.quantity <= 0) {
            throw new Error(`OrderItem "${item.productName || item.productId}" has invalid quantity ${item.quantity}`);
          }

          const productRef = doc(db, 'businesses', businessId, 'products', item.productId);
          const prodSnap = await txn.get(productRef);
          if (!prodSnap.exists()) {
            throw new Error(`Product "${item.productId}" not found in business "${businessId}"`);
          }

          const prodData = prodSnap.data() as Product;
          if (prodData.businessId !== businessId) {
            const err: any = new Error(`Tenant mismatch for product "${item.productId}"`);
            err.code = 'TENANT_MISMATCH';
            throw err;
          }

          const currentStock = typeof prodData.stock === 'number' ? prodData.stock : 0;

          // CRITICAL: Stock check
          if (currentStock < item.quantity) {
            const err: any = new Error(
              `Omborda yetarli qoldiq mavjud emas! Product "${prodData.name}" has ${currentStock} units, but order requires ${item.quantity} units.`
            );
            err.code = 'INSUFFICIENT_STOCK';
            throw err;
          }

          const newStock = currentStock - item.quantity;
          if (newStock < 0) {
            const err: any = new Error(`Negative stock prevented! Resulting stock would be ${newStock}`);
            err.code = 'INSUFFICIENT_STOCK';
            throw err;
          }

          itemsPlan.push({
            item,
            productRef,
            prodData,
            currentStock,
            newStock,
          });
        }

        // c) Apply stock decrements and create ledger entries inside transaction
        const now = Date.now();
        const createdMovements: StockMovement[] = [];
        const movementIds: string[] = [];

        for (const plan of itemsPlan) {
          const { item, productRef, prodData, newStock } = plan;

          // 1. Decrement stock atomically
          txn.update(productRef, {
            stock: newStock,
            updatedAt: now,
          });

          // 2. Create warehouse ledger entry
          // Deterministic movement ID: sm_ord_${freshOrder.id}_${item.productId}
          const movementId = `sm_ord_${freshOrder.id}_${item.productId}`;
          const movementRef = doc(db, 'businesses', businessId, 'stock_movements', movementId);

          const movementDoc: StockMovement = {
            id: movementId,
            businessId,
            warehouseId: prodData.warehouseId || 'wh_main',
            productId: item.productId,
            productName: prodData.name,
            type: 'STOCK_OUT',
            quantity: -item.quantity,
            reason: `Buyurtma bo'yicha chiqim #${freshOrder.id}`,
            referenceType: 'order',
            referenceId: freshOrder.id,
            createdAt: now,
            createdBy: 'system_order_service',
          };

          txn.set(movementRef, movementDoc);
          createdMovements.push(movementDoc);
          movementIds.push(movementId);
        }

        // d) Mark order inventory processing complete
        const updatedOrderFields = {
          inventoryProcessed: true,
          inventoryProcessedAt: now,
          inventoryStatus: 'completed' as const,
          ledgerMovementIds: movementIds,
          updatedAt: now,
        };

        txn.update(orderRef, updatedOrderFields);

        return {
          alreadyProcessed: false,
          order: { ...freshOrder, ...updatedOrderFields },
          ledgerMovements: createdMovements,
        };
      });

      if (result.alreadyProcessed) {
        return {
          success: true,
          isAlreadyProcessed: true,
          order: result.order,
          ledgerMovements: result.ledgerMovements,
        };
      }

      console.log(`[OrderService M4.4.2] Successfully processed inventory for order ${orderId}. Deducted stock and created ${result.ledgerMovements?.length} warehouse ledger entries.`);
      return {
        success: true,
        order: result.order,
        ledgerMovements: result.ledgerMovements,
        isAlreadyProcessed: false,
      };
    } catch (err: any) {
      console.error(`[OrderService M4.4.2] Stock mutation failed for order ${orderId}:`, err?.message || err);

      const isInsufficient = err?.code === 'INSUFFICIENT_STOCK' || (err?.message && err.message.includes('Omborda yetarli qoldiq mavjud emas'));
      const isTenantMismatch = err?.code === 'TENANT_MISMATCH' || (err?.message && err.message.includes('Tenant'));

      if (isInsufficient) {
        // Record inventory status as insufficient_stock on the order for audit and recovery
        try {
          await updateDoc(doc(db, 'orders', orderId), {
            inventoryStatus: 'insufficient_stock',
            updatedAt: Date.now(),
          });
        } catch {
          // Non-blocking
        }
        return {
          success: false,
          code: 'INSUFFICIENT_STOCK',
          error: err.message,
        };
      }

      if (isTenantMismatch) {
        return {
          success: false,
          code: 'TENANT_MISMATCH',
          error: err.message,
        };
      }

      return {
        success: false,
        code: 'MUTATION_FAILED',
        error: err?.message || 'Stock mutation transaction failed',
      };
    }
  }
}

