import { CustomerSalesSignalsService } from '../server/analytics/customerSalesSignals';
import { Customer, ConversationMessage } from '../src/types';
import { Order } from '../src/types/orders';

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

async function runM62Tests() {
  console.log('===================================================================================================');
  console.log('🚀 M6.2 CUSTOMER SALES SIGNALS VERIFICATION');
  console.log('===================================================================================================');

  const now = Date.now();
  const bizA = 'biz_test_a';
  const bizB = 'biz_test_b';
  const cust1 = 'cust_1';
  const cust2 = 'cust_2';
  const custB = 'cust_b';

  // -------------------------------------------------------------
  // Test 1: Yangi customer (Empty data / 0 orders, 0 messages)
  // -------------------------------------------------------------
  const newCustomer: Customer = {
    id: cust1,
    businessId: bizA,
    firstName: 'Sherzod',
    status: 'Yangi',
    source: 'telegram',
    totalOrders: 0,
    totalSpent: 0,
    createdAt: now - 100000,
    lastInteraction: now - 90000,
  };

  const signals1 = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: cust1,
    customer: newCustomer,
    orders: [],
    messages: [],
  });

  assert(signals1.customerId === cust1, 'Test 1a: customerId matches');
  assert(signals1.businessId === bizA, 'Test 1b: businessId matches');
  assert(!signals1.hasActiveOrder, 'Test 1c: new customer hasActiveOrder is false');
  assert(!signals1.hasCompletedOrder, 'Test 1d: new customer hasCompletedOrder is false');
  assert(!signals1.hasCancelledOrder, 'Test 1e: new customer hasCancelledOrder is false');
  assert(!signals1.isRepeatCustomer, 'Test 1f: new customer isRepeatCustomer is false');
  assert(signals1.totalOrders === 0, 'Test 1g: totalOrders is 0');
  assert(signals1.completedOrders === 0, 'Test 1h: completedOrders is 0');
  assert(signals1.cancelledOrders === 0, 'Test 1i: cancelledOrders is 0');
  assert(signals1.totalSpent === 0, 'Test 1j: totalSpent is 0');
  assert(signals1.lastOrderAt === null, 'Test 1k: lastOrderAt is null');
  assert(signals1.lastInteractionAt === now - 90000, 'Test 1l: lastInteractionAt falls back to customer record');

  // -------------------------------------------------------------
  // Test 2: Bitta order (Single active order)
  // -------------------------------------------------------------
  const orderSingle: Order = {
    id: 'ord_1',
    businessId: bizA,
    customerId: cust1,
    status: 'confirmed',
    subtotal: 1000000,
    total: 1000000,
    createdAt: now - 50000,
    updatedAt: now - 50000,
    items: [{ productId: 'p1', productName: 'AirPods', quantity: 1, unitPrice: 1000000 }],
  };

  const signals2 = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: cust1,
    customer: newCustomer,
    orders: [orderSingle],
    messages: [],
  });

  assert(signals2.totalOrders === 1, 'Test 2a: totalOrders is 1');
  assert(signals2.hasActiveOrder === true, 'Test 2b: hasActiveOrder is true');
  assert(signals2.hasCompletedOrder === false, 'Test 2c: hasCompletedOrder is false');
  assert(signals2.isRepeatCustomer === false, 'Test 2d: isRepeatCustomer is false for 1 order');
  assert(signals2.totalSpent === 1000000, 'Test 2e: totalSpent is 1,000,000');
  assert(signals2.lastOrderAt === now - 50000, 'Test 2f: lastOrderAt matches order timestamp');

  // -------------------------------------------------------------
  // Test 3: Repeat customer (2 or more orders)
  // -------------------------------------------------------------
  const orderSecond: Order = {
    id: 'ord_2',
    businessId: bizA,
    customerId: cust1,
    status: 'completed',
    subtotal: 3000000,
    total: 3000000,
    createdAt: now - 20000,
    updatedAt: now - 20000,
    items: [{ productId: 'p2', productName: 'Apple Watch', quantity: 1, unitPrice: 3000000 }],
  };

  const signals3 = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: cust1,
    customer: newCustomer,
    orders: [orderSingle, orderSecond],
    messages: [],
  });

  assert(signals3.totalOrders === 2, 'Test 3a: totalOrders is 2');
  assert(signals3.isRepeatCustomer === true, 'Test 3b: isRepeatCustomer is true for 2 orders');
  assert(signals3.totalSpent === 4000000, 'Test 3c: totalSpent is 4,000,000');
  assert(signals3.lastOrderAt === now - 20000, 'Test 3d: lastOrderAt is the latest order timestamp');

  // -------------------------------------------------------------
  // Test 4: Active order (confirmed & processing)
  // -------------------------------------------------------------
  const orderProcessing: Order = {
    id: 'ord_proc',
    businessId: bizA,
    customerId: cust1,
    status: 'processing',
    subtotal: 500000,
    total: 500000,
    createdAt: now - 10000,
    updatedAt: now - 10000,
    items: [],
  };

  const signalsActive = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: cust1,
    orders: [orderProcessing],
  });

  assert(signalsActive.hasActiveOrder === true, 'Test 4: processing status correctly flagged as hasActiveOrder');

  // -------------------------------------------------------------
  // Test 5: Completed order
  // -------------------------------------------------------------
  const signalsCompleted = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: cust1,
    orders: [orderSecond],
  });

  assert(signalsCompleted.hasCompletedOrder === true, 'Test 5a: hasCompletedOrder is true');
  assert(signalsCompleted.completedOrders === 1, 'Test 5b: completedOrders count is 1');

  // -------------------------------------------------------------
  // Test 6: Cancelled order
  // -------------------------------------------------------------
  const orderCancelled: Order = {
    id: 'ord_canc',
    businessId: bizA,
    customerId: cust1,
    status: 'cancelled',
    subtotal: 9900000,
    total: 9900000,
    createdAt: now - 5000,
    updatedAt: now - 5000,
    items: [],
  };

  const signalsCancelled = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: cust1,
    orders: [orderCancelled],
  });

  assert(signalsCancelled.hasCancelledOrder === true, 'Test 6a: hasCancelledOrder is true');
  assert(signalsCancelled.cancelledOrders === 1, 'Test 6b: cancelledOrders count is 1');
  assert(signalsCancelled.totalSpent === 0, 'Test 6c: Cancelled order total is NOT added to totalSpent');

  // -------------------------------------------------------------
  // Test 7: Total spent calculation across multiple mixed orders
  // -------------------------------------------------------------
  const signalsMixed = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: cust1,
    orders: [orderSingle, orderSecond, orderCancelled], // 1M + 3M + 9.9M(cancelled) = 4M
  });

  assert(signalsMixed.totalSpent === 4000000, `Test 7: Mixed orders totalSpent is 4,000,000 (got ${signalsMixed.totalSpent})`);
  assert(signalsMixed.totalOrders === 3, 'Test 7b: Total orders count includes cancelled (3)');
  assert(signalsMixed.completedOrders === 1, 'Test 7c: Completed count is 1');
  assert(signalsMixed.cancelledOrders === 1, 'Test 7d: Cancelled count is 1');

  // -------------------------------------------------------------
  // Test 8: Last order timestamp
  // -------------------------------------------------------------
  assert(signalsMixed.lastOrderAt === now - 5000, 'Test 8: lastOrderAt matches the newest order createdAt');

  // -------------------------------------------------------------
  // Test 9: Last interaction timestamp from latest message
  // -------------------------------------------------------------
  const msgRecent: ConversationMessage = {
    id: 'msg_recent',
    businessId: bizA,
    customerId: cust1,
    conversationId: 'conv_1',
    direction: 'inbound',
    channel: 'telegram',
    telegramMessageId: 101,
    telegramChatId: '12345',
    type: 'text',
    text: 'Rahmat, qachon yetkazasiz?',
    media: null,
    aiProcessed: true,
    aiIntent: 'greeting',
    createdAt: now - 1000, // Newer than any order
  };

  const signalsMsg = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: cust1,
    orders: [orderSingle],
    messages: [msgRecent],
  });

  assert(signalsMsg.lastInteractionAt === now - 1000, 'Test 9: lastInteractionAt updated from latest incoming message');

  // -------------------------------------------------------------
  // Test 10: Purchase intent detected
  // -------------------------------------------------------------
  const msgOrderIntent: ConversationMessage = {
    id: 'msg_order',
    businessId: bizA,
    customerId: cust1,
    conversationId: 'conv_1',
    direction: 'inbound',
    channel: 'telegram',
    telegramMessageId: 102,
    telegramChatId: '12345',
    type: 'text',
    text: 'iPhone 15 Pro olmoqchiman',
    media: null,
    aiProcessed: true,
    aiIntent: 'order_intent',
    createdAt: now - 3000,
  };

  const signalsIntent = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: cust1,
    messages: [msgOrderIntent],
  });

  assert(signalsIntent.purchaseIntentDetected === true, 'Test 10: purchaseIntentDetected is true');

  // -------------------------------------------------------------
  // Test 11: Product inquiry detected
  // -------------------------------------------------------------
  const msgProdInquiry: ConversationMessage = {
    id: 'msg_prod',
    businessId: bizA,
    customerId: cust1,
    conversationId: 'conv_1',
    direction: 'inbound',
    channel: 'telegram',
    telegramMessageId: 103,
    telegramChatId: '12345',
    type: 'text',
    text: 'Samsung S24 Ultra bormi?',
    media: null,
    aiProcessed: true,
    aiIntent: 'product_query',
    aiProductName: 'Samsung Galaxy S24 Ultra',
    createdAt: now - 4000,
  };

  const signalsProd = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: cust1,
    messages: [msgProdInquiry],
  });

  assert(signalsProd.productInquiryDetected === true, 'Test 11: productInquiryDetected is true');

  // -------------------------------------------------------------
  // Test 12: Price inquiry detected
  // -------------------------------------------------------------
  const msgPriceInquiry: ConversationMessage = {
    id: 'msg_price',
    businessId: bizA,
    customerId: cust1,
    conversationId: 'conv_1',
    direction: 'inbound',
    channel: 'telegram',
    telegramMessageId: 104,
    telegramChatId: '12345',
    type: 'text',
    text: 'Narxi qancha bo\'ladi?',
    media: null,
    aiProcessed: true,
    aiIntent: 'price_query',
    createdAt: now - 5000,
  };

  const signalsPrice = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: cust1,
    messages: [msgPriceInquiry],
  });

  assert(signalsPrice.priceInquiryDetected === true, 'Test 12: priceInquiryDetected is true');

  // -------------------------------------------------------------
  // Test 13: Stock inquiry detected
  // -------------------------------------------------------------
  const msgStockInquiry: ConversationMessage = {
    id: 'msg_stock',
    businessId: bizA,
    customerId: cust1,
    conversationId: 'conv_1',
    direction: 'inbound',
    channel: 'telegram',
    telegramMessageId: 105,
    telegramChatId: '12345',
    type: 'text',
    text: 'Omborda nechtasi qolgan?',
    media: null,
    aiProcessed: true,
    aiIntent: 'stock_query',
    createdAt: now - 6000,
  };

  const signalsStock = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: cust1,
    messages: [msgStockInquiry],
  });

  assert(signalsStock.stockInquiryDetected === true, 'Test 13: stockInquiryDetected is true');

  // -------------------------------------------------------------
  // Test 14: Customer isolation
  // -------------------------------------------------------------
  // Orders/messages from customer 2 must NOT bleed into customer 1 signals
  const orderCust2: Order = {
    id: 'ord_c2',
    businessId: bizA,
    customerId: cust2,
    status: 'completed',
    subtotal: 50000000,
    total: 50000000,
    createdAt: now,
    updatedAt: now,
    items: [],
  };

  const msgCust2: ConversationMessage = {
    id: 'msg_c2',
    businessId: bizA,
    customerId: cust2,
    conversationId: 'conv_2',
    direction: 'inbound',
    channel: 'telegram',
    telegramMessageId: 201,
    telegramChatId: '99999',
    type: 'text',
    text: 'Cust 2 order intent',
    media: null,
    aiProcessed: true,
    aiIntent: 'order_intent',
    createdAt: now,
  };

  const signalsIsolatedCust1 = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: cust1,
    orders: [orderSingle, orderCust2], // Contains cust2 order!
    messages: [msgCust2], // Contains cust2 message!
  });

  assert(signalsIsolatedCust1.totalOrders === 1, 'Test 14a: Customer 2 order was excluded from Customer 1 signals');
  assert(signalsIsolatedCust1.totalSpent === 1000000, 'Test 14b: Customer 2 50,000,000 total was NOT added to Customer 1');
  assert(signalsIsolatedCust1.purchaseIntentDetected === false, 'Test 14c: Customer 2 order_intent was excluded from Customer 1');

  // -------------------------------------------------------------
  // Test 15: Business / Tenant isolation
  // -------------------------------------------------------------
  // Orders/messages from Business B must NOT bleed into Business A customer signals
  const orderTenantB: Order = {
    id: 'ord_biz_b',
    businessId: bizB,
    customerId: cust1, // Same customerId, but different tenant!
    status: 'completed',
    subtotal: 70000000,
    total: 70000000,
    createdAt: now,
    updatedAt: now,
    items: [],
  };

  const msgTenantB: ConversationMessage = {
    id: 'msg_biz_b',
    businessId: bizB,
    customerId: cust1,
    conversationId: 'conv_b',
    direction: 'inbound',
    channel: 'telegram',
    telegramMessageId: 301,
    telegramChatId: '12345',
    type: 'text',
    text: 'Tenant B inquiry',
    media: null,
    aiProcessed: true,
    aiIntent: 'order_intent',
    createdAt: now,
  };

  const signalsIsolatedBizA = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: cust1,
    orders: [orderSingle, orderTenantB], // Contains Business B order
    messages: [msgTenantB], // Contains Business B message
  });

  assert(signalsIsolatedBizA.totalOrders === 1, 'Test 15a: Business B order was excluded from Business A signals');
  assert(signalsIsolatedBizA.totalSpent === 1000000, 'Test 15b: Business B spent was NOT added');
  assert(signalsIsolatedBizA.purchaseIntentDetected === false, 'Test 15c: Business B message was NOT processed');

  // -------------------------------------------------------------
  // Test 16: Empty data handling
  // -------------------------------------------------------------
  const signalsEmpty = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: 'cust_empty',
  });

  assert(signalsEmpty.totalOrders === 0, 'Test 16a: totalOrders is 0 for empty data');
  assert(signalsEmpty.totalSpent === 0, 'Test 16b: totalSpent is 0 for empty data');
  assert(signalsEmpty.lastOrderAt === null, 'Test 16c: lastOrderAt is null');
  assert(signalsEmpty.lastInteractionAt === null, 'Test 16d: lastInteractionAt is null');
  assert(!signalsEmpty.purchaseIntentDetected, 'Test 16e: purchaseIntentDetected is false');
  assert(!signalsEmpty.productInquiryDetected, 'Test 16f: productInquiryDetected is false');
  assert(!signalsEmpty.priceInquiryDetected, 'Test 16g: priceInquiryDetected is false');
  assert(!signalsEmpty.stockInquiryDetected, 'Test 16h: stockInquiryDetected is false');

  // -------------------------------------------------------------
  // Test 17: Multiple orders with all 4 message intents combined
  // -------------------------------------------------------------
  const allMessages = [msgOrderIntent, msgProdInquiry, msgPriceInquiry, msgStockInquiry];
  const signalsFull = CustomerSalesSignalsService.computeSignals({
    businessId: bizA,
    customerId: cust1,
    orders: [orderSingle, orderSecond, orderCancelled],
    messages: allMessages,
  });

  assert(signalsFull.purchaseIntentDetected === true, 'Test 17a: purchaseIntentDetected is true');
  assert(signalsFull.productInquiryDetected === true, 'Test 17b: productInquiryDetected is true');
  assert(signalsFull.priceInquiryDetected === true, 'Test 17c: priceInquiryDetected is true');
  assert(signalsFull.stockInquiryDetected === true, 'Test 17d: stockInquiryDetected is true');
  assert(signalsFull.isRepeatCustomer === true, 'Test 17e: isRepeatCustomer is true');
  assert(signalsFull.hasActiveOrder === true, 'Test 17f: hasActiveOrder is true');
  assert(signalsFull.hasCompletedOrder === true, 'Test 17g: hasCompletedOrder is true');
  assert(signalsFull.hasCancelledOrder === true, 'Test 17h: hasCancelledOrder is true');

  console.log('===================================================================================================');
  console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===================================================================================================');

  if (failCount > 0) {
    throw new Error(`${failCount} tests failed.`);
  }
  console.log('🎉 ALL 17 M6.2 CUSTOMER SALES SIGNALS TEST SCENARIOS PASSED SUCCESSFULLY!');
}

runM62Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal M6.2 test runner error:', err);
    process.exit(1);
  });
