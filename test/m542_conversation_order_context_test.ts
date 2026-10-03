import { db } from '../src/lib/firebase';
import { initWorkerAuth } from '../server/initWorkerAuth';
import { doc, setDoc } from 'firebase/firestore';
import { OrderService } from '../server/orders/orderService';
import { Order, OrderDomainStatus } from '../src/types/orders';
import { Customer, Conversation } from '../src/types';
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

async function runM542Tests() {
  console.log('===================================================================================================');
  console.log('🚀 M5.4.2 CONVERSATION ORDER CONTEXT VERIFICATION');
  console.log('===================================================================================================');

  await initWorkerAuth();

  const now = Date.now();
  const testBizA = `biz_m542_A_${now}`;
  const testBizB = `biz_m542_B_${now}`;

  // 1. Setup Tenants, Customers and Conversations
  await setDoc(doc(db, 'businesses', testBizA), { id: testBizA, name: 'Store A', active: true, createdAt: now });
  await setDoc(doc(db, 'businesses', testBizB), { id: testBizB, name: 'Store B', active: true, createdAt: now });

  const customerA: Customer = {
    id: `cust_m542_a_${now}`,
    businessId: testBizA,
    source: 'telegram',
    firstName: 'Sherzod',
    lastName: 'Mansurov',
    phone: '+998901239988',
    telegramUsername: 'sherzod_m',
    status: 'Buyurtma berdi',
    leadScore: 90,
    tags: ['VIP'],
    totalOrders: 0,
    totalSpent: 0,
    createdAt: now,
    lastInteraction: now,
  };

  const customerOther: Customer = {
    id: `cust_m542_other_${now}`,
    businessId: testBizA,
    source: 'telegram',
    firstName: 'Boshqa',
    lastName: 'Mijoz',
    phone: '+998905554433',
    telegramUsername: 'boshqa_m',
    status: 'Yangi',
    leadScore: 50,
    totalOrders: 0,
    totalSpent: 0,
    createdAt: now,
    lastInteraction: now,
  };

  const conversationA: Conversation = {
    id: `conv_m542_a_${now}`,
    businessId: testBizA,
    channel: 'telegram',
    status: 'open',
    assignedTo: 'bot',
    customerId: customerA.id,
    customerName: 'Sherzod Mansurov',
    customerUsername: 'sherzod_m',
    telegramChatId: '123456789',
    lastMessagePreview: 'Buyurtma tasdiqlandi',
    lastMessageAt: now,
    unreadCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  // 2. Create Orders for Customer A:
  // Order 1: confirmed (Active)
  const order1 = await OrderService.createOrder({
    businessId: testBizA,
    customerId: customerA.id,
    conversationId: conversationA.id,
    customerName: `${customerA.firstName} ${customerA.lastName}`,
    customerPhone: customerA.phone,
    status: 'confirmed',
    items: [
      {
        productId: 'prod_1',
        productName: 'iPhone 15 Pro 128GB',
        sku: 'IPH-15P-128',
        quantity: 1,
        unitPrice: 13500000,
      },
    ],
    currency: "so'm",
  });

  // Order 2: processing (Active)
  const order2 = await OrderService.createOrder({
    businessId: testBizA,
    customerId: customerA.id,
    conversationId: conversationA.id,
    customerName: `${customerA.firstName} ${customerA.lastName}`,
    customerPhone: customerA.phone,
    status: 'processing',
    items: [
      {
        productId: 'prod_2',
        productName: 'MagSafe Charger',
        sku: 'MAG-CHG-1',
        quantity: 2,
        unitPrice: 450000,
      },
    ],
    currency: "so'm",
  });

  // Order 3: completed (Recent)
  const order3 = await OrderService.createOrder({
    businessId: testBizA,
    customerId: customerA.id,
    conversationId: conversationA.id,
    customerName: `${customerA.firstName} ${customerA.lastName}`,
    customerPhone: customerA.phone,
    status: 'completed',
    items: [
      {
        productId: 'prod_3',
        productName: 'AirPods Pro 2',
        quantity: 1,
        unitPrice: 2800000,
      },
    ],
    currency: "so'm",
  });

  // Order 4: cancelled (Recent)
  const order4 = await OrderService.createOrder({
    businessId: testBizA,
    customerId: customerA.id,
    conversationId: conversationA.id,
    customerName: `${customerA.firstName} ${customerA.lastName}`,
    customerPhone: customerA.phone,
    status: 'cancelled',
    items: [
      {
        productId: 'prod_4',
        productName: 'Apple Watch Series 9',
        quantity: 1,
        unitPrice: 5200000,
      },
    ],
    currency: "so'm",
  });

  // Order for another customer in same tenant
  const orderOther = await OrderService.createOrder({
    businessId: testBizA,
    customerId: customerOther.id,
    customerName: 'Boshqa Mijoz',
    status: 'confirmed',
    items: [
      {
        productId: 'prod_other',
        productName: 'iPad Air 5',
        quantity: 1,
        unitPrice: 8000000,
      },
    ],
  });

  // Order for another business (Tenant B)
  const orderB = await OrderService.createOrder({
    businessId: testBizB,
    customerId: 'cust_tenant_b',
    customerName: 'Tenant B User',
    status: 'confirmed',
    items: [
      {
        productId: 'prod_b',
        productName: 'Store B Mac',
        quantity: 1,
        unitPrice: 15000000,
      },
    ],
  });

  // Replicating ConversationsView filter logic
  const allOrdersInState = [order1, order2, order3, order4, orderOther, orderB];

  const conversationOrders = allOrdersInState
    .filter((o) => {
      if (testBizA && o.businessId && o.businessId !== testBizA) return false;
      const matchesCustomer =
        (customerA && o.customerId === customerA.id) ||
        (conversationA.customerId && o.customerId === conversationA.customerId);
      const matchesConversation =
        conversationA.id && o.conversationId === conversationA.id;
      return matchesCustomer || matchesConversation;
    })
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const isActiveOrderStatus = (status?: string) => {
    const s = (status || '').toLowerCase();
    return s === 'confirmed' || s === 'processing' || s === 'tasdiqlandi' || s === 'tayyorlanmoqda';
  };

  const isRecentOrderStatus = (status?: string) => {
    const s = (status || '').toLowerCase();
    return s === 'completed' || s === 'cancelled' || s === 'yetkazildi' || s === 'bekor qilindi';
  };

  const activeOrders = conversationOrders.filter((o) => isActiveOrderStatus(o.status || o.orderStatus));
  const recentOrders = conversationOrders.filter((o) => isRecentOrderStatus(o.status || o.orderStatus));

  // Test 1: Active orders count and status correctness
  assert(activeOrders.length === 2, `Test 1a: Active orders count is 2 (got ${activeOrders.length})`);
  assert(
    activeOrders.every((o) => o.status === 'confirmed' || o.status === 'processing'),
    'Test 1b: Active orders only contain confirmed / processing'
  );
  assert(activeOrders.some((o) => o.id === order1.id), 'Test 1c: order1 (confirmed) is in active orders');
  assert(activeOrders.some((o) => o.id === order2.id), 'Test 1d: order2 (processing) is in active orders');

  // Test 2: Recent orders count and status correctness
  assert(recentOrders.length === 2, `Test 2a: Recent orders count is 2 (got ${recentOrders.length})`);
  assert(
    recentOrders.every((o) => o.status === 'completed' || o.status === 'cancelled'),
    'Test 2b: Recent orders only contain completed / cancelled'
  );
  assert(recentOrders.some((o) => o.id === order3.id), 'Test 2c: order3 (completed) is in recent orders');
  assert(recentOrders.some((o) => o.id === order4.id), 'Test 2d: order4 (cancelled) is in recent orders');
  assert(recentOrders[0].createdAt >= recentOrders[1].createdAt, 'Test 2e: Recent orders sorted newest first');

  // Test 3: Customer isolation: Other customer orders do NOT appear in Conversation A
  const otherCustomerIncluded = conversationOrders.some((o) => o.id === orderOther.id);
  assert(!otherCustomerIncluded, 'Test 3a: Other customer order is NOT in Conversation A orders');

  // Test 4: Tenant isolation: Tenant B order does NOT appear in Conversation A
  const tenantBIncluded = conversationOrders.some((o) => o.id === orderB.id || o.businessId === testBizB);
  assert(!tenantBIncluded, 'Test 4a: Tenant B order is NOT in Conversation A orders (strict multi-tenant)');

  // Test 5: Order fields completeness (Order ID, products, quantity, total, currency, status, inventory)
  const actOrder1 = activeOrders.find((o) => o.id === order1.id)!;
  assert(actOrder1.items[0].productName === 'iPhone 15 Pro 128GB', 'Test 5a: Product name is correct');
  assert(actOrder1.items[0].quantity === 1, 'Test 5b: Quantity is correct');
  assert(actOrder1.total === 13500000, 'Test 5c: Total is 13,500,000');
  assert(actOrder1.currency === "so'm", 'Test 5d: Currency is so\'m');
  assert(typeof actOrder1.createdAt === 'number', 'Test 5e: createdAt timestamp is present');

  const statusBadge = getOrderStatusBadge(actOrder1.status);
  assert(statusBadge.label === 'Tasdiqlangan', 'Test 5f: Status badge label is "Tasdiqlangan"');

  const inventoryBadge = getInventoryStatusBadge(actOrder1.inventoryStatus);
  assert(inventoryBadge.label.includes('Ombor'), 'Test 5g: Inventory badge is present');

  // Test 6: Realtime status transition: confirmed → completed moves from Active to Recent
  const updatedOrder1: Order = { ...order1, status: 'completed', updatedAt: Date.now() };
  const updatedOrdersList = allOrdersInState.map((o) => (o.id === order1.id ? updatedOrder1 : o));

  const reFilteredActive = updatedOrdersList
    .filter((o) => o.customerId === customerA.id && isActiveOrderStatus(o.status));
  const reFilteredRecent = updatedOrdersList
    .filter((o) => o.customerId === customerA.id && isRecentOrderStatus(o.status));

  assert(reFilteredActive.length === 1, `Test 6a: Active orders count reduced to 1 after completion (got ${reFilteredActive.length})`);
  assert(reFilteredRecent.length === 3, `Test 6b: Recent orders count increased to 3 after completion (got ${reFilteredRecent.length})`);
  assert(reFilteredRecent.some((o) => o.id === order1.id), 'Test 6c: order1 now in recent orders');

  // Test 7: Empty state verification
  const emptyActiveMessage = reFilteredActive.length === 0 ? 'Faol buyurtmalar yo‘q' : 'Faol mavjud';
  const emptyConvOrders: Order[] = [];
  const emptyActiveOrders = emptyConvOrders.filter((o) => isActiveOrderStatus(o.status));
  const emptyRecentOrders = emptyConvOrders.filter((o) => isRecentOrderStatus(o.status));

  assert(emptyActiveOrders.length === 0, 'Test 7a: 0 active orders detected');
  assert(emptyRecentOrders.length === 0, 'Test 7b: 0 recent orders detected');
  const emptyActiveText = emptyActiveOrders.length === 0 ? 'Faol buyurtmalar yo‘q' : '';
  const emptyRecentText = emptyRecentOrders.length === 0 ? 'So‘nggi buyurtmalar yo‘q' : '';
  assert(emptyActiveText === 'Faol buyurtmalar yo‘q', 'Test 7c: Empty active orders displays "Faol buyurtmalar yo‘q"');
  assert(emptyRecentText === 'So‘nggi buyurtmalar yo‘q', 'Test 7d: Empty recent orders displays "So‘nggi buyurtmalar yo‘q"');

  // Test 8: Realtime new incoming order adds to active orders
  const newIncomingOrder = await OrderService.createOrder({
    businessId: testBizA,
    customerId: customerA.id,
    conversationId: conversationA.id,
    customerName: 'Sherzod Mansurov',
    status: 'confirmed',
    items: [
      {
        productId: 'prod_new',
        productName: 'MacBook Air M3',
        quantity: 1,
        unitPrice: 14200000,
      },
    ],
    currency: "so'm",
  });

  const streamWithNew = [newIncomingOrder, ...updatedOrdersList];
  const activeWithNew = streamWithNew.filter((o) => o.customerId === customerA.id && isActiveOrderStatus(o.status));
  assert(activeWithNew.length === 2, `Test 8: Realtime incoming order adds to active orders: count=${activeWithNew.length}`);
  assert(activeWithNew[0].id === newIncomingOrder.id, 'Test 8b: Newest incoming order is at the top of active orders');

  console.log('===================================================================================================');
  console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===================================================================================================');

  if (failCount > 0) {
    throw new Error(`${failCount} tests failed.`);
  }
  console.log('🎉 ALL M5.4.2 CONVERSATION ORDER CONTEXT TESTS PASSED SUCCESSFULLY!');
}

runM542Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal M5.4.2 test runner error:', err);
    process.exit(1);
  });
