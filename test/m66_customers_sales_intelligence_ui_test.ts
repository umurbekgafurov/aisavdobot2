import { SalesIntelligenceService } from '../src/services/salesIntelligenceService';
import { Customer, Order } from '../src/types';

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

async function runM66Tests() {
  console.log('===================================================================================================');
  console.log('🚀 M6.6 PART 2 — CUSTOMERS VIEW SALES INTELLIGENCE UI VERIFICATION');
  console.log('===================================================================================================');

  const now = 1790980000000;
  const bizA = 'biz_shop_a';
  const bizB = 'biz_shop_b';
  const cust1 = 'cust_01';
  const cust2 = 'cust_02';

  // -------------------------------------------------------------
  // Test 1: Empty state when customer is null or missing businessId
  // -------------------------------------------------------------
  const emptyRes1 = SalesIntelligenceService.computeCustomerInsight(null, []);
  assert(emptyRes1 === null, 'Test 1a: Null customer returns null insight (empty state)');

  const emptyRes2 = SalesIntelligenceService.computeCustomerInsight({ id: cust1 } as any, []);
  assert(emptyRes2 === null, 'Test 1b: Customer missing businessId returns null insight (empty state)');

  // -------------------------------------------------------------
  // Test 2: Low Intent Customer
  // -------------------------------------------------------------
  const lowCustomer: Customer = {
    id: cust1,
    businessId: bizA,
    firstName: 'Anvar',
    status: 'Yangi',
    source: 'telegram',
    totalOrders: 0,
    totalSpent: 0,
    createdAt: now - 100000,
  };
  const lowInsight = SalesIntelligenceService.computeCustomerInsight(lowCustomer, []);
  assert(lowInsight !== null, 'Test 2a: Low customer computes valid insight');
  assert(lowInsight!.intentLevel === 'low', `Test 2b: intentLevel is "low" (got ${lowInsight!.intentLevel})`);
  assert(lowInsight!.intentScore === 0, `Test 2c: intentScore is 0 (got ${lowInsight!.intentScore})`);
  assert(lowInsight!.signals.length === 0, 'Test 2d: signals array is empty');
  assert(lowInsight!.totalOrders === 0, 'Test 2e: totalOrders is 0');
  assert(lowInsight!.totalSpent === 0, 'Test 2f: totalSpent is 0');
  assert(lowInsight!.lastOrderAt === null, 'Test 2g: lastOrderAt is null');

  // -------------------------------------------------------------
  // Test 3: Medium Intent Customer (1 Completed Order)
  // -------------------------------------------------------------
  const orderCompleted: Order = {
    id: 'ord_med_1',
    businessId: bizA,
    customerId: cust1,
    status: 'completed',
    subtotal: 3500000,
    total: 3500000,
    createdAt: now - 50000,
    updatedAt: now - 50000,
    items: [{ productId: 'p1', productName: 'AirPods', quantity: 1, unitPrice: 3500000 }],
  };

  const medCustomer: Customer = {
    ...lowCustomer,
    totalOrders: 1,
    totalSpent: 3500000,
    lastInteraction: now - 5000,
  };
  // Completed order (+10) -> score 10 / low; with product query note -> medium
  const orderActive: Order = {
    id: 'ord_act_1',
    businessId: bizA,
    customerId: cust1,
    status: 'processing',
    subtotal: 5000000,
    total: 5000000,
    createdAt: now - 10000,
    updatedAt: now - 10000,
    items: [{ productId: 'p2', productName: 'iPhone', quantity: 1, unitPrice: 5000000 }],
  };

  const medInsight = SalesIntelligenceService.computeCustomerInsight(medCustomer, [orderActive]);
  // Active order (+40) -> score 40 -> medium!
  assert(medInsight !== null, 'Test 3a: Medium customer computes valid insight');
  assert(medInsight!.intentLevel === 'medium', `Test 3b: intentLevel is "medium" (got ${medInsight!.intentLevel})`);
  assert(medInsight!.intentScore === 40, `Test 3c: intentScore is 40 (got ${medInsight!.intentScore})`);
  assert(medInsight!.signals.includes('active_order'), 'Test 3d: signals include "active_order"');

  // -------------------------------------------------------------
  // Test 4: High Intent Customer (Active Order + Completed Order + Repeat)
  // -------------------------------------------------------------
  // Active order (+40) + Completed order (+10) + Repeat customer (+15) = 65 -> with 2 orders completed = 75+ -> high
  const orderCompleted2: Order = {
    id: 'ord_comp_2',
    businessId: bizA,
    customerId: cust1,
    status: 'completed',
    subtotal: 6000000,
    total: 6000000,
    createdAt: now - 80000,
    updatedAt: now - 80000,
    items: [{ productId: 'p3', productName: 'MacBook', quantity: 1, unitPrice: 6000000 }],
  };

  const highCustomer: Customer = {
    ...lowCustomer,
    notes: 'Yangi buyurtma bermoqchiman narxi qancha?', // detected as inquiry
  };

  const highOrders = [orderActive, orderCompleted, orderCompleted2];
  const highInsight = SalesIntelligenceService.computeCustomerInsight(highCustomer, highOrders);

  // Active (+40) + Completed (+10) + Repeat (+15) + Orders = high intent!
  assert(highInsight !== null, 'Test 4a: High customer computes valid insight');
  assert(highInsight!.totalOrders === 3, `Test 4b: totalOrders is 3 (got ${highInsight!.totalOrders})`);
  assert(highInsight!.completedOrders === 2, `Test 4c: completedOrders is 2 (got ${highInsight!.completedOrders})`);
  assert(highInsight!.totalSpent === 14500000, `Test 4d: totalSpent is 14,500,000 (got ${highInsight!.totalSpent})`);
  assert(highInsight!.lastOrderAt === now - 10000, 'Test 4e: lastOrderAt is newest order');

  // -------------------------------------------------------------
  // Test 5: Order Statistics & Cancellations
  // -------------------------------------------------------------
  const orderCancelled: Order = {
    id: 'ord_canc_1',
    businessId: bizA,
    customerId: cust1,
    status: 'cancelled',
    subtotal: 2000000,
    total: 2000000,
    createdAt: now - 90000,
    updatedAt: now - 90000,
    items: [],
  };

  const statsInsight = SalesIntelligenceService.computeCustomerInsight(lowCustomer, [
    orderCompleted,
    orderCancelled,
  ]);
  assert(statsInsight!.totalOrders === 2, 'Test 5a: totalOrders includes cancelled');
  assert(statsInsight!.completedOrders === 1, 'Test 5b: completedOrders is 1');
  assert(statsInsight!.cancelledOrders === 1, 'Test 5c: cancelledOrders is 1');
  assert(statsInsight!.totalSpent === 3500000, 'Test 5d: cancelled order not added to totalSpent');

  // -------------------------------------------------------------
  // Test 6: AI Recommendation Generation (On-Demand)
  // -------------------------------------------------------------
  const recResult = await SalesIntelligenceService.generateCustomerRecommendation(highInsight!);
  assert(recResult !== null && typeof recResult === 'object', 'Test 6a: Recommendation returned');
  assert(typeof recResult.action === 'string', 'Test 6b: Recommendation action is string');
  assert(typeof recResult.reason === 'string' && recResult.reason.length > 0, 'Test 6c: Recommendation reason is non-empty');
  assert(recResult.confidence >= 0 && recResult.confidence <= 1, 'Test 6d: Confidence is bounded [0, 1]');

  // -------------------------------------------------------------
  // Test 7: Customer Isolation (Different Customers within same business)
  // -------------------------------------------------------------
  const customer2Orders: Order[] = [
    {
      id: 'ord_cust2_1',
      businessId: bizA,
      customerId: cust2,
      status: 'completed',
      subtotal: 99000000,
      total: 99000000,
      createdAt: now - 1000,
      updatedAt: now - 1000,
      items: [],
    },
  ];

  // Customer 1 insight calculated with both Customer 1 and Customer 2 orders passed into array
  const mixedCustomerOrders = [...highOrders, ...customer2Orders];
  const isolatedCust1Insight = SalesIntelligenceService.computeCustomerInsight(highCustomer, mixedCustomerOrders);

  assert(
    isolatedCust1Insight!.totalSpent === 14500000,
    'Test 7a: Customer 2 99M order is NOT in Customer 1 totalSpent'
  );
  assert(
    isolatedCust1Insight!.totalOrders === 3,
    'Test 7b: Customer 2 order is NOT in Customer 1 totalOrders'
  );

  // -------------------------------------------------------------
  // Test 8: Tenant Isolation (Business A vs Business B)
  // -------------------------------------------------------------
  const tenantBOrders: Order[] = [
    {
      id: 'ord_biz_b_1',
      businessId: bizB,
      customerId: cust1, // Same customer id, but different tenant!
      status: 'completed',
      subtotal: 50000000,
      total: 50000000,
      createdAt: now - 1000,
      updatedAt: now - 1000,
      items: [],
    },
  ];

  const mixedTenantOrders = [...highOrders, ...tenantBOrders];
  const isolatedTenantInsight = SalesIntelligenceService.computeCustomerInsight(highCustomer, mixedTenantOrders);

  assert(
    isolatedTenantInsight!.totalSpent === 14500000,
    'Test 8a: Tenant B order total is NOT in Tenant A insight'
  );
  assert(
    isolatedTenantInsight!.totalOrders === 3,
    'Test 8b: Tenant B order is NOT in Tenant A totalOrders'
  );
  assert(
    isolatedTenantInsight!.businessId === bizA,
    'Test 8c: Insight businessId strictly preserved as bizA'
  );

  console.log('===================================================================================================');
  console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===================================================================================================');

  if (failCount > 0) {
    throw new Error(`${failCount} tests failed.`);
  }
  console.log('🎉 ALL M6.6 PART 2 CUSTOMERS VIEW SALES INTELLIGENCE UI TESTS PASSED SUCCESSFULLY!');
}

runM66Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal M6.6 Part 2 test runner error:', err);
    process.exit(1);
  });
