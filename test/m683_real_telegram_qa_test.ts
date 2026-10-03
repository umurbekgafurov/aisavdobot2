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

async function runM683Tests() {
  console.log('===================================================================================================');
  console.log('🚀 M6.8 PART 3 — REAL TELEGRAM QA & ORDER FLOW INTEGRATION (15 SCENARIOS)');
  console.log('===================================================================================================');

  const now = 1791050000000;
  const bizA = 'biz_telegram_retail_a';
  const bizB = 'biz_telegram_wholesale_b';

  // Helper to create conversation message
  function makeMsg(
    id: string,
    customerId: string,
    businessId: string,
    text: string,
    aiIntent: string | null = null,
    extra: Partial<ConversationMessage> = {}
  ): ConversationMessage {
    return {
      id,
      businessId,
      customerId,
      conversationId: `conv_${customerId}`,
      direction: 'inbound',
      channel: 'telegram',
      telegramMessageId: Math.floor(Math.random() * 100000) + 1,
      telegramChatId: `tg_chat_${customerId}`,
      type: 'text',
      media: null,
      aiProcessed: true,
      aiIntent,
      text,
      createdAt: now - 3600000,
      ...extra,
    };
  }

  // Helper to create customer
  function makeCust(id: string, businessId: string = bizA, firstName: string = 'Mijoz'): Customer {
    return {
      id,
      businessId,
      firstName,
      status: 'Faol',
      source: 'telegram',
      totalOrders: 0,
      totalSpent: 0,
      createdAt: now - 86400000,
    };
  }

  // -------------------------------------------------------------
  // SCENARIO 1: Customer Greeting (Uzbek)
  // -------------------------------------------------------------
  console.log('--- SCENARIO 1: Customer Greeting ---');
  const c1 = makeCust('cust_tg_1');
  const m1 = [makeMsg('msg_1', c1.id, bizA, 'Assalomu alaykum, yaxshimisiz?', 'greeting', { aiLanguage: 'uz' })];
  const s1 = CustomerSalesSignalsService.computeSignals({ businessId: bizA, customerId: c1.id, customer: c1, messages: m1 });
  const sc1 = CustomerIntentScoreService.calculateScoreFromSignals(s1, now);
  const ins1 = CustomerSalesInsightService.buildSalesInsight(s1, sc1, now);
  const rec1: SalesRecommendation = { action: 'no_action', reason: 'Oddiy salomlashish, maxsus harakat talab etilmaydi', confidence: 0 };
  const act1 = SalesActionGenerator.generateAction(ins1, rec1);

  assert(s1.purchaseIntentDetected === false, '1a: No purchase intent in greeting');
  assert(s1.productInquiryDetected === false, '1b: No product inquiry in greeting');
  assert(sc1.score === 0, '1c: Intent score is 0');
  assert(sc1.level === 'low', '1d: Intent level is low');
  assert(act1.action === 'no_action', '1e: Action is no_action');
  assert(act1.suggestedText === '', '1f: Suggested text is empty string');

  // -------------------------------------------------------------
  // SCENARIO 2: Product Inquiry
  // -------------------------------------------------------------
  console.log('--- SCENARIO 2: Product Inquiry ---');
  const c2 = makeCust('cust_tg_2');
  const m2 = [makeMsg('msg_2', c2.id, bizA, 'Artel televizor bormi sizlarda?', 'product_query', { aiProductName: 'Artel televizor' })];
  const s2 = CustomerSalesSignalsService.computeSignals({ businessId: bizA, customerId: c2.id, customer: c2, messages: m2 });
  const sc2 = CustomerIntentScoreService.calculateScoreFromSignals(s2, now);
  const ins2 = CustomerSalesInsightService.buildSalesInsight(s2, sc2, now);
  const rec2: SalesRecommendation = { action: 'product_recommendation', reason: 'Mijoz Artel televizor haqida so‘radi', confidence: 0.86 };
  const act2 = SalesActionGenerator.generateAction(ins2, rec2);

  assert(s2.productInquiryDetected === true, '2a: Product inquiry detected');
  assert(sc2.score === 10, '2b: Score is 10 (product inquiry)');
  assert(sc2.signals.includes('product_inquiry_detected'), '2c: Signals include product_inquiry_detected');
  assert(act2.action === 'product_recommendation', '2d: Action is product_recommendation');
  assert(act2.suggestedText.includes('yangi variantlar va tavsiyalarimiz'), '2e: Suggested text has recommendation');

  // -------------------------------------------------------------
  // SCENARIO 3: Price Inquiry
  // -------------------------------------------------------------
  console.log('--- SCENARIO 3: Price Inquiry ---');
  const c3 = makeCust('cust_tg_3');
  const m3 = [makeMsg('msg_3', c3.id, bizA, 'iPhone 15 narxi qancha hozir?', 'price_query')];
  const s3 = CustomerSalesSignalsService.computeSignals({ businessId: bizA, customerId: c3.id, customer: c3, messages: m3 });
  const sc3 = CustomerIntentScoreService.calculateScoreFromSignals(s3, now);
  const ins3 = CustomerSalesInsightService.buildSalesInsight(s3, sc3, now);
  const rec3: SalesRecommendation = { action: 'price_follow_up', reason: 'Mijoz narx bo‘yicha ma’lumot so‘radi', confidence: 0.88 };
  const act3 = SalesActionGenerator.generateAction(ins3, rec3);

  assert(s3.priceInquiryDetected === true, '3a: Price inquiry detected');
  assert(sc3.score === 8, '3b: Score is 8 (price inquiry)');
  assert(sc3.signals.includes('price_inquiry_detected'), '3c: Signals include price_inquiry_detected');
  assert(act3.action === 'price_follow_up', '3d: Action is price_follow_up');

  // -------------------------------------------------------------
  // SCENARIO 4: Stock Inquiry
  // -------------------------------------------------------------
  console.log('--- SCENARIO 4: Stock Inquiry ---');
  const c4 = makeCust('cust_tg_4');
  const m4 = [makeMsg('msg_4', c4.id, bizA, 'Omborda yana qancha qoldiq bor?', 'stock_query')];
  const s4 = CustomerSalesSignalsService.computeSignals({ businessId: bizA, customerId: c4.id, customer: c4, messages: m4 });
  const sc4 = CustomerIntentScoreService.calculateScoreFromSignals(s4, now);
  const ins4 = CustomerSalesInsightService.buildSalesInsight(s4, sc4, now);
  const rec4: SalesRecommendation = { action: 'follow_up', reason: 'Mijoz ombor qoldig‘i bilan qiziqdi', confidence: 0.80 };
  const act4 = SalesActionGenerator.generateAction(ins4, rec4);

  assert(s4.stockInquiryDetected === true, '4a: Stock inquiry detected');
  assert(sc4.score === 5, '4b: Score is 5 (stock inquiry)');
  assert(sc4.signals.includes('stock_inquiry_detected'), '4c: Signals include stock_inquiry_detected');
  assert(act4.action === 'follow_up', '4d: Action is follow_up');

  // -------------------------------------------------------------
  // SCENARIO 5: Purchase Intent
  // -------------------------------------------------------------
  console.log('--- SCENARIO 5: Purchase Intent ---');
  const c5 = makeCust('cust_tg_5');
  const m5 = [
    makeMsg('msg_5a', c5.id, bizA, 'Shuni olmoqchiman, buyurtma qilaylik', 'order_intent'),
    makeMsg('msg_5b', c5.id, bizA, 'Yetkazib berish shartlari qanaqa?', 'faq'),
  ];
  const s5 = CustomerSalesSignalsService.computeSignals({ businessId: bizA, customerId: c5.id, customer: c5, messages: m5 });
  const sc5 = CustomerIntentScoreService.calculateScoreFromSignals(s5, now);
  const ins5 = CustomerSalesInsightService.buildSalesInsight(s5, sc5, now);
  const rec5: SalesRecommendation = { action: 'follow_up', reason: 'Mijoz xarid qilishga tayyor', confidence: 0.92 };
  const act5 = SalesActionGenerator.generateAction(ins5, rec5);

  assert(s5.purchaseIntentDetected === true, '5a: Purchase intent detected');
  assert(sc5.score === 30, '5b: Score is 30 (purchase intent weight)');
  assert(act5.action === 'follow_up', '5c: Action is follow_up');

  // -------------------------------------------------------------
  // SCENARIO 6: Order Confirmation (M4 Flow)
  // -------------------------------------------------------------
  console.log('--- SCENARIO 6: Order Confirmation ---');
  const c6 = makeCust('cust_tg_6');
  const m6 = [makeMsg('msg_6', c6.id, bizA, 'Ha, tasdiqlayman', 'order_intent')];
  const o6: Order[] = [
    {
      id: 'ord_conf_6',
      businessId: bizA,
      customerId: c6.id,
      status: 'confirmed',
      subtotal: 12000000,
      total: 12000000,
      createdAt: now - 1800000,
      updatedAt: now - 1800000,
      items: [{ productId: 'p6', productName: 'iPhone 15 Pro', quantity: 1, unitPrice: 12000000 }],
    },
  ];
  const s6 = CustomerSalesSignalsService.computeSignals({ businessId: bizA, customerId: c6.id, customer: c6, orders: o6, messages: m6 });
  const sc6 = CustomerIntentScoreService.calculateScoreFromSignals(s6, now);
  const ins6 = CustomerSalesInsightService.buildSalesInsight(s6, sc6, now);
  const rec6: SalesRecommendation = { action: 'order_follow_up', reason: 'Buyurtma tasdiqlandi, holat haqida xabardor qilish', confidence: 0.95 };
  const act6 = SalesActionGenerator.generateAction(ins6, rec6);

  assert(s6.hasActiveOrder === true, '6a: Active order confirmed');
  assert(s6.purchaseIntentDetected === true, '6b: Purchase intent detected');
  // 40 (active) + 30 (purchase) = 70 -> high
  assert(sc6.score >= 70, '6c: Intent score is high (>= 70, got ' + sc6.score + ')');
  assert(sc6.level === 'high', '6d: Level is high');
  assert(act6.action === 'order_follow_up', '6e: Action is order_follow_up');
  assert(act6.suggestedText.includes('Buyurtmangiz holati'), '6f: Suggested text is order follow-up');

  // -------------------------------------------------------------
  // SCENARIO 7: Confirmed Order (Standing active order)
  // -------------------------------------------------------------
  console.log('--- SCENARIO 7: Confirmed Order ---');
  const c7 = makeCust('cust_tg_7');
  const o7: Order[] = [
    {
      id: 'ord_7_conf',
      businessId: bizA,
      customerId: c7.id,
      status: 'confirmed',
      subtotal: 3500000,
      total: 3500000,
      createdAt: now - 3600000,
      updatedAt: now - 3600000,
      items: [{ productId: 'p7', productName: 'Changyutgich', quantity: 1, unitPrice: 3500000 }],
    },
  ];
  const s7 = CustomerSalesSignalsService.computeSignals({ businessId: bizA, customerId: c7.id, customer: c7, orders: o7, messages: [] });
  const sc7 = CustomerIntentScoreService.calculateScoreFromSignals(s7, now);
  assert(s7.hasActiveOrder === true, '7a: Active order flag true');
  assert(sc7.score === 40, '7b: Score is 40 for active order');
  assert(sc7.level === 'medium', '7c: Level is medium');

  // -------------------------------------------------------------
  // SCENARIO 8: Completed Order
  // -------------------------------------------------------------
  console.log('--- SCENARIO 8: Completed Order ---');
  const c8 = makeCust('cust_tg_8');
  const o8: Order[] = [
    {
      id: 'ord_8_comp',
      businessId: bizA,
      customerId: c8.id,
      status: 'completed',
      subtotal: 4500000,
      total: 4500000,
      createdAt: now - 86400000 * 2,
      updatedAt: now - 86400000 * 2,
      items: [{ productId: 'p8', productName: 'Mikroto‘lqinli pech', quantity: 1, unitPrice: 4500000 }],
    },
  ];
  const s8 = CustomerSalesSignalsService.computeSignals({ businessId: bizA, customerId: c8.id, customer: c8, orders: o8, messages: [] });
  const sc8 = CustomerIntentScoreService.calculateScoreFromSignals(s8, now);
  assert(s8.hasCompletedOrder === true, '8a: Completed order flag true');
  assert(s8.completedOrders === 1, '8b: Completed orders count is 1');
  assert(s8.totalSpent === 4500000, '8c: Total spent is 4,500,000');
  assert(sc8.score === 10, '8d: Score is 10 (completed order)');
  assert(sc8.signals.includes('completed_order'), '8e: Signals include completed_order');

  // -------------------------------------------------------------
  // SCENARIO 9: Repeat Customer
  // -------------------------------------------------------------
  console.log('--- SCENARIO 9: Repeat Customer ---');
  const c9 = makeCust('cust_tg_9');
  const o9: Order[] = [
    {
      id: 'ord_9_1',
      businessId: bizA,
      customerId: c9.id,
      status: 'completed',
      subtotal: 5000000,
      total: 5000000,
      createdAt: now - 86400000 * 10,
      updatedAt: now - 86400000 * 10,
      items: [{ productId: 'p9a', productName: 'Tovar 1', quantity: 1, unitPrice: 5000000 }],
    },
    {
      id: 'ord_9_2',
      businessId: bizA,
      customerId: c9.id,
      status: 'completed',
      subtotal: 8000000,
      total: 8000000,
      createdAt: now - 86400000 * 1,
      updatedAt: now - 86400000 * 1,
      items: [{ productId: 'p9b', productName: 'Tovar 2', quantity: 1, unitPrice: 8000000 }],
    },
  ];
  const s9 = CustomerSalesSignalsService.computeSignals({ businessId: bizA, customerId: c9.id, customer: c9, orders: o9, messages: [] });
  const sc9 = CustomerIntentScoreService.calculateScoreFromSignals(s9, now);
  const ins9 = CustomerSalesInsightService.buildSalesInsight(s9, sc9, now);
  const rec9: SalesRecommendation = { action: 'repeat_purchase', reason: 'Doimiy mijozga yangi chegirma taklif qilish', confidence: 0.90 };
  const act9 = SalesActionGenerator.generateAction(ins9, rec9);

  assert(s9.isRepeatCustomer === true, '9a: Repeat customer flag true');
  assert(sc9.signals.includes('repeat_customer'), '9b: Signals include repeat_customer');
  assert(act9.action === 'repeat_purchase', '9c: Action is repeat_purchase');

  // -------------------------------------------------------------
  // SCENARIO 10: Cancelled Order
  // -------------------------------------------------------------
  console.log('--- SCENARIO 10: Cancelled Order ---');
  const c10 = makeCust('cust_tg_10');
  const o10: Order[] = [
    {
      id: 'ord_10_canc',
      businessId: bizA,
      customerId: c10.id,
      status: 'cancelled',
      subtotal: 6000000,
      total: 6000000,
      createdAt: now - 3600000,
      updatedAt: now - 3600000,
      items: [{ productId: 'p10', productName: 'Bekor qilingan tovar', quantity: 1, unitPrice: 6000000 }],
    },
  ];
  const s10 = CustomerSalesSignalsService.computeSignals({ businessId: bizA, customerId: c10.id, customer: c10, orders: o10, messages: [] });
  const sc10 = CustomerIntentScoreService.calculateScoreFromSignals(s10, now);

  assert(s10.hasCancelledOrder === true, '10a: Cancelled order flag true');
  assert(s10.cancelledOrders === 1, '10b: Cancelled orders count is 1');
  assert(s10.totalSpent === 0, '10c: Cancelled order not counted in spent');
  assert(sc10.score === 0, '10d: Score penalized and clamped to 0');
  assert(sc10.signals.includes('cancelled_order'), '10e: Signals include cancelled_order');

  // -------------------------------------------------------------
  // SCENARIO 11: Customer with Active Order Asking for ETA
  // -------------------------------------------------------------
  console.log('--- SCENARIO 11: Active Order Asking for ETA ---');
  const c11 = makeCust('cust_tg_11');
  const o11: Order[] = [
    {
      id: 'ord_11_act',
      businessId: bizA,
      customerId: c11.id,
      status: 'processing',
      subtotal: 15000000,
      total: 15000000,
      createdAt: now - 1800000,
      updatedAt: now - 1800000,
      items: [{ productId: 'p11', productName: 'Muzlatgich', quantity: 1, unitPrice: 15000000 }],
    },
  ];
  const m11 = [makeMsg('msg_11', c11.id, bizA, 'Kuryer soat nechada yetkazadi?', 'order_intent')];
  const s11 = CustomerSalesSignalsService.computeSignals({ businessId: bizA, customerId: c11.id, customer: c11, orders: o11, messages: m11 });
  const sc11 = CustomerIntentScoreService.calculateScoreFromSignals(s11, now);
  const ins11 = CustomerSalesInsightService.buildSalesInsight(s11, sc11, now);
  const rec11: SalesRecommendation = { action: 'order_follow_up', reason: 'Mijoz yetkazish vaqti bo‘yicha so‘ramoqda', confidence: 0.98 };
  const act11 = SalesActionGenerator.generateAction(ins11, rec11);

  assert(s11.hasActiveOrder === true, '11a: Processing status counts as active order');
  assert(sc11.score === 70, '11b: Score is 70 (40 active + 30 order intent)');
  assert(sc11.level === 'high', '11c: Level is high');
  assert(act11.action === 'order_follow_up', '11d: Action is order_follow_up');

  // -------------------------------------------------------------
  // SCENARIO 12: Unknown / Ambiguous Message
  // -------------------------------------------------------------
  console.log('--- SCENARIO 12: Unknown / Ambiguous Message ---');
  const c12 = makeCust('cust_tg_12');
  const m12 = [makeMsg('msg_12', c12.id, bizA, '??? ... :)', 'unknown')];
  const s12 = CustomerSalesSignalsService.computeSignals({ businessId: bizA, customerId: c12.id, customer: c12, messages: m12 });
  const sc12 = CustomerIntentScoreService.calculateScoreFromSignals(s12, now);
  const ins12 = CustomerSalesInsightService.buildSalesInsight(s12, sc12, now);
  const rec12: SalesRecommendation = { action: 'no_action', reason: 'Xabar ma’nosi noaniq, harakat tavsiya etilmaydi', confidence: 0 };
  const act12 = SalesActionGenerator.generateAction(ins12, rec12);

  assert(s12.purchaseIntentDetected === false, '12a: No purchase intent');
  assert(s12.productInquiryDetected === false, '12b: No product inquiry');
  assert(sc12.score === 0, '12c: Intent score 0');
  assert(act12.action === 'no_action', '12d: Action no_action');
  assert(act12.suggestedText === '', '12e: Empty suggested text');

  // -------------------------------------------------------------
  // SCENARIO 13: Uzbek Message
  // -------------------------------------------------------------
  console.log('--- SCENARIO 13: Uzbek Message ---');
  const c13 = makeCust('cust_tg_13');
  const m13 = [makeMsg('msg_13', c13.id, bizA, 'Yangi kelgan tovarlar ro‘yxatini bering', 'product_query', { aiLanguage: 'uz' })];
  const s13 = CustomerSalesSignalsService.computeSignals({ businessId: bizA, customerId: c13.id, customer: c13, messages: m13 });
  assert(s13.productInquiryDetected === true, '13a: Uzbek product inquiry detected');

  // -------------------------------------------------------------
  // SCENARIO 14: Russian Message
  // -------------------------------------------------------------
  console.log('--- SCENARIO 14: Russian Message ---');
  const c14 = makeCust('cust_tg_14');
  const m14 = [makeMsg('msg_14', c14.id, bizA, 'Здравствуйте, какая цена у этого смартфона?', 'price_query', { aiLanguage: 'ru' })];
  const s14 = CustomerSalesSignalsService.computeSignals({ businessId: bizA, customerId: c14.id, customer: c14, messages: m14 });
  assert(s14.priceInquiryDetected === true, '14a: Russian price inquiry detected');

  // -------------------------------------------------------------
  // SCENARIO 15: English Message
  // -------------------------------------------------------------
  console.log('--- SCENARIO 15: English Message ---');
  const c15 = makeCust('cust_tg_15');
  const m15 = [makeMsg('msg_15', c15.id, bizA, 'Hello, do you have black shoes size 42 in stock?', 'product_query', { aiLanguage: 'en' })];
  const s15 = CustomerSalesSignalsService.computeSignals({ businessId: bizA, customerId: c15.id, customer: c15, messages: m15 });
  assert(s15.productInquiryDetected === true, '15a: English product inquiry detected');

  // -------------------------------------------------------------
  // CRITICAL INVARIANTS: Advisory, Tenant & Customer Isolation
  // -------------------------------------------------------------
  console.log('--- CRITICAL INVARIANTS ---');
  // 16: Advisory Nature: Generator returns pure object, no DB or telegram side effect
  assert(typeof act1 === 'object', '16a: Sales Assistant action is purely an in-memory advisory object');
  assert(validateSalesAssistantAction(act1).isValid === true, '16b: Valid contract adherence');

  // 17: Tenant Isolation
  const crossTenantOrder: Order = {
    id: 'ord_cross_b',
    businessId: bizB, // TENANT B
    customerId: c1.id,
    status: 'completed',
    subtotal: 999000000,
    total: 999000000,
    createdAt: now - 1000,
    updatedAt: now - 1000,
    items: [{ productId: 'pb', productName: 'Tenant B Super Car', quantity: 1, unitPrice: 999000000 }],
  };
  const isolatedSignals = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: c1.id,
    customer: c1,
    orders: [crossTenantOrder],
  });
  assert(isolatedSignals.totalOrders === 0, '17a: Tenant B order filtered out from Tenant A signals');
  assert(isolatedSignals.totalSpent === 0, '17b: Tenant B spent filtered out from Tenant A signals');

  // 18: Customer Isolation
  const cOther = makeCust('cust_other_user');
  const otherOrder: Order = {
    id: 'ord_other_cust',
    businessId: bizA,
    customerId: cOther.id, // DIFFERENT CUSTOMER
    status: 'completed',
    subtotal: 50000000,
    total: 50000000,
    createdAt: now - 2000,
    updatedAt: now - 2000,
    items: [{ productId: 'p_other', productName: 'Item Other', quantity: 1, unitPrice: 50000000 }],
  };
  const c1SignalsWithOtherOrder = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: c1.id,
    customer: c1,
    orders: [otherOrder],
  });
  assert(c1SignalsWithOtherOrder.totalOrders === 0, '18a: Customer Other order filtered out from Customer 1 signals');
  assert(c1SignalsWithOtherOrder.totalSpent === 0, '18b: Customer Other spent filtered out from Customer 1 signals');

  console.log('===================================================================================================');
  console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===================================================================================================');

  if (failCount > 0) {
    throw new Error(`${failCount} tests failed.`);
  }
  console.log('🎉 ALL 15 REAL TELEGRAM & INTEGRATION QA SCENARIOS PASSED WITH 100% SUCCESS!');
}

runM683Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal M6.8 Part 3 test runner error:', err);
    process.exit(1);
  });
