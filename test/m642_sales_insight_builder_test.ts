import { CustomerSalesInsightService } from '../server/analytics/customerSalesInsight';
import { CustomerSalesSignals } from '../src/types/salesSignals';
import { CustomerIntentScore } from '../src/types/intentScore';
import { CustomerSalesInsight } from '../src/types/salesInsight';

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

function createSignals(overrides: Partial<CustomerSalesSignals> = {}): CustomerSalesSignals {
  return {
    customerId: 'cust_insight_1',
    businessId: 'biz_super_shop',
    hasActiveOrder: false,
    hasCompletedOrder: false,
    hasCancelledOrder: false,
    isRepeatCustomer: false,
    totalOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    totalSpent: 0,
    lastOrderAt: null,
    lastInteractionAt: null,
    purchaseIntentDetected: false,
    productInquiryDetected: false,
    priceInquiryDetected: false,
    stockInquiryDetected: false,
    ...overrides,
  };
}

function createScore(overrides: Partial<CustomerIntentScore> = {}): CustomerIntentScore {
  return {
    customerId: 'cust_insight_1',
    businessId: 'biz_super_shop',
    level: 'low',
    score: 0,
    signals: [],
    calculatedAt: Date.now(),
    ...overrides,
  };
}

async function runM642Tests() {
  console.log('===================================================================================================');
  console.log('🚀 M6.4 PART 2 — SALES INSIGHT BUILDER VERIFICATION');
  console.log('===================================================================================================');

  const now = 1790940000000;

  // -------------------------------------------------------------
  // Test 1: Low intent insight
  // -------------------------------------------------------------
  const lowSig = createSignals({ lastInteractionAt: now - 3600000 });
  const lowScr = createScore({ level: 'low', score: 25, signals: ['price_inquiry_detected'] });
  const insight1: CustomerSalesInsight = CustomerSalesInsightService.buildSalesInsight(lowSig, lowScr, now);

  assert(insight1.intentLevel === 'low', `Test 1a: intentLevel is "low" (got ${insight1.intentLevel})`);
  assert(insight1.intentScore === 25, `Test 1b: intentScore is 25 (got ${insight1.intentScore})`);

  // -------------------------------------------------------------
  // Test 2: Medium intent insight
  // -------------------------------------------------------------
  const medSig = createSignals({ totalOrders: 1, completedOrders: 1, totalSpent: 4200000 });
  const medScr = createScore({ level: 'medium', score: 55, signals: ['purchase_intent_detected', 'product_inquiry_detected'] });
  const insight2: CustomerSalesInsight = CustomerSalesInsightService.buildSalesInsight(medSig, medScr, now);

  assert(insight2.intentLevel === 'medium', `Test 2a: intentLevel is "medium" (got ${insight2.intentLevel})`);
  assert(insight2.intentScore === 55, `Test 2b: intentScore is 55 (got ${insight2.intentScore})`);

  // -------------------------------------------------------------
  // Test 3: High intent insight
  // -------------------------------------------------------------
  const highSig = createSignals({ hasActiveOrder: true, isRepeatCustomer: true, totalOrders: 3, completedOrders: 2 });
  const highScr = createScore({ level: 'high', score: 85, signals: ['active_order', 'repeat_customer', 'purchase_intent_detected'] });
  const insight3: CustomerSalesInsight = CustomerSalesInsightService.buildSalesInsight(highSig, highScr, now);

  assert(insight3.intentLevel === 'high', `Test 3a: intentLevel is "high" (got ${insight3.intentLevel})`);
  assert(insight3.intentScore === 85, `Test 3b: intentScore is 85 (got ${insight3.intentScore})`);

  // -------------------------------------------------------------
  // Test 4: Correct customerId
  // -------------------------------------------------------------
  assert(insight3.customerId === 'cust_insight_1', 'Test 4: customerId matches signals and score');

  // -------------------------------------------------------------
  // Test 5: Correct businessId
  // -------------------------------------------------------------
  assert(insight3.businessId === 'biz_super_shop', 'Test 5: businessId matches signals and score');

  // -------------------------------------------------------------
  // Test 6: Correct totals
  // -------------------------------------------------------------
  const richSig = createSignals({
    totalOrders: 10,
    completedOrders: 8,
    cancelledOrders: 2,
    totalSpent: 45000000,
  });
  const insightTotals = CustomerSalesInsightService.buildSalesInsight(richSig, highScr, now);

  assert(insightTotals.totalOrders === 10, `Test 6a: totalOrders is 10 (got ${insightTotals.totalOrders})`);
  assert(insightTotals.completedOrders === 8, `Test 6b: completedOrders is 8 (got ${insightTotals.completedOrders})`);
  assert(insightTotals.cancelledOrders === 2, `Test 6c: cancelledOrders is 2 (got ${insightTotals.cancelledOrders})`);
  assert(insightTotals.totalSpent === 45000000, `Test 6d: totalSpent is 45,000,000 (got ${insightTotals.totalSpent})`);

  // -------------------------------------------------------------
  // Test 7: Correct intentScore
  // -------------------------------------------------------------
  assert(insightTotals.intentScore === 85, 'Test 7: intentScore matches M6.3 score object');

  // -------------------------------------------------------------
  // Test 8: Correct intentLevel
  // -------------------------------------------------------------
  assert(insightTotals.intentLevel === 'high', 'Test 8: intentLevel matches M6.3 level');

  // -------------------------------------------------------------
  // Test 9: Correct signals
  // -------------------------------------------------------------
  assert(
    JSON.stringify(insightTotals.signals) ===
      JSON.stringify(['active_order', 'repeat_customer', 'purchase_intent_detected']),
    'Test 9: signals array exactly mirrors M6.3 score signals'
  );

  // -------------------------------------------------------------
  // Test 10: Null dates handling
  // -------------------------------------------------------------
  const nullDatesSig = createSignals({ lastOrderAt: null, lastInteractionAt: null });
  const insightNull = CustomerSalesInsightService.buildSalesInsight(nullDatesSig, lowScr, now);
  assert(insightNull.lastOrderAt === null, 'Test 10a: lastOrderAt is null');
  assert(insightNull.lastInteractionAt === null, 'Test 10b: lastInteractionAt is null');

  const withDatesSig = createSignals({ lastOrderAt: now - 50000, lastInteractionAt: now - 10000 });
  const insightDates = CustomerSalesInsightService.buildSalesInsight(withDatesSig, lowScr, now);
  assert(insightDates.lastOrderAt === now - 50000, 'Test 10c: lastOrderAt timestamp preserved');
  assert(insightDates.lastInteractionAt === now - 10000, 'Test 10d: lastInteractionAt timestamp preserved');

  // -------------------------------------------------------------
  // Test 11: Deterministic mapping (repeated calls produce identical output)
  // -------------------------------------------------------------
  const runA = CustomerSalesInsightService.buildSalesInsight(medSig, medScr, now);
  const runB = CustomerSalesInsightService.buildSalesInsight(medSig, medScr, now);
  assert(JSON.stringify(runA) === JSON.stringify(runB), 'Test 11: Deterministic mapping produces identical JSON');

  // -------------------------------------------------------------
  // Test 12: Tenant isolation
  // -------------------------------------------------------------
  // Case A: Tenant B signals with Tenant B score
  const tenantBSig = createSignals({ businessId: 'biz_tenant_b', customerId: 'cust_b_user' });
  const tenantBScr = createScore({ businessId: 'biz_tenant_b', customerId: 'cust_b_user' });
  const insightB = CustomerSalesInsightService.buildSalesInsight(tenantBSig, tenantBScr, now);
  assert(insightB.businessId === 'biz_tenant_b', 'Test 12a: Tenant B businessId preserved');
  assert(insightB.customerId === 'cust_b_user', 'Test 12b: Tenant B customerId preserved');

  // Case B: Cross-tenant mismatch error check
  let tenantMismatchThrown = false;
  try {
    CustomerSalesInsightService.buildSalesInsight(
      createSignals({ businessId: 'biz_alpha', customerId: 'cust_1' }),
      createScore({ businessId: 'biz_beta', customerId: 'cust_1' }),
      now
    );
  } catch {
    tenantMismatchThrown = true;
  }
  assert(tenantMismatchThrown, 'Test 12c: Cross-tenant mismatch throws error and prevents data leak');

  // Case C: Customer ID mismatch error check
  let custMismatchThrown = false;
  try {
    CustomerSalesInsightService.buildSalesInsight(
      createSignals({ businessId: 'biz_alpha', customerId: 'cust_1' }),
      createScore({ businessId: 'biz_alpha', customerId: 'cust_2' }),
      now
    );
  } catch {
    custMismatchThrown = true;
  }
  assert(custMismatchThrown, 'Test 12d: Customer mismatch throws error and prevents data corruption');

  console.log('===================================================================================================');
  console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===================================================================================================');

  if (failCount > 0) {
    throw new Error(`${failCount} tests failed.`);
  }
  console.log('🎉 ALL 12 M6.4 PART 2 SALES INSIGHT BUILDER TESTS PASSED SUCCESSFULLY!');
}

runM642Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal M6.4 Part 2 test runner error:', err);
    process.exit(1);
  });
