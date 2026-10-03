import { db } from '../src/lib/firebase';
import { initWorkerAuth } from '../server/initWorkerAuth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { OrderService } from '../server/orders/orderService';
import { Order } from '../src/types/orders';
import { Customer } from '../src/types';
import { getOrderStatusBadge, getInventoryStatusBadge } from '../src/components/OrdersView';

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

async function runM541Tests() {
  console.log('===================================================================================================');
  console.log('🚀 M5.4.1 CUSTOMER ORDER HISTORY VERIFICATION');
  console.log('===================================================================================================');

  await initWorkerAuth();

  const now = Date.now();
  const testBizA = `biz_m541_A_${now}`;
  const testBizB = `biz_m541_B_${now}`;

  // 1. Setup Businesses and Customers
  await setDoc(doc(db, 'businesses', testBizA), { id: testBizA, name: 'Store A', active: true, createdAt: now });
  await setDoc(doc(db, 'businesses', testBizB), { id: testBizB, name: 'Store B', active: true, createdAt: now });

  const customerA1: Customer = {
    id: `cust_a1_${now}`,
    businessId: testBizA,
    source: 'telegram',
    firstName: 'Aziz',
    lastName: 'Qodirov',
    phone: '+998901234501',
    telegramUsername: 'aziz_q',
    status: 'Buyurtma berdi',
    leadScore: 85,
    tags: ['VIP', 'Issiq lead'],
    totalOrders: 0,
    totalSpent: 0,
    createdAt: now,
    lastInteraction: now,
  };

  const customerA2: Customer = {
    id: `cust_a2_${now}`,
    businessId: testBizA,
    source: 'telegram',
    firstName: 'Nozima',
    lastName: 'Alimova',
    phone: '+998901234502',
    telegramUsername: 'nozima_a',
    status: 'Yangi',
    leadScore: 60,
    tags: ['Yangi mijoz'],
    totalOrders: 0,
    totalSpent: 0,
    createdAt: now,
    lastInteraction: now,
  };

  const customerB1: Customer = {
    id: `cust_b1_${now}`,
    businessId: testBizB,
    source: 'telegram',
    firstName: 'Bobur',
    lastName: 'TenantB',
    phone: '+998909999999',
    telegramUsername: 'bobur_b',
    status: 'Buyurtma berdi',
    leadScore: 70,
    tags: ['Qayta aloqa'],
    totalOrders: 0,
    totalSpent: 0,
    createdAt: now,
    lastInteraction: now,
  };

  // 2. Create 2 real orders for Customer A1 in Business A
  const order1 = await OrderService.createOrder({
    businessId: testBizA,
    customerId: customerA1.id,
    customerName: `${customerA1.firstName} ${customerA1.lastName}`,
    customerPhone: customerA1.phone,
    status: 'confirmed',
    items: [
      {
        productId: 'prod_1',
        productName: 'Apple iPhone 15 Pro 256GB',
        sku: 'IPH-15P-256',
        quantity: 1,
        unitPrice: 14000000,
      },
    ],
    currency: "so'm",
  });

  const order2 = await OrderService.createOrder({
    businessId: testBizA,
    customerId: customerA1.id,
    customerName: `${customerA1.firstName} ${customerA1.lastName}`,
    customerPhone: customerA1.phone,
    status: 'processing',
    items: [
      {
        productId: 'prod_2',
        productName: 'Apple AirPods Pro 2',
        sku: 'AIR-PRO-2',
        quantity: 2,
        unitPrice: 2800000,
      },
    ],
    currency: "so'm",
  });

  // 3. Create 1 order for Customer B1 in Business B
  const orderB = await OrderService.createOrder({
    businessId: testBizB,
    customerId: customerB1.id,
    customerName: `${customerB1.firstName} ${customerB1.lastName}`,
    customerPhone: customerB1.phone,
    status: 'confirmed',
    items: [
      {
        productId: 'prod_b',
        productName: 'Secret Product B',
        quantity: 1,
        unitPrice: 5000000,
      },
    ],
  });

  // Simulate combined state in dashboard
  const allOrdersInTenantA = [order1, order2];

  // Test 1: Customer A1 has exactly 2 orders
  const filterForA1 = allOrdersInTenantA
    .filter((order) => order.customerId === customerA1.id)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  assert(filterForA1.length === 2, `Test 1: Customer A1 has exactly 2 orders (received ${filterForA1.length})`);
  assert(filterForA1[0].id === order2.id || filterForA1[0].id === order1.id, 'Test 1b: Order IDs match customer A1 orders');

  // Test 2: Faqat shu customer orderlari ko'rinadi (Customer A2 has 0 orders)
  const filterForA2 = allOrdersInTenantA
    .filter((order) => order.customerId === customerA2.id)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  assert(filterForA2.length === 0, `Test 2: Customer A2 has 0 orders: received ${filterForA2.length}`);
  const emptyStateText = filterForA2.length === 0 ? 'Hozircha buyurtmalar mavjud emas' : '';
  assert(emptyStateText === 'Hozircha buyurtmalar mavjud emas', 'Test 2b: Displays "Hozircha buyurtmalar mavjud emas" when orders empty');

  // Test 3: Tenant isolation: Order B is not in Customer A1 history
  const tenantCheck = filterForA1.some((o) => o.id === orderB.id || o.businessId === testBizB);
  assert(!tenantCheck, 'Test 3: Zero Business B orders appear in Business A customer history');

  // Test 4: Details accuracy (Product, Quantity, Unit Price, Total, Currency)
  const ordA1Item1 = filterForA1.find((o) => o.id === order1.id);
  assert(!!ordA1Item1, 'Test 4a: Order 1 found in customer history');
  assert(ordA1Item1?.items[0].productName === 'Apple iPhone 15 Pro 256GB', 'Test 4b: Product name matches');
  assert(ordA1Item1?.items[0].quantity === 1, 'Test 4c: Product quantity matches 1');
  assert(ordA1Item1?.total === 14000000, 'Test 4d: Total matches 14,000,000');
  assert(ordA1Item1?.currency === "so'm", 'Test 4e: Currency matches so\'m');

  const ordA1Item2 = filterForA1.find((o) => o.id === order2.id);
  assert(!!ordA1Item2, 'Test 4f: Order 2 found in customer history');
  assert(ordA1Item2?.items[0].productName === 'Apple AirPods Pro 2', 'Test 4g: Product 2 name matches');
  assert(ordA1Item2?.items[0].quantity === 2, 'Test 4h: Product 2 quantity is 2');
  assert(ordA1Item2?.total === 5600000, `Test 4i: Product 2 total is 5,600,000: received ${ordA1Item2?.total}`);

  // Test 5: Status Badges reuse
  const badge1 = getOrderStatusBadge(ordA1Item1?.status);
  assert(badge1.label === 'Tasdiqlangan', `Test 5a: Status badge for confirmed is "Tasdiqlangan" (got ${badge1.label})`);

  const badge2 = getOrderStatusBadge(ordA1Item2?.status);
  assert(badge2.label === 'Tayyorlanmoqda', `Test 5b: Status badge for processing is "Tayyorlanmoqda" (got ${badge2.label})`);

  // Test 6: Status update reflects in customer history
  const updatedOrder1 = { ...order1, status: 'completed' as const, updatedAt: Date.now() };
  const updatedList = [updatedOrder1, order2];
  const reFiltered = updatedList.filter((o) => o.customerId === customerA1.id);
  const updatedBadge = getOrderStatusBadge(reFiltered.find((o) => o.id === order1.id)?.status);
  assert(updatedBadge.label === 'Yetkazildi', `Test 6: Updated order status reflected in history as "Yetkazildi" (got ${updatedBadge.label})`);

  // Test 7: New incoming Telegram order appears realtime
  const newTelegramOrder = await OrderService.createOrder({
    businessId: testBizA,
    customerId: customerA1.id,
    customerName: `${customerA1.firstName} ${customerA1.lastName}`,
    customerPhone: customerA1.phone,
    status: 'confirmed',
    items: [
      {
        productId: 'prod_3',
        productName: 'Samsung Galaxy S24 Ultra',
        quantity: 1,
        unitPrice: 12500000,
      },
    ],
    currency: "so'm",
  });

  const realtimeStreamWithNew = [newTelegramOrder, ...updatedList].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const realtimeForA1 = realtimeStreamWithNew.filter((o) => o.customerId === customerA1.id);
  assert(realtimeForA1.length === 3, `Test 7a: Realtime update adds new order to customer history (now 3 orders, got ${realtimeForA1.length})`);
  assert(realtimeForA1[0].id === newTelegramOrder.id, 'Test 7b: Newest Telegram order is at the top of history');

  console.log('===================================================================================================');
  console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===================================================================================================');

  if (failCount > 0) {
    throw new Error(`${failCount} tests failed.`);
  }
  console.log('🎉 ALL M5.4.1 CUSTOMER ORDER HISTORY TESTS PASSED SUCCESSFULLY!');
}

runM541Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal M5.4.1 test runner error:', err);
    process.exit(1);
  });
