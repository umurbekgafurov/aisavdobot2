import { AdminNotificationService } from '../server/notifications/adminNotificationService';
import { CustomerService } from '../src/services/customerService';
import { ConversationService } from '../src/services/conversationService';
import { initWorkerAuth } from '../server/initWorkerAuth';
import { Customer, Product } from '../src/types';
import { Order } from '../src/types/orders';
import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

interface TestItem {
  num: number;
  name: string;
  passed: boolean;
  details?: string;
}

const suite: TestItem[] = [];

function assert(num: number, name: string, condition: boolean, details?: string) {
  suite.push({ num, name, passed: condition, details });
  console.log(`[M4.5.1 TEST ${num}] ${condition ? '✅ PASS' : '❌ FAIL'}: ${name}${details ? ` -> ${details}` : ''}`);
}

async function runM451Tests() {
  console.log('===============================================================');
  console.log('📢 M4.5.1 ADMIN NOTIFICATION SERVICE TESTS');
  console.log('(Payload Assembly, Stock Mutation Gating, Idempotency, Tenant Isolation)');
  console.log('===============================================================');

  await initWorkerAuth();

  const timestamp = Date.now();
  const testBizA = `biz_m451_A_${timestamp}`;
  const testBizB = `biz_m451_B_${timestamp}`;

  // 1. Setup sample customer
  const custId1 = CustomerService.getCustomerId(testBizA, '88801');
  const sampleCustomer: Customer = {
    id: custId1,
    businessId: testBizA,
    firstName: 'Anvar',
    lastName: 'Karimov',
    phone: '+998901234567',
    telegramUsername: 'anvar_k',
    username: 'anvar_k',
    source: 'telegram',
    totalOrders: 1,
    totalSpent: 15500000,
    status: 'Buyurtma berdi',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await setDoc(doc(db, 'businesses', testBizA, 'customers', custId1), sampleCustomer);

  // 2. Setup sample product
  const sampleProduct: Product = {
    id: `prod_m451_1_${timestamp}`,
    businessId: testBizA,
    warehouseId: 'wh_main',
    name: 'Samsung Galaxy S24 Ultra 512GB',
    sku: 'SAM-S24U-512',
    category: 'Smartphones',
    brand: 'Samsung',
    model: 'S24 Ultra',
    description: 'Titanium Gray',
    price: 15500000,
    costPrice: 13000000,
    stock: 5,
    lowStockThreshold: 2,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await setDoc(doc(db, 'businesses', testBizA, 'products', sampleProduct.id), sampleProduct);

  // Helper to create order document
  async function createOrder(opts: {
    biz: string;
    orderIdSuffix: string;
    status?: 'confirmed' | 'pending_confirmation' | 'cancelled';
    inventoryProcessed?: boolean;
    inventoryStatus?: 'pending' | 'completed' | 'failed' | 'insufficient_stock';
    customerId?: string;
  }): Promise<Order> {
    const orderId = `ord_m451_${opts.orderIdSuffix}_${timestamp}`;
    const custId = opts.customerId || custId1;
    const convId = ConversationService.getConversationId(opts.biz, '88801');
    const unitPrice = 15500000;
    const quantity = 2;
    const total = quantity * unitPrice;

    const order: any = {
      id: orderId,
      orderId,
      businessId: opts.biz,
      customerId: custId,
      conversationId: convId,
      status: opts.status || 'confirmed',
      inventoryProcessed: opts.inventoryProcessed ?? true,
      inventoryStatus: opts.inventoryStatus || 'completed',
      ledgerMovementIds: opts.inventoryProcessed ? [`sm_ord_${orderId}_${sampleProduct.id}`] : [],
      items: [
        {
          productId: sampleProduct.id,
          productName: sampleProduct.name,
          sku: sampleProduct.sku,
          quantity,
          unitPrice,
          lineTotal: total,
          totalPrice: total,
        },
      ],
      subtotal: total,
      total,
      currency: "so'm",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    if (opts.inventoryProcessed) {
      order.inventoryProcessedAt = timestamp;
    }

    await setDoc(doc(db, 'orders', orderId), order);
    return order;
  }

  // --- TEST 1: confirmed order + stock mutated -> valid notification payload ---
  const validOrder = await createOrder({
    biz: testBizA,
    orderIdSuffix: 'valid_1',
    status: 'confirmed',
    inventoryProcessed: true,
    inventoryStatus: 'completed',
  });

  const res1 = await AdminNotificationService.prepareOrderNotification({
    businessId: testBizA,
    orderId: validOrder.id,
  });

  assert(
    1,
    'confirmed order + stock mutated -> valid notification payload',
    res1.success === true && Boolean(res1.payload),
    `notificationId: ${res1.payload?.notificationId}`
  );

  const payload = res1.payload!;

  // --- TEST 2: product name/SKU/quantity correct ---
  assert(
    2,
    'product name/SKU/quantity correct in notification payload',
    payload.productName === sampleProduct.name &&
    payload.sku === sampleProduct.sku &&
    payload.quantity === 2 &&
    payload.unitPrice === 15500000,
    `product: ${payload.productName}, SKU: ${payload.sku}, qty: ${payload.quantity}, price: ${payload.unitPrice}`
  );

  // --- TEST 3: total and currency correct ---
  const expectedTotal = 2 * 15500000;
  assert(
    3,
    'total and currency correct in notification payload',
    payload.total === expectedTotal &&
    payload.subtotal === expectedTotal &&
    payload.currency === "so'm",
    `total: ${payload.total}, subtotal: ${payload.subtotal}, currency: ${payload.currency}`
  );

  // --- TEST 4: customer information correct ---
  assert(
    4,
    'customer information correct in notification payload',
    payload.customerId === custId1 &&
    payload.customerName === 'Anvar Karimov' &&
    Boolean(payload.customerContact?.includes('+998901234567')) &&
    Boolean(payload.customerContact?.includes('@anvar_k')),
    `name: ${payload.customerName}, contact: ${payload.customerContact}`
  );

  // --- TEST 5: businessId isolation (tenant mismatch rejected) ---
  const tenantRes = await AdminNotificationService.prepareOrderNotification({
    businessId: testBizB,
    orderId: validOrder.id, // belongs to testBizA
  });

  assert(
    5,
    'businessId isolation: cross-tenant notification preparation rejected',
    tenantRes.success === false && tenantRes.code === 'TENANT_MISMATCH',
    `Code: ${tenantRes.code}, Error: ${tenantRes.error}`
  );

  // --- TEST 6: invalid/non-confirmed order does not generate notification ---
  const unconfirmedOrder = await createOrder({
    biz: testBizA,
    orderIdSuffix: 'unconfirmed',
    status: 'pending_confirmation',
    inventoryProcessed: false,
    inventoryStatus: 'pending',
  });

  const unconfirmedRes = await AdminNotificationService.prepareOrderNotification({
    businessId: testBizA,
    orderId: unconfirmedOrder.id,
  });

  assert(
    6,
    'invalid/non-confirmed order does not generate notification',
    unconfirmedRes.success === false && unconfirmedRes.code === 'INVALID_ORDER_STATUS',
    `Code: ${unconfirmedRes.code}, Error: ${unconfirmedRes.error}`
  );

  // --- TEST 7: stock mutation unsuccessful -> NO notification created ---
  // Confirmed order, but stock was insufficient
  const failedStockOrder = await createOrder({
    biz: testBizA,
    orderIdSuffix: 'failed_stock',
    status: 'confirmed',
    inventoryProcessed: false,
    inventoryStatus: 'insufficient_stock',
  });

  const failedStockRes = await AdminNotificationService.prepareOrderNotification({
    businessId: testBizA,
    orderId: failedStockOrder.id,
  });

  assert(
    7,
    'stock mutation unsuccessful (insufficient stock) -> NO notification created',
    failedStockRes.success === false && failedStockRes.code === 'STOCK_MUTATION_REQUIRED',
    `Code: ${failedStockRes.code}, Error: ${failedStockRes.error}`
  );

  // --- TEST 8: duplicate processing safe / idempotency ---
  // Call prepare again with persistPreparationFlag = true
  const firstPrepare = await AdminNotificationService.prepareOrderNotification({
    businessId: testBizA,
    orderId: validOrder.id,
    persistPreparationFlag: true,
  });

  const secondPrepare = await AdminNotificationService.prepareOrderNotification({
    businessId: testBizA,
    orderId: validOrder.id,
    persistPreparationFlag: true,
  });

  assert(
    8,
    'duplicate processing safe / idempotency preserved without side-effects',
    firstPrepare.success === true &&
    secondPrepare.success === true &&
    firstPrepare.payload?.notificationId === secondPrepare.payload?.notificationId &&
    secondPrepare.isAlreadyPrepared === true,
    `notificationId: ${secondPrepare.payload?.notificationId}, isAlreadyPrepared: ${secondPrepare.isAlreadyPrepared}`
  );

  // --- TEST 9: missing optional customer data does not crash ---
  // Order with customer that does not exist in Firestore
  const anonCustId = `cust_unknown_${timestamp}`;
  const anonOrder = await createOrder({
    biz: testBizA,
    orderIdSuffix: 'anon_cust',
    status: 'confirmed',
    inventoryProcessed: true,
    inventoryStatus: 'completed',
    customerId: anonCustId,
  });

  const anonRes = await AdminNotificationService.prepareOrderNotification({
    businessId: testBizA,
    orderId: anonOrder.id,
  });

  assert(
    9,
    'missing optional customer data does not crash and provides clean fallbacks',
    anonRes.success === true &&
    Boolean(anonRes.payload) &&
    anonRes.payload?.customerName === 'Mijoz' &&
    anonRes.payload?.customerContact === undefined,
    `customerName: ${anonRes.payload?.customerName}, contact: ${anonRes.payload?.customerContact}`
  );

  // --- TEST 10: pure payload preparation: stock & movements remain 100% untouched ---
  const productSnapAfter = await getDoc(doc(db, 'businesses', testBizA, 'products', sampleProduct.id));
  const currentStock = (productSnapAfter.data() as Product).stock;
  const movementsSnap = await getDocs(collection(db, 'businesses', testBizA, 'stock_movements'));

  assert(
    10,
    'notification service is non-intrusive: zero stock changes and zero extra movements',
    currentStock === 5 && movementsSnap.size === 0,
    `Stock: ${currentStock} (expected 5), movements: ${movementsSnap.size} (expected 0)`
  );

  // --- TEST 11: formatted notification message generated in clean Uzbek ---
  const text = payload.formattedText;
  const textValid =
    text.includes('YANGI BUYURTMA!') &&
    text.includes(validOrder.id) &&
    text.includes('Anvar Karimov') &&
    text.includes(sampleProduct.name) &&
    (text.includes('31 000 000') || text.includes('31,000,000')) &&
    text.includes("so'm");

  assert(
    11,
    'formattedText contains complete, professional Uzbek notification text',
    textValid,
    `Formatted text excerpt: ${text.substring(0, 100).replace(/\n/g, ' ')}...`
  );

  console.log('===============================================================');
  const passedCount = suite.filter((t) => t.passed).length;
  console.log(`TOTAL: ${suite.length} | PASSED: ${passedCount} | FAILED: ${suite.length - passedCount}`);
  console.log('===============================================================');

  if (passedCount === suite.length) {
    console.log('🎉 ALL 11 M4.5.1 ADMIN NOTIFICATION TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('❌ SOME M4.5.1 TESTS FAILED');
    process.exit(1);
  }
}

runM451Tests();
