import { db } from '../src/lib/firebase';
import { initWorkerAuth } from '../server/initWorkerAuth';
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { OrderService } from '../server/orders/orderService';
import { Order, OrderDomainStatus, OrderInventoryStatus } from '../src/types/orders';
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

async function runM52Tests() {
  console.log('===================================================================================================');
  console.log('🚀 M5.2 ORDER UI INTEGRATION VERIFICATION');
  console.log('===================================================================================================');

  // Authenticate as worker
  await initWorkerAuth();

  const now = Date.now();
  const testBizA = `biz_m52_A_${now}`;
  const testBizB = `biz_m52_B_${now}`;

  // Clean setup
  await setDoc(doc(db, 'businesses', testBizA), {
    id: testBizA,
    name: 'M5.2 Test Store A',
    active: true,
    createdAt: now,
  });
  await setDoc(doc(db, 'businesses', testBizB), {
    id: testBizB,
    name: 'M5.2 Test Store B',
    active: true,
    createdAt: now,
  });

  // 1. Create a confirmed order for Business A
  const orderA = await OrderService.createOrder({
    businessId: testBizA,
    customerId: `cust_m52_01_${now}`,
    customerName: 'Anvar Rahimov',
    customerPhone: '+998901234567',
    status: 'confirmed',
    items: [
      {
        productId: 'prod_m52_01',
        productName: 'Apple iPhone 15 Pro 256GB',
        sku: 'IPH-15P-256',
        quantity: 2,
        unitPrice: 14000000,
      },
    ],
    currency: "so'm",
  });

  assert(!!orderA && !!orderA.id, 'Test 1: Successfully created real confirmed order for Business A');

  // Verify all required M5.2 fields are present and accurate
  assert(orderA.id.startsWith('order_'), `Test 2a: Order ID is deterministic and starts with order_: ${orderA.id}`);
  assert(orderA.customerName === 'Anvar Rahimov', `Test 2b: Customer name matches: ${orderA.customerName}`);
  assert(orderA.customerPhone === '+998901234567', `Test 2c: Customer phone matches: ${orderA.customerPhone}`);
  assert(orderA.items.length === 1, 'Test 2d: Products array contains items');
  assert(orderA.items[0].productName === 'Apple iPhone 15 Pro 256GB', 'Test 2e: Product name is accurate');
  assert(orderA.items[0].sku === 'IPH-15P-256', 'Test 2f: Product SKU is accurate');
  assert(orderA.items[0].quantity === 2, `Test 2g: Item quantity is 2: ${orderA.items[0].quantity}`);
  assert(orderA.items[0].unitPrice === 14000000, `Test 2h: Unit price is accurate: ${orderA.items[0].unitPrice}`);
  assert(orderA.subtotal === 28000000, `Test 3a: Subtotal is 28,000,000: ${orderA.subtotal}`);
  assert(orderA.total === 28000000, `Test 3b: Total is 28,000,000: ${orderA.total}`);
  assert(orderA.currency === "so'm", `Test 3c: Currency is so'm: ${orderA.currency}`);
  assert(typeof orderA.createdAt === 'number' && orderA.createdAt > 0, `Test 3d: createdAt timestamp is valid: ${orderA.createdAt}`);

  // Test 4: Status badge mapping for all M4 Order Domain statuses
  const statusTestCases: Array<{ status: OrderDomainStatus; expectedLabel: string }> = [
    { status: 'pending_confirmation', expectedLabel: 'Kutilmoqda' },
    { status: 'confirmed', expectedLabel: 'Tasdiqlangan' },
    { status: 'processing', expectedLabel: 'Tayyorlanmoqda' },
    { status: 'completed', expectedLabel: 'Yetkazildi' },
    { status: 'cancelled', expectedLabel: 'Bekor qilingan' },
  ];

  for (const tc of statusTestCases) {
    const badge = getOrderStatusBadge(tc.status);
    assert(badge.label === tc.expectedLabel, `Test 4: Status "${tc.status}" maps to badge label "${tc.expectedLabel}"`);
  }

  // Test 5: Inventory status badge mapping
  const inventoryTestCases: Array<{ status: OrderInventoryStatus; expectedLabel: string }> = [
    { status: 'completed', expectedLabel: 'Ombor: Yechildi' },
    { status: 'pending', expectedLabel: 'Ombor: Kutilmoqda' },
    { status: 'insufficient_stock', expectedLabel: 'Ombor: Yetarli emas' },
    { status: 'failed', expectedLabel: 'Ombor: Xatolik' },
  ];

  for (const tc of inventoryTestCases) {
    const badge = getInventoryStatusBadge(tc.status);
    assert(badge.label === tc.expectedLabel, `Test 5: Inventory status "${tc.status}" maps to badge label "${tc.expectedLabel}"`);
  }

  // Test 6: Recent Orders sorting & limiting
  // Create a second newer order for Business A
  const orderA2 = await OrderService.createOrder({
    businessId: testBizA,
    customerId: `cust_m52_02_${now}`,
    customerName: 'Dilshod Aliyev',
    customerPhone: '+998912345678',
    status: 'processing',
    items: [
      {
        productId: 'prod_m52_02',
        productName: 'Dyson V15 Detect',
        quantity: 1,
        unitPrice: 9500000,
      },
    ],
    currency: "so'm",
  });
  assert(!!orderA2 && !!orderA2.id, 'Test 6a: Created second order for Business A');

  // Test 7: Realtime subscription listener via OrderService.subscribeOrders
  let realtimeReceived: Order[] = [];
  let subscriptionFired = false;

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (subscriptionFired) resolve();
      else reject(new Error('subscribeOrders timed out'));
    }, 5000);

    const unsubscribe = OrderService.subscribeOrders(
      testBizA,
      (orders) => {
        realtimeReceived = orders;
        subscriptionFired = true;
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      },
      (err) => {
        clearTimeout(timeout);
        unsubscribe();
        reject(err);
      }
    );
  });

  assert(realtimeReceived.length >= 2, `Test 7a: Realtime subscribeOrders received orders: count=${realtimeReceived.length}`);
  // Verify descending sort (newest first)
  assert(realtimeReceived[0].createdAt >= realtimeReceived[1].createdAt, 'Test 7b: Orders are sorted newest first (descending createdAt)');
  assert(
    realtimeReceived.some((o) => o.id === orderA.id),
    'Test 7c: Order A is present in realtime subscription stream'
  );

  // Test 8: Strict Multi-tenant isolation
  // Create an order for Business B
  const orderB = await OrderService.createOrder({
    businessId: testBizB,
    customerId: `cust_m52_B_${now}`,
    customerName: 'Tenant B Customer',
    customerPhone: '+998939999999',
    status: 'confirmed',
    items: [
      {
        productId: 'prod_m52_B',
        productName: 'Secret Product B',
        quantity: 1,
        unitPrice: 1000000,
      },
    ],
  });
  assert(!!orderB && !!orderB.id, 'Test 8a: Created order for Business B');

  // Verify Business A stream does NOT contain Business B order
  const ordersBizA = await OrderService.getOrdersByBusiness(testBizA);
  const ordersBizB = await OrderService.getOrdersByBusiness(testBizB);

  const bizALeak = ordersBizA.some((o) => o.businessId === testBizB || o.id === orderB.id);
  const bizBLeak = ordersBizB.some((o) => o.businessId === testBizA || o.id === orderA.id);

  assert(!bizALeak, 'Test 8b: Business A orders list contains ZERO Business B orders (no leak)');
  assert(!bizBLeak, 'Test 8c: Business B orders list contains ZERO Business A orders (no leak)');
  assert(
    ordersBizA.every((o) => o.businessId === testBizA),
    'Test 8d: Every order in Business A has businessId === testBizA'
  );

  // Test 9: Existing legacy backwards compatibility
  const legacyStatusBadge = getOrderStatusBadge('Yetkazilmoqda');
  assert(legacyStatusBadge.label === 'Yetkazilmoqda', 'Test 9a: Legacy Uzbek status "Yetkazilmoqda" handled gracefully');
  const legacyTasdiqlandiBadge = getOrderStatusBadge('Tasdiqlandi');
  assert(legacyTasdiqlandiBadge.label === 'Tasdiqlangan', 'Test 9b: Legacy "Tasdiqlandi" maps cleanly to "Tasdiqlangan"');

  console.log('===============================================================');
  console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===============================================================');

  if (failCount > 0) {
    throw new Error(`${failCount} tests failed.`);
  }
  console.log('🎉 ALL M5.2 ORDER UI INTEGRATION TESTS PASSED SUCCESSFULLY!');
}

runM52Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal M5.2 test runner error:', err);
    process.exit(1);
  });
