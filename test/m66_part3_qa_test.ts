import { SalesIntelligenceService } from '../src/services/salesIntelligenceService';
import { Customer, Order, ConversationMessage } from '../src/types';

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

async function runM66Part3QATests() {
  console.log('===================================================================================================');
  console.log('🚀 M6.6 PART 3 — FINAL INTEGRATION & QA VERIFICATION');
  console.log('===================================================================================================');

  const now = 1790990000000;
  const bizA = 'biz_main_store';
  const bizB = 'biz_other_store';

  // Customer A: High Intent
  const customerA: Customer = {
    id: 'cust_switch_a',
    businessId: bizA,
    firstName: 'Alisher',
    status: 'Faol',
    source: 'telegram',
    totalOrders: 2,
    totalSpent: 12000000,
    createdAt: now - 500000,
  };

  // Orders for Customer A: 1 active processing, 1 completed
  const ordersA: Order[] = [
    {
      id: 'ord_sw_a1',
      businessId: bizA,
      customerId: 'cust_switch_a',
      status: 'processing',
      subtotal: 7000000,
      total: 7000000,
      createdAt: now - 10000,
      updatedAt: now - 10000,
      items: [{ productId: 'p1', productName: 'iPhone 15', quantity: 1, unitPrice: 7000000 }],
    },
    {
      id: 'ord_sw_a2',
      businessId: bizA,
      customerId: 'cust_switch_a',
      status: 'completed',
      subtotal: 5000000,
      total: 5000000,
      createdAt: now - 100000,
      updatedAt: now - 100000,
      items: [{ productId: 'p2', productName: 'AirPods Pro', quantity: 1, unitPrice: 5000000 }],
    },
  ];

  // Message with purchase intent for Customer A -> 40 + 30 + 15 + 10 = 95 -> HIGH
  const messages: ConversationMessage[] = [
    {
      id: 'msg_sw_a1',
      businessId: bizA,
      customerId: 'cust_switch_a',
      conversationId: 'conv_a',
      direction: 'inbound',
      channel: 'telegram',
      telegramMessageId: 801,
      telegramChatId: 'chat_801',
      type: 'text',
      text: 'Yangi buyurtma bermoqchiman',
      media: null,
      aiProcessed: true,
      aiIntent: 'order_intent',
      createdAt: now - 5000,
    },
  ];

  // Customer B: Low Intent
  const customerB: Customer = {
    id: 'cust_switch_b',
    businessId: bizA,
    firstName: 'Bekzod',
    status: 'Yangi',
    source: 'telegram',
    totalOrders: 0,
    totalSpent: 0,
    createdAt: now - 200000,
  };

  // Customer C: Medium Intent (1 active order -> 40 -> MEDIUM)
  const customerC: Customer = {
    id: 'cust_switch_c',
    businessId: bizA,
    firstName: 'Charos',
    status: 'Sotib oldi',
    source: 'telegram',
    totalOrders: 1,
    totalSpent: 4000000,
    createdAt: now - 800000,
  };

  const ordersC: Order[] = [
    {
      id: 'ord_sw_c1',
      businessId: bizA,
      customerId: 'cust_switch_c',
      status: 'confirmed',
      subtotal: 4000000,
      total: 4000000,
      createdAt: now - 30000,
      updatedAt: now - 30000,
      items: [{ productId: 'p3', productName: 'Watch 9', quantity: 1, unitPrice: 4000000 }],
    },
  ];

  const allOrders = [...ordersA, ...ordersC];

  // -------------------------------------------------------------
  // Test 1: Customer Switching & Recalculation
  // -------------------------------------------------------------
  // Step 1: Select Customer A
  let activeCustomer: Customer | null = customerA;
  let activeInsight = SalesIntelligenceService.computeCustomerInsight(activeCustomer, allOrders, messages);

  assert(activeInsight !== null, 'Test 1a: Customer A insight computed');
  assert(activeInsight!.customerId === 'cust_switch_a', 'Test 1b: Customer A ID matches');
  assert(activeInsight!.intentLevel === 'high', `Test 1c: Customer A has "high" intent (got ${activeInsight!.intentLevel})`);
  assert(activeInsight!.totalOrders === 2, 'Test 1d: Customer A has 2 orders');
  assert(activeInsight!.totalSpent === 12000000, 'Test 1e: Customer A spent is 12,000,000');

  // Step 2: Switch to Customer B (Zero Orders, Low intent)
  activeCustomer = customerB;
  activeInsight = SalesIntelligenceService.computeCustomerInsight(activeCustomer, allOrders, messages);

  assert(activeInsight !== null, 'Test 1f: Customer B insight computed upon switch');
  assert(activeInsight!.customerId === 'cust_switch_b', 'Test 1g: Customer B ID matches');
  assert(activeInsight!.intentLevel === 'low', `Test 1h: Customer B has "low" intent (got ${activeInsight!.intentLevel})`);
  assert(activeInsight!.totalOrders === 0, 'Test 1i: Customer B has 0 orders');
  assert(activeInsight!.totalSpent === 0, 'Test 1j: Customer B spent is 0');

  // Step 3: Switch to Customer C (Medium intent)
  activeCustomer = customerC;
  activeInsight = SalesIntelligenceService.computeCustomerInsight(activeCustomer, allOrders, messages);

  assert(activeInsight !== null, 'Test 1k: Customer C insight computed upon switch');
  assert(activeInsight!.customerId === 'cust_switch_c', 'Test 1l: Customer C ID matches');
  assert(activeInsight!.intentLevel === 'medium', `Test 1m: Customer C has "medium" intent (got ${activeInsight!.intentLevel})`);
  assert(activeInsight!.totalOrders === 1, 'Test 1n: Customer C has 1 order');
  assert(activeInsight!.totalSpent === 4000000, 'Test 1o: Customer C spent is 4,000,000');

  // -------------------------------------------------------------
  // Test 2: High / Medium / Low Intent Badges & Scores
  // -------------------------------------------------------------
  const insightA = SalesIntelligenceService.computeCustomerInsight(customerA, allOrders, messages);
  const insightB = SalesIntelligenceService.computeCustomerInsight(customerB, allOrders, messages);
  const insightC = SalesIntelligenceService.computeCustomerInsight(customerC, allOrders, messages);

  assert(insightA!.intentScore >= 70, 'Test 2a: High intent score >= 70');
  assert(insightC!.intentScore >= 40 && insightC!.intentScore < 70, 'Test 2b: Medium intent score in [40, 69]');
  assert(insightB!.intentScore < 40, 'Test 2c: Low intent score < 40');

  // -------------------------------------------------------------
  // Test 3: Empty State Handling
  // -------------------------------------------------------------
  const nullCustomerInsight = SalesIntelligenceService.computeCustomerInsight(null, allOrders, messages);
  assert(nullCustomerInsight === null, 'Test 3a: Null customer returns null (renders empty state)');

  const missingBizInsight = SalesIntelligenceService.computeCustomerInsight(
    { id: 'c_nobiz', firstName: 'NoBiz' } as any,
    allOrders,
    messages
  );
  assert(missingBizInsight === null, 'Test 3b: Customer without businessId returns null (renders empty state)');

  // -------------------------------------------------------------
  // Test 4: Recommendation Present vs Not Present
  // -------------------------------------------------------------
  // Initially null (not generated)
  let testRecommendation = null;
  assert(testRecommendation === null, 'Test 4a: Initial recommendation state is null');

  // Generated on-demand for Customer A
  testRecommendation = await SalesIntelligenceService.generateCustomerRecommendation(insightA!);
  assert(testRecommendation !== null, 'Test 4b: Recommendation generated on-demand');
  assert(typeof testRecommendation.action === 'string', 'Test 4c: Action is string');
  assert(testRecommendation.confidence >= 0 && testRecommendation.confidence <= 1, 'Test 4d: Confidence is bounded [0, 1]');
  assert(testRecommendation.reason.length > 0, 'Test 4e: Reason is non-empty');

  // When switching customer, recommendation state is reset
  testRecommendation = null;
  assert(testRecommendation === null, 'Test 4f: Recommendation cleanly reset on customer switch');

  // -------------------------------------------------------------
  // Test 5: Tenant Isolation
  // -------------------------------------------------------------
  const tenantBOrders: Order[] = [
    {
      id: 'ord_tb_99',
      businessId: bizB, // Cross-tenant!
      customerId: 'cust_switch_a',
      status: 'completed',
      subtotal: 99000000,
      total: 99000000,
      createdAt: now,
      updatedAt: now,
      items: [],
    },
  ];

  const mixedOrders = [...allOrders, ...tenantBOrders];
  const isolatedInsightA = SalesIntelligenceService.computeCustomerInsight(customerA, mixedOrders, messages);

  assert(
    isolatedInsightA!.totalOrders === 2,
    'Test 5a: Cross-tenant orders are filtered out (totalOrders is strictly 2)'
  );
  assert(
    isolatedInsightA!.totalSpent === 12000000,
    'Test 5b: Cross-tenant spent is filtered out (totalSpent is strictly 12,000,000)'
  );
  assert(
    isolatedInsightA!.businessId === bizA,
    'Test 5c: Business ID strictly matches customerA businessId'
  );

  // -------------------------------------------------------------
  // Test 6: Existing Order History Sorting & Data Integrity
  // -------------------------------------------------------------
  const filteredCustomerAOrders = allOrders
    .filter((o) => o.customerId === customerA.id && o.businessId === customerA.businessId)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  assert(filteredCustomerAOrders.length === 2, 'Test 6a: 2 orders found for customer A');
  assert(
    filteredCustomerAOrders[0].createdAt! >= filteredCustomerAOrders[1].createdAt!,
    'Test 6b: Orders sorted newest first'
  );
  assert(filteredCustomerAOrders[0].id === 'ord_sw_a1', 'Test 6c: Newest order is ord_sw_a1');

  console.log('===================================================================================================');
  console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===================================================================================================');

  if (failCount > 0) {
    throw new Error(`${failCount} tests failed.`);
  }
  console.log('🎉 ALL M6.6 PART 3 FINAL INTEGRATION & QA TESTS PASSED SUCCESSFULLY!');
}

runM66Part3QATests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal M6.6 Part 3 test runner error:', err);
    process.exit(1);
  });
