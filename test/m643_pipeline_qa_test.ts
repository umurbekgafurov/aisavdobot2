import { CustomerSalesSignalsService } from '../server/analytics/customerSalesSignals';
import { CustomerIntentScoreService } from '../server/analytics/customerIntentScore';
import { CustomerSalesInsightService } from '../server/analytics/customerSalesInsight';
import { Customer, ConversationMessage } from '../src/types';
import { Order } from '../src/types/orders';

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

async function runM643PipelineQATests() {
  console.log('===================================================================================================');
  console.log('🚀 M6.4 PART 3 — SALES INSIGHT PIPELINE QA & INTEGRATION VERIFICATION');
  console.log('===================================================================================================');

  const now = 1790950000000;
  const bizA = 'biz_omega_a';
  const bizB = 'biz_omega_b';
  const custA = 'cust_pipeline_a';
  const custB = 'cust_pipeline_b';

  // Customer A in Business A
  const customerA: Customer = {
    id: custA,
    businessId: bizA,
    firstName: 'Dilshod',
    status: 'Faol',
    source: 'telegram',
    totalOrders: 3,
    totalSpent: 21000000,
    createdAt: now - 500000,
    lastInteraction: now - 3000,
  };

  // Orders for Customer A: 1 active (processing), 1 completed, 1 cancelled
  const orderAActive: Order = {
    id: 'ord_pipe_a1',
    businessId: bizA,
    customerId: custA,
    status: 'processing',
    subtotal: 12000000,
    total: 12000000,
    createdAt: now - 15000,
    updatedAt: now - 15000,
    items: [{ productId: 'p1', productName: 'iPhone 15 Pro', quantity: 1, unitPrice: 12000000 }],
  };

  const orderACompleted: Order = {
    id: 'ord_pipe_a2',
    businessId: bizA,
    customerId: custA,
    status: 'completed',
    subtotal: 9000000,
    total: 9000000,
    createdAt: now - 60000,
    updatedAt: now - 60000,
    items: [{ productId: 'p2', productName: 'iPad Mini', quantity: 1, unitPrice: 9000000 }],
  };

  const orderACancelled: Order = {
    id: 'ord_pipe_a3',
    businessId: bizA,
    customerId: custA,
    status: 'cancelled',
    subtotal: 4000000,
    total: 4000000,
    createdAt: now - 80000,
    updatedAt: now - 80000,
    items: [],
  };

  // Messages for Customer A
  const msgA1: ConversationMessage = {
    id: 'msg_pipe_a1',
    businessId: bizA,
    customerId: custA,
    conversationId: 'conv_pipe_a',
    direction: 'inbound',
    channel: 'telegram',
    telegramMessageId: 701,
    telegramChatId: 'chat_701',
    type: 'text',
    text: 'Yangi buyurtma bermoqchiman',
    media: null,
    aiProcessed: true,
    aiIntent: 'order_intent',
    createdAt: now - 5000,
  };

  const msgA2: ConversationMessage = {
    id: 'msg_pipe_a2',
    businessId: bizA,
    customerId: custA,
    conversationId: 'conv_pipe_a',
    direction: 'inbound',
    channel: 'telegram',
    telegramMessageId: 702,
    telegramChatId: 'chat_701',
    type: 'text',
    text: 'Yetkazib berish narxi qancha?',
    media: null,
    aiProcessed: true,
    aiIntent: 'price_query',
    createdAt: now - 4000,
  };

  // -------------------------------------------------------------
  // Test 1: Full Pipeline (M6.2 Signals -> M6.3 Score -> M6.4 Insight)
  // -------------------------------------------------------------
  // Step 1: M6.2 CustomerSalesSignals
  const signalsA = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: custA,
    customer: customerA,
    orders: [orderAActive, orderACompleted, orderACancelled],
    messages: [msgA1, msgA2],
  });

  assert(signalsA.customerId === custA, 'Test 1a: Signals customerId matches');
  assert(signalsA.businessId === bizA, 'Test 1b: Signals businessId matches');
  assert(signalsA.hasActiveOrder === true, 'Test 1c: hasActiveOrder is true');
  assert(signalsA.hasCompletedOrder === true, 'Test 1d: hasCompletedOrder is true');
  assert(signalsA.hasCancelledOrder === true, 'Test 1e: hasCancelledOrder is true');
  assert(signalsA.isRepeatCustomer === true, 'Test 1f: isRepeatCustomer is true (completed + active >= 2)');
  assert(signalsA.purchaseIntentDetected === true, 'Test 1g: purchaseIntentDetected is true');
  assert(signalsA.priceInquiryDetected === true, 'Test 1h: priceInquiryDetected is true');
  assert(signalsA.totalSpent === 21000000, 'Test 1i: totalSpent is 21,000,000 (12M + 9M)');

  // Step 2: M6.3 CustomerIntentScore
  const scoreA = CustomerIntentScoreService.calculateScoreFromSignals(signalsA, now);

  // Score breakdown:
  // active_order: +40
  // purchase_intent_detected: +30
  // repeat_customer: +15
  // completed_order: +10
  // price_inquiry_detected: +8
  // cancelled_order: -10
  // Raw = 40 + 30 + 15 + 10 + 8 - 10 = 93 -> clamped [0, 100] = 93
  // 93 >= 70 -> 'high'
  assert(scoreA.score === 93, `Test 1j: Intent score is 93 (got ${scoreA.score})`);
  assert(scoreA.level === 'high', `Test 1k: Intent level is "high" (got ${scoreA.level})`);
  assert(scoreA.signals.includes('active_order'), 'Test 1l: Signals include active_order');
  assert(scoreA.signals.includes('cancelled_order'), 'Test 1m: Signals include cancelled_order');

  // Step 3: M6.4 CustomerSalesInsight
  const insightA = CustomerSalesInsightService.buildSalesInsight(signalsA, scoreA, now);

  // -------------------------------------------------------------
  // Test 2: Data Integrity across all 12 properties
  // -------------------------------------------------------------
  assert(insightA.customerId === custA, 'Test 2a: customerId preserved');
  assert(insightA.businessId === bizA, 'Test 2b: businessId preserved');
  assert(insightA.intentLevel === 'high', 'Test 2c: intentLevel matches score level');
  assert(insightA.intentScore === 93, 'Test 2d: intentScore matches score');
  assert(
    JSON.stringify(insightA.signals) === JSON.stringify(scoreA.signals),
    'Test 2e: signals array exactly matches score signals'
  );
  assert(insightA.totalOrders === 3, 'Test 2f: totalOrders is 3');
  assert(insightA.completedOrders === 1, 'Test 2g: completedOrders is 1');
  assert(insightA.cancelledOrders === 1, 'Test 2h: cancelledOrders is 1');
  assert(insightA.totalSpent === 21000000, 'Test 2i: totalSpent is 21,000,000');
  assert(insightA.lastOrderAt === now - 15000, 'Test 2j: lastOrderAt is newest order timestamp');
  assert(insightA.lastInteractionAt === now - 3000, 'Test 2k: lastInteractionAt is newest interaction');
  assert(insightA.generatedAt === now, 'Test 2l: generatedAt matches current timestamp');

  // -------------------------------------------------------------
  // Test 3: Score Integrity & Boundaries
  // -------------------------------------------------------------
  assert(insightA.intentScore >= 0 && insightA.intentScore <= 100, 'Test 3a: Score is bounded in [0, 100]');
  assert(['low', 'medium', 'high'].includes(insightA.intentLevel), 'Test 3b: Level is valid enum value');

  // -------------------------------------------------------------
  // Test 4: Tenant Isolation (Zero Cross-Tenant Leakage)
  // -------------------------------------------------------------
  // Mix Tenant A data into Tenant B calculation
  const signalsB = CustomerSalesSignalsService.computeSignals({
    businessId: bizB,
    customerId: custB,
    orders: [orderAActive, orderACompleted], // Belongs to Tenant A!
    messages: [msgA1],                      // Belongs to Tenant A!
  });

  assert(signalsB.businessId === bizB, 'Test 4a: Signals B strictly scoped to bizB');
  assert(signalsB.customerId === custB, 'Test 4b: Signals B strictly scoped to custB');
  assert(signalsB.totalOrders === 0, 'Test 4c: Tenant A orders filtered out for Tenant B');
  assert(signalsB.totalSpent === 0, 'Test 4d: Tenant A spent filtered out for Tenant B');
  assert(signalsB.purchaseIntentDetected === false, 'Test 4e: Tenant A message filtered out for Tenant B');

  const scoreB = CustomerIntentScoreService.calculateScoreFromSignals(signalsB, now);
  const insightB = CustomerSalesInsightService.buildSalesInsight(signalsB, scoreB, now);

  assert(insightB.businessId === bizB, 'Test 4f: Insight B strictly scoped to bizB');
  assert(insightB.customerId === custB, 'Test 4g: Insight B strictly scoped to custB');
  assert(insightB.intentScore === 0, 'Test 4h: Tenant B intentScore is 0');
  assert(insightB.intentLevel === 'low', 'Test 4i: Tenant B intentLevel is "low"');
  assert(insightB.totalSpent === 0, 'Test 4j: Tenant B totalSpent is 0');

  // -------------------------------------------------------------
  // Test 5: Deterministic Pipeline Idempotency
  // -------------------------------------------------------------
  const rerun1 = CustomerSalesInsightService.buildSalesInsight(signalsA, scoreA, now);
  const rerun2 = CustomerSalesInsightService.buildSalesInsight(signalsA, scoreA, now);
  assert(JSON.stringify(rerun1) === JSON.stringify(rerun2), 'Test 5: Pipeline is 100% deterministic & idempotent');

  console.log('===================================================================================================');
  console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===================================================================================================');

  if (failCount > 0) {
    throw new Error(`${failCount} tests failed.`);
  }
  console.log('🎉 ALL M6.4 PART 3 SALES INSIGHT PIPELINE QA TESTS PASSED SUCCESSFULLY!');
}

runM643PipelineQATests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal M6.4 Part 3 QA test runner error:', err);
    process.exit(1);
  });
