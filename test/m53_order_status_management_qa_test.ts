import { db } from '../src/lib/firebase';
import { initWorkerAuth } from '../server/initWorkerAuth';
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { OrderService } from '../server/orders/orderService';
import { FirestoreService } from '../src/services/firebaseService';
import { Order, OrderDomainStatus } from '../src/types/orders';
import { getOrderStatusBadge } from '../src/components/OrdersView';

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runM53QATests() {
  console.log('===================================================================================================');
  console.log('🚀 M5.3 ORDER STATUS MANAGEMENT QA VERIFICATION');
  console.log('===================================================================================================');

  await initWorkerAuth();

  const now = Date.now();
  const testBizA = `biz_m53_A_${now}`;
  const testBizB = `biz_m53_B_${now}`;

  // 1. Setup Tenants and Products
  await setDoc(doc(db, 'businesses', testBizA), {
    id: testBizA,
    name: 'M5.3 Store A',
    active: true,
    createdAt: now,
  });

  await setDoc(doc(db, 'businesses', testBizB), {
    id: testBizB,
    name: 'M5.3 Store B',
    active: true,
    createdAt: now,
  });

  const prodIdA = `prod_iphone_${now}`;
  await setDoc(doc(db, 'businesses', testBizA, 'products', prodIdA), {
    id: prodIdA,
    businessId: testBizA,
    name: 'Apple iPhone 15 Pro 256GB',
    sku: 'IPH-15P-256',
    price: 14000000,
    costPrice: 12000000,
    stock: 10,
    warehouseId: 'wh-main',
    category: 'Smartfonlar',
    lowStockThreshold: 2,
    createdAt: now,
    updatedAt: now,
  });

  // Verify initial stock = 10
  const initialProdSnap = await getDoc(doc(db, 'businesses', testBizA, 'products', prodIdA));
  assert(initialProdSnap.data()?.stock === 10, 'Initial product stock is 10');

  // =====================================================================================
  // TRANSITION 1: confirmed → processing
  // =====================================================================================
  console.log('\n--- TESTING TRANSITION 1: confirmed → processing ---');
  const order1 = await OrderService.createOrder({
    businessId: testBizA,
    customerId: `cust_1_${now}`,
    customerName: 'Sardor Karimov',
    customerPhone: '+998901112233',
    status: 'confirmed',
    items: [
      {
        productId: prodIdA,
        productName: 'Apple iPhone 15 Pro 256GB',
        sku: 'IPH-15P-256',
        quantity: 2,
        unitPrice: 14000000,
      },
    ],
    currency: "so'm",
  });
  assert(order1.status === 'confirmed', 'Order 1 created with status confirmed');

  // Mutate stock via M4.4.2
  const mutateRes1 = await OrderService.mutateStockForConfirmedOrder({
    businessId: testBizA,
    orderId: order1.id,
  });
  assert(mutateRes1.success && mutateRes1.order?.inventoryStatus === 'completed', 'Order 1 inventory processed');

  // Stock should be 10 - 2 = 8
  const stockAfterConfirm = (await getDoc(doc(db, 'businesses', testBizA, 'products', prodIdA))).data()?.stock;
  assert(stockAfterConfirm === 8, `Stock after confirmation is 8 (was 10 - 2): received ${stockAfterConfirm}`);

  // Count ledgers after confirmation
  const ledgersSnap1 = await getDocs(collection(db, 'businesses', testBizA, 'stock_movements'));
  const ledgerCount1 = ledgersSnap1.size;
  assert(ledgerCount1 === 1, `Ledger count is 1: received ${ledgerCount1}`);

  await sleep(100);
  const beforeProcessingTime = Date.now();

  // Perform Transition: confirmed → processing via OrderService / FirestoreService
  const updatedToProcessing = await OrderService.updateOrderStatus(testBizA, order1.id, 'processing');
  await FirestoreService.updateOrderStatus(testBizA, order1.id, 'processing', 'Kutilmoqda');

  assert(updatedToProcessing.status === 'processing', 'Transition 1: returned status is processing');

  // Check Firestore root order document
  const orderDocProcessing = await getDoc(doc(db, 'orders', order1.id));
  assert(orderDocProcessing.exists(), 'Order exists in root orders collection');
  const orderDataProc = orderDocProcessing.data() as Order;
  assert(orderDataProc.status === 'processing', `Transition 1: Firestore status is processing (received: ${orderDataProc.status})`);
  assert(orderDataProc.updatedAt >= beforeProcessingTime, `Transition 1: updatedAt updated: ${orderDataProc.updatedAt} >= ${beforeProcessingTime}`);

  // Stock Safety check: stock must NOT change
  const stockAfterProc = (await getDoc(doc(db, 'businesses', testBizA, 'products', prodIdA))).data()?.stock;
  assert(stockAfterProc === 8, `Stock Safety: Stock remained exactly 8 after confirmed → processing (received ${stockAfterProc})`);

  // Ledger Safety check: zero duplicate ledger
  const ledgersSnapProc = await getDocs(collection(db, 'businesses', testBizA, 'stock_movements'));
  assert(ledgersSnapProc.size === ledgerCount1, `Ledger Safety: Zero new ledger movements created on confirmed → processing (count ${ledgersSnapProc.size})`);

  // UI badge check
  const badgeProc = getOrderStatusBadge('processing');
  assert(badgeProc.key === 'processing' && badgeProc.label === 'Tayyorlanmoqda', 'UI Badge for processing is "Tayyorlanmoqda"');

  // =====================================================================================
  // TRANSITION 2: processing → completed
  // =====================================================================================
  console.log('\n--- TESTING TRANSITION 2: processing → completed ---');
  await sleep(100);
  const beforeCompletedTime = Date.now();

  const updatedToCompleted = await OrderService.updateOrderStatus(testBizA, order1.id, 'completed');
  await FirestoreService.updateOrderStatus(testBizA, order1.id, 'completed', "To'landi");

  assert(updatedToCompleted.status === 'completed', 'Transition 2: returned status is completed');

  // Check Firestore root order document
  const orderDocComp = await getDoc(doc(db, 'orders', order1.id));
  const orderDataComp = orderDocComp.data() as Order;
  assert(orderDataComp.status === 'completed', `Transition 2: Firestore status is completed (received: ${orderDataComp.status})`);
  assert(orderDataComp.updatedAt >= beforeCompletedTime, `Transition 2: updatedAt updated: ${orderDataComp.updatedAt} >= ${beforeCompletedTime}`);

  // Stock Safety check: stock must NOT change
  const stockAfterComp = (await getDoc(doc(db, 'businesses', testBizA, 'products', prodIdA))).data()?.stock;
  assert(stockAfterComp === 8, `Stock Safety: Stock remained exactly 8 after processing → completed (received ${stockAfterComp})`);

  // Ledger Safety check: zero duplicate ledger
  const ledgersSnapComp = await getDocs(collection(db, 'businesses', testBizA, 'stock_movements'));
  assert(ledgersSnapComp.size === ledgerCount1, `Ledger Safety: Zero new ledger movements on processing → completed (count ${ledgersSnapComp.size})`);

  // Full Sequence Verification: confirmed → processing → completed executed mutation EXACTLY ONCE
  assert(initialProdSnap.data()?.stock - stockAfterComp === 2, 'Stock verification: exactly 2 units deducted across entire confirmed → processing → completed lifecycle');

  // UI badge check
  const badgeComp = getOrderStatusBadge('completed');
  assert(badgeComp.key === 'completed' && badgeComp.label === 'Yetkazildi', 'UI Badge for completed is "Yetkazildi"');

  // =====================================================================================
  // TRANSITION 3: confirmed → cancelled
  // =====================================================================================
  console.log('\n--- TESTING TRANSITION 3: confirmed → cancelled ---');
  const order2 = await OrderService.createOrder({
    businessId: testBizA,
    customerId: `cust_2_${now}`,
    customerName: 'Javohir Toshmatov',
    customerPhone: '+998903334455',
    status: 'confirmed',
    items: [
      {
        productId: prodIdA,
        productName: 'Apple iPhone 15 Pro 256GB',
        sku: 'IPH-15P-256',
        quantity: 3,
        unitPrice: 14000000,
      },
    ],
    currency: "so'm",
  });
  // Mutate stock
  await OrderService.mutateStockForConfirmedOrder({
    businessId: testBizA,
    orderId: order2.id,
  });
  // Stock is 8 - 3 = 5
  const stockBeforeCancel = (await getDoc(doc(db, 'businesses', testBizA, 'products', prodIdA))).data()?.stock;
  assert(stockBeforeCancel === 5, `Stock before cancellation is 5: received ${stockBeforeCancel}`);

  const ledgersBeforeCancel = (await getDocs(collection(db, 'businesses', testBizA, 'stock_movements'))).size;
  assert(ledgersBeforeCancel === 2, `Ledger count is 2: received ${ledgersBeforeCancel}`);

  await sleep(100);
  const beforeCancelTime = Date.now();

  // Perform Transition: confirmed → cancelled
  const updatedToCancelled = await OrderService.updateOrderStatus(testBizA, order2.id, 'cancelled');
  await FirestoreService.updateOrderStatus(testBizA, order2.id, 'cancelled');

  assert(updatedToCancelled.status === 'cancelled', 'Transition 3: returned status is cancelled');

  const orderDocCanc = await getDoc(doc(db, 'orders', order2.id));
  const orderDataCanc = orderDocCanc.data() as Order;
  assert(orderDataCanc.status === 'cancelled', `Transition 3: Firestore status is cancelled (received: ${orderDataCanc.status})`);
  assert(orderDataCanc.updatedAt >= beforeCancelTime, `Transition 3: updatedAt updated: ${orderDataCanc.updatedAt} >= ${beforeCancelTime}`);

  // Cancellation rule: stock is NOT refunded, ledger is NOT modified in current scope
  const stockAfterCancel = (await getDoc(doc(db, 'businesses', testBizA, 'products', prodIdA))).data()?.stock;
  assert(stockAfterCancel === 5, `Cancellation scope: stock remains 5 (not returned): received ${stockAfterCancel}`);

  const ledgersAfterCancel = (await getDocs(collection(db, 'businesses', testBizA, 'stock_movements'))).size;
  assert(ledgersAfterCancel === 2, `Cancellation scope: ledger count remains 2 (not modified): received ${ledgersAfterCancel}`);

  const badgeCanc = getOrderStatusBadge('cancelled');
  assert(badgeCanc.key === 'cancelled' && badgeCanc.label === 'Bekor qilingan', 'UI Badge for cancelled is "Bekor qilingan"');

  // =====================================================================================
  // TRANSITION 4: processing → cancelled
  // =====================================================================================
  console.log('\n--- TESTING TRANSITION 4: processing → cancelled ---');
  const order3 = await OrderService.createOrder({
    businessId: testBizA,
    customerId: `cust_3_${now}`,
    customerName: 'Malika Karimova',
    customerPhone: '+998905556677',
    status: 'confirmed',
    items: [
      {
        productId: prodIdA,
        productName: 'Apple iPhone 15 Pro 256GB',
        sku: 'IPH-15P-256',
        quantity: 1,
        unitPrice: 14000000,
      },
    ],
    currency: "so'm",
  });
  await OrderService.mutateStockForConfirmedOrder({
    businessId: testBizA,
    orderId: order3.id,
  });
  // Stock is 5 - 1 = 4
  const stockBeforeTrans4 = (await getDoc(doc(db, 'businesses', testBizA, 'products', prodIdA))).data()?.stock;
  assert(stockBeforeTrans4 === 4, `Stock before transition 4 is 4: received ${stockBeforeTrans4}`);

  // Move to processing
  await OrderService.updateOrderStatus(testBizA, order3.id, 'processing');
  const checkProc3 = (await getDoc(doc(db, 'orders', order3.id))).data()?.status;
  assert(checkProc3 === 'processing', 'Order 3 moved to processing');

  await sleep(100);
  const beforeCancel4Time = Date.now();

  // Move processing → cancelled
  const updated4Canc = await OrderService.updateOrderStatus(testBizA, order3.id, 'cancelled');
  await FirestoreService.updateOrderStatus(testBizA, order3.id, 'cancelled');

  assert(updated4Canc.status === 'cancelled', 'Transition 4: returned status is cancelled');

  const orderDoc4Canc = await getDoc(doc(db, 'orders', order3.id));
  const orderData4Canc = orderDoc4Canc.data() as Order;
  assert(orderData4Canc.status === 'cancelled', `Transition 4: Firestore status is cancelled (received: ${orderData4Canc.status})`);
  assert(orderData4Canc.updatedAt >= beforeCancel4Time, `Transition 4: updatedAt updated: ${orderData4Canc.updatedAt} >= ${beforeCancel4Time}`);

  const stockAfterCancel4 = (await getDoc(doc(db, 'businesses', testBizA, 'products', prodIdA))).data()?.stock;
  assert(stockAfterCancel4 === 4, `Transition 4 scope: stock remains 4: received ${stockAfterCancel4}`);

  // =====================================================================================
  // REALTIME SUBSCRIPTION VERIFICATION
  // =====================================================================================
  console.log('\n--- TESTING REALTIME SUBSCRIPTION UPON STATUS CHANGE ---');
  let realtimeUpdatedOrder: Order | undefined;
  let receivedSnapshot = false;

  const unsub = OrderService.subscribeOrders(testBizA, (ords) => {
    const found = ords.find((o) => o.id === order1.id);
    if (found) {
      realtimeUpdatedOrder = found;
      receivedSnapshot = true;
    }
  });

  // Give subscription time to establish and receive initial snapshot
  await sleep(600);
  assert(receivedSnapshot && !!realtimeUpdatedOrder, 'Realtime subscription received order1');
  assert(realtimeUpdatedOrder?.status === 'completed', `Realtime order1 has latest status "completed": received ${realtimeUpdatedOrder?.status}`);
  unsub();

  // =====================================================================================
  // TENANT ISOLATION
  // =====================================================================================
  console.log('\n--- TESTING TENANT ISOLATION ---');
  const orderB = await OrderService.createOrder({
    businessId: testBizB,
    customerId: `cust_b_${now}`,
    customerName: 'Tenant B User',
    customerPhone: '+998990001122',
    status: 'confirmed',
    items: [
      {
        productId: 'prod_b',
        productName: 'Store B Product',
        quantity: 1,
        unitPrice: 500000,
      },
    ],
  });

  // Cross-tenant update must fail / reject
  let crossTenantRejected = false;
  try {
    await OrderService.updateOrderStatus(testBizA, orderB.id, 'completed');
  } catch (err: any) {
    crossTenantRejected = true;
  }
  assert(crossTenantRejected, 'Security: Business A attempting to update Business B order is rejected with error');

  // Verify Business A order list has zero Business B orders
  const ordersBizA = await OrderService.getOrdersByBusiness(testBizA);
  const leakB = ordersBizA.some((o) => o.id === orderB.id || o.businessId === testBizB);
  assert(!leakB, 'Multi-tenant: Business A orders list contains zero Business B orders');

  console.log('===================================================================================================');
  console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===================================================================================================');

  if (failCount > 0) {
    throw new Error(`${failCount} tests failed.`);
  }
  console.log('🎉 ALL M5.3 ORDER STATUS MANAGEMENT QA TESTS PASSED SUCCESSFULLY!');
}

runM53QATests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal M5.3 QA runner error:', err);
    process.exit(1);
  });
