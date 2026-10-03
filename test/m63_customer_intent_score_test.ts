import {
  CustomerIntentScoreService,
  INTENT_SCORE_THRESHOLDS,
  INTENT_SIGNAL_WEIGHTS
} from '../server/analytics/customerIntentScore';
import { CustomerSalesSignals } from '../src/types/salesSignals';

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

function createBaseSignals(overrides: Partial<CustomerSalesSignals> = {}): CustomerSalesSignals {
  return {
    customerId: 'cust_m63_01',
    businessId: 'biz_store_a',
    hasActiveOrder: false,
    hasCompletedOrder: false,
    hasCancelledOrder: false,
    isRepeatCustomer: false,
    totalOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    totalSpent: 0,
    lastOrderAt: null,
    lastInteractionAt: Date.now(),
    purchaseIntentDetected: false,
    productInquiryDetected: false,
    priceInquiryDetected: false,
    stockInquiryDetected: false,
    ...overrides,
  };
}

async function runM63Part2Tests() {
  console.log('===================================================================================================');
  console.log('🚀 M6.3 PART 2 — DETERMINISTIC INTENT SCORING VERIFICATION');
  console.log('===================================================================================================');

  const now = 1790860000000;

  // -------------------------------------------------------------
  // Test 1: Barcha signal false → 0 / low
  // -------------------------------------------------------------
  const allFalseSignals = createBaseSignals();
  const res1 = CustomerIntentScoreService.calculateScoreFromSignals(allFalseSignals, now);

  assert(res1.score === 0, `Test 1a: All false signals score is 0 (got ${res1.score})`);
  assert(res1.level === 'low', `Test 1b: All false signals level is "low" (got ${res1.level})`);
  assert(res1.signals.length === 0, `Test 1c: Contributing signals array is empty`);

  // -------------------------------------------------------------
  // Test 2: Purchase intent → 30 / low (0-39 range)
  // -------------------------------------------------------------
  const purchaseSignals = createBaseSignals({ purchaseIntentDetected: true });
  const res2 = CustomerIntentScoreService.calculateScoreFromSignals(purchaseSignals, now);

  assert(res2.score === 30, `Test 2a: Purchase intent score is 30 (got ${res2.score})`);
  assert(res2.level === 'low', `Test 2b: 30 is mapped to "low" (got ${res2.level})`);
  assert(
    res2.signals.includes('purchase_intent_detected') && res2.signals.length === 1,
    'Test 2c: Signals array contains exactly ["purchase_intent_detected"]'
  );

  // -------------------------------------------------------------
  // Test 3: Active order → 40 / medium (40-69 range)
  // -------------------------------------------------------------
  const activeSignals = createBaseSignals({ hasActiveOrder: true });
  const res3 = CustomerIntentScoreService.calculateScoreFromSignals(activeSignals, now);

  assert(res3.score === 40, `Test 3a: Active order score is 40 (got ${res3.score})`);
  assert(res3.level === 'medium', `Test 3b: 40 is mapped to "medium" (got ${res3.level})`);
  assert(
    res3.signals.includes('active_order') && res3.signals.length === 1,
    'Test 3c: Signals array contains exactly ["active_order"]'
  );

  // -------------------------------------------------------------
  // Test 4: Active order + Purchase intent → 40 + 30 = 70 / high (70-100 range)
  // -------------------------------------------------------------
  const activeAndPurchaseSignals = createBaseSignals({
    hasActiveOrder: true,
    purchaseIntentDetected: true,
  });
  const res4 = CustomerIntentScoreService.calculateScoreFromSignals(activeAndPurchaseSignals, now);

  assert(res4.score === 70, `Test 4a: Active order + purchase intent score is 70 (got ${res4.score})`);
  assert(res4.level === 'high', `Test 4b: 70 is mapped to "high" (got ${res4.level})`);
  assert(
    res4.signals.includes('active_order') && res4.signals.includes('purchase_intent_detected'),
    'Test 4c: Signals array contains both active_order and purchase_intent_detected'
  );

  // -------------------------------------------------------------
  // Test 5: Repeat customer + Completed order → 15 + 10 = 25 / low
  // -------------------------------------------------------------
  const repeatCompletedSignals = createBaseSignals({
    isRepeatCustomer: true,
    hasCompletedOrder: true,
  });
  const res5 = CustomerIntentScoreService.calculateScoreFromSignals(repeatCompletedSignals, now);

  assert(res5.score === 25, `Test 5a: Repeat customer (15) + completed order (10) score is 25 (got ${res5.score})`);
  assert(res5.level === 'low', `Test 5b: 25 is mapped to "low" (got ${res5.level})`);
  assert(
    res5.signals.includes('repeat_customer') && res5.signals.includes('completed_order') && res5.signals.length === 2,
    'Test 5c: Signals array contains repeat_customer and completed_order'
  );

  // -------------------------------------------------------------
  // Test 6: Cancellation penalty (-10)
  // -------------------------------------------------------------
  // Active order (40) + Cancelled order (-10) = 30 / low
  const activeWithCancelSignals = createBaseSignals({
    hasActiveOrder: true,
    hasCancelledOrder: true,
  });
  const res6 = CustomerIntentScoreService.calculateScoreFromSignals(activeWithCancelSignals, now);

  assert(res6.score === 30, `Test 6a: 40 - 10 = 30 score with cancellation penalty (got ${res6.score})`);
  assert(res6.level === 'low', `Test 6b: 30 with penalty is "low" (got ${res6.level})`);
  assert(res6.signals.includes('cancelled_order'), 'Test 6c: Signals array includes "cancelled_order"');

  // -------------------------------------------------------------
  // Test 7: Multiple signals
  // -------------------------------------------------------------
  // Purchase intent (30) + Product inquiry (10) + Price inquiry (8) + Stock inquiry (5) = 53 / medium
  const multiSignals = createBaseSignals({
    purchaseIntentDetected: true,
    productInquiryDetected: true,
    priceInquiryDetected: true,
    stockInquiryDetected: true,
  });
  const res7 = CustomerIntentScoreService.calculateScoreFromSignals(multiSignals, now);

  assert(res7.score === 53, `Test 7a: 30 + 10 + 8 + 5 = 53 score (got ${res7.score})`);
  assert(res7.level === 'medium', `Test 7b: 53 is "medium" (got ${res7.level})`);
  assert(res7.signals.length === 4, `Test 7c: Exactly 4 signals recorded (got ${res7.signals.length})`);
  assert(res7.signals.includes('product_inquiry_detected'), 'Test 7d: product_inquiry_detected present');
  assert(res7.signals.includes('price_inquiry_detected'), 'Test 7e: price_inquiry_detected present');
  assert(res7.signals.includes('stock_inquiry_detected'), 'Test 7f: stock_inquiry_detected present');

  // -------------------------------------------------------------
  // Test 8: Score never below 0
  // -------------------------------------------------------------
  const onlyCancelSignals = createBaseSignals({
    hasCancelledOrder: true, // raw = -10
  });
  const res8 = CustomerIntentScoreService.calculateScoreFromSignals(onlyCancelSignals, now);

  assert(res8.score === 0, `Test 8a: Score clamped to 0 when negative (got ${res8.score})`);
  assert(res8.score >= 0, 'Test 8b: Score is >= 0');
  assert(res8.level === 'low', 'Test 8c: Clamped 0 is "low"');
  assert(res8.signals.includes('cancelled_order'), 'Test 8d: Signals records contributing cancelled_order');

  // -------------------------------------------------------------
  // Test 9: Score never above 100
  // -------------------------------------------------------------
  // All positive signals: 40 + 30 + 15 + 10 + 10 + 8 + 5 = 118 raw -> clamped to 100
  const maxSignals = createBaseSignals({
    hasActiveOrder: true,
    purchaseIntentDetected: true,
    isRepeatCustomer: true,
    hasCompletedOrder: true,
    productInquiryDetected: true,
    priceInquiryDetected: true,
    stockInquiryDetected: true,
  });
  const res9 = CustomerIntentScoreService.calculateScoreFromSignals(maxSignals, now);

  assert(res9.score === 100, `Test 9a: Score clamped to 100 when > 100 (got ${res9.score})`);
  assert(res9.score <= 100, 'Test 9b: Score is <= 100');
  assert(res9.level === 'high', 'Test 9c: 100 is "high"');

  // -------------------------------------------------------------
  // Test 10: Explainable signals (only contributing signals)
  // -------------------------------------------------------------
  const explainSignals = createBaseSignals({
    hasActiveOrder: true,
    priceInquiryDetected: true,
  });
  const res10 = CustomerIntentScoreService.calculateScoreFromSignals(explainSignals, now);

  assert(
    JSON.stringify(res10.signals) === JSON.stringify(['active_order', 'price_inquiry_detected']),
    `Test 10: Signals array only contains the 2 contributing signals: ${JSON.stringify(res10.signals)}`
  );

  // -------------------------------------------------------------
  // Test 11: Deterministic repeated calculation
  // -------------------------------------------------------------
  const calcA = CustomerIntentScoreService.calculateScoreFromSignals(multiSignals, now);
  const calcB = CustomerIntentScoreService.calculateScoreFromSignals(multiSignals, now);
  const calcC = CustomerIntentScoreService.calculateScoreFromSignals(multiSignals, now);

  assert(calcA.score === calcB.score && calcB.score === calcC.score, 'Test 11a: Scores are identical on repeated runs');
  assert(calcA.level === calcB.level && calcB.level === calcC.level, 'Test 11b: Levels are identical on repeated runs');
  assert(
    JSON.stringify(calcA.signals) === JSON.stringify(calcB.signals) &&
      JSON.stringify(calcB.signals) === JSON.stringify(calcC.signals),
    'Test 11c: Signals are identical on repeated runs'
  );

  console.log('===================================================================================================');
  console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===================================================================================================');

  if (failCount > 0) {
    throw new Error(`${failCount} tests failed.`);
  }
  console.log('🎉 ALL 11 M6.3 PART 2 DETERMINISTIC INTENT SCORING TESTS PASSED SUCCESSFULLY!');
}

runM63Part2Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal M6.3 Part 2 test runner error:', err);
    process.exit(1);
  });
