import { SalesActionGenerator } from '../server/analytics/salesActionGenerator';
import { CustomerSalesInsight } from '../src/types/salesInsight';
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

async function runM673Tests() {
  console.log('===================================================================================================');
  console.log('🚀 M6.7 PART 3 — SALES ASSISTANT ACTION GENERATOR VERIFICATION');
  console.log('===================================================================================================');

  const now = 1791000000000;
  const bizA = 'biz_gadgets_center';
  const bizB = 'biz_fashion_house';
  const custA = 'cust_muzaffar';
  const custB = 'cust_nodira';

  const baseInsightA: CustomerSalesInsight = {
    customerId: custA,
    businessId: bizA,
    intentLevel: 'high',
    intentScore: 85,
    signals: ['active_order', 'purchase_intent_detected'],
    totalOrders: 3,
    completedOrders: 2,
    cancelledOrders: 0,
    totalSpent: 16000000,
    lastOrderAt: now - 3600000,
    lastInteractionAt: now - 1800000,
    generatedAt: now,
  };

  const baseInsightB: CustomerSalesInsight = {
    customerId: custB,
    businessId: bizB,
    intentLevel: 'medium',
    intentScore: 50,
    signals: ['price_inquiry_detected'],
    totalOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    totalSpent: 0,
    lastOrderAt: null,
    lastInteractionAt: now - 7200000,
    generatedAt: now,
  };

  // -------------------------------------------------------------
  // Test 1: order_follow_up action mapping
  // -------------------------------------------------------------
  const recOrderFollowUp: SalesRecommendation = {
    action: 'order_follow_up',
    reason: 'Mijozning faol buyurtmasi mavjud, yetkazib berish holatini bildirish zarur',
    confidence: 0.94,
  };
  const action1 = SalesActionGenerator.generateAction(baseInsightA, recOrderFollowUp);

  assert(action1.action === 'order_follow_up', 'Test 1a: action is order_follow_up');
  assert(action1.customerId === custA, 'Test 1b: customerId mapped from insight');
  assert(action1.businessId === bizA, 'Test 1c: businessId mapped from insight');
  assert(action1.reason === recOrderFollowUp.reason, 'Test 1d: reason mapped from recommendation');
  assert(action1.confidence === 0.94, 'Test 1e: confidence mapped from recommendation');
  assert(action1.suggestedText.includes('Buyurtmangiz holati'), 'Test 1f: suggestedText has order follow up message');

  // -------------------------------------------------------------
  // Test 2: price_follow_up action mapping
  // -------------------------------------------------------------
  const recPriceFollowUp: SalesRecommendation = {
    action: 'price_follow_up',
    reason: 'Mijoz narx so‘ragan ammo buyurtma bermagan',
    confidence: 0.86,
  };
  const action2 = SalesActionGenerator.generateAction(baseInsightB, recPriceFollowUp);

  assert(action2.action === 'price_follow_up', 'Test 2a: action is price_follow_up');
  assert(action2.customerId === custB, 'Test 2b: customerId mapped to custB');
  assert(action2.businessId === bizB, 'Test 2c: businessId mapped to bizB');
  assert(action2.suggestedText.includes('Narxlar va mavjud takliflar'), 'Test 2d: suggestedText has price message');

  // -------------------------------------------------------------
  // Test 3: product_recommendation action mapping
  // -------------------------------------------------------------
  const recProductRec: SalesRecommendation = {
    action: 'product_recommendation',
    reason: 'Mijoz yangi tovarlar haqida qiziqmoqda',
    confidence: 0.8,
  };
  const action3 = SalesActionGenerator.generateAction(baseInsightA, recProductRec);

  assert(action3.action === 'product_recommendation', 'Test 3a: action is product_recommendation');
  assert(action3.suggestedText.includes('yangi variantlar va tavsiyalarimiz bor'), 'Test 3b: suggestedText has product recommendation text');

  // -------------------------------------------------------------
  // Test 4: repeat_purchase action mapping
  // -------------------------------------------------------------
  const recRepeatPurchase: SalesRecommendation = {
    action: 'repeat_purchase',
    reason: 'Doimiy xaridor 2 tadan ortiq buyurtma bergan',
    confidence: 0.77,
  };
  const action4 = SalesActionGenerator.generateAction(baseInsightA, recRepeatPurchase);

  assert(action4.action === 'repeat_purchase', 'Test 4a: action is repeat_purchase');
  assert(action4.suggestedText.includes('Do‘konimizning doimiy mijozi'), 'Test 4b: suggestedText has repeat purchase text');

  // -------------------------------------------------------------
  // Test 5: follow_up action mapping
  // -------------------------------------------------------------
  const recFollowUp: SalesRecommendation = {
    action: 'follow_up',
    reason: 'Mijoz javob kutmoqda',
    confidence: 0.89,
  };
  const action5 = SalesActionGenerator.generateAction(baseInsightA, recFollowUp);

  assert(action5.action === 'follow_up', 'Test 5a: action is follow_up');
  assert(action5.suggestedText.includes('Murojaatingiz bo‘yicha'), 'Test 5b: suggestedText has general follow up text');

  // -------------------------------------------------------------
  // Test 6: no_action action mapping (suggestedText must be empty)
  // -------------------------------------------------------------
  const recNoAction: SalesRecommendation = {
    action: 'no_action',
    reason: 'Qo‘shimcha harakat talab etilmaydi',
    confidence: 0.99,
  };
  const action6 = SalesActionGenerator.generateAction(baseInsightA, recNoAction);

  assert(action6.action === 'no_action', 'Test 6a: action is no_action');
  assert(action6.suggestedText === '', 'Test 6b: suggestedText is empty string for no_action');
  assert(action6.confidence === 0.99, 'Test 6c: confidence preserved');

  // -------------------------------------------------------------
  // Test 7: Confidence mapping & bounds
  // -------------------------------------------------------------
  const recEdgeConfidence: SalesRecommendation = {
    action: 'follow_up',
    reason: 'Boundary confidence',
    confidence: 0,
  };
  const actionEdge = SalesActionGenerator.generateAction(baseInsightA, recEdgeConfidence);
  assert(actionEdge.confidence === 0, 'Test 7: 0 confidence mapped properly');

  // -------------------------------------------------------------
  // Test 8: Missing or null recommendation -> Fallback
  // -------------------------------------------------------------
  const actionNullRec = SalesActionGenerator.generateAction(baseInsightA, null as any);
  assert(actionNullRec.action === 'no_action', 'Test 8a: null recommendation falls back to no_action');
  assert(actionNullRec.confidence === 0, 'Test 8b: fallback confidence is 0');
  assert(actionNullRec.customerId === custA, 'Test 8c: customerId preserved in fallback');
  assert(actionNullRec.businessId === bizA, 'Test 8d: businessId preserved in fallback');

  // -------------------------------------------------------------
  // Test 9: Invalid recommendation (bad confidence or invalid action) -> Fallback
  // -------------------------------------------------------------
  const badConfidenceRec = {
    action: 'follow_up',
    reason: 'Too confident',
    confidence: 1.5,
  };
  const actionBadConf = SalesActionGenerator.generateAction(baseInsightA, badConfidenceRec as any);
  assert(actionBadConf.action === 'no_action', 'Test 9a: invalid confidence falls back to no_action');
  assert(actionBadConf.confidence === 0, 'Test 9b: fallback confidence is 0');

  const badActionRec = {
    action: 'send_telegram_broadcast',
    reason: 'Invalid action',
    confidence: 0.9,
  };
  const actionBadAct = SalesActionGenerator.generateAction(baseInsightA, badActionRec as any);
  assert(actionBadAct.action === 'no_action', 'Test 9c: invalid action falls back to no_action');

  // -------------------------------------------------------------
  // Test 10: Missing or null insight -> Safe Fallback
  // -------------------------------------------------------------
  const actionNullInsight = SalesActionGenerator.generateAction(null as any, recFollowUp);
  assert(actionNullInsight.action === 'no_action', 'Test 10a: null insight falls back to no_action');
  assert(actionNullInsight.confidence === 0, 'Test 10b: fallback confidence is 0');

  const actionEmptyInsight = SalesActionGenerator.generateAction({} as any, recFollowUp);
  assert(actionEmptyInsight.action === 'no_action', 'Test 10c: empty insight falls back to no_action');

  // -------------------------------------------------------------
  // Test 11: Tenant Isolation (businessId + customerId)
  // -------------------------------------------------------------
  const actionA = SalesActionGenerator.generateAction(baseInsightA, recOrderFollowUp);
  const actionB = SalesActionGenerator.generateAction(baseInsightB, recPriceFollowUp);

  assert(actionA.businessId === bizA, 'Test 11a: Action A strictly scoped to bizA');
  assert(actionA.customerId === custA, 'Test 11b: Action A strictly scoped to custA');
  assert(actionB.businessId === bizB, 'Test 11c: Action B strictly scoped to bizB');
  assert(actionB.customerId === custB, 'Test 11d: Action B strictly scoped to custB');
  assert(actionA.businessId !== actionB.businessId, 'Test 11e: No cross-tenant bleeding');

  console.log('===================================================================================================');
  console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===================================================================================================');

  if (failCount > 0) {
    throw new Error(`${failCount} tests failed.`);
  }
  console.log('🎉 ALL M6.7 PART 3 SALES ASSISTANT ACTION GENERATOR TESTS PASSED SUCCESSFULLY!');
}

runM673Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal M6.7 Part 3 test runner error:', err);
    process.exit(1);
  });
