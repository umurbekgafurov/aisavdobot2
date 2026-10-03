import {
  SalesActionService,
  VALID_SALES_ACTIONS,
  isValidSalesAction,
  validateSalesAssistantAction
} from '../server/analytics/salesActionContract';
import { SalesAssistantAction } from '../src/types/salesAction';

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

async function runM672Tests() {
  console.log('===================================================================================================');
  console.log('🚀 M6.7 PART 2 — AI SALES ASSISTANT ACTION CONTRACT VERIFICATION');
  console.log('===================================================================================================');

  const bizA = 'biz_electronics_uz';
  const bizB = 'biz_apparel_uz';
  const custA = 'cust_dilshod';
  const custB = 'cust_sarvar';

  // -------------------------------------------------------------
  // Test 1: follow_up action
  // -------------------------------------------------------------
  const action1 = SalesActionService.createAction({
    action: 'follow_up',
    customerId: custA,
    businessId: bizA,
    reason: 'Mijoz 24 soat oldin savol bergan ammo davom ettirmagan',
    confidence: 0.85,
    suggestedText: 'Assalomu alaykum! Smartfonlar bo‘yicha savollaringiz bormi? Sizga yordam berishdan mamnunmiz.',
  });
  assert(action1.action === 'follow_up', 'Test 1a: action is follow_up');
  assert(action1.customerId === custA, 'Test 1b: customerId matches');
  assert(action1.businessId === bizA, 'Test 1c: businessId matches');
  assert(action1.confidence === 0.85, 'Test 1d: confidence is 0.85');
  assert(action1.suggestedText.includes('Smartfonlar'), 'Test 1e: suggestedText is present');
  assert(validateSalesAssistantAction(action1).isValid === true, 'Test 1f: validated successfully');

  // -------------------------------------------------------------
  // Test 2: product_recommendation action
  // -------------------------------------------------------------
  const action2 = SalesActionService.createAction({
    action: 'product_recommendation',
    customerId: custA,
    businessId: bizA,
    reason: 'Mijoz flagman smartfonlarga qiziqmoqda',
    confidence: 0.9,
    suggestedText: 'Bizda yangi Samsung Galaxy S25 Ultra keldi, narxi va xususiyatlari bilan tanishib ko‘rasizmi?',
  });
  assert(action2.action === 'product_recommendation', 'Test 2a: action is product_recommendation');
  assert(validateSalesAssistantAction(action2).isValid === true, 'Test 2b: validated successfully');

  // -------------------------------------------------------------
  // Test 3: price_follow_up action
  // -------------------------------------------------------------
  const action3 = SalesActionService.createAction({
    action: 'price_follow_up',
    customerId: custA,
    businessId: bizA,
    reason: 'Mijoz narx so‘raganidan keyin to‘xtab qolgan',
    confidence: 0.88,
    suggestedText: 'Siz so‘ragan model uchun bugun 5% lik maxsus chegirma kuponini taqdim eta olamiz!',
  });
  assert(action3.action === 'price_follow_up', 'Test 3a: action is price_follow_up');
  assert(validateSalesAssistantAction(action3).isValid === true, 'Test 3b: validated successfully');

  // -------------------------------------------------------------
  // Test 4: order_follow_up action
  // -------------------------------------------------------------
  const action4 = SalesActionService.createAction({
    action: 'order_follow_up',
    customerId: custA,
    businessId: bizA,
    reason: 'Mijozning faol buyurtmasi yetkazilmoqda',
    confidence: 0.95,
    suggestedText: 'Sizning buyurtmangiz kuryerga topshirildi, yetib borgach kuryer telefon qiladi.',
  });
  assert(action4.action === 'order_follow_up', 'Test 4a: action is order_follow_up');
  assert(validateSalesAssistantAction(action4).isValid === true, 'Test 4b: validated successfully');

  // -------------------------------------------------------------
  // Test 5: repeat_purchase action
  // -------------------------------------------------------------
  const action5 = SalesActionService.createAction({
    action: 'repeat_purchase',
    customerId: custA,
    businessId: bizA,
    reason: 'Doimiy xaridor, avvalgi xariddan 30 kun o‘tgan',
    confidence: 0.75,
    suggestedText: 'Assalomu alaykum, doimiy mijozimiz sifatida sizga yangi aksessuarlarimiz uchun maxsus taklifimiz bor.',
  });
  assert(action5.action === 'repeat_purchase', 'Test 5a: action is repeat_purchase');
  assert(validateSalesAssistantAction(action5).isValid === true, 'Test 5b: validated successfully');

  // -------------------------------------------------------------
  // Test 6: no_action action
  // -------------------------------------------------------------
  const action6 = SalesActionService.createAction({
    action: 'no_action',
    customerId: custA,
    businessId: bizA,
    reason: 'Hozirda harakat talab etilmaydi, xarid niyati past',
    confidence: 0.98,
    suggestedText: '',
  });
  assert(action6.action === 'no_action', 'Test 6a: action is no_action');
  assert(action6.suggestedText === '', 'Test 6b: suggestedText is empty string for no_action');
  assert(validateSalesAssistantAction(action6).isValid === true, 'Test 6c: validated successfully');

  // -------------------------------------------------------------
  // Test 7: Confidence boundaries (0 and 1)
  // -------------------------------------------------------------
  const actionZero = SalesActionService.createAction({
    action: 'no_action',
    customerId: custA,
    businessId: bizA,
    reason: 'Zero confidence edge case',
    confidence: 0,
    suggestedText: '',
  });
  assert(actionZero.confidence === 0, 'Test 7a: confidence 0 is valid');

  const actionOne = SalesActionService.createAction({
    action: 'order_follow_up',
    customerId: custA,
    businessId: bizA,
    reason: 'Max confidence edge case',
    confidence: 1,
    suggestedText: 'Holat yangilandi',
  });
  assert(actionOne.confidence === 1, 'Test 7b: confidence 1 is valid');

  // -------------------------------------------------------------
  // Test 8: Invalid confidence rejection (< 0, > 1, NaN)
  // -------------------------------------------------------------
  const negConfVal = validateSalesAssistantAction({
    action: 'follow_up',
    customerId: custA,
    businessId: bizA,
    reason: 'Reason',
    confidence: -0.1,
    suggestedText: 'Text',
  });
  assert(negConfVal.isValid === false, 'Test 8a: confidence -0.1 rejected');

  const overConfVal = validateSalesAssistantAction({
    action: 'follow_up',
    customerId: custA,
    businessId: bizA,
    reason: 'Reason',
    confidence: 1.1,
    suggestedText: 'Text',
  });
  assert(overConfVal.isValid === false, 'Test 8b: confidence 1.1 rejected');

  const nanConfVal = validateSalesAssistantAction({
    action: 'follow_up',
    customerId: custA,
    businessId: bizA,
    reason: 'Reason',
    confidence: NaN,
    suggestedText: 'Text',
  });
  assert(nanConfVal.isValid === false, 'Test 8c: confidence NaN rejected');

  // -------------------------------------------------------------
  // Test 9: customerId validation
  // -------------------------------------------------------------
  const emptyCustVal = validateSalesAssistantAction({
    action: 'follow_up',
    customerId: '',
    businessId: bizA,
    reason: 'Reason',
    confidence: 0.8,
    suggestedText: 'Text',
  });
  assert(emptyCustVal.isValid === false, 'Test 9a: empty customerId rejected');

  const missingCustVal = validateSalesAssistantAction({
    action: 'follow_up',
    customerId: null,
    businessId: bizA,
    reason: 'Reason',
    confidence: 0.8,
    suggestedText: 'Text',
  });
  assert(missingCustVal.isValid === false, 'Test 9b: null customerId rejected');

  // -------------------------------------------------------------
  // Test 10: businessId validation
  // -------------------------------------------------------------
  const emptyBizVal = validateSalesAssistantAction({
    action: 'follow_up',
    customerId: custA,
    businessId: '',
    reason: 'Reason',
    confidence: 0.8,
    suggestedText: 'Text',
  });
  assert(emptyBizVal.isValid === false, 'Test 10a: empty businessId rejected');

  // -------------------------------------------------------------
  // Test 11: suggestedText validation
  // -------------------------------------------------------------
  const invalidTextVal = validateSalesAssistantAction({
    action: 'follow_up',
    customerId: custA,
    businessId: bizA,
    reason: 'Reason',
    confidence: 0.8,
    suggestedText: null,
  });
  assert(invalidTextVal.isValid === false, 'Test 11: non-string suggestedText rejected');

  // -------------------------------------------------------------
  // Test 12: Invalid action type rejection
  // -------------------------------------------------------------
  const invalidActionVal = validateSalesAssistantAction({
    action: 'auto_create_invoice_and_bill_card',
    customerId: custA,
    businessId: bizA,
    reason: 'Reason',
    confidence: 0.8,
    suggestedText: 'Text',
  });
  assert(invalidActionVal.isValid === false, 'Test 12a: unauthorized action type rejected');
  assert(VALID_SALES_ACTIONS.length === 6, 'Test 12b: exactly 6 valid actions defined');

  // -------------------------------------------------------------
  // Test 13: Tenant Isolation (businessId + customerId)
  // -------------------------------------------------------------
  const actionTenantB = SalesActionService.createAction({
    action: 'follow_up',
    customerId: custB,
    businessId: bizB,
    reason: 'Tenant B kiyim-kechak do‘koni mijozi',
    confidence: 0.82,
    suggestedText: 'Yangi kolleksiyamiz bilan tanishib chiqing',
  });
  assert(actionTenantB.businessId === bizB, 'Test 13a: action strictly scoped to bizB');
  assert(actionTenantB.customerId === custB, 'Test 13b: action strictly scoped to custB');
  assert(action1.businessId !== actionTenantB.businessId, 'Test 13c: Tenant A and Tenant B isolated');

  // -------------------------------------------------------------
  // Test 14: Fallback Action
  // -------------------------------------------------------------
  const fallback = SalesActionService.createFallbackAction(custA, bizA);
  assert(fallback.action === 'no_action', 'Test 14a: fallback action is no_action');
  assert(fallback.confidence === 0, 'Test 14b: fallback confidence is 0');
  assert(fallback.customerId === custA, 'Test 14c: fallback preserves customerId');
  assert(fallback.businessId === bizA, 'Test 14d: fallback preserves businessId');

  console.log('===================================================================================================');
  console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===================================================================================================');

  if (failCount > 0) {
    throw new Error(`${failCount} tests failed.`);
  }
  console.log('🎉 ALL M6.7 PART 2 ACTION CONTRACT TESTS PASSED SUCCESSFULLY!');
}

runM672Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal M6.7 Part 2 test runner error:', err);
    process.exit(1);
  });
