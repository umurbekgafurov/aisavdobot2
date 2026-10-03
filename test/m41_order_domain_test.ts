import { OrderService } from '../server/orders/orderService';
import { CreateOrderInput, OrderDomainStatus } from '../src/types/orders';
import { initWorkerAuth } from '../server/initWorkerAuth';

interface TestRecord {
  num: number;
  name: string;
  passed: boolean;
  details?: string;
}

const suite: TestRecord[] = [];

function assert(num: number, name: string, condition: boolean, details?: string) {
  suite.push({ num, name, passed: condition, details });
  console.log(`[M4.1 TEST ${num}] ${condition ? '✅ PASS' : '❌ FAIL'}: ${name}${details ? ` -> ${details}` : ''}`);
}

async function runM41OrderDomainTests() {
  console.log('===============================================================');
  console.log('📦 M4.1 ORDER DOMAIN MODEL & SERVICE UNIT TESTS');
  console.log('===============================================================');

  // Authenticate backend worker for Firestore operations
  await initWorkerAuth();

  const bizA = `biz_order_test_A_${Date.now()}`;
  const bizB = `biz_order_test_B_${Date.now()}`;
  const custA = `cust_order_test_A_${Date.now()}`;

  // 1. Valid order structure
  let createdOrderA: any = null;
  try {
    const input: CreateOrderInput = {
      businessId: bizA,
      customerId: custA,
      conversationId: 'conv_123',
      items: [
        {
          productId: 'prod_1',
          productName: 'iPhone 15 Pro 256GB',
          sku: 'IPH-15P-256',
          quantity: 2,
          unitPrice: 13000000,
        },
      ],
      currency: 'UZS',
    };

    createdOrderA = await OrderService.createOrder(input);

    const validStructure =
      Boolean(createdOrderA.id) &&
      createdOrderA.businessId === bizA &&
      createdOrderA.customerId === custA &&
      createdOrderA.conversationId === 'conv_123' &&
      createdOrderA.status === 'pending_confirmation' &&
      Array.isArray(createdOrderA.items) &&
      createdOrderA.items.length === 1 &&
      createdOrderA.items[0].productId === 'prod_1' &&
      createdOrderA.items[0].productName === 'iPhone 15 Pro 256GB' &&
      createdOrderA.items[0].sku === 'IPH-15P-256' &&
      createdOrderA.items[0].quantity === 2 &&
      createdOrderA.items[0].unitPrice === 13000000 &&
      createdOrderA.items[0].lineTotal === 26000000 &&
      createdOrderA.subtotal === 26000000 &&
      createdOrderA.total === 26000000 &&
      createdOrderA.currency === 'UZS' &&
      typeof createdOrderA.createdAt === 'number' &&
      typeof createdOrderA.updatedAt === 'number';

    assert(1, 'Valid order structure created with all required fields', validStructure, `ID: ${createdOrderA.id}`);
  } catch (err: any) {
    assert(1, 'Valid order structure created with all required fields', false, err.message);
  }

  // 2. Multiple order items
  let multiItemOrder: any = null;
  try {
    const input: CreateOrderInput = {
      businessId: bizA,
      customerId: custA,
      items: [
        {
          productId: 'prod_1',
          productName: 'iPhone 15 Pro 256GB',
          sku: 'IPH-15P-256',
          quantity: 1,
          unitPrice: 13000000,
        },
        {
          productId: 'prod_2',
          productName: 'AirPods Pro 2',
          sku: 'APP-2',
          quantity: 2,
          unitPrice: 3000000,
        },
        {
          productId: 'prod_3',
          productName: '20W USB-C Adapter',
          sku: 'ADP-20W',
          quantity: 3,
          unitPrice: 250000,
        },
      ],
      deliveryPrice: 50000,
    };

    multiItemOrder = await OrderService.createOrder(input);

    const has3Items = multiItemOrder.items.length === 3;
    const item1Correct = multiItemOrder.items[0].lineTotal === 13000000;
    const item2Correct = multiItemOrder.items[1].lineTotal === 6000000;
    const item3Correct = multiItemOrder.items[2].lineTotal === 750000;
    const subtotalCorrect = multiItemOrder.subtotal === 19750000;
    const totalCorrect = multiItemOrder.total === 19800000; // 19750000 + 50000 delivery

    assert(
      2,
      'Multiple order items handled with accurate lineTotals',
      has3Items && item1Correct && item2Correct && item3Correct && subtotalCorrect && totalCorrect,
      `Items: ${multiItemOrder.items.length}, Subtotal: ${multiItemOrder.subtotal}, Total: ${multiItemOrder.total}`
    );
  } catch (err: any) {
    assert(2, 'Multiple order items handled with accurate lineTotals', false, err.message);
  }

  // 3. Invalid quantity (0, negative, fractional, or non-numeric)
  try {
    let zeroQuantityRejected = false;
    try {
      await OrderService.createOrder({
        businessId: bizA,
        customerId: custA,
        items: [{ productId: 'prod_1', productName: 'iPhone', quantity: 0, unitPrice: 1000 }],
      });
    } catch {
      zeroQuantityRejected = true;
    }

    let negativeQuantityRejected = false;
    try {
      await OrderService.createOrder({
        businessId: bizA,
        customerId: custA,
        items: [{ productId: 'prod_1', productName: 'iPhone', quantity: -2, unitPrice: 1000 }],
      });
    } catch {
      negativeQuantityRejected = true;
    }

    let fractionalQuantityRejected = false;
    try {
      await OrderService.createOrder({
        businessId: bizA,
        customerId: custA,
        items: [{ productId: 'prod_1', productName: 'iPhone', quantity: 1.5, unitPrice: 1000 }],
      });
    } catch {
      fractionalQuantityRejected = true;
    }

    assert(
      3,
      'Invalid quantity rejection (zero, negative, fractional)',
      zeroQuantityRejected && negativeQuantityRejected && fractionalQuantityRejected
    );
  } catch (err: any) {
    assert(3, 'Invalid quantity rejection (zero, negative, fractional)', false, err.message);
  }

  // 4. Invalid price (negative or NaN)
  try {
    let negativePriceRejected = false;
    try {
      await OrderService.createOrder({
        businessId: bizA,
        customerId: custA,
        items: [{ productId: 'prod_1', productName: 'iPhone', quantity: 1, unitPrice: -500 }],
      });
    } catch {
      negativePriceRejected = true;
    }

    let nanPriceRejected = false;
    try {
      await OrderService.createOrder({
        businessId: bizA,
        customerId: custA,
        items: [{ productId: 'prod_1', productName: 'iPhone', quantity: 1, unitPrice: NaN }],
      });
    } catch {
      nanPriceRejected = true;
    }

    assert(4, 'Invalid price rejection (negative or NaN)', negativePriceRejected && nanPriceRejected);
  } catch (err: any) {
    assert(4, 'Invalid price rejection (negative or NaN)', false, err.message);
  }

  // 5. Empty items array
  try {
    let emptyItemsRejected = false;
    try {
      await OrderService.createOrder({
        businessId: bizA,
        customerId: custA,
        items: [],
      });
    } catch {
      emptyItemsRejected = true;
    }

    assert(5, 'Empty items array rejection', emptyItemsRejected);
  } catch (err: any) {
    assert(5, 'Empty items array rejection', false, err.message);
  }

  // 6. Missing businessId
  try {
    let missingBusinessRejected = false;
    try {
      await OrderService.createOrder({
        businessId: '',
        customerId: custA,
        items: [{ productId: 'prod_1', productName: 'iPhone', quantity: 1, unitPrice: 1000 }],
      });
    } catch {
      missingBusinessRejected = true;
    }

    let whitespaceBusinessRejected = false;
    try {
      await OrderService.createOrder({
        businessId: '   ',
        customerId: custA,
        items: [{ productId: 'prod_1', productName: 'iPhone', quantity: 1, unitPrice: 1000 }],
      });
    } catch {
      whitespaceBusinessRejected = true;
    }

    assert(6, 'Missing or empty businessId rejection', missingBusinessRejected && whitespaceBusinessRejected);
  } catch (err: any) {
    assert(6, 'Missing or empty businessId rejection', false, err.message);
  }

  // 7. Strict multi-tenant isolation
  try {
    // Attempt to access Business A's order using Business B credentials
    const crossTenantGet = await OrderService.getOrder(bizB, createdOrderA.id);
    const tenantAGet = await OrderService.getOrder(bizA, createdOrderA.id);

    // List orders for Business B should NOT contain Business A's orders
    const bizBOrders = await OrderService.getOrdersByBusiness(bizB);
    const leakedIntoB = bizBOrders.some((o) => o.id === createdOrderA.id);

    assert(
      7,
      'Strict multi-tenant isolation on getOrder & getOrdersByBusiness',
      crossTenantGet === null && tenantAGet !== null && !leakedIntoB,
      `Cross-tenant read returned: ${crossTenantGet === null ? 'null (safe)' : 'LEAK'}`
    );
  } catch (err: any) {
    assert(7, 'Strict multi-tenant isolation on getOrder & getOrdersByBusiness', false, err.message);
  }

  // 8. Deterministic subtotal calculation (Backend computes, never trusts external calculation)
  try {
    const rawItems = [
      { productId: 'p1', productName: 'Item 1', quantity: 3, unitPrice: 12500 }, // 37500
      { productId: 'p2', productName: 'Item 2', quantity: 4, unitPrice: 9900 },  // 39600
    ];

    const order = await OrderService.createOrder({
      businessId: bizA,
      customerId: custA,
      items: rawItems,
    });

    const expectedSubtotal = 37500 + 39600; // 77100
    assert(
      8,
      'Deterministic subtotal calculation verified',
      order.subtotal === expectedSubtotal,
      `Subtotal: ${order.subtotal} (expected ${expectedSubtotal})`
    );
  } catch (err: any) {
    assert(8, 'Deterministic subtotal calculation verified', false, err.message);
  }

  // 9. Deterministic total calculation (subtotal + deliveryFee)
  try {
    const rawItems = [
      { productId: 'p1', productName: 'Item 1', quantity: 2, unitPrice: 50000 }, // 100000
    ];

    const orderWithDelivery = await OrderService.createOrder({
      businessId: bizA,
      customerId: custA,
      items: rawItems,
      deliveryPrice: 20000,
    });

    const expectedTotal = 100000 + 20000; // 120000
    assert(
      9,
      'Deterministic total calculation verified (subtotal + deliveryPrice)',
      orderWithDelivery.total === expectedTotal && orderWithDelivery.subtotal === 100000,
      `Total: ${orderWithDelivery.total} (expected ${expectedTotal})`
    );
  } catch (err: any) {
    assert(9, 'Deterministic total calculation verified (subtotal + deliveryPrice)', false, err.message);
  }

  // 10. Order status validation & lifecycle transitions
  try {
    let invalidStatusRejected = false;
    try {
      await OrderService.createOrder({
        businessId: bizA,
        customerId: custA,
        items: [{ productId: 'p1', productName: 'Item 1', quantity: 1, unitPrice: 50000 }],
        status: 'invalid_status_xyz' as any,
      });
    } catch {
      invalidStatusRejected = true;
    }

    // Test transition through allowed statuses
    const allowedStatuses: OrderDomainStatus[] = [
      'pending_confirmation',
      'confirmed',
      'processing',
      'completed',
      'cancelled',
    ];

    let allTransitionsSucceeded = true;
    for (const st of allowedStatuses) {
      const updated = await OrderService.updateOrderStatus(bizA, createdOrderA.id, st);
      if (updated.status !== st) {
        allTransitionsSucceeded = false;
      }
    }

    let invalidTransitionRejected = false;
    try {
      await OrderService.updateOrderStatus(bizA, createdOrderA.id, 'paid_out' as any);
    } catch {
      invalidTransitionRejected = true;
    }

    assert(
      10,
      'Order status validation & transition enforcement',
      invalidStatusRejected && allTransitionsSucceeded && invalidTransitionRejected,
      `Allowed: ${allowedStatuses.join(', ')}`
    );
  } catch (err: any) {
    assert(10, 'Order status validation & transition enforcement', false, err.message);
  }

  console.log('===============================================================');
  const passedCount = suite.filter((t) => t.passed).length;
  console.log(`TOTAL: ${suite.length} | PASSED: ${passedCount} | FAILED: ${suite.length - passedCount}`);
  console.log('===============================================================');

  if (passedCount === suite.length) {
    console.log('🎉 ALL 10 M4.1 ORDER DOMAIN TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('❌ SOME M4.1 TESTS FAILED');
    process.exit(1);
  }
}

runM41OrderDomainTests();
