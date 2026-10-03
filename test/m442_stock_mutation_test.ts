import { OrderService } from '../server/orders/orderService';
import { CustomerService } from '../src/services/customerService';
import { ConversationService } from '../src/services/conversationService';
import { initWorkerAuth } from '../server/initWorkerAuth';
import { Product, StockMovement } from '../src/types';
import { Order } from '../src/types/orders';
import { doc, getDoc, setDoc, getDocs, collection, query, where, updateDoc } from 'firebase/firestore';
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
  console.log(`[M4.4.2 TEST ${num}] ${condition ? '✅ PASS' : '❌ FAIL'}: ${name}${details ? ` -> ${details}` : ''}`);
}

async function runM442Tests() {
  console.log('===============================================================');
  console.log('📦 M4.4.2 STOCK MUTATION & WAREHOUSE LEDGER TESTS');
  console.log('(Atomic Transactions, Ledger Integrity, Concurrency, Tenant Isolation)');
  console.log('===============================================================');

  await initWorkerAuth();

  const timestamp = Date.now();
  const testBizA = `biz_m442_A_${timestamp}`;
  const testBizB = `biz_m442_B_${timestamp}`;

  // Helper to create product
  async function createProduct(biz: string, prodId: string, initialStock: number, name = 'Xiaomi 14 Ultra'): Promise<Product> {
    const prod: Product = {
      id: prodId,
      businessId: biz,
      warehouseId: 'wh_main',
      name,
      sku: `SKU-${prodId}`,
      category: 'Smartphones',
      brand: 'Xiaomi',
      model: '14 Ultra',
      description: 'Flagship camera phone',
      price: 12000000,
      costPrice: 10000000,
      stock: initialStock,
      lowStockThreshold: 2,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await setDoc(doc(db, 'businesses', biz, 'products', prod.id), prod);
    return prod;
  }

  // Helper to create a confirmed order
  async function createConfirmedOrder(biz: string, prodId: string, qty: number, orderSuffix: string, status: 'confirmed' | 'pending_confirmation' | 'cancelled' = 'confirmed'): Promise<Order> {
    const orderId = `ord_m442_${orderSuffix}_${timestamp}`;
    const custId = CustomerService.getCustomerId(biz, `user_${orderSuffix}`);
    const convId = ConversationService.getConversationId(biz, `user_${orderSuffix}`);
    const unitPrice = 12000000;
    const lineTotal = qty * unitPrice;

    const order: Order = {
      id: orderId,
      orderId,
      businessId: biz,
      customerId: custId,
      conversationId: convId,
      status,
      items: [
        {
          productId: prodId,
          productName: 'Xiaomi 14 Ultra',
          sku: `SKU-${prodId}`,
          quantity: qty,
          unitPrice,
          lineTotal,
          totalPrice: lineTotal,
        },
      ],
      subtotal: lineTotal,
      total: lineTotal,
      currency: "so'm",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await setDoc(doc(db, 'orders', orderId), order);
    return order;
  }

  // Seed initial products
  const productA1 = await createProduct(testBizA, `prod_m442_1_${timestamp}`, 10);
  const productB1 = await createProduct(testBizB, `prod_m442_b1_${timestamp}`, 10);

  // --- TESTS 1-6: Standard Confirmed Order Stock Mutation & Ledger Verification ---
  const order1 = await createConfirmedOrder(testBizA, productA1.id, 2, 'std_1');

  const mutateRes1 = await OrderService.mutateStockForConfirmedOrder({
    businessId: testBizA,
    orderId: order1.id,
  });

  const productSnap1 = await getDoc(doc(db, 'businesses', testBizA, 'products', productA1.id));
  const productData1 = productSnap1.data() as Product;

  // 1. confirmed order decreases stock correctly
  assert(
    1,
    'confirmed order decreases stock correctly',
    mutateRes1.success === true && productData1.stock === 8,
    `Stock before: 10, after: ${productData1.stock}`
  );

  // 2. correct quantity deducted
  const deducted = 10 - productData1.stock;
  assert(
    2,
    'correct quantity deducted',
    deducted === 2,
    `Expected deduction: 2, actual: ${deducted}`
  );

  // 3. warehouse ledger created
  const movementsSnap1 = await getDocs(
    query(
      collection(db, 'businesses', testBizA, 'stock_movements'),
      where('referenceId', '==', order1.id)
    )
  );
  const movements1: StockMovement[] = [];
  movementsSnap1.forEach((d) => movements1.push(d.data() as StockMovement));

  assert(
    3,
    'warehouse ledger created',
    movements1.length === 1,
    `Ledger count for order ${order1.id}: ${movements1.length}`
  );

  const ledgerEntry1 = movements1[0];

  // 4. ledger references orderId
  assert(
    4,
    'ledger references orderId',
    ledgerEntry1?.referenceId === order1.id && ledgerEntry1?.referenceType === 'order',
    `referenceId: ${ledgerEntry1?.referenceId}, referenceType: ${ledgerEntry1?.referenceType}`
  );

  // 5. correct businessId
  assert(
    5,
    'correct businessId',
    ledgerEntry1?.businessId === testBizA,
    `businessId: ${ledgerEntry1?.businessId}`
  );

  // 6. correct productId
  assert(
    6,
    'correct productId',
    ledgerEntry1?.productId === productA1.id,
    `productId: ${ledgerEntry1?.productId}`
  );

  // --- TESTS 7-9: Insufficient Stock, Zero Stock, and Negative-Stock Prevention ---
  // Product with stock = 1
  const productLow = await createProduct(testBizA, `prod_m442_low_${timestamp}`, 1);
  const orderLow = await createConfirmedOrder(testBizA, productLow.id, 3, 'low_stock'); // needs 3, only 1 available

  const mutateLowRes = await OrderService.mutateStockForConfirmedOrder({
    businessId: testBizA,
    orderId: orderLow.id,
  });

  const productLowSnap = await getDoc(doc(db, 'businesses', testBizA, 'products', productLow.id));
  const productLowData = productLowSnap.data() as Product;

  // 7. insufficient stock
  assert(
    7,
    'insufficient stock prevents mutation safely',
    mutateLowRes.success === false && mutateLowRes.code === 'INSUFFICIENT_STOCK' && productLowData.stock === 1,
    `Result code: ${mutateLowRes.code}, stock maintained: ${productLowData.stock}`
  );

  // Zero stock product
  const productZero = await createProduct(testBizA, `prod_m442_zero_${timestamp}`, 0);
  const orderZero = await createConfirmedOrder(testBizA, productZero.id, 1, 'zero_stock');

  const mutateZeroRes = await OrderService.mutateStockForConfirmedOrder({
    businessId: testBizA,
    orderId: orderZero.id,
  });

  const productZeroSnap = await getDoc(doc(db, 'businesses', testBizA, 'products', productZero.id));
  const productZeroData = productZeroSnap.data() as Product;

  // 8. zero stock
  assert(
    8,
    'zero stock prevents mutation safely',
    mutateZeroRes.success === false && mutateZeroRes.code === 'INSUFFICIENT_STOCK' && productZeroData.stock === 0,
    `Result code: ${mutateZeroRes.code}, stock maintained: ${productZeroData.stock}`
  );

  // 9. negative-stock prevention
  assert(
    9,
    'negative-stock prevention strictly enforced',
    productLowData.stock >= 0 && productZeroData.stock >= 0,
    `Low product stock: ${productLowData.stock}, Zero product stock: ${productZeroData.stock}`
  );

  // --- TESTS 10-11: Idempotency & Duplicate Processing Protection ---
  // Run mutation again on order1 (which was already processed in Test 1)
  const duplicateRes = await OrderService.mutateStockForConfirmedOrder({
    businessId: testBizA,
    orderId: order1.id,
  });

  const productSnapAfterDup = await getDoc(doc(db, 'businesses', testBizA, 'products', productA1.id));
  const stockAfterDup = (productSnapAfterDup.data() as Product).stock;

  // 10. duplicate processing does not deduct twice
  assert(
    10,
    'duplicate processing does not deduct twice',
    duplicateRes.success === true && duplicateRes.isAlreadyProcessed === true && stockAfterDup === 8,
    `isAlreadyProcessed: ${duplicateRes.isAlreadyProcessed}, stock: ${stockAfterDup} (expected 8)`
  );

  // 11. duplicate processing does not create duplicate ledger
  const movementsSnapDup = await getDocs(
    query(
      collection(db, 'businesses', testBizA, 'stock_movements'),
      where('referenceId', '==', order1.id)
    )
  );
  assert(
    11,
    'duplicate processing does not create duplicate ledger',
    movementsSnapDup.size === 1,
    `Movements count: ${movementsSnapDup.size} (expected exactly 1)`
  );

  // --- TEST 12: Concurrent Purchase of Final Unit ---
  // Product with stock = 1
  const productFinal = await createProduct(testBizA, `prod_m442_final_${timestamp}`, 1);
  const orderCustA = await createConfirmedOrder(testBizA, productFinal.id, 1, 'conc_A');
  const orderCustB = await createConfirmedOrder(testBizA, productFinal.id, 1, 'conc_B');

  // Simultaneously fire mutations
  const [resA, resB] = await Promise.all([
    OrderService.mutateStockForConfirmedOrder({ businessId: testBizA, orderId: orderCustA.id }),
    OrderService.mutateStockForConfirmedOrder({ businessId: testBizA, orderId: orderCustB.id }),
  ]);

  const productFinalSnap = await getDoc(doc(db, 'businesses', testBizA, 'products', productFinal.id));
  const finalStock = (productFinalSnap.data() as Product).stock;

  const oneSucceeded = (resA.success && !resB.success) || (!resA.success && resB.success);
  const oneFailedInsufficient =
    (resA.code === 'INSUFFICIENT_STOCK' && resB.success) ||
    (resB.code === 'INSUFFICIENT_STOCK' && resA.success);

  assert(
    12,
    'concurrent purchase of final unit allows only one winner and never negative stock',
    oneSucceeded && oneFailedInsufficient && finalStock === 0,
    `ResA success: ${resA.success}, ResB success: ${resB.success}, Final Stock: ${finalStock}`
  );

  // --- TEST 13: Tenant Isolation ---
  // Try to mutate stock for Biz B using Biz A's order
  const tenantViolationRes = await OrderService.mutateStockForConfirmedOrder({
    businessId: testBizB,
    orderId: order1.id, // belongs to testBizA
  });

  const prodBSnap = await getDoc(doc(db, 'businesses', testBizB, 'products', productB1.id));
  const prodBStock = (prodBSnap.data() as Product).stock;

  assert(
    13,
    'tenant isolation prevents cross-business stock mutation',
    tenantViolationRes.success === false && tenantViolationRes.code === 'TENANT_MISMATCH' && prodBStock === 10,
    `Result code: ${tenantViolationRes.code}, Biz B Stock: ${prodBStock}`
  );

  // --- TEST 14: Order Creation Failure Does Not Mutate Stock ---
  // Verify that an unconfirmed order cannot mutate stock
  const unconfirmedOrder = await createConfirmedOrder(testBizA, productA1.id, 2, 'unconfirmed', 'pending_confirmation');
  const stockBeforeUnconfirmed = (await getDoc(doc(db, 'businesses', testBizA, 'products', productA1.id))).data()?.stock;

  const unconfirmedMutateRes = await OrderService.mutateStockForConfirmedOrder({
    businessId: testBizA,
    orderId: unconfirmedOrder.id,
  });

  const stockAfterUnconfirmed = (await getDoc(doc(db, 'businesses', testBizA, 'products', productA1.id))).data()?.stock;

  assert(
    14,
    'order creation failure / unconfirmed order does not mutate stock',
    unconfirmedMutateRes.success === false && unconfirmedMutateRes.code === 'INVALID_STATUS' && stockBeforeUnconfirmed === stockAfterUnconfirmed,
    `Result code: ${unconfirmedMutateRes.code}, stock unchanged: ${stockAfterUnconfirmed}`
  );

  // --- TEST 15: Stock Mutation Failure Remains Recoverable ---
  // We have orderLow which failed in Test 7 because stock was 1 and order needed 3.
  // Now replenish productLow stock to 5 units!
  await updateDoc(doc(db, 'businesses', testBizA, 'products', productLow.id), {
    stock: 5,
    updatedAt: Date.now(),
  });

  // Retry mutation for the exact same orderLow!
  const retryMutateRes = await OrderService.mutateStockForConfirmedOrder({
    businessId: testBizA,
    orderId: orderLow.id,
  });

  const productLowAfterReplenish = (await getDoc(doc(db, 'businesses', testBizA, 'products', productLow.id))).data()?.stock;

  assert(
    15,
    'stock mutation failure remains recoverable upon stock replenishment',
    retryMutateRes.success === true && productLowAfterReplenish === 2,
    `Retry success: ${retryMutateRes.success}, Stock after replenishment & deduction: ${productLowAfterReplenish} (5 - 3 = 2)`
  );

  // --- TEST 16: Successful Mutation Marks Inventory Processing Complete ---
  const orderSnapAfterMutation = await getDoc(doc(db, 'orders', order1.id));
  const orderDataAfter = orderSnapAfterMutation.data() as Order;

  assert(
    16,
    'successful mutation marks inventory processing complete',
    orderDataAfter.inventoryProcessed === true &&
    typeof orderDataAfter.inventoryProcessedAt === 'number' &&
    orderDataAfter.inventoryStatus === 'completed' &&
    Array.isArray(orderDataAfter.ledgerMovementIds) &&
    orderDataAfter.ledgerMovementIds.length > 0,
    `inventoryProcessed: ${orderDataAfter.inventoryProcessed}, status: ${orderDataAfter.inventoryStatus}, at: ${orderDataAfter.inventoryProcessedAt}`
  );

  // --- TEST 17: Repeated Execution is Idempotent ---
  const idempotentRes = await OrderService.mutateStockForConfirmedOrder({
    businessId: testBizA,
    orderId: order1.id,
  });

  assert(
    17,
    'repeated execution is idempotent and returns clean result',
    idempotentRes.success === true && idempotentRes.isAlreadyProcessed === true,
    `isAlreadyProcessed: ${idempotentRes.isAlreadyProcessed}`
  );

  console.log('===============================================================');
  const passedCount = suite.filter((t) => t.passed).length;
  console.log(`TOTAL: ${suite.length} | PASSED: ${passedCount} | FAILED: ${suite.length - passedCount}`);
  console.log('===============================================================');

  if (passedCount === suite.length) {
    console.log('🎉 ALL 17 M4.4.2 STOCK MUTATION & WAREHOUSE LEDGER TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('❌ SOME M4.4.2 TESTS FAILED');
    process.exit(1);
  }
}

runM442Tests();
