import { ProductResolver } from '../server/products/productResolver';
import { Product } from '../src/types';

interface TestItem {
  name: string;
  passed: boolean;
  message?: string;
}

const testResults: TestItem[] = [];

function assert(name: string, condition: boolean, message?: string) {
  testResults.push({ name, passed: condition, message });
  console.log(`[TEST] ${condition ? '✅ PASS' : '❌ FAIL'}: ${name}${message ? ` (${message})` : ''}`);
}

async function runProductResolverTests() {
  console.log('==================================================');
  console.log('📦 M3.2.3 Product Resolver Unit Tests');
  console.log('(Tenant-isolated, safe matching, no Gemini API calls)');
  console.log('==================================================');

  const bizA = 'biz_tenant_A';
  const bizB = 'biz_tenant_B';

  const mockProducts: Product[] = [
    {
      id: 'prod_1',
      businessId: bizA,
      warehouseId: 'wh_1',
      name: 'iPhone 15 Pro 256GB',
      sku: 'IPH-15P-256',
      category: 'Smartphones',
      brand: 'Apple',
      model: '15 Pro',
      description: 'Titanium design',
      price: 13000000,
      costPrice: 11000000,
      stock: 5,
      lowStockThreshold: 2,
      active: true,
      createdAt: 1700000000,
      updatedAt: 1700000000,
    },
    {
      id: 'prod_2',
      businessId: bizA,
      warehouseId: 'wh_1',
      name: 'iPhone 15 Pro 128GB',
      sku: 'IPH-15P-128',
      category: 'Smartphones',
      brand: 'Apple',
      model: '15 Pro',
      description: 'Titanium design 128GB',
      price: 12000000,
      costPrice: 10000000,
      stock: 3,
      lowStockThreshold: 1,
      active: true,
      createdAt: 1700000000,
      updatedAt: 1700000000,
    },
    {
      id: 'prod_3',
      businessId: bizA,
      warehouseId: 'wh_1',
      name: 'iPhone 15 Pro 512GB',
      sku: 'IPH-15P-512',
      category: 'Smartphones',
      brand: 'Apple',
      model: '15 Pro',
      description: 'Titanium design 512GB',
      price: 15000000,
      costPrice: 13000000,
      stock: 2,
      lowStockThreshold: 1,
      active: true,
      createdAt: 1700000000,
      updatedAt: 1700000000,
    },
    {
      id: 'prod_4',
      businessId: bizA,
      warehouseId: 'wh_1',
      name: 'Samsung S24 128GB',
      sku: 'SAM-S24-128',
      category: 'Smartphones',
      brand: 'Samsung',
      model: 'S24',
      description: 'Galaxy AI',
      price: 9000000,
      costPrice: 7500000,
      stock: 8,
      lowStockThreshold: 2,
      active: true,
      createdAt: 1700000000,
      updatedAt: 1700000000,
    },
    {
      id: 'prod_5',
      businessId: bizA,
      warehouseId: 'wh_1',
      name: 'Samsung S24 256GB',
      sku: 'SAM-S24-256',
      category: 'Smartphones',
      brand: 'Samsung',
      model: 'S24',
      description: 'Galaxy AI 256GB',
      price: 10000000,
      costPrice: 8500000,
      stock: 4,
      lowStockThreshold: 2,
      active: true,
      createdAt: 1700000000,
      updatedAt: 1700000000,
    },
    {
      id: 'prod_6',
      businessId: bizA,
      warehouseId: 'wh_1',
      name: 'MacBook Air M3 256GB',
      sku: 'ABC-123',
      category: 'Laptops',
      brand: 'Apple',
      model: 'Air M3',
      description: 'Apple Silicon',
      price: 14000000,
      costPrice: 12000000,
      stock: 4,
      lowStockThreshold: 1,
      active: true,
      createdAt: 1700000000,
      updatedAt: 1700000000,
    },
    // Business B product (Same name, different tenant & price)
    {
      id: 'prod_b_1',
      businessId: bizB,
      warehouseId: 'wh_b_1',
      name: 'iPhone 15 Pro 256GB',
      sku: 'BIZ-B-15P',
      category: 'Smartphones',
      brand: 'Apple',
      model: '15 Pro',
      description: 'Tenant B Product',
      price: 13500000,
      costPrice: 11500000,
      stock: 10,
      lowStockThreshold: 2,
      active: true,
      createdAt: 1700000000,
      updatedAt: 1700000000,
    },
    // Product existing ONLY in Business B
    {
      id: 'prod_b_unique',
      businessId: bizB,
      warehouseId: 'wh_b_1',
      name: 'iPad Pro M4 256GB',
      sku: 'IPAD-PRO-M4',
      category: 'Tablets',
      brand: 'Apple',
      model: 'Pro M4',
      description: 'OLED Display',
      price: 16000000,
      costPrice: 14000000,
      stock: 3,
      lowStockThreshold: 1,
      active: true,
      createdAt: 1700000000,
      updatedAt: 1700000000,
    },
  ];

  // Test 1 — exact product
  {
    const res = await ProductResolver.resolveProduct({ businessId: bizA, productName: 'iPhone 15 Pro 256GB' }, mockProducts);
    assert('Test 1 - Exact product match resolves', res.status === 'resolved');
    if (res.status === 'resolved') {
      assert('Test 1 - Product ID matches prod_1', res.product.id === 'prod_1');
      assert('Test 1 - MatchType is exact', res.matchType === 'exact');
    }
  }

  // Test 2 — case normalization
  {
    const res = await ProductResolver.resolveProduct({ businessId: bizA, productName: 'iphone 15 pro 256gb' }, mockProducts);
    assert('Test 2 - Case normalization resolves', res.status === 'resolved');
    if (res.status === 'resolved') {
      assert('Test 2 - Product ID matches prod_1', res.product.id === 'prod_1');
    }
  }

  // Test 3 — spacing normalization ("256 GB" -> "256gb")
  {
    const res = await ProductResolver.resolveProduct({ businessId: bizA, productName: 'iPhone 15 Pro 256 GB' }, mockProducts);
    assert('Test 3 - Spacing normalization resolves', res.status === 'resolved');
    if (res.status === 'resolved') {
      assert('Test 3 - Product ID matches prod_1', res.product.id === 'prod_1');
    }
  }

  // Test 4 — SKU match
  {
    const res = await ProductResolver.resolveProduct({ businessId: bizA, productName: 'ABC-123' }, mockProducts);
    assert('Test 4 - SKU match resolves', res.status === 'resolved');
    if (res.status === 'resolved') {
      assert('Test 4 - Product is MacBook Air', res.product.id === 'prod_6');
      assert('Test 4 - MatchType is sku', res.matchType === 'sku');
    }
  }

  // Test 5 — not found
  {
    const res = await ProductResolver.resolveProduct({ businessId: bizA, productName: 'iPhone 99 Ultra' }, mockProducts);
    assert('Test 5 - Not found returns status not_found', res.status === 'not_found');
    if (res.status === 'not_found') {
      assert('Test 5 - productName preserved in result', res.productName === 'iPhone 99 Ultra');
    }
  }

  // Test 6 — ambiguous (multiple capacity variants)
  {
    const res = await ProductResolver.resolveProduct({ businessId: bizA, productName: 'iPhone 15 Pro' }, mockProducts);
    assert('Test 6 - Ambiguous query returns status ambiguous', res.status === 'ambiguous');
    if (res.status === 'ambiguous') {
      assert('Test 6 - Candidates include multiple variants', res.candidates.length >= 3);
      assert('Test 6 - Candidates contain only iPhone 15 Pro', res.candidates.every((c) => c.name.includes('iPhone 15 Pro')));
    }
  }

  // Test 7 — capacity distinction
  {
    const res = await ProductResolver.resolveProduct({ businessId: bizA, productName: 'iPhone 15 Pro 256GB' }, mockProducts);
    assert('Test 7 - Resolves specifically to 256GB', res.status === 'resolved' && res.product.id === 'prod_1');
    if (res.status === 'resolved') {
      assert('Test 7 - Never returns 128GB version', res.product.name.includes('256GB') && !res.product.name.includes('128GB'));
    }
  }

  // Test 8 — tenant isolation
  {
    const resA = await ProductResolver.resolveProduct({ businessId: bizA, productName: 'iPhone 15 Pro 256GB' }, mockProducts);
    const resB = await ProductResolver.resolveProduct({ businessId: bizB, productName: 'iPhone 15 Pro 256GB' }, mockProducts);

    assert('Test 8 - Business A resolution belongs to A', resA.status === 'resolved' && resA.product.businessId === bizA && resA.product.id === 'prod_1');
    assert('Test 8 - Business B resolution belongs to B', resB.status === 'resolved' && resB.product.businessId === bizB && resB.product.id === 'prod_b_1');
    if (resA.status === 'resolved' && resB.status === 'resolved') {
      assert('Test 8 - Different price per tenant maintained', resA.product.price === 13000000 && resB.product.price === 13500000);
    }
  }

  // Test 9 — empty product name
  {
    const res = await ProductResolver.resolveProduct({ businessId: bizA, productName: '' }, mockProducts);
    assert('Test 9 - Empty product name returns not_found safely', res.status === 'not_found');
  }

  // Test 10 — whitespace product name
  {
    const res = await ProductResolver.resolveProduct({ businessId: bizA, productName: '   ' }, mockProducts);
    assert('Test 10 - Whitespace product name returns not_found safely', res.status === 'not_found');
  }

  // Test 11 — fuzzy ambiguity (Samsung S24)
  {
    const res = await ProductResolver.resolveProduct({ businessId: bizA, productName: 'Samsung S24' }, mockProducts);
    assert('Test 11 - Samsung S24 returns ambiguous', res.status === 'ambiguous');
    if (res.status === 'ambiguous') {
      assert('Test 11 - Found 2 Samsung candidates (128GB and 256GB)', res.candidates.length === 2);
    }
  }

  // Test 12 — no cross-tenant leakage
  {
    const res = await ProductResolver.resolveProduct({ businessId: bizA, productName: 'iPad Pro M4 256GB' }, mockProducts);
    assert('Test 12 - Product existing only in Business B returns not_found for Business A', res.status === 'not_found');
  }

  // Test 13 — Security: Empty businessId throws error
  {
    let threw = false;
    try {
      await ProductResolver.resolveProduct({ businessId: '', productName: 'iPhone 15' }, mockProducts);
    } catch {
      threw = true;
    }
    assert('Test 13 - Security: Missing businessId throws error', threw === true);
  }

  console.log('==================================================');
  const passed = testResults.filter((t) => t.passed).length;
  console.log(`TOTAL: ${testResults.length} | PASSED: ${passed} | FAILED: ${testResults.length - passed}`);
  console.log('==================================================');

  if (passed === testResults.length) {
    console.log('🎉 ALL M3.2.3 PRODUCT RESOLVER TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME PRODUCT RESOLVER TESTS FAILED');
    process.exit(1);
  }
}

runProductResolverTests();
