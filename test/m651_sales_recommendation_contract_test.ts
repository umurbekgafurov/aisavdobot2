import {
  SalesRecommendationService,
  VALID_RECOMMENDATION_ACTIONS,
  isValidRecommendationAction,
  validateSalesRecommendation
} from '../server/analytics/salesRecommendation';
import { SalesRecommendation } from '../src/types/salesRecommendation';

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

async function runM651Tests() {
  console.log('===================================================================================================');
  console.log('🚀 M6.5 PART 1 — AI RECOMMENDATION CONTRACT VERIFICATION');
  console.log('===================================================================================================');

  // -------------------------------------------------------------
  // Test 1: follow_up action
  // -------------------------------------------------------------
  const rec1: SalesRecommendation = SalesRecommendationService.createRecommendation(
    'follow_up',
    'Mijoz 24 soat oldin mahsulot so‘ragan ammo buyurtma bermagan',
    0.85
  );
  assert(rec1.action === 'follow_up', 'Test 1a: action is follow_up');
  assert(rec1.confidence === 0.85, 'Test 1b: confidence is 0.85');
  assert(validateSalesRecommendation(rec1).isValid === true, 'Test 1c: Validated as valid');

  // -------------------------------------------------------------
  // Test 2: product_recommendation action
  // -------------------------------------------------------------
  const rec2: SalesRecommendation = SalesRecommendationService.createRecommendation(
    'product_recommendation',
    'Mijoz qidirgan telefon omborda yo‘q, muqobil modelni tavsiya qilish',
    0.78
  );
  assert(rec2.action === 'product_recommendation', 'Test 2a: action is product_recommendation');
  assert(rec2.confidence === 0.78, 'Test 2b: confidence is 0.78');
  assert(validateSalesRecommendation(rec2).isValid === true, 'Test 2c: Validated as valid');

  // -------------------------------------------------------------
  // Test 3: price_follow_up action
  // -------------------------------------------------------------
  const rec3: SalesRecommendation = SalesRecommendationService.createRecommendation(
    'price_follow_up',
    'Mijoz narx so‘raganidan so‘ng to‘xtab qolgan, maxsus chegirma taklif qilish',
    0.9
  );
  assert(rec3.action === 'price_follow_up', 'Test 3a: action is price_follow_up');
  assert(rec3.confidence === 0.9, 'Test 3b: confidence is 0.9');
  assert(validateSalesRecommendation(rec3).isValid === true, 'Test 3c: Validated as valid');

  // -------------------------------------------------------------
  // Test 4: order_follow_up action
  // -------------------------------------------------------------
  const rec4: SalesRecommendation = SalesRecommendationService.createRecommendation(
    'order_follow_up',
    'Mijozning faol buyurtmasi yetkazilmoqda, yetkazib berish holatini xabar qilish',
    0.95
  );
  assert(rec4.action === 'order_follow_up', 'Test 4a: action is order_follow_up');
  assert(rec4.confidence === 0.95, 'Test 4b: confidence is 0.95');
  assert(validateSalesRecommendation(rec4).isValid === true, 'Test 4c: Validated as valid');

  // -------------------------------------------------------------
  // Test 5: repeat_purchase action
  // -------------------------------------------------------------
  const rec5: SalesRecommendation = SalesRecommendationService.createRecommendation(
    'repeat_purchase',
    'Doimiy mijoz oxirgi xariddan 30 kun o‘tgach qayta eslatma',
    0.65
  );
  assert(rec5.action === 'repeat_purchase', 'Test 5a: action is repeat_purchase');
  assert(rec5.confidence === 0.65, 'Test 5b: confidence is 0.65');
  assert(validateSalesRecommendation(rec5).isValid === true, 'Test 5c: Validated as valid');

  // -------------------------------------------------------------
  // Test 6: no_action action
  // -------------------------------------------------------------
  const rec6: SalesRecommendation = SalesRecommendationService.createRecommendation(
    'no_action',
    'Mijoz yaqinda to‘liq buyurtma olgan yoki hech qanday yangi ehtiyoj bildirmagan',
    0.99
  );
  assert(rec6.action === 'no_action', 'Test 6a: action is no_action');
  assert(rec6.confidence === 0.99, 'Test 6b: confidence is 0.99');
  assert(validateSalesRecommendation(rec6).isValid === true, 'Test 6c: Validated as valid');

  // -------------------------------------------------------------
  // Test 7: confidence = 0 (Lower boundary)
  // -------------------------------------------------------------
  const recZero: SalesRecommendation = {
    action: 'no_action',
    reason: 'Minimal confidence edge case',
    confidence: 0,
  };
  const valZero = validateSalesRecommendation(recZero);
  assert(valZero.isValid === true, 'Test 7a: confidence 0 is valid edge case');
  assert(recZero.confidence === 0, 'Test 7b: confidence is exactly 0');

  // -------------------------------------------------------------
  // Test 8: confidence = 1 (Upper boundary)
  // -------------------------------------------------------------
  const recOne: SalesRecommendation = {
    action: 'follow_up',
    reason: 'Max confidence edge case',
    confidence: 1,
  };
  const valOne = validateSalesRecommendation(recOne);
  assert(valOne.isValid === true, 'Test 8a: confidence 1 is valid edge case');
  assert(recOne.confidence === 1, 'Test 8b: confidence is exactly 1');

  // -------------------------------------------------------------
  // Test 9: invalid confidence (< 0, > 1, NaN)
  // -------------------------------------------------------------
  const invalidNeg = validateSalesRecommendation({
    action: 'follow_up',
    reason: 'Test',
    confidence: -0.1,
  });
  assert(invalidNeg.isValid === false, 'Test 9a: confidence -0.1 is rejected');

  const invalidOver = validateSalesRecommendation({
    action: 'follow_up',
    reason: 'Test',
    confidence: 1.05,
  });
  assert(invalidOver.isValid === false, 'Test 9b: confidence 1.05 is rejected');

  const invalidNaN = validateSalesRecommendation({
    action: 'follow_up',
    reason: 'Test',
    confidence: NaN,
  });
  assert(invalidNaN.isValid === false, 'Test 9c: confidence NaN is rejected');

  // -------------------------------------------------------------
  // Test 10: invalid action
  // -------------------------------------------------------------
  const invalidAction1 = isValidRecommendationAction('send_spam');
  assert(invalidAction1 === false, 'Test 10a: "send_spam" is not a valid action');

  const invalidAction2 = validateSalesRecommendation({
    action: 'buy_now_auto',
    reason: 'Automated unauthorized order',
    confidence: 0.9,
  });
  assert(invalidAction2.isValid === false, 'Test 10b: invalid action rejected by validator');

  // Ensure all 6 valid actions are acknowledged
  assert(VALID_RECOMMENDATION_ACTIONS.length === 6, 'Test 10c: Exactly 6 valid recommendation actions defined');

  console.log('===================================================================================================');
  console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===================================================================================================');

  if (failCount > 0) {
    throw new Error(`${failCount} tests failed.`);
  }
  console.log('🎉 ALL 10 M6.5 PART 1 AI RECOMMENDATION CONTRACT TESTS PASSED SUCCESSFULLY!');
}

runM651Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal M6.5 Part 1 test runner error:', err);
    process.exit(1);
  });
