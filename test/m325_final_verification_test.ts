import { UpdateProcessor } from '../server/telegram/updateProcessor';
import { IntentParser, ParsedIntent } from '../server/ai/intentParser';
import { GeminiClient } from '../server/ai/geminiClient';
import { initWorkerAuth } from '../server/initWorkerAuth';
import { TelegramUpdate } from '../src/types/telegram';
import { MessageService } from '../src/services/messageService';
import { ProductResolver } from '../server/products/productResolver';
import { BusinessResolver } from '../server/telegram/businessResolver';
import { Product } from '../src/types';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
  console.log(`[TEST ${num}] ${condition ? '✅ PASS' : '❌ FAIL'}: ${name}${details ? ` -> ${details}` : ''}`);
}

async function runM325FinalVerification() {
  console.log('==================================================');
  console.log('🔍 M3.2.5 FINAL INTEGRATION TEST & VERIFICATION');
  console.log('(Comprehensive End-to-End Pipeline Verification)');
  console.log('==================================================');

  await initWorkerAuth();

  const testBizA = `biz_m325_A_${Date.now()}`;
  const testBizB = `biz_m325_B_${Date.now()}`;

  // Seed sample products in Firestore for Biz A
  const productA1: Product = {
    id: `prod_m325_1_${Date.now()}`,
    businessId: testBizA,
    warehouseId: 'wh_main',
    name: 'iPhone 15 Pro 256GB',
    sku: 'IPH15P-256',
    category: 'Smartphones',
    brand: 'Apple',
    model: '15 Pro',
    description: 'Titanium',
    price: 13000000,
    costPrice: 11000000,
    stock: 7,
    lowStockThreshold: 2,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const productA2: Product = {
    id: `prod_m325_2_${Date.now()}`,
    businessId: testBizA,
    warehouseId: 'wh_main',
    name: 'iPhone 15 Pro 128GB',
    sku: 'IPH15P-128',
    category: 'Smartphones',
    brand: 'Apple',
    model: '15 Pro',
    description: 'Titanium 128',
    price: 12000000,
    costPrice: 10000000,
    stock: 4,
    lowStockThreshold: 2,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Seed product in Biz B (same name, distinct tenant, different price & stock)
  const productB1: Product = {
    id: `prod_m325_b1_${Date.now()}`,
    businessId: testBizB,
    warehouseId: 'wh_bizb',
    name: 'iPhone 15 Pro 256GB',
    sku: 'BIZB-15P-256',
    category: 'Smartphones',
    brand: 'Apple',
    model: '15 Pro',
    description: 'Tenant B item',
    price: 13800000,
    costPrice: 11500000,
    stock: 15,
    lowStockThreshold: 3,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await setDoc(doc(db, 'businesses', testBizA, 'products', productA1.id), productA1);
  await setDoc(doc(db, 'businesses', testBizA, 'products', productA2.id), productA2);
  await setDoc(doc(db, 'businesses', testBizB, 'products', productB1.id), productB1);

  BusinessResolver.setExplicitBusiness(testBizA);

  function makeUpdate(text: string, updateId?: number, userId = 88990011): TelegramUpdate {
    return {
      update_id: updateId || (Date.now() + Math.floor(Math.random() * 1000000)),
      message: {
        message_id: Math.floor(Math.random() * 1000000) + 1,
        from: {
          id: userId,
          is_bot: false,
          first_name: 'TestClient',
          username: 'test_client_m325',
        },
        chat: {
          id: userId,
          type: 'private',
          first_name: 'TestClient',
        },
        date: Math.floor(Date.now() / 1000),
        text,
      },
    };
  }

  function mockParser(data: ParsedIntent) {
    const mock = new GeminiClient({ apiKey: 'mock' });
    (mock as any).generateText = async () => ({
      success: true,
      text: JSON.stringify(data),
    });
    return new IntentParser(mock);
  }

  // 1. Uzbek product question
  {
    UpdateProcessor.setIntentParser(
      mockParser({
        intent: 'product_query',
        product_name: 'iPhone 15 Pro 256GB',
        quantity: null,
        confidence: 0.98,
        language: 'uz',
      })
    );
    const res = await UpdateProcessor.processUpdate(makeUpdate('iPhone 15 Pro 256GB bormi?'));
    assert(1, 'Uzbek product question', res.success && res.detectedIntent === 'product_query' && res.productResolution?.status === 'resolved');
  }

  // 2. Uzbek price question
  {
    UpdateProcessor.setIntentParser(
      mockParser({
        intent: 'price_query',
        product_name: 'iPhone 15 Pro 256GB',
        quantity: null,
        confidence: 0.97,
        language: 'uz',
      })
    );
    const res = await UpdateProcessor.processUpdate(makeUpdate('iPhone 15 Pro 256GB narxi qancha?'));
    assert(2, 'Uzbek price question', res.success && res.detectedIntent === 'price_query' && res.productResolution?.status === 'resolved');
  }

  // 3. Uzbek stock question
  {
    UpdateProcessor.setIntentParser(
      mockParser({
        intent: 'stock_query',
        product_name: 'iPhone 15 Pro 256GB',
        quantity: null,
        confidence: 0.95,
        language: 'uz',
      })
    );
    const res = await UpdateProcessor.processUpdate(makeUpdate('iPhone 15 Pro 256GBdan nechta bor?'));
    assert(3, 'Uzbek stock question', res.success && res.detectedIntent === 'stock_query' && res.productResolution?.status === 'resolved');
  }

  // 4. Uzbek order intent
  {
    UpdateProcessor.setIntentParser(
      mockParser({
        intent: 'order_intent',
        product_name: 'iPhone 15 Pro 256GB',
        quantity: 1,
        confidence: 0.96,
        language: 'uz',
      })
    );
    const res = await UpdateProcessor.processUpdate(makeUpdate('Menga iPhone 15 Pro 256GB kerak'));
    assert(4, 'Uzbek order intent', res.success && res.detectedIntent === 'order_intent' && res.productResolution?.status === 'resolved');
  }

  // 5. Russian product question
  {
    UpdateProcessor.setIntentParser(
      mockParser({
        intent: 'product_query',
        product_name: 'iPhone 15 Pro 256GB',
        quantity: null,
        confidence: 0.96,
        language: 'ru',
      })
    );
    const res = await UpdateProcessor.processUpdate(makeUpdate('У вас есть iPhone 15 Pro 256GB?'));
    assert(5, 'Russian product question', res.success && res.detectedIntent === 'product_query' && res.parsedIntent?.language === 'ru');
  }

  // 6. English product question
  {
    UpdateProcessor.setIntentParser(
      mockParser({
        intent: 'product_query',
        product_name: 'iPhone 15 Pro 256GB',
        quantity: null,
        confidence: 0.97,
        language: 'en',
      })
    );
    const res = await UpdateProcessor.processUpdate(makeUpdate('Do you have iPhone 15 Pro 256GB?'));
    assert(6, 'English product question', res.success && res.detectedIntent === 'product_query' && res.parsedIntent?.language === 'en');
  }

  // 7. Greeting
  {
    UpdateProcessor.setIntentParser(
      mockParser({
        intent: 'greeting',
        product_name: null,
        quantity: null,
        confidence: 0.99,
        language: 'uz',
      })
    );
    const res = await UpdateProcessor.processUpdate(makeUpdate('Assalomu alaykum'));
    assert(7, 'Greeting (no product resolution)', res.success && res.detectedIntent === 'greeting' && res.productResolution === undefined);
  }

  // 8. Unknown message
  {
    UpdateProcessor.setIntentParser(
      mockParser({
        intent: 'unknown',
        product_name: null,
        quantity: null,
        confidence: 0.95,
        language: 'unknown',
      })
    );
    const res = await UpdateProcessor.processUpdate(makeUpdate('asdfgh???'));
    assert(8, 'Unknown message (no product resolution)', res.success && res.detectedIntent === 'unknown' && res.productResolution === undefined);
  }

  // 9. Product not found
  {
    UpdateProcessor.setIntentParser(
      mockParser({
        intent: 'product_query',
        product_name: 'NonExistentPhone 999',
        quantity: null,
        confidence: 0.92,
        language: 'uz',
      })
    );
    const res = await UpdateProcessor.processUpdate(makeUpdate('NonExistentPhone 999 bormi?'));
    assert(9, 'Product not found', res.success && res.productResolution?.status === 'not_found');
  }

  // 10. Ambiguous product variants
  {
    UpdateProcessor.setIntentParser(
      mockParser({
        intent: 'product_query',
        product_name: 'iPhone 15 Pro',
        quantity: null,
        confidence: 0.94,
        language: 'uz',
      })
    );
    const res = await UpdateProcessor.processUpdate(makeUpdate('iPhone 15 Pro bormi?'));
    assert(10, 'Ambiguous product variants', res.success && res.productResolution?.status === 'ambiguous' && (res.productResolution as any).candidates?.length === 2);
  }

  // 11. Same product name in two different businesses (Tenant isolation)
  {
    BusinessResolver.setExplicitBusiness(testBizA);
    const resA = await ProductResolver.resolveProduct({ businessId: testBizA, productName: 'iPhone 15 Pro 256GB' });

    BusinessResolver.setExplicitBusiness(testBizB);
    const resB = await ProductResolver.resolveProduct({ businessId: testBizB, productName: 'iPhone 15 Pro 256GB' });

    const passTenant =
      resA.status === 'resolved' &&
      resB.status === 'resolved' &&
      resA.product.id === productA1.id &&
      resB.product.id === productB1.id &&
      resA.product.businessId === testBizA &&
      resB.product.businessId === testBizB &&
      resA.product.price === 13000000 &&
      resB.product.price === 13800000;

    assert(11, 'Same product name in two different businesses (Tenant isolation)', passTenant);
    BusinessResolver.setExplicitBusiness(testBizA); // Reset to testBizA
  }

  // 12. Duplicate Telegram update
  {
    const updateId = Date.now() + Math.floor(Math.random() * 1000000);
    const upd1 = makeUpdate('First run', updateId);
    const upd2 = makeUpdate('First run', updateId);

    const r1 = await UpdateProcessor.processUpdate(upd1);
    const r2 = await UpdateProcessor.processUpdate(upd2);

    assert(12, 'Duplicate Telegram update idempotency', r1.status === 'processed_informational_only' && r2.status === 'duplicate_update_skipped' && r2.isDuplicate === true);
  }

  // 13. Gemini/API failure
  {
    const failingMock = new GeminiClient({ apiKey: 'mock' });
    (failingMock as any).generateText = async () => ({
      success: false,
      errorCode: 'API_ERROR',
      errorMessage: 'Simulated API failure',
    });
    UpdateProcessor.setIntentParser(new IntentParser(failingMock));

    const res = await UpdateProcessor.processUpdate(makeUpdate('Test API error'));
    assert(13, 'Gemini/API failure resilience', res.success === true && res.status === 'processed_informational_only' && Boolean(res.inboundMessageId));
  }

  // 14. Malformed or empty Telegram text
  {
    const emptyUpdate = makeUpdate('');
    (emptyUpdate.message as any).text = '';
    const res = await UpdateProcessor.processUpdate(emptyUpdate);
    assert(14, 'Malformed or empty Telegram text', res.success === true && Boolean(res.status));
  }

  // 15. Verify Firestore Message fields compliance
  {
    UpdateProcessor.setIntentParser(
      mockParser({
        intent: 'product_query',
        product_name: 'iPhone 15 Pro 256GB',
        quantity: null,
        confidence: 0.99,
        language: 'uz',
      })
    );

    const res = await UpdateProcessor.processUpdate(makeUpdate('Firestore field check'));
    if (res.conversationId && res.inboundMessageId) {
      const snap = await getDoc(doc(db, 'conversations', res.conversationId, 'messages', res.inboundMessageId));
      const data = snap.data();

      const passFields =
        snap.exists() &&
        data?.aiProcessed === true &&
        data?.aiIntent === 'product_query' &&
        data?.aiConfidence >= 0 &&
        data?.aiConfidence <= 1 &&
        data?.aiLanguage === 'uz' &&
        data?.aiProductName === 'iPhone 15 Pro 256GB' &&
        data?.aiProductResolution === 'resolved' &&
        data?.aiProductId === productA1.id &&
        data?.aiResolvedProduct?.id === productA1.id;

      // Ensure no field in document is undefined
      let hasUndefined = false;
      for (const [k, v] of Object.entries(data || {})) {
        if (v === undefined) hasUndefined = true;
      }

      assert(15, 'Firestore AI message fields strict compliance', passFields && !hasUndefined);
    } else {
      assert(15, 'Firestore AI message fields strict compliance', false, 'Missing conversationId or inboundMessageId');
    }
  }

  // 16. Security verification
  {
    // A: Gemini API key never exposed in Firestore
    const sampleMsgSnap = await getDoc(doc(db, 'conversations', `conv_${testBizA}_88990011`, 'messages', `msg_${testBizA}_88990011_1`));
    const msgStr = JSON.stringify(sampleMsgSnap.data() || {});
    const noGeminiKeyInFirestore = !msgStr.includes(process.env.GEMINI_API_KEY || 'AQ.Ab8RN6LyvdwsDmpf67f0MlTCQXB0BhUSWkZ7s4zuEqzrmtKf_w');

    // B: Stock and Price mutation check
    const snapProdA1 = await getDoc(doc(db, 'businesses', testBizA, 'products', productA1.id));
    const prodAfter = snapProdA1.data() as Product;
    const stockUnchanged = prodAfter.stock === 7;
    const priceUnchanged = prodAfter.price === 13000000;

    assert(16, 'Security: No secret leakage & zero stock/price mutation', noGeminiKeyInFirestore && stockUnchanged && priceUnchanged);
  }

  console.log('==================================================');
  const passedCount = suite.filter((t) => t.passed).length;
  console.log(`TOTAL: ${suite.length} | PASSED: ${passedCount} | FAILED: ${suite.length - passedCount}`);
  console.log('==================================================');

  if (passedCount === suite.length) {
    console.log('🎉 ALL 16 M3.2.5 FINAL VERIFICATION CHECKS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME CHECKS FAILED');
    process.exit(1);
  }
}

runM325FinalVerification();
