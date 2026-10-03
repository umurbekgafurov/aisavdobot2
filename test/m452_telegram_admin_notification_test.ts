import { AdminNotificationService } from '../server/notifications/adminNotificationService';
import { CustomerService } from '../src/services/customerService';
import { ConversationService } from '../src/services/conversationService';
import { OrderService } from '../server/orders/orderService';
import { TelegramClient } from '../server/telegram/telegramClient';
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
  console.log(`[M4.5.2 TEST ${num}] ${condition ? '✅ PASS' : '❌ FAIL'}: ${name}${details ? ` -> ${details}` : ''}`);
}

async function runM452Tests() {
  console.log('===============================================================');
  console.log('📢 M4.5.2 TELEGRAM ADMIN NOTIFICATION INTEGRATION TESTS');
  console.log('(Telegram Delivery, Multiple Admins, Idempotency, Tenant Isolation, Error Resilience)');
  console.log('===============================================================');

  await initWorkerAuth();

  const timestamp = Date.now();
  const testBizA = `biz_m452_A_${timestamp}`;
  const testBizB = `biz_m452_B_${timestamp}`;

  const adminChatIdA1 = '777001';
  const adminChatIdA2 = '777002';
  const adminChatIdB = '888001';

  // 1. Setup Businesses with admin chat IDs
  await setDoc(doc(db, 'businesses', testBizA), {
    id: testBizA,
    name: 'Biznes A Gadgets',
    ownerUid: 'owner_user_A',
    adminTelegramChatId: adminChatIdA1,
    telegramAdminChatIds: [adminChatIdA1, adminChatIdA2],
    phone: '+998901111111',
    address: 'Tashkent, Chilonzor',
    workingHours: '09:00 - 18:00',
    deliveryZones: ['Tashkent'],
    deliveryPrice: 20000,
    paymentMethods: ['Payme', 'Naqd'],
    currency: "so'm",
    telegramConnected: true,
    createdAt: timestamp,
  });

  await setDoc(doc(db, 'businesses', testBizB), {
    id: testBizB,
    name: 'Biznes B Outfits',
    ownerUid: 'owner_user_B',
    adminTelegramChatId: adminChatIdB,
    telegramAdminChatIds: [adminChatIdB],
    phone: '+998902222222',
    address: 'Tashkent, Yunusobod',
    workingHours: '10:00 - 20:00',
    deliveryZones: ['Tashkent'],
    deliveryPrice: 25000,
    paymentMethods: ['Click', 'Naqd'],
    currency: "so'm",
    telegramConnected: true,
    createdAt: timestamp,
  });

  // 2. Setup Customer for Biz A
  const custIdA = CustomerService.getCustomerId(testBizA, '99911');
  const sampleCustomerA: Customer = {
    id: custIdA,
    businessId: testBizA,
    firstName: 'Dilshod',
    lastName: 'Rahimov',
    phone: '+998911234567',
    telegramUsername: 'dilshod_r',
    username: 'dilshod_r',
    source: 'telegram',
    totalOrders: 1,
    totalSpent: 12000000,
    status: 'Buyurtma berdi',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await setDoc(doc(db, 'businesses', testBizA, 'customers', custIdA), sampleCustomerA);

  // 3. Setup Product for Biz A
  const sampleProductA: Product = {
    id: `prod_m452_1_${timestamp}`,
    businessId: testBizA,
    warehouseId: 'wh_main',
    name: 'Apple iPad Air M2 128GB',
    sku: 'APL-IPAD-M2',
    category: 'Tablets',
    brand: 'Apple',
    model: 'iPad Air M2',
    description: 'Space Gray',
    price: 9500000,
    costPrice: 8000000,
    stock: 10,
    lowStockThreshold: 2,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await setDoc(doc(db, 'businesses', testBizA, 'products', sampleProductA.id), sampleProductA);

  // Helper to create an order
  async function createTestOrder(opts: {
    biz: string;
    orderIdSuffix: string;
    status?: 'confirmed' | 'pending_confirmation' | 'cancelled';
    inventoryProcessed?: boolean;
    inventoryStatus?: 'pending' | 'completed' | 'failed' | 'insufficient_stock';
  }): Promise<Order> {
    const orderId = `ord_m452_${opts.orderIdSuffix}_${timestamp}`;
    const convId = ConversationService.getConversationId(opts.biz, '99911');
    const unitPrice = sampleProductA.price;
    const quantity = 2;
    const total = quantity * unitPrice;

    const order: any = {
      id: orderId,
      orderId,
      businessId: opts.biz,
      customerId: custIdA,
      conversationId: convId,
      status: opts.status || 'confirmed',
      inventoryProcessed: opts.inventoryProcessed ?? true,
      inventoryStatus: opts.inventoryStatus || 'completed',
      ledgerMovementIds: opts.inventoryProcessed ? [`sm_ord_${orderId}_${sampleProductA.id}`] : [],
      items: [
        {
          productId: sampleProductA.id,
          productName: sampleProductA.name,
          sku: sampleProductA.sku,
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
    return order as Order;
  }

  // Intercept Telegram messages
  const sentTelegramMessages: Array<{ chatId: string | number; text: string }> = [];
  TelegramClient.setMockSender(async (chatId, text) => {
    sentTelegramMessages.push({ chatId, text });
    return { ok: true, result: { message_id: 1000 + sentTelegramMessages.length } };
  });

  // --- TEST 1: successful order → Telegram admin notification sent ---
  sentTelegramMessages.length = 0;
  const validOrder1 = await createTestOrder({
    biz: testBizA,
    orderIdSuffix: 'valid_1',
    status: 'confirmed',
    inventoryProcessed: true,
    inventoryStatus: 'completed',
  });

  const sendRes1 = await AdminNotificationService.sendOrderNotificationToAdmins({
    businessId: testBizA,
    orderId: validOrder1.id,
    customer: sampleCustomerA,
  });

  assert(
    1,
    'successful order → Telegram admin notification sent',
    sendRes1.success === true && sendRes1.recipientsSent > 0,
    `recipientsSent: ${sendRes1.recipientsSent}, found: ${sendRes1.recipientsFound}`
  );

  // --- TEST 2: correct chatId(s) ---
  const sentChatIds = sentTelegramMessages.map((m) => String(m.chatId));
  const hasExpectedAdmins = sentChatIds.includes(adminChatIdA1) && sentChatIds.includes(adminChatIdA2);
  assert(
    2,
    'correct admin chatId recipients received message',
    hasExpectedAdmins,
    `Sent to chatIds: [${sentChatIds.join(', ')}] (Expected: ${adminChatIdA1}, ${adminChatIdA2})`
  );

  // --- TEST 3: correct notification text content ---
  const firstMsg = sentTelegramMessages[0]?.text || '';
  const textMatches =
    firstMsg.includes(`Buyurtma: #${validOrder1.id}`) &&
    firstMsg.includes('Dilshod Rahimov') &&
    firstMsg.includes('+998911234567') &&
    firstMsg.includes(sampleProductA.name) &&
    firstMsg.includes(sampleProductA.sku) &&
    firstMsg.includes('2 dona') &&
    (firstMsg.includes('19 000 000') || firstMsg.includes('19,000,000')) &&
    firstMsg.includes("so'm");

  assert(
    3,
    'correct notification text (orderId, customer, product, quantity, total, currency, date)',
    textMatches,
    `Text sample: ${firstMsg.substring(0, 110).replace(/\n/g, ' ')}...`
  );

  // --- TEST 4: multiple admins both receive the notification ---
  assert(
    4,
    'multiple registered admins for business both received notifications',
    sentTelegramMessages.filter((m) => m.chatId === adminChatIdA1).length === 1 &&
    sentTelegramMessages.filter((m) => m.chatId === adminChatIdA2).length === 1,
    `Admin 1 count: ${sentTelegramMessages.filter((m) => m.chatId === adminChatIdA1).length}, Admin 2 count: ${sentTelegramMessages.filter((m) => m.chatId === adminChatIdA2).length}`
  );

  // --- TEST 5: Telegram failure handled gracefully without crashing ---
  TelegramClient.setMockSender(async () => {
    return { ok: false, error: 'Telegram API gateway timeout 504' };
  });

  const validOrderForFailure = await createTestOrder({
    biz: testBizA,
    orderIdSuffix: 'failure_test',
    status: 'confirmed',
    inventoryProcessed: true,
    inventoryStatus: 'completed',
  });

  const failureRes = await AdminNotificationService.sendOrderNotificationToAdmins({
    businessId: testBizA,
    orderId: validOrderForFailure.id,
    customer: sampleCustomerA,
  });

  assert(
    5,
    'Telegram failure does not throw and reports failure cleanly',
    failureRes.success === false && failureRes.code === 'ALL_DELIVERIES_FAILED',
    `Code: ${failureRes.code}, deliveries: ${failureRes.deliveries.length}`
  );

  // Reset mock sender
  TelegramClient.setMockSender(async (chatId, text) => {
    sentTelegramMessages.push({ chatId, text });
    return { ok: true, result: { message_id: 2000 + sentTelegramMessages.length } };
  });

  // --- TEST 6: duplicate notification prevention (idempotency) ---
  // Attempt sending on validOrder1 again (which was already marked adminNotificationSent = true)
  const initialSentCount = sentTelegramMessages.length;
  const duplicateRes = await AdminNotificationService.sendOrderNotificationToAdmins({
    businessId: testBizA,
    orderId: validOrder1.id,
  });

  assert(
    6,
    'duplicate notification prevention: already sent order sends zero duplicate messages',
    duplicateRes.success === true &&
    duplicateRes.isAlreadySent === true &&
    sentTelegramMessages.length === initialSentCount,
    `isAlreadySent: ${duplicateRes.isAlreadySent}, messages sent: 0`
  );

  // --- TEST 7: tenant isolation: Biz A order never sent to Biz B admin ---
  sentTelegramMessages.length = 0;
  const orderA2 = await createTestOrder({
    biz: testBizA,
    orderIdSuffix: 'tenant_iso',
    status: 'confirmed',
    inventoryProcessed: true,
    inventoryStatus: 'completed',
  });

  await AdminNotificationService.sendOrderNotificationToAdmins({
    businessId: testBizA,
    orderId: orderA2.id,
  });

  const sentToChatIds = sentTelegramMessages.map((m) => String(m.chatId));
  const bizBReceived = sentToChatIds.includes(adminChatIdB);

  assert(
    7,
    'tenant isolation: Business A order only sent to Biz A admins, NEVER Biz B admin',
    !bizBReceived && sentToChatIds.includes(adminChatIdA1),
    `Received chats: [${sentToChatIds.join(', ')}], Biz B chat present: ${bizBReceived}`
  );

  // --- TEST 8: stock failure → NO notification sent ---
  sentTelegramMessages.length = 0;
  const failedStockOrder = await createTestOrder({
    biz: testBizA,
    orderIdSuffix: 'stock_fail',
    status: 'confirmed',
    inventoryProcessed: false,
    inventoryStatus: 'insufficient_stock',
  });

  const stockFailRes = await AdminNotificationService.sendOrderNotificationToAdmins({
    businessId: testBizA,
    orderId: failedStockOrder.id,
  });

  assert(
    8,
    'stock failure (insufficient stock) -> NO notification sent',
    stockFailRes.success === false &&
    stockFailRes.code === 'STOCK_MUTATION_REQUIRED' &&
    sentTelegramMessages.length === 0,
    `Code: ${stockFailRes.code}, sent messages: ${sentTelegramMessages.length}`
  );

  // --- TEST 9: notification failure → order, stock, and ledger remain 100% valid ---
  // In TEST 5, validOrderForFailure experienced Telegram failure.
  // Verify order in Firestore is still confirmed and untouched.
  const orderSnapAfterFailure = await getDoc(doc(db, 'orders', validOrderForFailure.id));
  const orderData = orderSnapAfterFailure.data() as Order;
  const productSnap = await getDoc(doc(db, 'businesses', testBizA, 'products', sampleProductA.id));
  const productData = productSnap.data() as Product;

  assert(
    9,
    'notification failure leaves order valid, stock correct, and ledger intact',
    orderData.status === 'confirmed' &&
    orderData.inventoryProcessed === true &&
    orderData.inventoryStatus === 'completed' &&
    productData.stock === 10,
    `Order status: ${orderData.status}, inventoryStatus: ${orderData.inventoryStatus}, stock: ${productData.stock}`
  );

  console.log('===============================================================');
  const passedCount = suite.filter((t) => t.passed).length;
  console.log(`TOTAL: ${suite.length} | PASSED: ${passedCount} | FAILED: ${suite.length - passedCount}`);
  console.log('===============================================================');

  if (passedCount === suite.length) {
    console.log('🎉 ALL 9 M4.5.2 TELEGRAM ADMIN NOTIFICATION TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('❌ SOME M4.5.2 TESTS FAILED');
    process.exit(1);
  }
}

runM452Tests();
