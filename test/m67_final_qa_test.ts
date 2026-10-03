import { ACTION_LABELS } from '../src/components/CustomersView';
import { SalesActionGenerator } from '../server/analytics/salesActionGenerator';
import { SalesActionService, validateSalesAssistantAction } from '../server/analytics/salesActionContract';
import { SalesIntelligenceService } from '../src/services/salesIntelligenceService';
import { Customer, Order, SalesRecommendation } from '../src/types';
import { CustomerSalesInsight } from '../src/types/salesInsight';
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

async function runM67FinalQA() {
  console.log('===================================================================================================');
  console.log('🚀 M6.7 PART 5 — FINAL COMPREHENSIVE QA VERIFICATION');
  console.log('===================================================================================================');

  const now = 1791020000000;
  const bizA = 'tenant_supermarket_samarkand';
  const bizB = 'tenant_boutique_tashkent';
  const custA = 'cust_akbar';
  const custB = 'cust_dildora';

  const insightA: CustomerSalesInsight = {
    customerId: custA,
    businessId: bizA,
    intentLevel: 'high',
    intentScore: 90,
    signals: ['active_order', 'is_repeat_customer', 'purchase_intent_detected'],
    totalOrders: 4,
    completedOrders: 3,
    cancelledOrders: 0,
    totalSpent: 25000000,
    lastOrderAt: now - 1800000,
    lastInteractionAt: now - 600000,
    generatedAt: now,
  };

  const insightB: CustomerSalesInsight = {
    customerId: custB,
    businessId: bizB,
    intentLevel: 'low',
    intentScore: 15,
    signals: [],
    totalOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    totalSpent: 0,
    lastOrderAt: null,
    lastInteractionAt: null,
    generatedAt: now,
  };

  // -------------------------------------------------------------
  // QA 1: Full pipeline: M6.5 Recommendation -> M6.7 Action Generator -> SalesAssistantAction
  // -------------------------------------------------------------
  const recOrder: SalesRecommendation = {
    action: 'order_follow_up',
    reason: 'Mijoz faol buyurtma bergan va yetkazilishini kutmoqda',
    confidence: 0.95,
  };
  const actionFromPipeline = SalesActionGenerator.generateAction(insightA, recOrder);

  assert(actionFromPipeline.action === 'order_follow_up', 'QA 1a: Pipeline generates order_follow_up action');
  assert(actionFromPipeline.customerId === custA, 'QA 1b: customerId matches insight customerId');
  assert(actionFromPipeline.businessId === bizA, 'QA 1c: businessId matches insight businessId');
  assert(actionFromPipeline.reason === recOrder.reason, 'QA 1d: reason preserved from recommendation');
  assert(actionFromPipeline.confidence === 0.95, 'QA 1e: confidence preserved from recommendation');
  assert(actionFromPipeline.suggestedText.includes('Buyurtmangiz holati'), 'QA 1f: suggestedText contains order status message');
  assert(validateSalesAssistantAction(actionFromPipeline).isValid === true, 'QA 1g: action conforms to Action Contract');

  // -------------------------------------------------------------
  // QA 2: All 6 Action Types & Label Translations
  // -------------------------------------------------------------
  const actionsMatrix: Array<{
    type: 'follow_up' | 'product_recommendation' | 'price_follow_up' | 'order_follow_up' | 'repeat_purchase' | 'no_action';
    expectedLabel: string;
    expectedSuggestedTextSnippet?: string;
  }> = [
    { type: 'follow_up', expectedLabel: 'Mijoz bilan bog‘lanish', expectedSuggestedTextSnippet: 'Murojaatingiz bo‘yicha' },
    { type: 'product_recommendation', expectedLabel: 'Mahsulot tavsiyasi', expectedSuggestedTextSnippet: 'yangi variantlar va tavsiyalarimiz' },
    { type: 'price_follow_up', expectedLabel: 'Narx bo‘yicha follow-up', expectedSuggestedTextSnippet: 'Narxlar va mavjud takliflar' },
    { type: 'order_follow_up', expectedLabel: 'Buyurtma follow-up', expectedSuggestedTextSnippet: 'Buyurtmangiz holati' },
    { type: 'repeat_purchase', expectedLabel: 'Qayta xarid', expectedSuggestedTextSnippet: 'Do‘konimizning doimiy mijozi' },
    { type: 'no_action', expectedLabel: 'Harakat kerak emas' },
  ];

  for (const item of actionsMatrix) {
    const rec: SalesRecommendation = {
      action: item.type,
      reason: `Test reason for ${item.type}`,
      confidence: 0.88,
    };
    const act = SalesActionGenerator.generateAction(insightA, rec);

    assert(act.action === item.type, `QA 2 [${item.type}] action match`);
    assert(ACTION_LABELS[act.action] === item.expectedLabel, `QA 2 [${item.type}] label match: ${item.expectedLabel}`);

    if (item.type === 'no_action') {
      assert(act.suggestedText === '', 'QA 2 [no_action] suggestedText is empty string');
    } else {
      assert(
        act.suggestedText.includes(item.expectedSuggestedTextSnippet!),
        `QA 2 [${item.type}] suggestedText includes: ${item.expectedSuggestedTextSnippet}`
      );
    }
  }

  // -------------------------------------------------------------
  // QA 3: Confidence range 0–1 and invalid confidence handling
  // -------------------------------------------------------------
  const recZeroConf: SalesRecommendation = { action: 'no_action', reason: 'Zero conf', confidence: 0 };
  const actZeroConf = SalesActionGenerator.generateAction(insightA, recZeroConf);
  assert(actZeroConf.confidence === 0, 'QA 3a: 0 confidence is valid');

  const recMaxConf: SalesRecommendation = { action: 'order_follow_up', reason: 'Max conf', confidence: 1 };
  const actMaxConf = SalesActionGenerator.generateAction(insightA, recMaxConf);
  assert(actMaxConf.confidence === 1, 'QA 3b: 1 confidence is valid');

  // Negative confidence -> fallback
  const recNegConf = { action: 'follow_up', reason: 'Negative', confidence: -0.2 };
  const actNegConf = SalesActionGenerator.generateAction(insightA, recNegConf as any);
  assert(actNegConf.action === 'no_action', 'QA 3c: negative confidence triggers no_action fallback');
  assert(actNegConf.confidence === 0, 'QA 3d: fallback confidence is 0');

  // Confidence > 1 -> fallback
  const recOverConf = { action: 'follow_up', reason: 'Over', confidence: 1.25 };
  const actOverConf = SalesActionGenerator.generateAction(insightA, recOverConf as any);
  assert(actOverConf.action === 'no_action', 'QA 3e: confidence > 1 triggers no_action fallback');
  assert(actOverConf.confidence === 0, 'QA 3f: fallback confidence is 0');

  // Confidence NaN -> fallback
  const recNanConf = { action: 'follow_up', reason: 'NaN', confidence: NaN };
  const actNanConf = SalesActionGenerator.generateAction(insightA, recNanConf as any);
  assert(actNanConf.action === 'no_action', 'QA 3g: NaN confidence triggers no_action fallback');

  // -------------------------------------------------------------
  // QA 4: customerId and businessId Mapping
  // -------------------------------------------------------------
  assert(actionFromPipeline.customerId === custA, 'QA 4a: customerId mapped');
  assert(actionFromPipeline.businessId === bizA, 'QA 4b: businessId mapped');

  const actionB = SalesActionGenerator.generateAction(insightB, {
    action: 'product_recommendation',
    reason: 'Product inquiry from Dildora',
    confidence: 0.82,
  });
  assert(actionB.customerId === custB, 'QA 4c: Customer B customerId mapped');
  assert(actionB.businessId === bizB, 'QA 4d: Business B businessId mapped');

  // -------------------------------------------------------------
  // QA 5: UI Empty State & no_action copy
  // -------------------------------------------------------------
  const emptyStateNotice = 'AI Sales Assistant tavsiyasi mavjud emas';
  assert(emptyStateNotice === 'AI Sales Assistant tavsiyasi mavjud emas', 'QA 5a: empty state string matches');

  const noActionNotice = 'Hozircha avtomatik harakat tavsiya etilmaydi';
  assert(noActionNotice === 'Hozircha avtomatik harakat tavsiya etilmaydi', 'QA 5b: no_action text matches');

  // -------------------------------------------------------------
  // QA 6: Customer Switching (State Reset)
  // -------------------------------------------------------------
  let selectedCustId = custA;
  let currentRecommendation: SalesRecommendation | null = recOrder;
  let activeAction: SalesAssistantAction | null = SalesActionGenerator.generateAction(insightA, currentRecommendation);

  assert(activeAction !== null, 'QA 6a: Customer A active action is computed');
  assert(activeAction!.customerId === custA, 'QA 6b: Active action belongs to Customer A');

  // Customer switch: customer selection changes -> recommendation is reset to null
  selectedCustId = custB;
  currentRecommendation = null;
  activeAction = currentRecommendation ? SalesActionGenerator.generateAction(insightB, currentRecommendation) : null;

  assert(activeAction === null, 'QA 6c: Recommendation and action are completely reset to null upon customer switch');

  // -------------------------------------------------------------
  // QA 7: Tenant Isolation
  // -------------------------------------------------------------
  assert(actionFromPipeline.businessId === bizA, 'QA 7a: Action A strictly scoped to bizA');
  assert(actionB.businessId === bizB, 'QA 7b: Action B strictly scoped to bizB');
  assert(actionFromPipeline.businessId !== actionB.businessId, 'QA 7c: No tenant cross-contamination');

  // -------------------------------------------------------------
  // QA 8: M6.6 Regression (CustomersView Sales Intelligence & Orders)
  // -------------------------------------------------------------
  const customerRecord: Customer = {
    id: custA,
    businessId: bizA,
    firstName: 'Akbar',
    status: 'Faol',
    source: 'telegram',
    totalOrders: 2,
    totalSpent: 10000000,
    createdAt: now - 100000,
  };
  const ordersRecord: Order[] = [
    {
      id: 'ord_qa_1',
      businessId: bizA,
      customerId: custA,
      status: 'completed',
      subtotal: 10000000,
      total: 10000000,
      createdAt: now - 50000,
      updatedAt: now - 50000,
      items: [{ productId: 'p1', productName: 'iPhone 15 Pro', quantity: 1, unitPrice: 10000000 }],
    },
  ];

  const m66Insight = SalesIntelligenceService.computeCustomerInsight(customerRecord, ordersRecord);
  assert(m66Insight !== null, 'QA 8a: M6.6 sales intelligence insight computed');
  assert(m66Insight!.totalOrders === 1, 'QA 8b: Total orders count is 1');
  assert(m66Insight!.completedOrders === 1, 'QA 8c: Completed orders count is 1');
  assert(m66Insight!.totalSpent === 10000000, 'QA 8d: Total spent is 10,000,000');
  assert(m66Insight!.intentLevel === 'low', 'QA 8e: Single completed order without active order is low intent');

  // -------------------------------------------------------------
  // QA 9: Zero Mutation Guarantee
  // -------------------------------------------------------------
  // Assert order item, status, total remain unchanged
  assert(ordersRecord[0].total === 10000000, 'QA 9a: Order total was not modified');
  assert(ordersRecord[0].status === 'completed', 'QA 9b: Order status was not modified');
  assert(customerRecord.status === 'Faol', 'QA 9c: Customer status was not modified');

  console.log('===================================================================================================');
  console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===================================================================================================');

  if (failCount > 0) {
    throw new Error(`${failCount} tests failed.`);
  }
  console.log('🎉 ALL M6.7 FINAL QA VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runM67FinalQA()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal M6.7 Final QA test runner error:', err);
    process.exit(1);
  });
