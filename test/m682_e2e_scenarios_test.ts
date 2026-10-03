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

async function runM682E2ETests() {
  console.log('===================================================================================================');
  console.log('🚀 M6.8 PART 2 — COMPLETE END-TO-END QA (10 SCENARIOS)');
  console.log('===================================================================================================');

  const now = 1791040000000;
  const bizA = 'biz_fashion_tashkent';
  const bizB = 'biz_electronics_samarkand';

  // =============================================================
  // SCENARIO 1: New Customer (No orders, no messages, low/empty)
  // =============================================================
  console.log('--- SCENARIO 1: New Customer ---');
  const newCustomer: Customer = {
    id: 'cust_sc1',
    businessId: bizA,
    firstName: 'Madina',
    status: 'Yangi',
    source: 'telegram',
    totalOrders: 0,
    totalSpent: 0,
    createdAt: now - 3600000,
  };

  const signals1 = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: newCustomer.id,
    customer: newCustomer,
    orders: [],
    messages: [],
  });
  assert(signals1.hasActiveOrder === false, '1a: No active order');
  assert(signals1.hasCompletedOrder === false, '1b: No completed order');
  assert(signals1.hasCancelledOrder === false, '1c: No cancelled order');
  assert(signals1.isRepeatCustomer === false, '1d: Not repeat customer');
  assert(signals1.totalOrders === 0, '1e: Total orders is 0');
  assert(signals1.totalSpent === 0, '1f: Total spent is 0');
  assert(signals1.purchaseIntentDetected === false, '1g: No purchase intent');

  const score1 = CustomerIntentScoreService.calculateScoreFromSignals(signals1, now);
  assert(score1.score === 0, '1h: Intent score is 0');
  assert(score1.level === 'low', '1i: Intent level is low');
  assert(score1.signals.length === 0, '1j: Signals array is empty');

  const insight1 = CustomerSalesInsightService.buildSalesInsight(signals1, score1, now);
  assert(insight1.intentScore === 0, '1k: Insight intentScore is 0');
  assert(insight1.intentLevel === 'low', '1l: Insight intentLevel is low');
  assert(insight1.totalOrders === 0, '1m: Insight totalOrders is 0');

  const rec1: SalesRecommendation = {
    action: 'no_action',
    reason: 'Yangi mijozda hozircha faollik yoki xarid niyati mavjud emas',
    confidence: 0,
  };
  const action1 = SalesActionGenerator.generateAction(insight1, rec1);
  assert(action1.action === 'no_action', '1n: Action is no_action');
  assert(action1.confidence === 0, '1o: Confidence is 0');
  assert(action1.suggestedText === '', '1p: Suggested text is empty string');
  assert(ACTION_LABELS[action1.action] === 'Harakat kerak emas', '1q: UI label is "Harakat kerak emas"');
  assert(validateSalesAssistantAction(action1).isValid === true, '1r: Action contract is valid');

  // =============================================================
  // SCENARIO 2: Product Inquiry
  // =============================================================
  console.log('--- SCENARIO 2: Product Inquiry ---');
  const cust2: Customer = {
    id: 'cust_sc2',
    businessId: bizA,
    firstName: 'Jasur',
    status: 'Faol',
    source: 'telegram',
    totalOrders: 0,
    totalSpent: 0,
    createdAt: now - 7200000,
  };
  const msgs2: ConversationMessage[] = [
    {
      id: 'msg_sc2',
      businessId: bizA,
      customerId: cust2.id,
      conversationId: 'conv_2',
      direction: 'inbound',
      channel: 'telegram',
      telegramMessageId: 201,
      telegramChatId: 'chat_2',
      type: 'text',
      media: null,
      aiProcessed: true,
      aiIntent: 'product_query',
      aiProductName: 'Klassik Kostyum',
      text: 'Klassik Kostyum qora rangi bormi?',
      createdAt: now - 1800000,
    },
  ];

  const signals2 = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: cust2.id,
    customer: cust2,
    orders: [],
    messages: msgs2,
  });
  assert(signals2.productInquiryDetected === true, '2a: Product inquiry detected');
  assert(signals2.priceInquiryDetected === false, '2b: Price inquiry not detected');

  const score2 = CustomerIntentScoreService.calculateScoreFromSignals(signals2, now);
  assert(score2.score === 10, '2c: Score is 10 (product inquiry weight)');
  assert(score2.level === 'low', '2d: Intent level is low');
  assert(score2.signals.includes('product_inquiry_detected'), '2e: Score signals include product_inquiry_detected');

  const insight2 = CustomerSalesInsightService.buildSalesInsight(signals2, score2, now);
  const rec2: SalesRecommendation = {
    action: 'product_recommendation',
    reason: 'Mijoz Klassik Kostyum mahsuloti bo‘yicha qiziqish bildirgan',
    confidence: 0.85,
  };
  const action2 = SalesActionGenerator.generateAction(insight2, rec2);
  assert(action2.action === 'product_recommendation', '2f: Action is product_recommendation');
  assert(action2.suggestedText.includes('yangi variantlar va tavsiyalarimiz'), '2g: Suggested text contains product recommendation');
  assert(ACTION_LABELS[action2.action] === 'Mahsulot tavsiyasi', '2h: UI label is "Mahsulot tavsiyasi"');
  assert(validateSalesAssistantAction(action2).isValid === true, '2i: Action contract is valid');

  // =============================================================
  // SCENARIO 3: Price Inquiry
  // =============================================================
  console.log('--- SCENARIO 3: Price Inquiry ---');
  const cust3: Customer = {
    id: 'cust_sc3',
    businessId: bizA,
    firstName: 'Dilnoza',
    status: 'Faol',
    source: 'telegram',
    totalOrders: 0,
    totalSpent: 0,
    createdAt: now - 3600000,
  };
  const msgs3: ConversationMessage[] = [
    {
      id: 'msg_sc3',
      businessId: bizA,
      customerId: cust3.id,
      conversationId: 'conv_3',
      direction: 'inbound',
      channel: 'telegram',
      telegramMessageId: 301,
      telegramChatId: 'chat_3',
      type: 'text',
      media: null,
      aiProcessed: true,
      aiIntent: 'price_query',
      text: 'Bu ko‘ylak narxi qancha?',
      createdAt: now - 900000,
    },
  ];

  const signals3 = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: cust3.id,
    customer: cust3,
    orders: [],
    messages: msgs3,
  });
  assert(signals3.priceInquiryDetected === true, '3a: Price inquiry detected');

  const score3 = CustomerIntentScoreService.calculateScoreFromSignals(signals3, now);
  assert(score3.score === 8, '3b: Score is 8 (price inquiry weight)');
  assert(score3.signals.includes('price_inquiry_detected'), '3c: Signals include price_inquiry_detected');

  const insight3 = CustomerSalesInsightService.buildSalesInsight(signals3, score3, now);
  const rec3: SalesRecommendation = {
    action: 'price_follow_up',
    reason: 'Mijoz mahsulot narxi bo‘yicha ma’lumot so‘ragan',
    confidence: 0.88,
  };
  const action3 = SalesActionGenerator.generateAction(insight3, rec3);
  assert(action3.action === 'price_follow_up', '3d: Action is price_follow_up');
  assert(action3.suggestedText.includes('Narxlar va mavjud takliflar'), '3e: Suggested text contains price info');
  assert(ACTION_LABELS[action3.action] === 'Narx bo‘yicha follow-up', '3f: UI label is "Narx bo‘yicha follow-up"');
  assert(validateSalesAssistantAction(action3).isValid === true, '3g: Action contract is valid');

  // =============================================================
  // SCENARIO 4: Purchase Intent
  // =============================================================
  console.log('--- SCENARIO 4: Purchase Intent ---');
  const cust4: Customer = {
    id: 'cust_sc4',
    businessId: bizA,
    firstName: 'Bobur',
    status: 'Faol',
    source: 'telegram',
    totalOrders: 0,
    totalSpent: 0,
    createdAt: now - 3600000,
  };
  const msgs4: ConversationMessage[] = [
    {
      id: 'msg_sc4_1',
      businessId: bizA,
      customerId: cust4.id,
      conversationId: 'conv_4',
      direction: 'inbound',
      channel: 'telegram',
      telegramMessageId: 401,
      telegramChatId: 'chat_4',
      type: 'text',
      media: null,
      aiProcessed: true,
      aiIntent: 'order_intent',
      text: 'Men ushbu mahsulotni buyurtma qilmoqchiman',
      createdAt: now - 500000,
    },
    {
      id: 'msg_sc4_2',
      businessId: bizA,
      customerId: cust4.id,
      conversationId: 'conv_4',
      direction: 'inbound',
      channel: 'telegram',
      telegramMessageId: 402,
      telegramChatId: 'chat_4',
      type: 'text',
      media: null,
      aiProcessed: true,
      aiIntent: 'product_query',
      text: 'Razmer M bormi?',
      createdAt: now - 400000,
    },
  ];

  const signals4 = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: cust4.id,
    customer: cust4,
    orders: [],
    messages: msgs4,
  });
  assert(signals4.purchaseIntentDetected === true, '4a: Purchase intent detected');
  assert(signals4.productInquiryDetected === true, '4b: Product inquiry detected');

  const score4 = CustomerIntentScoreService.calculateScoreFromSignals(signals4, now);
  // 30 (purchase) + 10 (product) = 40 -> medium
  assert(score4.score === 40, '4c: Score is 40');
  assert(score4.level === 'medium', '4d: Level is medium (score >= 40)');
  assert(score4.signals.includes('purchase_intent_detected'), '4e: Signals include purchase_intent_detected');

  const insight4 = CustomerSalesInsightService.buildSalesInsight(signals4, score4, now);
  const rec4: SalesRecommendation = {
    action: 'follow_up',
    reason: 'Mijoz xarid niyatini bildirgan va tezkor yordam talab etiladi',
    confidence: 0.91,
  };
  const action4 = SalesActionGenerator.generateAction(insight4, rec4);
  assert(action4.action === 'follow_up', '4f: Action is follow_up');
  assert(action4.suggestedText.includes('Murojaatingiz bo‘yicha'), '4g: Suggested text contains follow-up message');
  assert(ACTION_LABELS[action4.action] === 'Mijoz bilan bog‘lanish', '4h: UI label is "Mijoz bilan bog‘lanish"');
  assert(validateSalesAssistantAction(action4).isValid === true, '4i: Action contract is valid');

  // =============================================================
  // SCENARIO 5: Repeat Customer
  // =============================================================
  console.log('--- SCENARIO 5: Repeat Customer ---');
  const cust5: Customer = {
    id: 'cust_sc5',
    businessId: bizA,
    firstName: 'Nodira',
    status: 'Faol',
    source: 'telegram',
    totalOrders: 2,
    totalSpent: 9000000,
    createdAt: now - 86400000 * 30,
  };
  const orders5: Order[] = [
    {
      id: 'ord_5_1',
      businessId: bizA,
      customerId: cust5.id,
      status: 'completed',
      subtotal: 4000000,
      total: 4000000,
      createdAt: now - 86400000 * 15,
      updatedAt: now - 86400000 * 15,
      items: [{ productId: 'p5a', productName: 'Yozgi libos', quantity: 2, unitPrice: 2000000 }],
    },
    {
      id: 'ord_5_2',
      businessId: bizA,
      customerId: cust5.id,
      status: 'completed',
      subtotal: 5000000,
      total: 5000000,
      createdAt: now - 86400000 * 2,
      updatedAt: now - 86400000 * 2,
      items: [{ productId: 'p5b', productName: 'Qishki palto', quantity: 1, unitPrice: 5000000 }],
    },
  ];

  const signals5 = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: cust5.id,
    customer: cust5,
    orders: orders5,
    messages: [],
  });
  assert(signals5.isRepeatCustomer === true, '5a: Repeat customer detected (2 completed orders)');
  assert(signals5.hasCompletedOrder === true, '5b: Completed order detected');
  assert(signals5.totalSpent === 9000000, '5c: Total spent is 9,000,000');
  assert(signals5.totalOrders === 2, '5d: Total orders is 2');

  const score5 = CustomerIntentScoreService.calculateScoreFromSignals(signals5, now);
  // 15 (repeat) + 10 (completed) = 25 -> low
  assert(score5.score === 25, '5e: Score is 25');
  assert(score5.signals.includes('repeat_customer'), '5f: Signals include repeat_customer');

  const insight5 = CustomerSalesInsightService.buildSalesInsight(signals5, score5, now);
  const rec5: SalesRecommendation = {
    action: 'repeat_purchase',
    reason: 'Doimiy mijoz uchun qayta xarid taklifi va minnatdorchilik',
    confidence: 0.89,
  };
  const action5 = SalesActionGenerator.generateAction(insight5, rec5);
  assert(action5.action === 'repeat_purchase', '5g: Action is repeat_purchase');
  assert(action5.suggestedText.includes('Do‘konimizning doimiy mijozi'), '5h: Suggested text contains repeat purchase text');
  assert(ACTION_LABELS[action5.action] === 'Qayta xarid', '5i: UI label is "Qayta xarid"');
  assert(validateSalesAssistantAction(action5).isValid === true, '5j: Action contract is valid');

  // =============================================================
  // SCENARIO 6: Active Order
  // =============================================================
  console.log('--- SCENARIO 6: Active Order ---');
  const cust6: Customer = {
    id: 'cust_sc6',
    businessId: bizA,
    firstName: 'Farhod',
    status: 'Faol',
    source: 'telegram',
    totalOrders: 2,
    totalSpent: 16000000,
    createdAt: now - 86400000 * 5,
  };
  const orders6: Order[] = [
    {
      id: 'ord_6_prev',
      businessId: bizA,
      customerId: cust6.id,
      status: 'completed',
      subtotal: 8000000,
      total: 8000000,
      createdAt: now - 86400000 * 3,
      updatedAt: now - 86400000 * 3,
      items: [{ productId: 'p6a', productName: 'Poyabzal', quantity: 2, unitPrice: 4000000 }],
    },
    {
      id: 'ord_6_act',
      businessId: bizA,
      customerId: cust6.id,
      status: 'confirmed',
      subtotal: 8000000,
      total: 8000000,
      createdAt: now - 1800000,
      updatedAt: now - 1800000,
      items: [{ productId: 'p6b', productName: 'Kostyum', quantity: 1, unitPrice: 8000000 }],
    },
  ];
  const msgs6: ConversationMessage[] = [
    {
      id: 'msg_sc6',
      businessId: bizA,
      customerId: cust6.id,
      conversationId: 'conv_6',
      direction: 'inbound',
      channel: 'telegram',
      telegramMessageId: 601,
      telegramChatId: 'chat_6',
      type: 'text',
      media: null,
      aiProcessed: true,
      aiIntent: 'order_intent',
      text: 'Bugun yetkazib berasizlarmi?',
      createdAt: now - 600000,
    },
  ];

  const signals6 = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: cust6.id,
    customer: cust6,
    orders: orders6,
    messages: msgs6,
  });
  assert(signals6.hasActiveOrder === true, '6a: Active order detected');
  assert(signals6.hasCompletedOrder === true, '6b: Completed order detected');

  const score6 = CustomerIntentScoreService.calculateScoreFromSignals(signals6, now);
  // 40 (active) + 30 (purchase) + 15 (repeat) + 10 (completed) = 95 -> high
  assert(score6.score >= 70, '6c: Intent score is high (got ' + score6.score + ')');
  assert(score6.level === 'high', '6d: Intent level is high');
  assert(score6.signals.includes('active_order'), '6e: Signals include active_order');

  const insight6 = CustomerSalesInsightService.buildSalesInsight(signals6, score6, now);
  const rec6: SalesRecommendation = {
    action: 'order_follow_up',
    reason: 'Mijozning tasdiqlangan buyurtmasi mavjud va yetkazib berish vaqtini so‘ragan',
    confidence: 0.96,
  };
  const action6 = SalesActionGenerator.generateAction(insight6, rec6);
  assert(action6.action === 'order_follow_up', '6f: Action is order_follow_up');
  assert(action6.confidence === 0.96, '6g: Confidence is 0.96');
  assert(action6.suggestedText.includes('Buyurtmangiz holati'), '6h: Suggested text contains order status');
  assert(ACTION_LABELS[action6.action] === 'Buyurtma follow-up', '6i: UI label is "Buyurtma follow-up"');
  assert(validateSalesAssistantAction(action6).isValid === true, '6j: Action contract is valid');

  // =============================================================
  // SCENARIO 7: Cancelled Order
  // =============================================================
  console.log('--- SCENARIO 7: Cancelled Order ---');
  const cust7: Customer = {
    id: 'cust_sc7',
    businessId: bizA,
    firstName: 'Anvar',
    status: 'Faol',
    source: 'telegram',
    totalOrders: 2,
    totalSpent: 5000000,
    createdAt: now - 86400000 * 10,
  };
  const orders7: Order[] = [
    {
      id: 'ord_7_comp',
      businessId: bizA,
      customerId: cust7.id,
      status: 'completed',
      subtotal: 5000000,
      total: 5000000,
      createdAt: now - 86400000 * 5,
      updatedAt: now - 86400000 * 5,
      items: [{ productId: 'p7a', productName: 'Kiyim', quantity: 1, unitPrice: 5000000 }],
    },
    {
      id: 'ord_7_canc',
      businessId: bizA,
      customerId: cust7.id,
      status: 'cancelled',
      subtotal: 10000000,
      total: 10000000,
      createdAt: now - 86400000 * 1,
      updatedAt: now - 86400000 * 1,
      items: [{ productId: 'p7b', productName: 'Bekor qilingan tovar', quantity: 1, unitPrice: 10000000 }],
    },
  ];

  const signals7 = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: cust7.id,
    customer: cust7,
    orders: orders7,
    messages: [],
  });
  assert(signals7.hasCancelledOrder === true, '7a: Cancelled order detected');
  assert(signals7.cancelledOrders === 1, '7b: Cancelled orders count is 1');
  assert(signals7.totalSpent === 5000000, '7c: 10M cancelled order excluded from totalSpent (strictly 5M)');

  const score7 = CustomerIntentScoreService.calculateScoreFromSignals(signals7, now);
  // 10 (completed) - 10 (cancelled penalty) = 0 -> clamped to 0
  assert(score7.score === 0, '7d: Score penalized by cancelled order to 0');
  assert(score7.level === 'low', '7e: Level is low');
  assert(score7.signals.includes('cancelled_order'), '7f: Signals include cancelled_order');

  const insight7 = CustomerSalesInsightService.buildSalesInsight(signals7, score7, now);
  assert(insight7.cancelledOrders === 1, '7g: Insight has 1 cancelled order');

  const rec7: SalesRecommendation = {
    action: 'follow_up',
    reason: 'Bekor qilingan buyurtma sababini aniqlash va yordam berish',
    confidence: 0.75,
  };
  const action7 = SalesActionGenerator.generateAction(insight7, rec7);
  assert(action7.action === 'follow_up', '7h: Action is follow_up');
  assert(validateSalesAssistantAction(action7).isValid === true, '7i: Action contract is valid');

  // =============================================================
  // SCENARIO 8: AI Failure Handling (Safe fallback, no crash)
  // =============================================================
  console.log('--- SCENARIO 8: AI Failure Handling ---');
  // 8a: Gemini network down / throws error
  const failRec1 = null;
  const safeAction1 = SalesActionGenerator.generateAction(insight6, failRec1 as any);
  assert(safeAction1.action === 'no_action', '8a: Null recommendation returns no_action');
  assert(safeAction1.confidence === 0, '8b: Null recommendation confidence is 0');
  assert(safeAction1.suggestedText === '', '8c: Null recommendation suggestedText is empty');

  // 8b: Malformed / unauthorized action returned by AI
  const failRec2 = { action: 'execute_wire_transfer', reason: 'hacked', confidence: 0.99 };
  const safeAction2 = SalesActionGenerator.generateAction(insight6, failRec2 as any);
  assert(safeAction2.action === 'no_action', '8d: Unauthorized action returns no_action');
  assert(safeAction2.confidence === 0, '8e: Fallback confidence is 0');

  // 8c: Invalid confidence score (> 1 or negative)
  const failRec3 = { action: 'order_follow_up', reason: 'valid reason', confidence: 99.9 };
  const safeAction3 = SalesActionGenerator.generateAction(insight6, failRec3 as any);
  assert(safeAction3.action === 'no_action', '8f: Confidence 99.9 triggers no_action fallback');

  const failRec4 = { action: 'order_follow_up', reason: 'valid reason', confidence: -0.5 };
  const safeAction4 = SalesActionGenerator.generateAction(insight6, failRec4 as any);
  assert(safeAction4.action === 'no_action', '8g: Negative confidence triggers no_action fallback');

  // =============================================================
  // SCENARIO 9: Customer Isolation
  // =============================================================
  console.log('--- SCENARIO 9: Customer Isolation ---');
  // Customer X and Customer Y in the same business
  const custX: Customer = {
    id: 'cust_x',
    businessId: bizA,
    firstName: 'Olim',
    status: 'Faol',
    source: 'telegram',
    totalOrders: 1,
    totalSpent: 3000000,
    createdAt: now - 3600000,
  };
  const custY: Customer = {
    id: 'cust_y',
    businessId: bizA,
    firstName: 'Zokir',
    status: 'Faol',
    source: 'telegram',
    totalOrders: 1,
    totalSpent: 50000000,
    createdAt: now - 3600000,
  };

  const mixedOrders: Order[] = [
    {
      id: 'ord_x_1',
      businessId: bizA,
      customerId: custX.id,
      status: 'completed',
      subtotal: 3000000,
      total: 3000000,
      createdAt: now - 100000,
      updatedAt: now - 100000,
      items: [{ productId: 'px', productName: 'Item X', quantity: 1, unitPrice: 3000000 }],
    },
    {
      id: 'ord_y_1',
      businessId: bizA,
      customerId: custY.id,
      status: 'completed',
      subtotal: 50000000,
      total: 50000000,
      createdAt: now - 200000,
      updatedAt: now - 200000,
      items: [{ productId: 'py', productName: 'Expensive Item Y', quantity: 1, unitPrice: 50000000 }],
    },
  ];

  const signalsX = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: custX.id,
    customer: custX,
    orders: mixedOrders,
  });
  assert(signalsX.customerId === custX.id, '9a: Customer X signals customerId matches');
  assert(signalsX.totalOrders === 1, '9b: Customer X total orders is strictly 1');
  assert(signalsX.totalSpent === 3000000, '9c: Customer X totalSpent is strictly 3,000,000 (50M Y excluded)');

  const signalsY = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: custY.id,
    customer: custY,
    orders: mixedOrders,
  });
  assert(signalsY.customerId === custY.id, '9d: Customer Y signals customerId matches');
  assert(signalsY.totalOrders === 1, '9e: Customer Y total orders is strictly 1');
  assert(signalsY.totalSpent === 50000000, '9f: Customer Y totalSpent is strictly 50,000,000 (3M X excluded)');

  // =============================================================
  // SCENARIO 10: Tenant Isolation
  // =============================================================
  console.log('--- SCENARIO 10: Tenant Isolation ---');
  // Tenant A vs Tenant B
  const multiTenantOrders: Order[] = [
    ...mixedOrders,
    {
      id: 'ord_tenant_b_1',
      businessId: bizB, // BELONGS TO TENANT B!
      customerId: custX.id,
      status: 'completed',
      subtotal: 777000000,
      total: 777000000,
      createdAt: now - 50000,
      updatedAt: now - 50000,
      items: [{ productId: 'pb', productName: 'Tenant B Special Item', quantity: 1, unitPrice: 777000000 }],
    },
  ];

  const multiTenantMsgs: ConversationMessage[] = [
    {
      id: 'msg_tenant_b_1',
      businessId: bizB, // BELONGS TO TENANT B!
      customerId: custX.id,
      conversationId: 'conv_tb',
      direction: 'inbound',
      channel: 'telegram',
      telegramMessageId: 9901,
      telegramChatId: 'chat_tb',
      type: 'text',
      media: null,
      aiProcessed: true,
      aiIntent: 'order_intent',
      text: 'Tenant B xaridi',
      createdAt: now - 30000,
    },
  ];

  const isolatedInsightA = SalesIntelligenceService.computeCustomerInsight(
    custX,
    multiTenantOrders,
    multiTenantMsgs
  );
  assert(isolatedInsightA !== null, '10a: Tenant A customer insight computed');
  assert(isolatedInsightA!.businessId === bizA, '10b: businessId strictly preserved as bizA');
  assert(isolatedInsightA!.totalOrders === 1, '10c: 777M Tenant B order excluded (totalOrders is 1)');
  assert(isolatedInsightA!.totalSpent === 3000000, '10d: 777M Tenant B spent excluded (totalSpent is 3M)');
  assert(isolatedInsightA!.signals.includes('order_intent') === false, '10e: Tenant B message excluded');

  const actionTenantA = SalesActionGenerator.generateAction(isolatedInsightA, {
    action: 'follow_up',
    reason: 'Tenant A follow up',
    confidence: 0.85,
  });
  assert(actionTenantA.businessId === bizA, '10f: Action strictly scoped to bizA');
  assert(actionTenantA.customerId === custX.id, '10g: Action strictly scoped to custX');

  console.log('===================================================================================================');
  console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===================================================================================================');

  if (failCount > 0) {
    throw new Error(`${failCount} tests failed.`);
  }
  console.log('🎉 ALL 10 M6.8 PART 2 E2E SCENARIOS PASSED WITH 100% SUCCESS!');
}

runM682E2ETests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal M6.8 Part 2 test runner error:', err);
    process.exit(1);
  });
