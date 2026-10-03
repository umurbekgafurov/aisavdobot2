import { UpdateProcessor } from '../server/telegram/updateProcessor';
import { IntentParser } from '../server/ai/intentParser';
import { GeminiClient } from '../server/ai/geminiClient';
import { TelegramClient } from '../server/telegram/telegramClient';
import { BusinessResolver } from '../server/telegram/businessResolver';
import { initWorkerAuth } from '../server/initWorkerAuth';
import { PendingConfirmationService } from '../server/orders/pendingConfirmationService';
import { TelegramUpdate } from '../src/types/telegram';
import { Product } from '../src/types';
import { doc, getDoc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
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
  console.log(`[M4.3.1 TEST ${num}] ${condition ? '✅ PASS' : '❌ FAIL'}: ${name}${details ? ` -> ${details}` : ''}`);
}

async function runM431Tests() {
  console.log('===============================================================');
  console.log('📦 M4.3.1 PENDING ORDER CONFIRMATION TESTS');
  console.log('(Mocked Telegram Client, Mocked Gemini, Real/Sandbox Firestore)');
  console.log('===============================================================');

  await initWorkerAuth();

  const timestamp = Date.now();
  const testBizA = `biz_m431_A_${timestamp}`;
  const testBizB = `biz_m431_B_${timestamp}`;

  // Track sent telegram messages
  const sentTelegramMessages: Array<{ chatId: string | number; text: string }> = [];

  TelegramClient.setMockSender(async (chatId, text) => {
    sentTelegramMessages.push({ chatId, text });
    return {
      ok: true,
      result: {
        message_id: Math.floor(Math.random() * 900000) + 100000,
        chat: { id: chatId },
        text,
      },
    };
  });

  // Seed sample products
  const productA1: Product = {
    id: `prod_m431_1_${timestamp}`,
    businessId: testBizA,
    warehouseId: 'wh_main',
    name: 'iPhone 15 Pro 256GB',
    sku: 'IPH-15P-256',
    category: 'Smartphones',
    brand: 'Apple',
    model: '15 Pro',
    description: 'Titanium 256GB',
    price: 13000000,
    costPrice: 11000000,
    stock: 7,
    lowStockThreshold: 2,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const productA_LowStock: Product = {
    id: `prod_m431_low_${timestamp}`,
    businessId: testBizA,
    warehouseId: 'wh_main',
    name: 'AirPods Pro 2',
    sku: 'APP-2',
    category: 'Audio',
    brand: 'Apple',
    model: 'Pro 2',
    description: 'Wireless earbuds',
    price: 2500000,
    costPrice: 2000000,
    stock: 1, // Only 1 left
    lowStockThreshold: 2,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const productA_NoPrice: Product = {
    id: `prod_m431_noprice_${timestamp}`,
    businessId: testBizA,
    warehouseId: 'wh_main',
    name: 'Special Edition Gift Box',
    sku: 'BOX-SP',
    category: 'Gifts',
    brand: 'Custom',
    model: 'Box',
    description: 'Gift box unpriced',
    price: 0, // Missing or unpriced
    costPrice: 0,
    stock: 10,
    lowStockThreshold: 1,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const productB1: Product = {
    id: `prod_m431_b1_${timestamp}`,
    businessId: testBizB,
    warehouseId: 'wh_b',
    name: 'iPhone 15 Pro 256GB',
    sku: 'IPH-15P-256',
    category: 'Smartphones',
    brand: 'Apple',
    model: '15 Pro',
    description: 'Biz B item',
    price: 14500000,
    costPrice: 12000000,
    stock: 12,
    lowStockThreshold: 2,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  // Save products in Firestore
  await setDoc(doc(db, 'businesses', testBizA, 'products', productA1.id), productA1);
  await setDoc(doc(db, 'businesses', testBizA, 'products', productA_LowStock.id), productA_LowStock);
  await setDoc(doc(db, 'businesses', testBizA, 'products', productA_NoPrice.id), productA_NoPrice);
  await setDoc(doc(db, 'businesses', testBizB, 'products', productB1.id), productB1);

  // Set initial business
  BusinessResolver.setExplicitBusiness(testBizA);

  // Configure Mock Gemini IntentParser
  const mockGemini = new GeminiClient({ apiKey: 'mock' });
  const parser = new IntentParser(mockGemini);
  UpdateProcessor.setIntentParser(parser);

  // Initial order count for testBizA
  const ordersSnapBefore = await getDocs(
    query(collection(db, 'orders'), where('businessId', '==', testBizA))
  );
  const orderCountBefore = ordersSnapBefore.size;

  // 1. Valid order intent -> Pending confirmation created
  const updateId1 = timestamp + 1;
  (mockGemini as any).generateText = async () => ({
    success: true,
    text: JSON.stringify({
      intent: 'order_intent',
      product_name: 'iPhone 15 Pro 256GB',
      quantity: 2,
      confidence: 0.98,
      language: 'uz',
    }),
  });

  const update1: TelegramUpdate = {
    update_id: updateId1,
    message: {
      message_id: 101,
      from: { id: 7001, is_bot: false, first_name: 'Alisher', username: 'alisher_uz' },
      chat: { id: 7001, type: 'private' },
      date: Math.floor(timestamp / 1000),
      text: '2 ta iPhone 15 Pro 256GB olaman',
    },
  };

  const res1 = await UpdateProcessor.processUpdate(update1);

  assert(1, 'Valid order intent creates pending confirmation', res1.pendingConfirmation !== undefined && res1.pendingConfirmation.status === 'pending_confirmation', `Status: ${res1.pendingConfirmation?.status}`);

  // 2. Correct productId
  assert(2, 'Correct productId stored', res1.pendingConfirmation?.productId === productA1.id, `Product ID: ${res1.pendingConfirmation?.productId}`);

  // 3. Correct quantity
  assert(3, 'Correct quantity stored', res1.pendingConfirmation?.quantity === 2, `Quantity: ${res1.pendingConfirmation?.quantity}`);

  // 4. Correct unitPrice
  assert(4, 'Correct unitPrice stored', res1.pendingConfirmation?.unitPrice === 13000000, `UnitPrice: ${res1.pendingConfirmation?.unitPrice}`);

  // 5. Correct subtotal (2 * 13,000,000 = 26,000,000)
  assert(5, 'Correct subtotal calculated by backend', res1.pendingConfirmation?.subtotal === 26000000, `Subtotal: ${res1.pendingConfirmation?.subtotal}`);

  // 6. Correct businessId
  assert(6, 'Correct businessId stored', res1.pendingConfirmation?.businessId === testBizA, `BizId: ${res1.pendingConfirmation?.businessId}`);

  // 7. Correct customerId
  assert(7, 'Correct customerId stored', res1.pendingConfirmation?.customerId === res1.customerId, `CustomerId: ${res1.pendingConfirmation?.customerId}`);

  // 8. Correct conversationId
  assert(8, 'Correct conversationId stored', res1.pendingConfirmation?.conversationId === res1.conversationId, `ConvId: ${res1.pendingConfirmation?.conversationId}`);

  // 9. 15-minute expiration
  const lifespan = (res1.pendingConfirmation?.expiresAt || 0) - (res1.pendingConfirmation?.createdAt || 0);
  const is15Min = lifespan === 15 * 60 * 1000;
  
  // Test expiration retrieval behavior
  const retrievedPending = await PendingConfirmationService.getPendingConfirmation(
    testBizA,
    res1.customerId!,
    res1.conversationId!
  );
  assert(9, '15-minute expiration duration and retrieval verified', is15Min && retrievedPending !== null, `Duration: ${lifespan}ms (expected 900000ms)`);

  // 10. Product not found -> No pending confirmation
  const updateId2 = timestamp + 2;
  (mockGemini as any).generateText = async () => ({
    success: true,
    text: JSON.stringify({
      intent: 'order_intent',
      product_name: 'NonExistentGizmo 999',
      quantity: 1,
      confidence: 0.95,
      language: 'uz',
    }),
  });

  const update2: TelegramUpdate = {
    update_id: updateId2,
    message: {
      message_id: 102,
      from: { id: 7002, is_bot: false, first_name: 'Botir' },
      chat: { id: 7002, type: 'private' },
      date: Math.floor(timestamp / 1000),
      text: 'NonExistentGizmo 999 olaman',
    },
  };

  const res2 = await UpdateProcessor.processUpdate(update2);
  assert(10, 'Product not found -> no pending confirmation created', res2.pendingConfirmation === undefined, `Pending: ${res2.pendingConfirmation}`);

  // 11. Insufficient stock -> No pending confirmation
  // Requested 3, but stock is only 1
  const updateId3 = timestamp + 3;
  (mockGemini as any).generateText = async () => ({
    success: true,
    text: JSON.stringify({
      intent: 'order_intent',
      product_name: 'AirPods Pro 2',
      quantity: 3,
      confidence: 0.96,
      language: 'uz',
    }),
  });

  const update3: TelegramUpdate = {
    update_id: updateId3,
    message: {
      message_id: 103,
      from: { id: 7003, is_bot: false, first_name: 'Jamshid' },
      chat: { id: 7003, type: 'private' },
      date: Math.floor(timestamp / 1000),
      text: '3 ta AirPods Pro 2 olmoqchiman',
    },
  };

  const res3 = await UpdateProcessor.processUpdate(update3);
  assert(11, 'Insufficient stock -> no pending confirmation created', res3.pendingConfirmation === undefined, `Reply: ${res3.aiResponseText}`);

  // 12. Missing price -> No pending confirmation
  const updateId4 = timestamp + 4;
  (mockGemini as any).generateText = async () => ({
    success: true,
    text: JSON.stringify({
      intent: 'order_intent',
      product_name: 'Special Edition Gift Box',
      quantity: 1,
      confidence: 0.96,
      language: 'uz',
    }),
  });

  const update4: TelegramUpdate = {
    update_id: updateId4,
    message: {
      message_id: 104,
      from: { id: 7004, is_bot: false, first_name: 'Dilshod' },
      chat: { id: 7004, type: 'private' },
      date: Math.floor(timestamp / 1000),
      text: 'Gift Box buyurtma qilmoqchiman',
    },
  };

  const res4 = await UpdateProcessor.processUpdate(update4);
  assert(12, 'Missing price -> no pending confirmation created', res4.pendingConfirmation === undefined, `Reply: ${res4.aiResponseText}`);

  // 13. Duplicate Telegram update -> only one pending confirmation
  // Re-send update 1
  const resDuplicate = await UpdateProcessor.processUpdate(update1);
  assert(13, 'Duplicate Telegram update -> only one pending confirmation', resDuplicate.isDuplicate === true && resDuplicate.pendingConfirmation === undefined, `isDuplicate: ${resDuplicate.isDuplicate}`);

  // 14. Tenant isolation: Biz B customer creates confirmation; Biz A cannot see it
  const updateIdB = timestamp + 5;
  BusinessResolver.setExplicitBusiness(testBizB);
  (mockGemini as any).generateText = async () => ({
    success: true,
    text: JSON.stringify({
      intent: 'order_intent',
      product_name: 'iPhone 15 Pro 256GB',
      quantity: 1,
      confidence: 0.97,
      language: 'uz',
    }),
  });

  const updateB: TelegramUpdate = {
    update_id: updateIdB,
    message: {
      message_id: 105,
      from: { id: 7005, is_bot: false, first_name: 'Sardor' },
      chat: { id: 7005, type: 'private' },
      date: Math.floor(timestamp / 1000),
      text: 'iPhone 15 Pro 256GB olaman',
    },
  };

  const resB = await UpdateProcessor.processUpdate(updateB);

  // Verify Biz B received its own pending confirmation with Biz B's unit price (14,500,000)
  const isBizBPending =
    resB.pendingConfirmation?.businessId === testBizB &&
    resB.pendingConfirmation?.unitPrice === 14500000;

  // And cross-tenant read from Biz A for Biz B's confirmation fails / returns null
  const crossTenantRead = await PendingConfirmationService.getPendingConfirmation(
    testBizA,
    resB.customerId!,
    resB.conversationId!
  );

  assert(14, 'Tenant isolation strictly enforced between businesses', isBizBPending && crossTenantRead === null, `Biz B price: ${resB.pendingConfirmation?.unitPrice}, Cross-tenant read: ${crossTenantRead}`);

  // 15. No final order created in Firestore
  const ordersSnapAfter = await getDocs(
    query(collection(db, 'orders'), where('businessId', '==', testBizA))
  );
  const orderCountAfter = ordersSnapAfter.size;
  assert(15, 'No final order created in orders collection', orderCountAfter === orderCountBefore, `Order count before: ${orderCountBefore}, after: ${orderCountAfter}`);

  // 16. No stock mutation
  const prod1SnapAfter = await getDoc(doc(db, 'businesses', testBizA, 'products', productA1.id));
  const stockAfter = prod1SnapAfter.data()?.stock;
  assert(16, 'No stock mutation in products collection', stockAfter === productA1.stock, `Stock before: ${productA1.stock}, after: ${stockAfter}`);

  console.log('===============================================================');
  const passedCount = suite.filter((t) => t.passed).length;
  console.log(`TOTAL: ${suite.length} | PASSED: ${passedCount} | FAILED: ${suite.length - passedCount}`);
  console.log('===============================================================');

  if (passedCount === suite.length) {
    console.log('🎉 ALL 16 M4.3.1 PENDING CONFIRMATION TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('❌ SOME M4.3.1 TESTS FAILED');
    process.exit(1);
  }
}

runM431Tests();
