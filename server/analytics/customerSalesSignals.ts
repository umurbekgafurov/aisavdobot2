import { db } from '../../src/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { Customer, ConversationMessage } from '../../src/types';
import { Order } from '../../src/types/orders';
import { CustomerSalesSignals } from '../../src/types/salesSignals';

export interface ComputeSignalsInput {
  businessId: string;
  customerId: string;
  customer?: Partial<Customer> | null;
  orders?: Order[];
  messages?: ConversationMessage[];
}

export class CustomerSalesSignalsService {
  /**
   * Deterministic pure computation of customer sales signals.
   * Does NOT call external AI/Gemini.
   * Guarantees strict businessId + customerId scoping.
   */
  public static computeSignals(input: ComputeSignalsInput): CustomerSalesSignals {
    const { businessId, customerId } = input;

    if (!businessId || typeof businessId !== 'string') {
      throw new Error('businessId is required and must be a string');
    }
    if (!customerId || typeof customerId !== 'string') {
      throw new Error('customerId is required and must be a string');
    }

    // 1. Strictly filter orders for this tenant and customer
    const customerOrders = (input.orders || []).filter(
      (o) => o.businessId === businessId && o.customerId === customerId
    );

    // 2. Strictly filter messages for this tenant and customer
    const customerMessages = (input.messages || []).filter(
      (m) => m.businessId === businessId && m.customerId === customerId
    );

    // Helper status checkers (case-insensitive for safety and legacy compat)
    const isActiveStatus = (status?: string) => {
      const s = (status || '').toLowerCase();
      return s === 'confirmed' || s === 'processing' || s === 'tasdiqlandi' || s === 'tayyorlanmoqda';
    };

    const isCompletedStatus = (status?: string) => {
      const s = (status || '').toLowerCase();
      return s === 'completed' || s === 'yetkazildi';
    };

    const isCancelledStatus = (status?: string) => {
      const s = (status || '').toLowerCase();
      return s === 'cancelled' || s === 'bekor qilindi';
    };

    const activeOrders = customerOrders.filter((o) => isActiveStatus(o.status || o.orderStatus));
    const completedOrders = customerOrders.filter((o) => isCompletedStatus(o.status || o.orderStatus));
    const cancelledOrders = customerOrders.filter((o) => isCancelledStatus(o.status || o.orderStatus));
    const nonCancelledOrders = customerOrders.filter((o) => !isCancelledStatus(o.status || o.orderStatus));

    // Order Counts
    const totalOrdersCount = customerOrders.length;
    const completedOrdersCount = completedOrders.length;
    const cancelledOrdersCount = cancelledOrders.length;

    // Has flags
    const hasActiveOrder = activeOrders.length > 0;
    const hasCompletedOrder = completedOrders.length > 0;
    const hasCancelledOrder = cancelledOrders.length > 0;

    // Repeat customer: 2 or more confirmed/completed orders, or 2 or more non-cancelled orders
    const isRepeatCustomer = completedOrdersCount + activeOrders.length >= 2 || nonCancelledOrders.length >= 2;

    // Total spent: sum of all non-cancelled orders
    let totalSpent = nonCancelledOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    if (totalSpent === 0 && input.customer && typeof input.customer.totalSpent === 'number' && input.customer.totalSpent > 0 && customerOrders.length === 0) {
      // Fallback to customer summary totalSpent if no individual orders in memory
      totalSpent = input.customer.totalSpent;
    }

    // Last order timestamp
    let lastOrderAt: number | null = null;
    if (customerOrders.length > 0) {
      const orderTimestamps = customerOrders
        .map((o) => o.createdAt)
        .filter((ts): ts is number => typeof ts === 'number' && ts > 0);
      if (orderTimestamps.length > 0) {
        lastOrderAt = Math.max(...orderTimestamps);
      }
    }

    // Last interaction timestamp: max of customer record, orders, and messages
    const interactionCandidates: number[] = [];

    if (input.customer) {
      if (typeof input.customer.lastInteraction === 'number' && input.customer.lastInteraction > 0) {
        interactionCandidates.push(input.customer.lastInteraction);
      }
      if (typeof input.customer.lastMessageAt === 'number' && input.customer.lastMessageAt > 0) {
        interactionCandidates.push(input.customer.lastMessageAt);
      }
      if (typeof input.customer.updatedAt === 'number' && input.customer.updatedAt > 0) {
        interactionCandidates.push(input.customer.updatedAt);
      }
      if (typeof input.customer.createdAt === 'number' && input.customer.createdAt > 0) {
        interactionCandidates.push(input.customer.createdAt);
      }
    }

    if (lastOrderAt !== null) {
      interactionCandidates.push(lastOrderAt);
    }

    for (const msg of customerMessages) {
      if (typeof msg.createdAt === 'number' && msg.createdAt > 0) {
        interactionCandidates.push(msg.createdAt);
      }
    }

    const lastInteractionAt = interactionCandidates.length > 0 ? Math.max(...interactionCandidates) : null;

    // Message intent analysis (deterministic from existing AI intent tags and metadata)
    const isPurchaseIntent = (intent?: string | null) => {
      const i = (intent || '').toLowerCase();
      return i === 'order_intent' || i === 'order_request' || i.includes('order');
    };

    const isProductInquiry = (intent?: string | null, m?: ConversationMessage) => {
      const i = (intent || '').toLowerCase();
      const hasProductData = Boolean(m?.aiProductName || m?.aiProductId);
      return i === 'product_query' || i === 'product_search' || i.includes('product') || hasProductData;
    };

    const isPriceInquiry = (intent?: string | null) => {
      const i = (intent || '').toLowerCase();
      return i === 'price_query' || i === 'price_request' || i.includes('price');
    };

    const isStockInquiry = (intent?: string | null) => {
      const i = (intent || '').toLowerCase();
      return i === 'stock_query' || i === 'stock_check' || i.includes('stock');
    };

    const purchaseIntentDetected = customerMessages.some((m) => isPurchaseIntent(m.aiIntent));
    const productInquiryDetected = customerMessages.some((m) => isProductInquiry(m.aiIntent, m));
    const priceInquiryDetected = customerMessages.some((m) => isPriceInquiry(m.aiIntent));
    const stockInquiryDetected = customerMessages.some((m) => isStockInquiry(m.aiIntent));

    return {
      customerId,
      businessId,

      hasActiveOrder,
      hasCompletedOrder,
      hasCancelledOrder,

      isRepeatCustomer,

      totalOrders: totalOrdersCount,
      completedOrders: completedOrdersCount,
      cancelledOrders: cancelledOrdersCount,
      totalSpent,

      lastOrderAt,
      lastInteractionAt,

      purchaseIntentDetected,
      productInquiryDetected,
      priceInquiryDetected,
      stockInquiryDetected,
    };
  }

  /**
   * Fetches customer, orders, and messages from Firestore with strict tenant isolation,
   * then computes deterministic CustomerSalesSignals.
   */
  public static async computeSignalsForCustomer(
    businessId: string,
    customerId: string
  ): Promise<CustomerSalesSignals> {
    if (!businessId || !customerId) {
      throw new Error('businessId and customerId are required');
    }

    // 1. Fetch customer doc
    const customerRef = doc(db, 'businesses', businessId, 'customers', customerId);
    const customerSnap = await getDoc(customerRef);
    const customer = customerSnap.exists()
      ? ({ id: customerSnap.id, ...customerSnap.data() } as Customer)
      : null;

    // 2. Fetch customer orders strictly for this tenant
    const orders: Order[] = [];
    try {
      const rootOrdersQ = query(
        collection(db, 'orders'),
        where('businessId', '==', businessId),
        where('customerId', '==', customerId)
      );
      const rootSnap = await getDocs(rootOrdersQ);
      rootSnap.forEach((d) => {
        orders.push({ id: d.id, ...d.data() } as Order);
      });
    } catch {
      // Fallback to subcollection if root query is constrained
      const subOrdersCol = collection(db, 'businesses', businessId, 'orders');
      const subSnap = await getDocs(subOrdersCol);
      subSnap.forEach((d) => {
        const o = { id: d.id, ...d.data() } as Order;
        if (o.customerId === customerId) {
          orders.push(o);
        }
      });
    }

    // 3. Fetch customer messages strictly for this tenant
    const messages: ConversationMessage[] = [];
    try {
      // Find conversations for this customer in this business
      const convsQ = query(
        collection(db, 'businesses', businessId, 'conversations'),
        where('customerId', '==', customerId)
      );
      const convsSnap = await getDocs(convsQ);

      for (const convDoc of convsSnap.docs) {
        const msgsCol = collection(db, 'businesses', businessId, 'conversations', convDoc.id, 'messages');
        const msgsSnap = await getDocs(msgsCol);
        msgsSnap.forEach((m) => {
          messages.push({ id: m.id, ...m.data() } as ConversationMessage);
        });
      }
    } catch (msgErr) {
      console.warn('CustomerSalesSignalsService messages notice:', msgErr);
    }

    return this.computeSignals({
      businessId,
      customerId,
      customer,
      orders,
      messages,
    });
  }
}
