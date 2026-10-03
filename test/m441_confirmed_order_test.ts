import { OrderService } from '../server/orders/orderService';
import { PendingConfirmationService } from '../server/orders/pendingConfirmationService';
import { CustomerService } from '../src/services/customerService';
import { ConversationService } from '../src/services/conversationService';
import { UpdateProcessor } from '../server/telegram/updateProcessor';
import { BusinessResolver } from '../server/telegram/businessResolver';
import { initWorkerAuth } from '../server/initWorkerAuth';
import { TelegramUpdate } from '../src/types/telegram';
import { Product } from '../src/types';
import { doc, getDoc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

interface TestItem {
  num: number;
  name: string;
  passed: boolean;
  details?: string;
}

const suite: TestItem[] = [];

function assert(num: number, name: string, condition: boolean, details?: string) {
  suite.push({ num, name, passed: condition, details });
  console.log(`[M4.4.1 TEST ${num}] ${condition ? '✅ PASS' : '❌ FAIL'}: ${name}${details ? ` -> ${details}` : ''}`);
}

async function runM441Tests() {
  console.log('===============================================================');
  console.log('📦 M4.4.1 CONFIRMED ORDER CREATION TESTS');
  console.log('(Pure Server-Side Order Generation, Idempotency, Tenant Isolation)');
  console.log('===============================================================');

  await initWorkerAuth();

  const timestamp = Date.now();
  const testBizA = `biz_m441_A_${timestamp}`;
  const testBizB = `biz_m441_B_${timestamp}`;

  // Seed sample products
  const productA1: Product = {
    id: `prod_m441_1_${timestamp}`,
    businessId: testBizA,
    warehouseId: 'wh_main',
    name: 'Samsung Galaxy S24 Ultra 512GB',
    sku: 'SAM-S24U-512',
    category: 'Smartphones',
    brand: 'Samsung',
    model: 'S24 Ultra',
    description: 'Titanium Gray 512GB',
    price: 15500000,
    costPrice: 13000000,
    stock: 8,
    lowStockThreshold: 2,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const productB1: Product = {
    id: `prod_m441_b1_${timestamp}`,
    businessId: testBizB,
    warehouseId: 'wh_b',
    name: 'Samsung Galaxy S24 Ultra 512GB',
    sku: 'SAM-S24U-512',
    category: 'Smartphones',
    brand: 'Samsung',
    model: 'S24 Ultra',
    description: 'Biz B item',
    price: 16000000,
    costPrice: 13500000,
    stock: 12,
    lowStockThreshold: 2,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await setDoc(doc(db, 'businesses', testBizA, 'products', productA1.id), productA1);
  await setDoc(doc(db, 'businesses', testBizB, 'products', productB1.id), productB1);

  // Helper to setup a pending confirmation for a customer
  async function createTestConfirmation(userId: number, quantity = 2, biz = testBizA, status: 'confirmed' | 'pending_confirmation' | 'cancelled' | 'expired' = 'confirmed') {
    const custId = CustomerService.getCustomerId(biz, String(userId));
    const convId = ConversationService.getConversationId(biz, String(userId));
    const base = await PendingConfirmationService.createPendingConfirmation({
      businessId: biz,
      customerId: custId,
      conversationId: convId,
      productId: productA1.id,
      productName: productA1.name,
      sku: productA1.sku || null,
      quantity,
      unitPrice: productA1.price,
      currency: "so'm",
    });

    const now = Date.now();
    const updated: any = {
      ...base,
      status,
    };
    if (status === 'confirmed') {
      updated.confirmedAt = now;
    } else if (status === 'cancelled') {
      updated.cancelledAt = now;
    } else if (status === 'expired') {
      updated.expiredAt = now;
      updated.expiresAt = now - 1000;
    }

    await setDoc(doc(db, 'pending_confirmations', base.id), updated);
    return updated as typeof base;
  }

  // --- TESTS 1-13: Basic Confirmed Confirmation -> Order Creation and Field Integrity ---
  const custUserId1 = 9001;
  const quantity1 = 2;
  const pending1 = await createTestConfirmation(custUserId1, quantity1, testBizA, 'confirmed');

  const creationResult = await OrderService.createOrderFromConfirmedPending({
    businessId: testBizA,
    pendingConfirmation: pending1,
  });

  const createdOrder = creationResult.order;

  // 1. confirmed confirmation -> order created
  assert(
    1,
    'confirmed confirmation -> order created',
    creationResult.success === true && Boolean(createdOrder) && creationResult.isExisting === false,
    `Order ID: ${createdOrder?.id}`
  );

  // 2. correct businessId
  assert(
    2,
    'correct businessId',
    createdOrder?.businessId === testBizA,
    `businessId: ${createdOrder?.businessId}`
  );

  // 3. correct customerId
  assert(
    3,
    'correct customerId',
    createdOrder?.customerId === pending1.customerId,
    `customerId: ${createdOrder?.customerId}`
  );

  // 4. correct conversationId
  assert(
    4,
    'correct conversationId',
    createdOrder?.conversationId === pending1.conversationId,
    `conversationId: ${createdOrder?.conversationId}`
  );

  // 5. correct productId
  assert(
    5,
    'correct productId',
    createdOrder?.items?.[0]?.productId === productA1.id,
    `productId: ${createdOrder?.items?.[0]?.productId}`
  );

  // 6. correct quantity
  assert(
    6,
    'correct quantity',
    createdOrder?.items?.[0]?.quantity === quantity1,
    `quantity: ${createdOrder?.items?.[0]?.quantity}`
  );

  // 7. correct unitPrice
  assert(
    7,
    'correct unitPrice',
    createdOrder?.items?.[0]?.unitPrice === productA1.price,
    `unitPrice: ${createdOrder?.items?.[0]?.unitPrice}`
  );

  // 8. correct lineTotal
  const expectedLineTotal = quantity1 * productA1.price;
  assert(
    8,
    'correct lineTotal',
    createdOrder?.items?.[0]?.lineTotal === expectedLineTotal,
    `lineTotal: ${createdOrder?.items?.[0]?.lineTotal}, expected: ${expectedLineTotal}`
  );

  // 9. correct subtotal
  assert(
    9,
    'correct subtotal',
    createdOrder?.subtotal === expectedLineTotal,
    `subtotal: ${createdOrder?.subtotal}`
  );

  // 10. correct total
  assert(
    10,
    'correct total',
    createdOrder?.total === expectedLineTotal,
    `total: ${createdOrder?.total}`
  );

  // 11. correct currency
  assert(
    11,
    'correct currency',
    createdOrder?.currency === "so'm",
    `currency: ${createdOrder?.currency}`
  );

  // 12. correct order status
  assert(
    12,
    'correct order status',
    createdOrder?.status === 'confirmed',
    `status: ${createdOrder?.status}`
  );

  // 13. confirmation linked to orderId
  const pendingSnapAfter = await getDoc(doc(db, 'pending_confirmations', pending1.id));
  const linkedOrderId = pendingSnapAfter.data()?.orderId;
  const stillAuditable = pendingSnapAfter.exists();
  assert(
    13,
    'confirmation linked to orderId and remains auditable',
    stillAuditable && linkedOrderId === createdOrder?.id,
    `linkedOrderId: ${linkedOrderId}, exists: ${stillAuditable}`
  );

  // 14. repeated execution returns existing order
  const repeatResult = await OrderService.createOrderFromConfirmedPending({
    businessId: testBizA,
    pendingConfirmationId: pending1.id,
  });
  assert(
    14,
    'repeated execution returns existing order',
    repeatResult.success === true && repeatResult.isExisting === true && repeatResult.order?.id === createdOrder?.id,
    `isExisting: ${repeatResult.isExisting}, orderId: ${repeatResult.order?.id}`
  );

  // 15. duplicate order is not created
  const ordersQuery = query(collection(db, 'orders'), where('businessId', '==', testBizA));
  const ordersSnap1 = await getDocs(ordersQuery);
  const countBeforeExtraRepeats = ordersSnap1.size;

  // Run 3 more repeated attempts
  await OrderService.createOrderFromConfirmedPending({ businessId: testBizA, pendingConfirmationId: pending1.id });
  await OrderService.createOrderFromConfirmedPending({ businessId: testBizA, pendingConfirmation: pending1 });
  await OrderService.createOrderFromConfirmedPending({
    businessId: testBizA,
    customerId: pending1.customerId,
    conversationId: pending1.conversationId,
  });

  const ordersSnap2 = await getDocs(ordersQuery);
  const countAfterExtraRepeats = ordersSnap2.size;
  assert(
    15,
    'duplicate order is not created on multiple executions',
    countBeforeExtraRepeats === countAfterExtraRepeats,
    `Count before: ${countBeforeExtraRepeats}, count after: ${countAfterExtraRepeats}`
  );

  // 16. unconfirmed pending state cannot create order
  const unconfirmedPending = await createTestConfirmation(9002, 1, testBizA, 'pending_confirmation');
  const unconfirmedRes = await OrderService.createOrderFromConfirmedPending({
    businessId: testBizA,
    pendingConfirmation: unconfirmedPending,
  });
  assert(
    16,
    'unconfirmed pending state cannot create order',
    unconfirmedRes.success === false && Boolean(unconfirmedRes.error),
    `Error: ${unconfirmedRes.error}`
  );

  // 17. cancelled confirmation cannot create order
  const cancelledPending = await createTestConfirmation(9003, 1, testBizA, 'cancelled');
  const cancelledRes = await OrderService.createOrderFromConfirmedPending({
    businessId: testBizA,
    pendingConfirmation: cancelledPending,
  });
  assert(
    17,
    'cancelled confirmation cannot create order',
    cancelledRes.success === false && Boolean(cancelledRes.error),
    `Error: ${cancelledRes.error}`
  );

  // 18. expired confirmation cannot create order
  const expiredPending = await createTestConfirmation(9004, 1, testBizA, 'expired');
  const expiredRes = await OrderService.createOrderFromConfirmedPending({
    businessId: testBizA,
    pendingConfirmation: expiredPending,
  });
  assert(
    18,
    'expired confirmation cannot create order',
    expiredRes.success === false && Boolean(expiredRes.error),
    `Error: ${expiredRes.error}`
  );

  // 19. tenant isolation: Biz B cannot use Biz A's confirmation to create an order
  const tenantViolationRes = await OrderService.createOrderFromConfirmedPending({
    businessId: testBizB,
    pendingConfirmation: pending1, // belongs to testBizA
  });
  const bizBOrdersSnap = await getDocs(query(collection(db, 'orders'), where('businessId', '==', testBizB)));
  assert(
    19,
    'tenant isolation: cross-tenant confirmation rejected and zero orders created for other business',
    tenantViolationRes.success === false && bizBOrdersSnap.size === 0,
    `Error: ${tenantViolationRes.error}, Biz B orders: ${bizBOrdersSnap.size}`
  );

  // 20. stock remains unchanged
  const productSnapAfter = await getDoc(doc(db, 'businesses', testBizA, 'products', productA1.id));
  const currentStock = productSnapAfter.data()?.stock;
  assert(
    20,
    'stock remains completely unchanged (deferred to M4.4.2)',
    currentStock === productA1.stock,
    `Stock before: ${productA1.stock}, after: ${currentStock}`
  );

  // 21. failure does not create partial order
  const ordersBeforeFailure = (await getDocs(ordersQuery)).size;
  const invalidPending = {
    ...pending1,
    id: `invalid_pending_${timestamp}`,
    productId: '', // invalid!
    quantity: -5,  // invalid!
  };
  const failureRes = await OrderService.createOrderFromConfirmedPending({
    businessId: testBizA,
    pendingConfirmation: invalidPending as any,
  });
  const ordersAfterFailure = (await getDocs(ordersQuery)).size;
  assert(
    21,
    'failure does not create partial order',
    failureRes.success === false && ordersBeforeFailure === ordersAfterFailure,
    `Orders before: ${ordersBeforeFailure}, after: ${ordersAfterFailure}, Error: ${failureRes.error}`
  );

  // --- BONUS: End-to-End UpdateProcessor with autoCreateOrder enabled ---
  {
    UpdateProcessor.setAutoCreateOrder(true);
    BusinessResolver.setExplicitBusiness(testBizA);

    const e2ePending = await createTestConfirmation(9005, 1, testBizA, 'pending_confirmation');

    const update: TelegramUpdate = {
      update_id: timestamp + 999,
      message: {
        message_id: 999,
        from: { id: 9005, is_bot: false, first_name: 'Davlat' },
        chat: { id: 9005, type: 'private' },
        date: Math.floor(timestamp / 1000),
        text: 'ha, tasdiqlayman',
      },
    };

    const e2eRes = await UpdateProcessor.processUpdate(update);
    const e2eOrderPass =
      e2eRes.success === true &&
      e2eRes.createdOrder !== undefined &&
      e2eRes.createdOrder.status === 'confirmed' &&
      e2eRes.createdOrder.items[0].productId === productA1.id;

    console.log(`[BONUS E2E] Auto-created order via UpdateProcessor webhook: ${e2eOrderPass ? '✅ SUCCESS' : '❌ FAIL'}`);
    UpdateProcessor.setAutoCreateOrder(false); // Reset to default
  }

  console.log('===============================================================');
  const passedCount = suite.filter((t) => t.passed).length;
  console.log(`TOTAL: ${suite.length} | PASSED: ${passedCount} | FAILED: ${suite.length - passedCount}`);
  console.log('===============================================================');

  if (passedCount === suite.length) {
    console.log('🎉 ALL 21 M4.4.1 CONFIRMED ORDER CREATION TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('❌ SOME M4.4.1 TESTS FAILED');
    process.exit(1);
  }
}

runM441Tests();
