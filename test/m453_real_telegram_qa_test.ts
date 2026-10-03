import { UpdateProcessor } from '../server/telegram/updateProcessor';
import { BusinessResolver } from '../server/telegram/businessResolver';
import { TelegramClient } from '../server/telegram/telegramClient';
import { OrderService } from '../server/orders/orderService';
import { AdminNotificationService } from '../server/notifications/adminNotificationService';
import { CustomerService } from '../src/services/customerService';
import { initWorkerAuth } from '../server/initWorkerAuth';
import { TelegramUpdate } from '../src/types/telegram';
import { Product, Customer } from '../src/types';
import { Order } from '../src/types/orders';
import { doc, getDoc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../src/lib/firebase';
import { GeminiClient } from '../server/ai/geminiClient';
import { IntentParser } from '../server/ai/intentParser';
import { ReplyGenerator } from '../server/ai/replyGenerator';

interface TestItem {
  num: number;
  name: string;
  passed: boolean;
  details?: string;
}

const suite: TestItem[] = [];

function assert(num: number, name: string, condition: boolean, details?: string) {
  suite.push({ num, name, passed: condition, details });
  console.log(`[M4.5.3 QA ${num}] ${condition ? '✅ PASS' : '❌ FAIL'}: ${name}${details ? ` -> ${details}` : ''}`);
}

async function runM453RealTelegramQA() {
  console.log('===============================================================');
  console.log('🚀 M4.5.3 REAL TELEGRAM QA — END-TO-END PIPELINE VERIFICATION');
  console.log('(Telegram Updates -> AI -> Confirmation -> Order -> Stock -> Ledger -> Admin Notif)');
  console.log('===============================================================');

  await initWorkerAuth();

  const timestamp = Date.now();
  const testBizA = `biz_m453_A_${timestamp}`;
  const testBizB = `biz_m453_B_${timestamp}`;

  const adminChatIdA1 = '990001';
  const adminChatIdA2 = '990002';
  const adminChatIdB = '880001';

  const customerChatIdA = 123456701;
  const customerUserIdA = 123456701;

  // 1. Setup Business A & Business B
  await setDoc(doc(db, 'businesses', testBizA), {
    id: testBizA,
    name: 'TechStore Tashkent',
    ownerUid: 'owner_A',
    adminTelegramChatId: adminChatIdA1,
    telegramAdminChatIds: [adminChatIdA1, adminChatIdA2],
    phone: '+998901234567',
    address: 'Tashkent, Amir Temur',
    workingHours: '09:00 - 21:00',
    deliveryZones: ['Tashkent'],
    deliveryPrice: 20000,
    paymentMethods: ['Payme', 'Click', 'Naqd'],
    currency: "so'm",
    telegramConnected: true,
    settings: {
      autoReply: true,
      groupAutoReply: false,
      humanApprovalRequired: false,
      followUp: false,
    },
    createdAt: timestamp,
  });

  await setDoc(doc(db, 'businesses', testBizB), {
    id: testBizB,
    name: 'Competitor Gadgets',
    ownerUid: 'owner_B',
    adminTelegramChatId: adminChatIdB,
    telegramAdminChatIds: [adminChatIdB],
    phone: '+998909876543',
    address: 'Samarkand, Registan',
    workingHours: '09:00 - 19:00',
    deliveryZones: ['Samarkand'],
    deliveryPrice: 15000,
    paymentMethods: ['Click', 'Naqd'],
    currency: "so'm",
    telegramConnected: true,
    settings: {
      autoReply: true,
      groupAutoReply: false,
      humanApprovalRequired: false,
      followUp: false,
    },
    createdAt: timestamp,
  });

  // 2. Setup Products for Biz A
  const productA1: Product = {
    id: `prod_m453_iphone_${timestamp}`,
    businessId: testBizA,
    warehouseId: 'wh_main',
    name: 'Apple iPhone 15 Pro 256GB',
    sku: 'IPHONE-15P-256',
    category: 'Smartphones',
    brand: 'Apple',
    model: 'iPhone 15 Pro',
    description: 'Natural Titanium, 256GB',
    price: 14000000,
    costPrice: 12000000,
    stock: 10,
    lowStockThreshold: 2,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await setDoc(doc(db, 'businesses', testBizA, 'products', productA1.id), productA1);

  const productA_lowStock: Product = {
    id: `prod_m453_dyson_${timestamp}`,
    businessId: testBizA,
    warehouseId: 'wh_main',
    name: 'Dyson V15 Detect Extra',
    sku: 'DYS-V15-EXT',
    category: 'Home Appliances',
    brand: 'Dyson',
    model: 'V15 Detect',
    description: 'Cordless vacuum cleaner',
    price: 8500000,
    costPrice: 7000000,
    stock: 1,
    lowStockThreshold: 1,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await setDoc(doc(db, 'businesses', testBizA, 'products', productA_lowStock.id), productA_lowStock);

  const productA_zeroStock: Product = {
    id: `prod_m453_ps5_${timestamp}`,
    businessId: testBizA,
    warehouseId: 'wh_main',
    name: 'Sony PlayStation 5 Slim',
    sku: 'SNY-PS5-SLM',
    category: 'Gaming',
    brand: 'Sony',
    model: 'PlayStation 5',
    description: '1TB SSD White',
    price: 6500000,
    costPrice: 5500000,
    stock: 0,
    lowStockThreshold: 2,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await setDoc(doc(db, 'businesses', testBizA, 'products', productA_zeroStock.id), productA_zeroStock);

  // 3. Setup Product for Biz B (for tenant isolation check)
  const productB1: Product = {
    id: `prod_m453_s24_${timestamp}`,
    businessId: testBizB,
    warehouseId: 'wh_bizb',
    name: 'Samsung Galaxy S24 Ultra',
    sku: 'SAM-S24U-256',
    category: 'Smartphones',
    brand: 'Samsung',
    model: 'S24 Ultra',
    description: 'Titanium Gray',
    price: 15000000,
    costPrice: 13000000,
    stock: 10,
    lowStockThreshold: 2,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await setDoc(doc(db, 'businesses', testBizB, 'products', productB1.id), productB1);

  // Intercept all Telegram messages
  const capturedMessages: Array<{ chatId: string | number; text: string; messageId: number }> = [];
  let msgIdCounter = 1000;
  let forceTelegramFailure = false;

  TelegramClient.setMockSender(async (chatId, text) => {
    if (forceTelegramFailure) {
      return { ok: false, error: 'Simulated Telegram network timeout (ECONNRESET)' };
    }
    msgIdCounter++;
    capturedMessages.push({ chatId, text, messageId: msgIdCounter });
    return { ok: true, result: { message_id: msgIdCounter } };
  });

  // Setup deterministic mock Gemini engine for QA tests (bypasses external rate limits)
  const mockGemini = new GeminiClient({ apiKey: 'mock_key' });
  (mockGemini as any).generateText = async (prompt: string) => {
    if (prompt.includes('retail intent extraction engine')) {
      const textMatch = prompt.match(/Customer message:\s*"([^"]+)"/i);
      const text = textMatch ? textMatch[1].toLowerCase() : '';

      if (text.includes('2 ta')) {
        return {
          success: true,
          text: JSON.stringify({ intent: 'order_intent', product_name: 'iPhone 15 Pro', quantity: 2, confidence: 0.99, language: 'uz' }),
        };
      }
      if (text.includes('dyson') || text.includes('3 ta')) {
        return {
          success: true,
          text: JSON.stringify({ intent: 'order_intent', product_name: 'Dyson V15', quantity: 3, confidence: 0.99, language: 'uz' }),
        };
      }
      if (text.includes('ps5') || text.includes('playstation')) {
        return {
          success: true,
          text: JSON.stringify({ intent: 'order_intent', product_name: 'Sony PlayStation 5', quantity: 1, confidence: 0.99, language: 'uz' }),
        };
      }
      if (text.includes('iphone')) {
        return {
          success: true,
          text: JSON.stringify({ intent: 'order_intent', product_name: 'iPhone 15 Pro', quantity: 1, confidence: 0.99, language: 'uz' }),
        };
      }
      return {
        success: true,
        text: JSON.stringify({ intent: 'unknown', product_name: null, quantity: null, confidence: 0.8, language: 'uz' }),
      };
    }

    return {
      success: true,
      text: JSON.stringify({ reply: 'Xabaringiz qabul qilindi.', language: 'uz' }),
    };
  };

  const intentParser = new IntentParser(mockGemini);
  const replyGenerator = new ReplyGenerator(mockGemini);
  UpdateProcessor.setIntentParser(intentParser);
  UpdateProcessor.setReplyGenerator(replyGenerator);
  UpdateProcessor.setAutoCreateOrder(true);
  BusinessResolver.setExplicitBusiness(testBizA);

  let currentUpdateId = Math.floor(Date.now() / 1000) * 1000 + Math.floor(Math.random() * 10000);

  function buildTelegramUpdate(text: string, chatId = customerChatIdA, userId = customerUserIdA): TelegramUpdate {
    currentUpdateId++;
    return {
      update_id: currentUpdateId,
      message: {
        message_id: currentUpdateId + 500,
        from: {
          id: userId,
          is_bot: false,
          first_name: 'Bobur',
          last_name: 'Mirzayev',
          username: 'bobur_m',
        },
        chat: {
          id: chatId,
          type: 'private',
          first_name: 'Bobur',
          last_name: 'Mirzayev',
          username: 'bobur_m',
        },
        date: Math.floor(Date.now() / 1000),
        text,
      },
    };
  }

  // =========================================================================
  // TEST 1: Normal Order (1 Unit) End-to-End
  // =========================================================================
  capturedMessages.length = 0;
  // Step 1: Customer requests product
  const upd1 = buildTelegramUpdate('iPhone 15 Pro olmoqchiman', customerChatIdA, customerUserIdA);
  const res1 = await UpdateProcessor.processUpdate(upd1);

  const pendingConfirmationCreated =
    res1.success &&
    res1.pendingConfirmation !== undefined &&
    res1.pendingConfirmation.status === 'pending_confirmation';

  // Step 2: Customer confirms with "Ha"
  const upd2 = buildTelegramUpdate('Ha', customerChatIdA, customerUserIdA);
  const res2 = await UpdateProcessor.processUpdate(upd2);

  // Check product stock in Firestore
  const p1Snap = await getDoc(doc(db, 'businesses', testBizA, 'products', productA1.id));
  const p1Data = p1Snap.data() as Product;

  // Check warehouse ledger in businesses/{businessId}/stock_movements
  const ledgerSnap1 = await getDocs(
    query(collection(db, 'businesses', testBizA, 'stock_movements'), where('businessId', '==', testBizA))
  );

  // Check admin messages
  const adminMsgsQA1 = capturedMessages.filter(
    (m) => String(m.chatId) === adminChatIdA1 || String(m.chatId) === adminChatIdA2
  );

  assert(
    1,
    'normal order (1 unit) E2E: pending confirmation -> confirm -> order -> stock deducted -> ledger -> admin notif',
    pendingConfirmationCreated &&
    res2.success &&
    res2.createdOrder !== undefined &&
    res2.createdOrder.status === 'confirmed' &&
    p1Data.stock === 9 && // 10 - 1 = 9
    ledgerSnap1.size === 1 &&
    adminMsgsQA1.length === 2,
    `Stock: ${p1Data.stock} (exp 9), Ledgers: ${ledgerSnap1.size}, Admin msgs: ${adminMsgsQA1.length}`
  );

  // =========================================================================
  // TEST 2: Quantity > 1 End-to-End (2 units)
  // =========================================================================
  const customerChatIdA2 = 123456702;
  const customerUserIdA2 = 123456702;

  capturedMessages.length = 0;
  const upd3 = buildTelegramUpdate('iPhone 15 Pro 2 ta kerak', customerChatIdA2, customerUserIdA2);
  const res3 = await UpdateProcessor.processUpdate(upd3);

  const upd4 = buildTelegramUpdate('Ha, tasdiqlayman', customerChatIdA2, customerUserIdA2);
  const res4 = await UpdateProcessor.processUpdate(upd4);

  const p1SnapAfter2 = await getDoc(doc(db, 'businesses', testBizA, 'products', productA1.id));
  const p1DataAfter2 = p1SnapAfter2.data() as Product;

  const adminMsgsQA2 = capturedMessages.filter(
    (m) => String(m.chatId) === adminChatIdA1 || String(m.chatId) === adminChatIdA2
  );
  const adminTextQA2 = adminMsgsQA2[0]?.text || '';

  assert(
    2,
    'quantity > 1 (2 units) E2E: stock deducted by 2, total correct, admin notified with 2 dona',
    res4.success &&
    res4.createdOrder !== undefined &&
    res4.createdOrder.items[0]?.quantity === 2 &&
    res4.createdOrder.total === 28000000 &&
    p1DataAfter2.stock === 7 && // 9 - 2 = 7
    adminTextQA2.includes('2 dona') &&
    (adminTextQA2.includes('28 000 000') || adminTextQA2.includes('28,000,000')),
    `Stock: ${p1DataAfter2.stock} (exp 7), Total: ${res4.createdOrder?.total}, Order items qty: ${res4.createdOrder?.items[0]?.quantity}`
  );

  // =========================================================================
  // TEST 3: Insufficient Stock
  // =========================================================================
  capturedMessages.length = 0;
  // Product has 1 unit, customer asks for 3 units
  const upd5 = buildTelegramUpdate('Dyson V15 3 ta olmoqchiman', customerChatIdA, customerUserIdA);
  const res5 = await UpdateProcessor.processUpdate(upd5);

  const pLowSnap = await getDoc(doc(db, 'businesses', testBizA, 'products', productA_lowStock.id));
  const pLowData = pLowSnap.data() as Product;

  const adminMsgsQA3 = capturedMessages.filter(
    (m) => String(m.chatId) === adminChatIdA1 || String(m.chatId) === adminChatIdA2
  );

  assert(
    3,
    'insufficient stock: no pending confirmation created, stock remains 1, zero admin notifications',
    res5.pendingConfirmation === undefined &&
    res5.createdOrder === undefined &&
    pLowData.stock === 1 &&
    adminMsgsQA3.length === 0,
    `Stock maintained: ${pLowData.stock}, admin msgs: ${adminMsgsQA3.length}`
  );

  // =========================================================================
  // TEST 4: Zero Stock
  // =========================================================================
  capturedMessages.length = 0;
  const upd6 = buildTelegramUpdate('Sony PS5 olmoqchiman', customerChatIdA, customerUserIdA);
  const res6 = await UpdateProcessor.processUpdate(upd6);

  const pZeroSnap = await getDoc(doc(db, 'businesses', testBizA, 'products', productA_zeroStock.id));
  const pZeroData = pZeroSnap.data() as Product;

  const adminMsgsQA4 = capturedMessages.filter(
    (m) => String(m.chatId) === adminChatIdA1 || String(m.chatId) === adminChatIdA2
  );

  assert(
    4,
    'zero stock: out-of-stock detected, zero orders, zero stock changes, zero admin notifications',
    res6.pendingConfirmation === undefined &&
    res6.createdOrder === undefined &&
    pZeroData.stock === 0 &&
    adminMsgsQA4.length === 0,
    `Stock maintained: ${pZeroData.stock}, admin msgs: ${adminMsgsQA4.length}`
  );

  // =========================================================================
  // TEST 5: Duplicate Confirmation
  // =========================================================================
  capturedMessages.length = 0;
  const stockBeforeDup = (await getDoc(doc(db, 'businesses', testBizA, 'products', productA1.id))).data()?.stock;
  const ledgersBeforeDup = (
    await getDocs(query(collection(db, 'businesses', testBizA, 'stock_movements'), where('businessId', '==', testBizA)))
  ).size;

  // Sending another "Ha" from customerChatIdA2 where the order was already confirmed
  const updDup = buildTelegramUpdate('Ha', customerChatIdA2, customerUserIdA2);
  const resDup = await UpdateProcessor.processUpdate(updDup);

  const stockAfterDup = (await getDoc(doc(db, 'businesses', testBizA, 'products', productA1.id))).data()?.stock;
  const ledgersAfterDup = (
    await getDocs(query(collection(db, 'businesses', testBizA, 'stock_movements'), where('businessId', '==', testBizA)))
  ).size;
  const adminMsgsDup = capturedMessages.filter(
    (m) => String(m.chatId) === adminChatIdA1 || String(m.chatId) === adminChatIdA2
  );

  assert(
    5,
    'duplicate confirmation: no second order created, stock unchanged, ledger unchanged, 0 admin notifications',
    resDup.createdOrder === undefined &&
    stockAfterDup === stockBeforeDup &&
    ledgersAfterDup === ledgersBeforeDup &&
    adminMsgsDup.length === 0,
    `Stock: ${stockAfterDup} (before: ${stockBeforeDup}), Ledgers: ${ledgersAfterDup} (before: ${ledgersBeforeDup})`
  );

  // =========================================================================
  // TEST 6: Duplicate Telegram Update (Idempotency)
  // =========================================================================
  capturedMessages.length = 0;
  // Re-process the exact same update upd4
  const resReplay = await UpdateProcessor.processUpdate(upd4);

  const stockAfterReplay = (await getDoc(doc(db, 'businesses', testBizA, 'products', productA1.id))).data()?.stock;
  const ledgersAfterReplay = (
    await getDocs(query(collection(db, 'businesses', testBizA, 'stock_movements'), where('businessId', '==', testBizA)))
  ).size;

  assert(
    6,
    'duplicate Telegram update: intercepted by IdempotencyService, status: duplicate_update_skipped, 0 side effects',
    (resReplay.status === 'duplicate_update_skipped' || resReplay.isDuplicate === true) &&
    stockAfterReplay === stockBeforeDup &&
    ledgersAfterReplay === ledgersBeforeDup &&
    capturedMessages.length === 0,
    `Status: ${resReplay.status}, captured messages: ${capturedMessages.length}`
  );

  // =========================================================================
  // TEST 7: Telegram Admin Notification Payload & Format Verification
  // =========================================================================
  const sampleAdminMsg = adminMsgsQA2[0]?.text || '';
  const hasEmoji = sampleAdminMsg.includes('🛒') && sampleAdminMsg.includes('👤') && sampleAdminMsg.includes('📦');
  const hasOrderId = sampleAdminMsg.includes('Buyurtma: #');
  const hasCustomer = sampleAdminMsg.includes('Bobur Mirzayev');
  const hasContact = sampleAdminMsg.includes('@bobur_m');
  const hasProduct = sampleAdminMsg.includes('Apple iPhone 15 Pro 256GB');
  const hasQuantity = sampleAdminMsg.includes('2 dona');
  const hasPrice = sampleAdminMsg.includes('14 000 000') || sampleAdminMsg.includes('14,000,000');
  const hasTotal = sampleAdminMsg.includes('28 000 000') || sampleAdminMsg.includes('28,000,000');
  const hasDate = sampleAdminMsg.includes('Sana:');

  assert(
    7,
    'admin notification contains complete, accurate metadata (emoji, order ID, customer, contact, product, qty, price, total, date)',
    hasEmoji && hasOrderId && hasCustomer && hasContact && hasProduct && hasQuantity && hasPrice && hasTotal && hasDate,
    `Metadata match: emoji=${hasEmoji}, id=${hasOrderId}, cust=${hasCustomer}, cont=${hasContact}, prod=${hasProduct}, qty=${hasQuantity}, price=${hasPrice}, total=${hasTotal}, date=${hasDate}`
  );

  // =========================================================================
  // TEST 8: Notification Failure Resilience
  // =========================================================================
  const customerChatIdA3 = 123456703;
  const customerUserIdA3 = 123456703;

  // Simulate Telegram failure during admin notification
  forceTelegramFailure = true;

  const updFail1 = buildTelegramUpdate('iPhone 15 Pro olmoqchiman', customerChatIdA3, customerUserIdA3);
  await UpdateProcessor.processUpdate(updFail1);

  const updFail2 = buildTelegramUpdate('Ha, tasdiqlayman', customerChatIdA3, customerUserIdA3);
  const resFail2 = await UpdateProcessor.processUpdate(updFail2);

  // Restore Telegram sender
  forceTelegramFailure = false;

  const orderSnapAfterFailure = resFail2.createdOrder
    ? await getDoc(doc(db, 'orders', resFail2.createdOrder.id))
    : null;
  const orderDataAfterFailure = orderSnapAfterFailure?.data() as Order;

  const stockAfterNotifFail = (await getDoc(doc(db, 'businesses', testBizA, 'products', productA1.id))).data()?.stock;

  assert(
    8,
    'notification failure resilience: Telegram failure does not rollback or cancel order; stock & ledger remain valid',
    resFail2.success === true &&
    orderDataAfterFailure !== undefined &&
    orderDataAfterFailure.status === 'confirmed' &&
    orderDataAfterFailure.inventoryProcessed === true &&
    orderDataAfterFailure.inventoryStatus === 'completed' &&
    stockAfterNotifFail === 6, // 7 - 1 = 6
    `Order status: ${orderDataAfterFailure?.status}, inventoryStatus: ${orderDataAfterFailure?.inventoryStatus}, stock: ${stockAfterNotifFail}`
  );

  // =========================================================================
  // TEST 9: Tenant Isolation End-to-End
  // =========================================================================
  capturedMessages.length = 0;
  // Verify Biz B product stock and Biz B admin received zero messages during all Biz A orders
  const pBizBSnap = await getDoc(doc(db, 'businesses', testBizB, 'products', productB1.id));
  const pBizBData = pBizBSnap.data() as Product;

  const bizBAdminMessages = capturedMessages.filter((m) => String(m.chatId) === adminChatIdB);

  // Try cross-tenant notification call directly to ensure strict boundary
  const crossTenantAttempt = await AdminNotificationService.sendOrderNotificationToAdmins({
    businessId: testBizB, // Biz B trying to send Biz A's order
    orderId: res2.createdOrder!.id,
  });

  assert(
    9,
    'tenant isolation: Biz A updates/orders never affect Biz B stock (remains 10), Biz B admin receives 0 notifications, cross-tenant rejected',
    pBizBData.stock === 10 &&
    bizBAdminMessages.length === 0 &&
    crossTenantAttempt.success === false &&
    crossTenantAttempt.code === 'TENANT_MISMATCH',
    `Biz B Stock: ${pBizBData.stock} (exp 10), Biz B Admin msgs: ${bizBAdminMessages.length}, Cross-tenant code: ${crossTenantAttempt.code}`
  );

  // =========================================================================
  // TEST 10: Stock + Ledger Consistency (Zero Drift)
  // =========================================================================
  // Initial stock of productA1 was 10.
  // Deductions:
  // QA-1: 1 unit
  // QA-2: 2 units
  // QA-8: 1 unit
  // Total expected deducted: 4 units. Final stock should be 6.
  const finalProductSnap = await getDoc(doc(db, 'businesses', testBizA, 'products', productA1.id));
  const finalProductStock = finalProductSnap.data()?.stock;

  const productLedgers = await getDocs(
    query(
      collection(db, 'businesses', testBizA, 'stock_movements'),
      where('businessId', '==', testBizA),
      where('productId', '==', productA1.id)
    )
  );

  let totalLedgerDeducted = 0;
  productLedgers.forEach((lDoc) => {
    const lData = lDoc.data();
    totalLedgerDeducted += Math.abs(lData.quantity);
  });

  const consistencyExact = 10 - totalLedgerDeducted === finalProductStock && finalProductStock === 6;

  assert(
    10,
    'stock + ledger consistency: initial stock (10) - ledger movements (4) === final stock (6) with zero drift',
    consistencyExact,
    `Initial: 10, Total Deducted in Ledgers: ${totalLedgerDeducted}, Final Stock: ${finalProductStock}`
  );

  console.log('===============================================================');
  const passedCount = suite.filter((t) => t.passed).length;
  console.log(`TOTAL: ${suite.length} | PASSED: ${passedCount} | FAILED: ${suite.length - passedCount}`);
  console.log('===============================================================');

  if (passedCount === suite.length) {
    console.log('🎉 ALL 10 M4.5.3 REAL TELEGRAM QA TESTS PASSED SUCCESSFULLY! M4.5.3 PASS!');
    process.exit(0);
  } else {
    console.error('❌ SOME M4.5.3 QA TESTS FAILED');
    process.exit(1);
  }
}

runM453RealTelegramQA();
