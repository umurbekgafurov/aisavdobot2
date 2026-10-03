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

function createMockSignals(overrides: Partial<CustomerSalesSignals> = {}): CustomerSalesSignals {
  return {
    customerId: 'cust_m64_01',
    businessId: 'biz_alpha',
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

function createMockScore(overrides: Partial<CustomerIntentScore> = {}): CustomerIntentScore {
  return {
    customerId: 'cust_m64_01',
    businessId: 'biz_alpha',
    level: 'low',
    score: 0,
    signals: [],
    calculatedAt: Date.now(),
    ...overrides,
  };
}

async function runM641Tests() {
  console.log('===================================================================================================');
  console.log('🚀 M6.4 PART 1 — SALES INSIGHT DATA MODEL & MAPPING VERIFICATION');
  console.log('===================================================================================================');

  const now = 1790930000000;

  // -------------------------------------------------------------
  // Test 1: Valid Low Intent
  // -------------------------------------------------------------
  const lowSignals = createMockSignals();
  const lowScore = createMockScore({ level: 'low', score: 20, signals: ['price_inquiry_detected'] });
  const insightLow: CustomerSalesInsight = CustomerSalesInsightService.mapToSalesInsight(lowSignals, lowScore, now);

  assert(insightLow.intentLevel === 'low', `Test 1a: intentLevel is "low" (got ${insightLow.intentLevel})`);
  assert(insightLow.intentScore === 20, `Test 1b: intentScore is 20 (got ${insightLow.intentScore})`);

  // -------------------------------------------------------------
  // Test 2: Valid Medium Intent
  // -------------------------------------------------------------
  const medSignals = createMockSignals({ totalOrders: 1, completedOrders: 1, totalSpent: 2500000 });
  const medScore = createMockScore({ level: 'medium', score: 55, signals: ['purchase_intent_detected'] });
  const insightMed = CustomerSalesInsightService.mapToSalesInsight(medSignals, medScore, now);

  assert(insightMed.intentLevel === 'medium', `Test 2a: intentLevel is "medium" (got ${insightMed.intentLevel})`);
  assert(insightMed.intentScore === 55, `Test 2b: intentScore is 55 (got ${insightMed.intentScore})`);

  // -------------------------------------------------------------
  // Test 3: Valid High Intent
  // -------------------------------------------------------------
  const highSignals = createMockSignals({ hasActiveOrder: true, totalOrders: 2 });
  const highScore = createMockScore({ level: 'high', score: 85, signals: ['active_order', 'purchase_intent_detected'] });
  const insightHigh = CustomerSalesInsightService.mapToSalesInsight(highSignals, highScore, now);

  assert(insightHigh.intentLevel === 'high', `Test 3a: intentLevel is "high" (got ${insightHigh.intentLevel})`);
  assert(insightHigh.intentScore === 85, `Test 3b: intentScore is 85 (got ${insightHigh.intentScore})`);

  // -------------------------------------------------------------
  // Test 4: Score 0
  // -------------------------------------------------------------
  const scoreZeroSignals = createMockSignals();
  const scoreZero = createMockScore({ score: 0, level: 'low', signals: [] });
  const insightZero = CustomerSalesInsightService.mapToSalesInsight(scoreZeroSignals, scoreZero, now);

  assert(insightZero.intentScore === 0, `Test 4a: Score 0 mapped properly (got ${insightZero.intentScore})`);
  assert(insightZero.intentLevel === 'low', `Test 4b: Level is low for score 0`);

  // -------------------------------------------------------------
  // Test 5: Score 100
  // -------------------------------------------------------------
  const score100Signals = createMockSignals();
  const score100 = createMockScore({ score: 100, level: 'high' });
  const insight100 = CustomerSalesInsightService.mapToSalesInsight(score100Signals, score100, now);

  assert(insight100.intentScore === 100, `Test 5a: Score 100 mapped properly (got ${insight100.intentScore})`);
  assert(insight100.intentLevel === 'high', `Test 5b: Level is high for score 100`);

  // -------------------------------------------------------------
  // Test 6: Empty Signals
  // -------------------------------------------------------------
  assert(Array.isArray(insightZero.signals), 'Test 6a: signals is an array');
  assert(insightZero.signals.length === 0, 'Test 6b: empty signals array retained as []');

  // -------------------------------------------------------------
  // Test 7: Null Dates
  // -------------------------------------------------------------
  const nullDatesSignals = createMockSignals({ lastOrderAt: null, lastInteractionAt: null });
  const insightNullDates = CustomerSalesInsightService.mapToSalesInsight(nullDatesSignals, lowScore, now);

  assert(insightNullDates.lastOrderAt === null, 'Test 7a: lastOrderAt is null');
  assert(insightNullDates.lastInteractionAt === null, 'Test 7b: lastInteractionAt is null');

  // When timestamps exist
  const withDatesSignals = createMockSignals({ lastOrderAt: now - 50000, lastInteractionAt: now - 10000 });
  const insightWithDates = CustomerSalesInsightService.mapToSalesInsight(withDatesSignals, lowScore, now);
  assert(insightWithDates.lastOrderAt === now - 50000, 'Test 7c: lastOrderAt numeric timestamp preserved');
  assert(insightWithDates.lastInteractionAt === now - 10000, 'Test 7d: lastInteractionAt numeric timestamp preserved');

  // -------------------------------------------------------------
  // Test 8: Correct customerId
  // -------------------------------------------------------------
  assert(insightHigh.customerId === 'cust_m64_01', 'Test 8: customerId correctly matches input');

  // -------------------------------------------------------------
  // Test 9: Correct businessId
  // -------------------------------------------------------------
  assert(insightHigh.businessId === 'biz_alpha', 'Test 9: businessId correctly matches input');

  // Mismatch error check
  let mismatchCaught = false;
  try {
    CustomerSalesInsightService.mapToSalesInsight(
      createMockSignals({ customerId: 'cust_A', businessId: 'biz_1' }),
      createMockScore({ customerId: 'cust_B', businessId: 'biz_1' })
    );
  } catch {
    mismatchCaught = true;
  }
  assert(mismatchCaught, 'Test 9b: Customer mismatch throws error');

  // -------------------------------------------------------------
  // Test 10: Correct Totals
  // -------------------------------------------------------------
  const totalsSignals = createMockSignals({
    totalOrders: 5,
    completedOrders: 3,
    cancelledOrders: 1,
    totalSpent: 18450000,
  });
  const insightTotals = CustomerSalesInsightService.mapToSalesInsight(totalsSignals, medScore, now);

  assert(insightTotals.totalOrders === 5, `Test 10a: totalOrders is 5 (got ${insightTotals.totalOrders})`);
  assert(insightTotals.completedOrders === 3, `Test 10b: completedOrders is 3 (got ${insightTotals.completedOrders})`);
  assert(insightTotals.cancelledOrders === 1, `Test 10c: cancelledOrders is 1 (got ${insightTotals.cancelledOrders})`);
  assert(insightTotals.totalSpent === 18450000, `Test 10d: totalSpent is 18,450,000 (got ${insightTotals.totalSpent})`);
  assert(insightTotals.generatedAt === now, 'Test 10e: generatedAt timestamp preserved');

  console.log('===================================================================================================');
  console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===================================================================================================');

  if (failCount > 0) {
    throw new Error(`${failCount} tests failed.`);
  }
  console.log('🎉 ALL 10 M6.4 PART 1 SALES INSIGHT DATA MODEL TESTS PASSED SUCCESSFULLY!');
}

runM641Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal M6.4 Part 1 test runner error:', err);
    process.exit(1);
  });
