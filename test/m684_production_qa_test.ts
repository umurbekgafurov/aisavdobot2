import { CustomerSalesSignalsService } from '../server/analytics/customerSalesSignals';
import { CustomerIntentScoreService } from '../server/analytics/customerIntentScore';
import { CustomerSalesInsightService } from '../server/analytics/customerSalesInsight';
import { SalesActionGenerator } from '../server/analytics/salesActionGenerator';
import { validateSalesAssistantAction } from '../server/analytics/salesActionContract';
import { SalesIntelligenceService } from '../src/services/salesIntelligenceService';
import { ACTION_LABELS } from '../src/components/CustomersView';
import { Customer, Order, ConversationMessage, SalesRecommendation } from '../src/types';

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

async function runProductionQATests() {
  console.log('===================================================================================================');
  console.log('🚀 M6.8 PART 4 — FINAL PRODUCTION QA VERIFICATION');
  console.log('===================================================================================================');

  const now = 1791060000000;
  const tenantA = 'tenant_prod_alpha';
  const tenantB = 'tenant_prod_beta';
  const custA = 'cust_prod_001';
  const custB = 'cust_prod_002';

  // -------------------------------------------------------------
  // CRITERION 1: AI Sales Intelligence Pipeline & UI Mapping
  // -------------------------------------------------------------
  console.log('--- Criterion 1: Pipeline & UI Mapping ---');
  const customerA: Customer = {
    id: custA,
    businessId: tenantA,
    firstName: 'Aziz',
    status: 'Faol',
    source: 'telegram',
    totalOrders: 2,
    totalSpent: 15000000,
    createdAt: now - 86400000 * 10,
  };

  const ordersA: Order[] = [
    {
      id: 'ord_prod_1',
      businessId: tenantA,
      customerId: custA,
      status: 'completed',
      subtotal: 7000000,
      total: 7000000,
      createdAt: now - 86400000 * 5,
      updatedAt: now - 86400000 * 5,
      items: [{ productId: 'p1', productName: 'iPhone 14', quantity: 1, unitPrice: 7000000 }],
    },
    {
      id: 'ord_prod_2',
      businessId: tenantA,
      customerId: custA,
      status: 'confirmed',
      subtotal: 8000000,
      total: 8000000,
      createdAt: now - 3600000,
      updatedAt: now - 3600000,
      items: [{ productId: 'p2', productName: 'iPad 10', quantity: 1, unitPrice: 8000000 }],
    },
  ];

  const messagesA: ConversationMessage[] = [
    {
      id: 'msg_prod_1',
      businessId: tenantA,
      customerId: custA,
      conversationId: 'conv_1',
      direction: 'inbound',
      channel: 'telegram',
      telegramMessageId: 1001,
      telegramChatId: 'chat_1',
      type: 'text',
      media: null,
      aiProcessed: true,
      aiIntent: 'order_intent',
      text: 'Buyurtmani bugun olsam bo‘ladimi?',
      createdAt: now - 1800000,
    },
  ];

  const signals = CustomerSalesSignalsService.computeSignals({
    businessId: tenantA,
    customerId: custA,
    customer: customerA,
    orders: ordersA,
    messages: messagesA,
  });
  assert(signals.hasActiveOrder === true, '1a: Active order flag true');
  assert(signals.hasCompletedOrder === true, '1b: Completed order flag true');
  assert(signals.isRepeatCustomer === true, '1c: Repeat customer true (2 orders)');
  assert(signals.purchaseIntentDetected === true, '1d: Purchase intent true');

  const intentScore = CustomerIntentScoreService.calculateScoreFromSignals(signals, now);
  assert(intentScore.score === 95, '1e: Intent score calculated correctly (95)');
  assert(intentScore.level === 'high', '1f: Intent level is high');

  const insight = CustomerSalesInsightService.buildSalesInsight(signals, intentScore, now);
  assert(insight.intentScore === 95, '1g: Insight intentScore matches (95)');
  assert(insight.totalOrders === 2, '1h: Insight totalOrders is 2');
  assert(insight.completedOrders === 1, '1i: Insight completedOrders is 1');
  assert(insight.totalSpent === 15000000, '1j: Insight totalSpent is 15,000,000');

  const recommendation: SalesRecommendation = {
    action: 'order_follow_up',
    reason: 'Mijozning tasdiqlangan buyurtmasi mavjud va yetkazib berish holatini kutmoqda',
    confidence: 0.97,
  };
  const action = SalesActionGenerator.generateAction(insight, recommendation);
  assert(action.action === 'order_follow_up', '1k: Action is order_follow_up');
  assert(action.confidence === 0.97, '1l: Confidence is 0.97');
  assert(ACTION_LABELS[action.action] === 'Buyurtma follow-up', '1m: UI label resolves to "Buyurtma follow-up"');
  assert(action.suggestedText.includes('Buyurtmangiz holati'), '1n: Suggested text matches order follow-up template');

  // -------------------------------------------------------------
  // CRITERION 2: Data Integrity & Clamping Bounds
  // -------------------------------------------------------------
  console.log('--- Criterion 2: Data Integrity & Bounds ---');
  assert(action.customerId === custA, '2a: customerId strictly preserved in action');
  assert(action.businessId === tenantA, '2b: businessId strictly preserved in action');
  assert(signals.customerId === custA && signals.businessId === tenantA, '2c: Signals IDs match');
  assert(intentScore.customerId === custA && intentScore.businessId === tenantA, '2d: IntentScore IDs match');
  assert(insight.customerId === custA && insight.businessId === tenantA, '2e: Insight IDs match');

  // Clamping verification
  assert(intentScore.score >= 0 && intentScore.score <= 100, '2f: Intent score clamped in [0, 100]');
  assert(action.confidence >= 0 && action.confidence <= 1, '2g: Action confidence bounded in [0, 1]');

  // Negative score clamping
  const penalizedScore = CustomerIntentScoreService.calculateScoreFromSignals(
    { ...signals, hasActiveOrder: false, hasCompletedOrder: false, isRepeatCustomer: false, purchaseIntentDetected: false, hasCancelledOrder: true },
    now
  );
  assert(penalizedScore.score === 0, '2h: Negative score clamped to 0');
  assert(penalizedScore.level === 'low', '2i: Clamped 0 level is low');

  // -------------------------------------------------------------
  // CRITERION 3: Security & Multi-Tenant / Multi-Customer Isolation
  // -------------------------------------------------------------
  console.log('--- Criterion 3: Security & Isolation ---');
  const crossTenantOrder: Order = {
    id: 'ord_cross_tenant',
    businessId: tenantB, // TENANT B
    customerId: custA,
    status: 'completed',
    subtotal: 500000000,
    total: 500000000,
    createdAt: now - 1000,
    updatedAt: now - 1000,
    items: [{ productId: 'px', productName: 'Cross Tenant Asset', quantity: 1, unitPrice: 500000000 }],
  };

  const crossCustomerOrder: Order = {
    id: 'ord_cross_cust',
    businessId: tenantA,
    customerId: custB, // CUSTOMER B
    status: 'completed',
    subtotal: 888000000,
    total: 888000000,
    createdAt: now - 2000,
    updatedAt: now - 2000,
    items: [{ productId: 'py', productName: 'Customer B Asset', quantity: 1, unitPrice: 888000000 }],
  };

  const isolatedSignals = CustomerSalesSignalsService.computeSignals({
    businessId: tenantA,
    customerId: custA,
    customer: customerA,
    orders: [...ordersA, crossTenantOrder, crossCustomerOrder],
    messages: messagesA,
  });

  assert(isolatedSignals.totalOrders === 2, '3a: Cross-tenant and cross-customer orders strictly excluded (totalOrders is 2)');
  assert(isolatedSignals.totalSpent === 15000000, '3b: Total spent strictly 15,000,000 (cross-tenant 500M and cross-cust 888M excluded)');
  assert(isolatedSignals.businessId === tenantA, '3c: businessId strictly tenantA');
  assert(isolatedSignals.customerId === custA, '3d: customerId strictly custA');

  // Contract validation test
  const validAction = validateSalesAssistantAction(action);
  assert(validAction.isValid === true, '3e: Contract validator returns isValid: true');

  // -------------------------------------------------------------
  // CRITERION 4: Failure Handling & Graceful Degradation
  // -------------------------------------------------------------
  console.log('--- Criterion 4: Failure Handling ---');
  // 4a: Null / undefined recommendation
  const nullFallback = SalesActionGenerator.generateAction(insight, null as any);
  assert(nullFallback.action === 'no_action', '4a: Null recommendation falls back to no_action');
  assert(nullFallback.confidence === 0, '4b: Fallback confidence is 0');
  assert(nullFallback.suggestedText === '', '4c: Fallback suggestedText is empty');

  // 4b: Unauthorized action
  const hackFallback = SalesActionGenerator.generateAction(insight, { action: 'delete_database', reason: 'hack', confidence: 0.99 } as any);
  assert(hackFallback.action === 'no_action', '4d: Malformed action falls back to no_action');

  // 4c: Missing / empty customer list
  const emptyInsight = SalesIntelligenceService.computeCustomerInsight(null, []);
  assert(emptyInsight === null, '4e: Null customer produces null insight without throwing');

  // -------------------------------------------------------------
  // CRITERION 5: Zero Side Effects & Immutability
  // -------------------------------------------------------------
  console.log('--- Criterion 5: Zero Side Effects ---');
  assert(ordersA[0].total === 7000000, '5a: Order total was not modified');
  assert(ordersA[0].status === 'completed', '5b: Order status was not modified');
  assert(customerA.totalSpent === 15000000, '5c: Customer record was not modified');
  assert(customerA.status === 'Faol', '5d: Customer status was not modified');

  // -------------------------------------------------------------
  // CRITERION 6: Performance & On-Demand Execution
  // -------------------------------------------------------------
  console.log('--- Criterion 6: Performance & On-Demand ---');
  const t0 = Date.now();
  for (let i = 0; i < 100; i++) {
    const s = CustomerSalesSignalsService.computeSignals({
      businessId: tenantA,
      customerId: custA,
      customer: customerA,
      orders: ordersA,
      messages: messagesA,
    });
    const sc = CustomerIntentScoreService.calculateScoreFromSignals(s, now);
    const ins = CustomerSalesInsightService.buildSalesInsight(s, sc, now);
    SalesActionGenerator.generateAction(ins, recommendation);
  }
  const tDiff = Date.now() - t0;
  assert(tDiff < 500, `6a: 100 deterministic pipeline runs completed in ${tDiff}ms (< 500ms)`);

  console.log('===================================================================================================');
  console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===================================================================================================');

  if (failCount > 0) {
    throw new Error(`${failCount} tests failed.`);
  }
  console.log('🎉 ALL FINAL PRODUCTION QA CHECKS PASSED WITH 100% SUCCESS!');
}

runProductionQATests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal Production QA error:', err);
    process.exit(1);
  });
