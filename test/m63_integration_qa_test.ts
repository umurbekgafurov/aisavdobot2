import { CustomerSalesSignalsService } from '../server/analytics/customerSalesSignals';
import { CustomerIntentScoreService } from '../server/analytics/customerIntentScore';
import { Customer, ConversationMessage } from '../src/types';
import { Order } from '../src/types/orders';
import { CustomerIntentScore } from '../src/types/intentScore';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    failCount++;
    throw new Error(`Assertion failed: ${msg}`);
  } else {
    console.log(`✅ PASS: ${msg}`);
    passCount++;
  }
}

async function runM63IntegrationQATests() {
  console.log('===================================================================================================');
  console.log('🚀 M6.3 PART 3 — INTEGRATION & REGRESSION QA VERIFICATION');
  console.log('===================================================================================================');

  const now = Date.now();
  const bizA = 'biz_corp_a';
  const bizB = 'biz_corp_b';
  const custA = 'cust_user_a';
  const custB = 'cust_user_b';

  // 1. Raw Customer objects for Tenant A and Tenant B
  const customerA: Customer = {
    id: custA,
    businessId: bizA,
    firstName: 'Aziz',
    lastName: 'Karimov',
    status: 'Faol',
    source: 'telegram',
    totalOrders: 2,
    totalSpent: 15000000,
    createdAt: now - 100000,
    lastInteraction: now - 5000,
  };

  const customerB: Customer = {
    id: custB,
    businessId: bizB,
    firstName: 'Bobur',
    lastName: 'Toshmatov',
    status: 'Yangi',
    source: 'telegram',
    totalOrders: 0,
    totalSpent: 0,
    createdAt: now - 200000,
    lastInteraction: now - 100000,
  };

  // Orders for Tenant A Customer: 1 active, 1 completed
  const orderA1: Order = {
    id: 'ord_a1',
    businessId: bizA,
    customerId: custA,
    status: 'confirmed',
    subtotal: 9000000,
    total: 9000000,
    createdAt: now - 20000,
    updatedAt: now - 20000,
    items: [{ productId: 'p1', productName: 'iPhone 15', quantity: 1, unitPrice: 9000000 }],
  };

  const orderA2: Order = {
    id: 'ord_a2',
    businessId: bizA,
    customerId: custA,
    status: 'completed',
    subtotal: 6000000,
    total: 6000000,
    createdAt: now - 60000,
    updatedAt: now - 60000,
    items: [{ productId: 'p2', productName: 'Watch', quantity: 1, unitPrice: 6000000 }],
  };

  // Messages for Tenant A Customer: purchase intent + price inquiry
  const msgA1: ConversationMessage = {
    id: 'msg_a1',
    businessId: bizA,
    customerId: custA,
    conversationId: 'conv_a',
    direction: 'inbound',
    channel: 'telegram',
    telegramMessageId: 101,
    telegramChatId: 'chat_a',
    type: 'text',
    text: 'iPhone 15 sotib olmoqchiman',
    media: null,
    aiProcessed: true,
    aiIntent: 'order_intent',
    createdAt: now - 15000,
  };

  const msgA2: ConversationMessage = {
    id: 'msg_a2',
    businessId: bizA,
    customerId: custA,
    conversationId: 'conv_a',
    direction: 'inbound',
    channel: 'telegram',
    telegramMessageId: 102,
    telegramChatId: 'chat_a',
    type: 'text',
    text: 'Narxini ayta olasizmi?',
    media: null,
    aiProcessed: true,
    aiIntent: 'price_query',
    createdAt: now - 10000,
  };

  // Orders and Messages for Tenant B: 1 cancelled order
  const orderB1: Order = {
    id: 'ord_b1',
    businessId: bizB,
    customerId: custB,
    status: 'cancelled',
    subtotal: 3000000,
    total: 3000000,
    createdAt: now - 50000,
    updatedAt: now - 50000,
    items: [],
  };

  // -------------------------------------------------------------
  // Test 1: Full Pipeline (Data -> M6.2 Signals -> M6.3 Intent Score)
  // -------------------------------------------------------------
  const signalsA = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: custA,
    customer: customerA,
    orders: [orderA1, orderA2],
    messages: [msgA1, msgA2],
  });

  assert(signalsA.customerId === custA, 'Test 1a: Signals customerId matches custA');
  assert(signalsA.businessId === bizA, 'Test 1b: Signals businessId matches bizA');
  assert(signalsA.hasActiveOrder === true, 'Test 1c: hasActiveOrder is true');
  assert(signalsA.hasCompletedOrder === true, 'Test 1d: hasCompletedOrder is true');
  assert(signalsA.isRepeatCustomer === true, 'Test 1e: isRepeatCustomer is true');
  assert(signalsA.purchaseIntentDetected === true, 'Test 1f: purchaseIntentDetected is true');
  assert(signalsA.priceInquiryDetected === true, 'Test 1g: priceInquiryDetected is true');

  const intentScoreA: CustomerIntentScore = CustomerIntentScoreService.calculateScoreFromSignals(signalsA, now);

  // Expected score for Customer A:
  // active_order: +40
  // purchase_intent_detected: +30
  // repeat_customer: +15
  // completed_order: +10
  // price_inquiry_detected: +8
  // Total raw = 103 -> clamped to 100 -> 'high'
  assert(intentScoreA.score === 100, `Test 1h: Customer A score is 100 (got ${intentScoreA.score})`);
  assert(intentScoreA.level === 'high', `Test 1i: Customer A level is "high" (got ${intentScoreA.level})`);
  assert(intentScoreA.customerId === custA, 'Test 1j: IntentScore customerId is preserved');
  assert(intentScoreA.businessId === bizA, 'Test 1k: IntentScore businessId is preserved');
  assert(typeof intentScoreA.calculatedAt === 'number', 'Test 1l: calculatedAt is present');
  assert(
    intentScoreA.signals.includes('active_order') &&
      intentScoreA.signals.includes('purchase_intent_detected') &&
      intentScoreA.signals.includes('repeat_customer') &&
      intentScoreA.signals.includes('completed_order') &&
      intentScoreA.signals.includes('price_inquiry_detected'),
    'Test 1m: Signals list contains all 5 contributing triggers'
  );

  // -------------------------------------------------------------
  // Test 2: Tenant Isolation: Tenant B Data in mixed inputs
  // -------------------------------------------------------------
  // Mixing Tenant A and Tenant B data together in input
  const mixedOrders = [orderA1, orderA2, orderB1];
  const mixedMessages = [msgA1, msgA2];

  // Pipeline for Tenant B (should only see orderB1)
  const signalsB = CustomerSalesSignalsService.computeSignals({
    businessId: bizB,
    customerId: custB,
    customer: customerB,
    orders: mixedOrders, // Mixed!
    messages: mixedMessages, // Mixed!
  });

  assert(signalsB.businessId === bizB, 'Test 2a: Signals B strictly scoped to bizB');
  assert(signalsB.customerId === custB, 'Test 2b: Signals B strictly scoped to custB');
  assert(signalsB.totalOrders === 1, 'Test 2c: Tenant B only has 1 order (cancelled)');
  assert(signalsB.hasActiveOrder === false, 'Test 2d: Tenant A active order NOT leaked to Tenant B');
  assert(signalsB.hasCompletedOrder === false, 'Test 2e: Tenant A completed order NOT leaked to Tenant B');
  assert(signalsB.purchaseIntentDetected === false, 'Test 2f: Tenant A message NOT leaked to Tenant B');
  assert(signalsB.hasCancelledOrder === true, 'Test 2g: Tenant B has cancelled order');

  const intentScoreB = CustomerIntentScoreService.calculateScoreFromSignals(signalsB, now);
  // Cancelled order (-10) -> clamped to 0 -> 'low'
  assert(intentScoreB.score === 0, `Test 2h: Tenant B score is 0 (got ${intentScoreB.score})`);
  assert(intentScoreB.level === 'low', `Test 2i: Tenant B level is "low" (got ${intentScoreB.level})`);
  assert(intentScoreB.businessId === bizB, 'Test 2j: Tenant B businessId preserved');
  assert(intentScoreB.signals.includes('cancelled_order'), 'Test 2k: Signals B includes "cancelled_order"');

  // -------------------------------------------------------------
  // Test 3: Type Safety & Boundary Checks
  // -------------------------------------------------------------
  assert(intentScoreA.score >= 0 && intentScoreA.score <= 100, 'Test 3a: Score A within [0, 100]');
  assert(intentScoreB.score >= 0 && intentScoreB.score <= 100, 'Test 3b: Score B within [0, 100]');
  assert(['low', 'medium', 'high'].includes(intentScoreA.level), 'Test 3c: Level A is valid');
  assert(['low', 'medium', 'high'].includes(intentScoreB.level), 'Test 3d: Level B is valid');

  console.log('===================================================================================================');
  console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===================================================================================================');

  if (failCount > 0) {
    throw new Error(`${failCount} tests failed.`);
  }
  console.log('🎉 ALL M6.3 PART 3 INTEGRATION QA TESTS PASSED SUCCESSFULLY!');
}

runM63IntegrationQATests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal M6.3 Part 3 QA test runner error:', err);
    process.exit(1);
  });
