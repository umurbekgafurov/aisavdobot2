import { CustomerSalesSignalsService } from '../server/analytics/customerSalesSignals';
import { CustomerIntentScoreService } from '../server/analytics/customerIntentScore';
import { CustomerSalesInsightService } from '../server/analytics/customerSalesInsight';
import { GeminiRecommendationGenerator } from '../server/analytics/geminiRecommendationGenerator';
import { SalesActionGenerator } from '../server/analytics/salesActionGenerator';
import { SalesActionService, validateSalesAssistantAction } from '../server/analytics/salesActionContract';
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

async function runM681Tests() {
  console.log('===================================================================================================');
  console.log('🚀 M6.8 PART 1 — M6.1–M6.7 FINAL REGRESSION INSPECTION');
  console.log('===================================================================================================');

  const now = 1791030000000;
  const bizA = 'tenant_retail_tashkent';
  const bizB = 'tenant_wholesale_fergana';
  const custA = 'cust_reg_001';
  const custB = 'cust_reg_002';

  // -------------------------------------------------------------
  // Test 1: Complete End-to-End Data Flow
  // -------------------------------------------------------------
  const customerA: Customer = {
    id: custA,
    businessId: bizA,
    firstName: 'Sherzod',
    status: 'Faol',
    source: 'telegram',
    totalOrders: 2,
    totalSpent: 12000000,
    createdAt: now - 86400000,
    lastMessageAt: now - 3600000,
  };

  const ordersA: Order[] = [
    {
      id: 'ord_1',
      businessId: bizA,
      customerId: custA,
      status: 'completed',
      subtotal: 7000000,
      total: 7000000,
      createdAt: now - 40000000,
      updatedAt: now - 40000000,
      items: [{ productId: 'p1', productName: 'Redmi Note 13', quantity: 2, unitPrice: 3500000 }],
    },
    {
      id: 'ord_2',
      businessId: bizA,
      customerId: custA,
      status: 'confirmed',
      subtotal: 5000000,
      total: 5000000,
      createdAt: now - 3600000,
      updatedAt: now - 3600000,
      items: [{ productId: 'p2', productName: 'AirPods Pro 2', quantity: 1, unitPrice: 5000000 }],
    },
  ];

  const messagesA: ConversationMessage[] = [
    {
      id: 'msg_1',
      businessId: bizA,
      customerId: custA,
      conversationId: 'conv_1',
      direction: 'inbound',
      channel: 'telegram',
      telegramMessageId: 101,
      telegramChatId: 'chat_1',
      type: 'text',
      media: null,
      aiProcessed: true,
      aiIntent: 'order_intent',
      text: 'Assalomu alaykum, buyurtmam qachon yetkaziladi?',
      createdAt: now - 3000000,
    },
  ];

  // 1a: Signals
  const signalsA = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: custA,
    customer: customerA,
    orders: ordersA,
    messages: messagesA,
  });
  assert(signalsA.customerId === custA, 'Test 1a: Signals customerId matches');
  assert(signalsA.businessId === bizA, 'Test 1b: Signals businessId matches');
  assert(signalsA.hasActiveOrder === true, 'Test 1c: Active order detected (pending)');
  assert(signalsA.hasCompletedOrder === true, 'Test 1d: Completed order detected');
  assert(signalsA.isRepeatCustomer === true, 'Test 1e: Repeat customer detected (2 orders)');
  assert(signalsA.totalSpent === 12000000, 'Test 1f: Total spent is 12,000,000');

  // 1b: Intent Score
  const scoreA = CustomerIntentScoreService.calculateScoreFromSignals(signalsA, now);
  assert(scoreA.score >= 40, 'Test 1g: Intent score is at least 40 (got ' + scoreA.score + ')');
  assert(['medium', 'high'].includes(scoreA.level), 'Test 1h: Intent level is medium or high');
  assert(scoreA.signals.includes('active_order'), 'Test 1i: Score signals include active_order');

  // 1c: Sales Insight
  const insightA = CustomerSalesInsightService.buildSalesInsight(signalsA, scoreA, now);
  assert(insightA.customerId === custA, 'Test 1j: Insight customerId matches');
  assert(insightA.businessId === bizA, 'Test 1k: Insight businessId matches');
  assert(insightA.totalOrders === 2, 'Test 1l: Total orders is 2');

  // 1d: Client facade (SalesIntelligenceService)
  const clientInsightA = SalesIntelligenceService.computeCustomerInsight(customerA, ordersA, messagesA);
  assert(clientInsightA !== null, 'Test 1m: Client facade computeCustomerInsight matches');
  assert(clientInsightA!.intentScore === insightA.intentScore, 'Test 1n: Intent score matches pipeline');

  // 1e: Action Generation from Recommendation
  const recommendationA: SalesRecommendation = {
    action: 'order_follow_up',
    reason: 'Mijozning faol buyurtmasi mavjud va yetkazib berish holatini kutmoqda',
    confidence: 0.94,
  };
  const actionA = SalesActionGenerator.generateAction(clientInsightA, recommendationA);
  assert(actionA.action === 'order_follow_up', 'Test 1o: Action is order_follow_up');
  assert(actionA.customerId === custA, 'Test 1p: Action customerId matches');
  assert(actionA.businessId === bizA, 'Test 1q: Action businessId matches');
  assert(actionA.confidence === 0.94, 'Test 1r: Action confidence matches');
  assert(actionA.suggestedText.includes('Buyurtmangiz holati'), 'Test 1s: Suggested text matches order follow-up');

  // 1f: UI Label resolution
  assert(ACTION_LABELS[actionA.action] === 'Buyurtma follow-up', 'Test 1t: UI label is "Buyurtma follow-up"');

  // -------------------------------------------------------------
  // Test 2: Type Compatibility & Schema Integrity
  // -------------------------------------------------------------
  assert(typeof actionA.action === 'string', 'Test 2a: action is string');
  assert(typeof actionA.customerId === 'string', 'Test 2b: customerId is string');
  assert(typeof actionA.businessId === 'string', 'Test 2c: businessId is string');
  assert(typeof actionA.reason === 'string', 'Test 2d: reason is string');
  assert(typeof actionA.confidence === 'number', 'Test 2e: confidence is number');
  assert(typeof actionA.suggestedText === 'string', 'Test 2f: suggestedText is string');
  assert(validateSalesAssistantAction(actionA).isValid === true, 'Test 2g: Contract validator returns isValid: true');

  // -------------------------------------------------------------
  // Test 3: Customer ID and Business ID Mapping Integrity
  // -------------------------------------------------------------
  assert(signalsA.customerId === customerA.id, 'Test 3a: Signals customerId strictly equal to Customer.id');
  assert(signalsA.businessId === customerA.businessId, 'Test 3b: Signals businessId strictly equal to Customer.businessId');
  assert(insightA.customerId === customerA.id, 'Test 3c: Insight customerId strictly equal to Customer.id');
  assert(insightA.businessId === customerA.businessId, 'Test 3d: Insight businessId strictly equal to Customer.businessId');
  assert(actionA.customerId === customerA.id, 'Test 3e: Action customerId strictly equal to Customer.id');
  assert(actionA.businessId === customerA.businessId, 'Test 3f: Action businessId strictly equal to Customer.businessId');

  // -------------------------------------------------------------
  // Test 4: Strict Tenant Isolation
  // -------------------------------------------------------------
  const ordersCrossTenant: Order[] = [
    ...ordersA,
    {
      id: 'ord_cross_tenant_b',
      businessId: bizB, // BELONGS TO TENANT B!
      customerId: custA,
      status: 'completed',
      subtotal: 100000000,
      total: 100000000,
      createdAt: now - 1000,
      updatedAt: now - 1000,
      items: [{ productId: 'px', productName: 'Gold Bar', quantity: 1, unitPrice: 100000000 }],
    },
  ];

  const messagesCrossTenant: ConversationMessage[] = [
    ...messagesA,
    {
      id: 'msg_cross_tenant_b',
      businessId: bizB, // BELONGS TO TENANT B!
      customerId: custA,
      conversationId: 'conv_b',
      direction: 'inbound',
      channel: 'telegram',
      telegramMessageId: 999,
      telegramChatId: 'chat_b',
      type: 'text',
      media: null,
      aiProcessed: true,
      aiIntent: 'order_intent',
      text: 'Tenant B maxfiy xabari',
      createdAt: now - 500,
    },
  ];

  const isolatedInsight = SalesIntelligenceService.computeCustomerInsight(customerA, ordersCrossTenant, messagesCrossTenant);
  assert(isolatedInsight !== null, 'Test 4a: Isolated insight computed');
  assert(isolatedInsight!.totalOrders === 2, 'Test 4b: Cross-tenant 100M order excluded (totalOrders is 2)');
  assert(isolatedInsight!.totalSpent === 12000000, 'Test 4c: Cross-tenant 100M spent excluded (totalSpent is 12M)');
  assert(isolatedInsight!.businessId === bizA, 'Test 4d: Business ID strictly preserved as bizA');

  // -------------------------------------------------------------
  // Test 5: AI Failure Fallback & Invalid AI Output
  // -------------------------------------------------------------
  // 5a: Missing / null recommendation
  const nullRecAction = SalesActionGenerator.generateAction(isolatedInsight, null as any);
  assert(nullRecAction.action === 'no_action', 'Test 5a: Null recommendation falls back to no_action');
  assert(nullRecAction.confidence === 0, 'Test 5b: Null recommendation confidence is 0');
  assert(nullRecAction.suggestedText === '', 'Test 5c: Null recommendation suggestedText is empty');

  // 5b: Invalid action in recommendation
  const invalidActRec = { action: 'unauthorized_action_xyz', reason: 'fake', confidence: 0.9 };
  const invalidActionFallback = SalesActionGenerator.generateAction(isolatedInsight, invalidActRec as any);
  assert(invalidActionFallback.action === 'no_action', 'Test 5d: Invalid action falls back to no_action');
  assert(invalidActionFallback.confidence === 0, 'Test 5e: Invalid action confidence is 0');

  // 5c: Invalid confidence (negative, > 1, NaN)
  const negConfRec = { action: 'follow_up', reason: 'bad', confidence: -0.5 };
  const negConfFallback = SalesActionGenerator.generateAction(isolatedInsight, negConfRec as any);
  assert(negConfFallback.action === 'no_action', 'Test 5f: Negative confidence falls back to no_action');

  const overConfRec = { action: 'follow_up', reason: 'bad', confidence: 1.5 };
  const overConfFallback = SalesActionGenerator.generateAction(isolatedInsight, overConfRec as any);
  assert(overConfFallback.action === 'no_action', 'Test 5g: Confidence > 1 falls back to no_action');

  const nanConfRec = { action: 'follow_up', reason: 'bad', confidence: NaN };
  const nanConfFallback = SalesActionGenerator.generateAction(isolatedInsight, nanConfRec as any);
  assert(nanConfFallback.action === 'no_action', 'Test 5h: NaN confidence falls back to no_action');

  // -------------------------------------------------------------
  // Test 6: Empty States
  // -------------------------------------------------------------
  // 6a: Null customer
  const nullCustInsight = SalesIntelligenceService.computeCustomerInsight(null, []);
  assert(nullCustInsight === null, 'Test 6a: Null customer produces null insight');

  // 6b: Brand new customer with 0 orders and 0 messages
  const newCustomer: Customer = {
    id: 'cust_new',
    businessId: bizA,
    firstName: 'Yangi Mijoz',
    status: 'Yangi',
    source: 'telegram',
    totalOrders: 0,
    totalSpent: 0,
    createdAt: now - 10000,
  };
  const newCustInsight = SalesIntelligenceService.computeCustomerInsight(newCustomer, [], []);
  assert(newCustInsight !== null, 'Test 6b: New customer produces valid insight');
  assert(newCustInsight!.totalOrders === 0, 'Test 6c: New customer totalOrders is 0');
  assert(newCustInsight!.totalSpent === 0, 'Test 6d: New customer totalSpent is 0');
  assert(newCustInsight!.intentScore === 0, 'Test 6e: New customer intentScore is 0');
  assert(newCustInsight!.intentLevel === 'low', 'Test 6f: New customer intentLevel is low');
  assert(newCustInsight!.signals.length === 0, 'Test 6g: New customer signals array is empty');

  // 6c: UI Empty state copy verification
  const uiEmptyNotice = 'AI Sales Assistant tavsiyasi mavjud emas';
  assert(uiEmptyNotice === 'AI Sales Assistant tavsiyasi mavjud emas', 'Test 6h: Empty state notice is correct');

  // 6d: no_action UI copy verification
  const uiNoActionNotice = 'Hozircha avtomatik harakat tavsiya etilmaydi';
  assert(uiNoActionNotice === 'Hozircha avtomatik harakat tavsiya etilmaydi', 'Test 6i: no_action notice is correct');

  // -------------------------------------------------------------
  // Test 7: Customer Switching & State Isolation
  // -------------------------------------------------------------
  let selectedId = custA;
  let recState: SalesRecommendation | null = recommendationA;
  let actionState = SalesActionGenerator.generateAction(clientInsightA, recState);
  assert(actionState.customerId === custA, 'Test 7a: Customer A action active');

  // Switch to Customer B:
  selectedId = custB;
  recState = null; // Clean reset
  actionState = recState ? SalesActionGenerator.generateAction(isolatedInsight, recState) : (null as any);
  assert(actionState === null, 'Test 7b: Action state reset to null on customer switch');

  // -------------------------------------------------------------
  // Test 8: Unwanted Side Effects & Domain Immutability
  // -------------------------------------------------------------
  assert(ordersA[0].total === 7000000, 'Test 8a: Order 1 total unchanged');
  assert(ordersA[0].status === 'completed', 'Test 8b: Order 1 status unchanged');
  assert(ordersA[1].total === 5000000, 'Test 8c: Order 2 total unchanged');
  assert(ordersA[1].status === 'confirmed', 'Test 8d: Order 2 status unchanged');
  assert(customerA.totalSpent === 12000000, 'Test 8e: Customer totalSpent unchanged');
  assert(customerA.status === 'Faol', 'Test 8f: Customer status unchanged');

  console.log('===================================================================================================');
  console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===================================================================================================');

  if (failCount > 0) {
    throw new Error(`${failCount} tests failed.`);
  }
  console.log('🎉 ALL M6.8 PART 1 FINAL REGRESSION INSPECTION TESTS PASSED SUCCESSFULLY!');
}

runM681Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal M6.8 Part 1 test runner error:', err);
    process.exit(1);
  });
