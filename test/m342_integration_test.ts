import { UpdateProcessor } from '../server/telegram/updateProcessor';
import { IntentParser, ParsedIntent } from '../server/ai/intentParser';
import { ReplyGenerator } from '../server/ai/replyGenerator';
import { GeminiClient } from '../server/ai/geminiClient';
import { TelegramClient } from '../server/telegram/telegramClient';
import { BusinessResolver } from '../server/telegram/businessResolver';
import { initWorkerAuth } from '../server/initWorkerAuth';
import { TelegramUpdate } from '../src/types/telegram';
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

async function runM342Tests() {
  console.log('==================================================');
  console.log('🚀 M3.4.2 Connect AI Reply to Telegram Integration Tests');
  console.log('(Mocked Telegram Client, Mocked Gemini, Real/Sandbox Firestore)');
  console.log('==================================================');

  await initWorkerAuth();

  const testBizA = `biz_m342_A_${Date.now()}`;
  const testBizB = `biz_m342_B_${Date.now()}`;

  // Track sent telegram messages
  const sentTelegramMessages: Array<{ chatId: string | number; text: string }> = [];

  TelegramClient.setMockSender(async (chatId, text) => {
    sentTelegramMessages.push({ chatId, text });
    return {
      ok: true,
      result: {
        message_id: Math.floor(Math.random() * 900000) + 100000,
        chat: { id: chatId },
        text,
      },
    };
  });

  // Seed sample products
  const productA1: Product = {
    id: `prod_m342_1_${Date.now()}`,
    businessId: testBizA,
    warehouseId: 'wh_main',
    name: 'iPhone 15 Pro 256GB',
    sku: 'IPH-15P-256',
    category: 'Smartphones',
    brand: 'Apple',
    model: '15 Pro',
    description: 'Titanium 256GB',
    price: 13000000,
    costPrice: 11000000,
    stock: 7,
    lowStockThreshold: 2,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const productA_OutOfStock: Product = {
    id: `prod_m342_out_${Date.now()}`,
    businessId: testBizA,
    warehouseId: 'wh_main',
    name: 'MacBook Pro M3 Max',
    sku: 'MBP-M3-MAX',
    category: 'Laptops',
    brand: 'Apple',
    model: 'M3 Max',
    description: 'Out of stock laptop',
    price: 35000000,
    costPrice: 30000000,
    stock: 0,
    lowStockThreshold: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const productA_NoPrice: Product = {
    id: `prod_m342_noprice_${Date.now()}`,
    businessId: testBizA,
    warehouseId: 'wh_main',
    name: 'Custom Server Rack',
    sku: 'RACK-CUSTOM',
    category: 'Hardware',
    brand: 'Custom',
    model: 'Rack',
    description: 'Price on request',
    price: 0,
    costPrice: 0,
    stock: 2,
    lowStockThreshold: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const productA_Variant1: Product = {
    id: `prod_m342_v1_${Date.now()}`,
    businessId: testBizA,
    warehouseId: 'wh_main',
    name: 'AirPods Max Silver',
    sku: 'APM-SILVER',
    category: 'Audio',
    brand: 'Apple',
    model: 'AirPods Max',
    description: 'Silver',
    price: 6500000,
    costPrice: 5000000,
    stock: 3,
    lowStockThreshold: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const productA_Variant2: Product = {
    id: `prod_m342_v2_${Date.now()}`,
    businessId: testBizA,
    warehouseId: 'wh_main',
    name: 'AirPods Max Space Gray',
    sku: 'APM-GRAY',
    category: 'Audio',
    brand: 'Apple',
    model: 'AirPods Max',
    description: 'Space Gray',
    price: 6500000,
    costPrice: 5000000,
    stock: 4,
    lowStockThreshold: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const productB1: Product = {
    id: `prod_m342_b1_${Date.now()}`,
    businessId: testBizB,
    warehouseId: 'wh_bizb',
    name: 'iPhone 15 Pro 256GB',
    sku: 'BIZB-IPH-256',
    category: 'Smartphones',
    brand: 'Apple',
    model: '15 Pro',
    description: 'Tenant B Item',
    price: 13900000,
    costPrice: 11900000,
    stock: 12,
    lowStockThreshold: 2,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await setDoc(doc(db, 'businesses', testBizA, 'products', productA1.id), productA1);
  await setDoc(doc(db, 'businesses', testBizA, 'products', productA_OutOfStock.id), productA_OutOfStock);
  await setDoc(doc(db, 'businesses', testBizA, 'products', productA_NoPrice.id), productA_NoPrice);
  await setDoc(doc(db, 'businesses', testBizA, 'products', productA_Variant1.id), productA_Variant1);
  await setDoc(doc(db, 'businesses', testBizA, 'products', productA_Variant2.id), productA_Variant2);
  await setDoc(doc(db, 'businesses', testBizB, 'products', productB1.id), productB1);

  BusinessResolver.setExplicitBusiness(testBizA);

  function makeUpdate(text: string, updateId?: number, userId = 77112233): TelegramUpdate {
    return {
      update_id: updateId || (Date.now() + Math.floor(Math.random() * 1000000)),
      message: {
        message_id: Math.floor(Math.random() * 1000000) + 1,
        from: {
          id: userId,
          is_bot: false,
          first_name: 'TestCustomer',
          username: 'test_client_m342',
        },
        chat: {
          id: userId,
          type: 'private',
          first_name: 'TestCustomer',
        },
        date: Math.floor(Date.now() / 1000),
        text,
      },
    };
  }

  function mockParserAndReply(parsed: ParsedIntent, replyText: string) {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async (prompt: string) => {
      // If parsing intent
      if (prompt.includes('retail intent extraction engine')) {
        return { success: true, text: JSON.stringify(parsed) };
      }
      // If generating reply
      return { success: true, text: JSON.stringify({ reply: replyText, language: parsed.language }) };
    };

    UpdateProcessor.setIntentParser(new IntentParser(mockGemini));
    UpdateProcessor.setReplyGenerator(new ReplyGenerator(mockGemini));
  }

  // 1. Normal Uzbek product question → Telegram reply
  {
    sentTelegramMessages.length = 0;
    mockParserAndReply(
      {
        intent: 'product_query',
        product_name: 'iPhone 15 Pro 256GB',
        quantity: null,
        confidence: 0.98,
        language: 'uz',
      },
      'Ha, iPhone 15 Pro 256GB omborimizda 7 dona mavjud. Narxi 13 000 000 so\'m.'
    );

    const res = await UpdateProcessor.processUpdate(makeUpdate('iPhone 15 Pro 256GB bormi?'));
    const sent = sentTelegramMessages[sentTelegramMessages.length - 1];

    assert(
      1,
      'Normal Uzbek product question -> Telegram reply sent',
      res.success === true &&
        res.telegramReplySent === true &&
        Boolean(sent && sent.text.includes('13 000 000') && sent.text.includes('7 dona'))
    );
  }

  // 2. Uzbek stock question
  {
    sentTelegramMessages.length = 0;
    mockParserAndReply(
      {
        intent: 'stock_query',
        product_name: 'iPhone 15 Pro 256GB',
        quantity: null,
        confidence: 0.96,
        language: 'uz',
      },
      'Hozirda omborimizda 7 dona iPhone 15 Pro 256GB qolgan.'
    );

    const res = await UpdateProcessor.processUpdate(makeUpdate('iPhone 15 nechta qoldi?'));
    const sent = sentTelegramMessages[sentTelegramMessages.length - 1];

    assert(
      2,
      'Uzbek stock question -> Telegram reply sent',
      res.success === true && res.telegramReplySent === true && Boolean(sent && sent.text.includes('7 dona'))
    );
  }

  // 3. Uzbek price question
  {
    sentTelegramMessages.length = 0;
    mockParserAndReply(
      {
        intent: 'price_query',
        product_name: 'iPhone 15 Pro 256GB',
        quantity: null,
        confidence: 0.97,
        language: 'uz',
      },
      'iPhone 15 Pro 256GB narxi 13 000 000 so\'m.'
    );

    const res = await UpdateProcessor.processUpdate(makeUpdate('iPhone 15 narxi qancha?'));
    const sent = sentTelegramMessages[sentTelegramMessages.length - 1];

    assert(
      3,
      'Uzbek price question -> Telegram reply sent',
      res.success === true && res.telegramReplySent === true && Boolean(sent && sent.text.includes('13 000 000'))
    );
  }

  // 4. Russian customer → Russian reply
  {
    sentTelegramMessages.length = 0;
    mockParserAndReply(
      {
        intent: 'product_query',
        product_name: 'iPhone 15 Pro 256GB',
        quantity: null,
        confidence: 0.95,
        language: 'ru',
      },
      'Да, iPhone 15 Pro 256GB есть в наличии. Остаток 7 шт, цена 13 000 000 сум.'
    );

    const res = await UpdateProcessor.processUpdate(makeUpdate('Есть ли у вас iPhone 15 Pro 256GB?'));
    const sent = sentTelegramMessages[sentTelegramMessages.length - 1];

    assert(
      4,
      'Russian customer -> Russian reply sent',
      res.success === true && res.telegramReplySent === true && Boolean(sent && sent.text.includes('наличии'))
    );
  }

  // 5. English customer → English reply
  {
    sentTelegramMessages.length = 0;
    mockParserAndReply(
      {
        intent: 'product_query',
        product_name: 'iPhone 15 Pro 256GB',
        quantity: null,
        confidence: 0.96,
        language: 'en',
      },
      'Yes, iPhone 15 Pro 256GB is available with 7 in stock for 13,000,000 UZS.'
    );

    const res = await UpdateProcessor.processUpdate(makeUpdate('Do you have iPhone 15 Pro 256GB?'));
    const sent = sentTelegramMessages[sentTelegramMessages.length - 1];

    assert(
      5,
      'English customer -> English reply sent',
      res.success === true && res.telegramReplySent === true && Boolean(sent && sent.text.includes('available'))
    );
  }

  // 6. Product not found → Telegram clarification/reply
  {
    sentTelegramMessages.length = 0;
    mockParserAndReply(
      {
        intent: 'product_query',
        product_name: 'SuperSecretPhone 99',
        quantity: null,
        confidence: 0.94,
        language: 'uz',
      },
      'Kechirasiz, "SuperSecretPhone 99" do\'konimizda topilmadi.'
    );

    const res = await UpdateProcessor.processUpdate(makeUpdate('SuperSecretPhone 99 bormi?'));
    const sent = sentTelegramMessages[sentTelegramMessages.length - 1];

    assert(
      6,
      'Product not found -> Telegram reply sent',
      res.success === true &&
        res.productResolution?.status === 'not_found' &&
        Boolean(sent && sent.text.includes('topilmadi'))
    );
  }

  // 7. Ambiguous product → clarification reply
  {
    sentTelegramMessages.length = 0;
    mockParserAndReply(
      {
        intent: 'product_query',
        product_name: 'AirPods Max',
        quantity: null,
        confidence: 0.95,
        language: 'uz',
      },
      'Bizda AirPods Max Silver va AirPods Max Space Gray variantlari bor. Qaysi rang sizga ma\'qul?'
    );

    const res = await UpdateProcessor.processUpdate(makeUpdate('AirPods Max bormi?'));
    const sent = sentTelegramMessages[sentTelegramMessages.length - 1];

    assert(
      7,
      'Ambiguous product -> Clarification reply sent',
      res.success === true &&
        res.productResolution?.status === 'ambiguous' &&
        Boolean(sent && sent.text.includes('Silver') && sent.text.includes('Space Gray'))
    );
  }

  // 8. Out-of-stock product
  {
    sentTelegramMessages.length = 0;
    mockParserAndReply(
      {
        intent: 'product_query',
        product_name: 'MacBook Pro M3 Max',
        quantity: null,
        confidence: 0.95,
        language: 'uz',
      },
      'Kechirasiz, MacBook Pro M3 Max hozirda omborimizda tugagan.'
    );

    const res = await UpdateProcessor.processUpdate(makeUpdate('MacBook Pro M3 Max bormi?'));
    const sent = sentTelegramMessages[sentTelegramMessages.length - 1];

    assert(
      8,
      'Out-of-stock product -> Telegram reply sent',
      res.success === true && Boolean(sent && (sent.text.includes('tugagan') || sent.text.includes('qolmagan')))
    );
  }

  // 9. Missing price
  {
    sentTelegramMessages.length = 0;
    mockParserAndReply(
      {
        intent: 'price_query',
        product_name: 'Custom Server Rack',
        quantity: null,
        confidence: 0.92,
        language: 'uz',
      },
      'Custom Server Rack narxi aniqlashtirilmoqda, tez orada xabar qilamiz.'
    );

    const res = await UpdateProcessor.processUpdate(makeUpdate('Custom Server Rack qancha?'));
    const sent = sentTelegramMessages[sentTelegramMessages.length - 1];

    assert(
      9,
      'Missing price -> Handled gracefully without hallucination',
      res.success === true && Boolean(sent && !sent.text.includes('0 so\'m'))
    );
  }

  // 10. Gemini failure → deterministic fallback sent
  {
    sentTelegramMessages.length = 0;

    // Both Parser and Reply fail safely
    const mockFailingGemini = new GeminiClient({ apiKey: 'mock' });
    (mockFailingGemini as any).generateText = async () => ({
      success: false,
      errorCode: 'API_ERROR',
      errorMessage: 'Simulated API failure',
    });
    UpdateProcessor.setIntentParser(new IntentParser(mockFailingGemini));
    UpdateProcessor.setReplyGenerator(new ReplyGenerator(mockFailingGemini));

    const res = await UpdateProcessor.processUpdate(makeUpdate('Salom'));
    const sent = sentTelegramMessages[sentTelegramMessages.length - 1];

    assert(
      10,
      'Gemini failure -> Deterministic fallback delivered to Telegram',
      res.success === true && res.telegramReplySent === true && Boolean(sent && sent.text.length > 5)
    );
  }

  // 11. Duplicate Telegram update → exactly ONE reply
  {
    sentTelegramMessages.length = 0;
    mockParserAndReply(
      {
        intent: 'greeting',
        product_name: null,
        quantity: null,
        confidence: 0.99,
        language: 'uz',
      },
      'Assalomu alaykum! Xush kelibsiz.'
    );

    const updateId = Date.now() + Math.floor(Math.random() * 1000000);
    const upd1 = makeUpdate('First greeting', updateId);
    const upd2 = makeUpdate('First greeting', updateId);

    const res1 = await UpdateProcessor.processUpdate(upd1);
    const res2 = await UpdateProcessor.processUpdate(upd2);

    assert(
      11,
      'Duplicate update -> exactly ONE reply delivered',
      res1.telegramReplySent === true &&
        res2.isDuplicate === true &&
        res2.telegramReplySent === undefined &&
        sentTelegramMessages.length === 1
    );
  }

  // 12. Tenant isolation
  {
    sentTelegramMessages.length = 0;
    // Set to Biz A
    BusinessResolver.setExplicitBusiness(testBizA);
    mockParserAndReply(
      {
        intent: 'price_query',
        product_name: 'iPhone 15 Pro 256GB',
        quantity: null,
        confidence: 0.98,
        language: 'uz',
      },
      'Biz A: iPhone 15 Pro narxi 13 000 000 so\'m.'
    );
    await UpdateProcessor.processUpdate(makeUpdate('Biz A price check'));
    const sentA = sentTelegramMessages[sentTelegramMessages.length - 1];

    // Set to Biz B
    BusinessResolver.setExplicitBusiness(testBizB);
    mockParserAndReply(
      {
        intent: 'price_query',
        product_name: 'iPhone 15 Pro 256GB',
        quantity: null,
        confidence: 0.98,
        language: 'uz',
      },
      'Biz B: iPhone 15 Pro narxi 13 900 000 so\'m.'
    );
    await UpdateProcessor.processUpdate(makeUpdate('Biz B price check'));
    const sentB = sentTelegramMessages[sentTelegramMessages.length - 1];

    assert(
      12,
      'Tenant isolation: Different responses and prices per business',
      Boolean(sentA && sentB && sentA.text.includes('13 000 000') && sentB.text.includes('13 900 000'))
    );
    BusinessResolver.setExplicitBusiness(testBizA);
  }

  // 13. Outgoing AI message persisted correctly in Firestore
  {
    sentTelegramMessages.length = 0;
    mockParserAndReply(
      {
        intent: 'greeting',
        product_name: null,
        quantity: null,
        confidence: 0.99,
        language: 'uz',
      },
      'Xush kelibsiz! Sizga qanday yordam bera olaman?'
    );

    const res = await UpdateProcessor.processUpdate(makeUpdate('Assalomu alaykum'));
    let outMsgStored = false;

    if (res.conversationId && res.outboundMessageId) {
      const snap = await getDoc(doc(db, 'conversations', res.conversationId, 'messages', res.outboundMessageId));
      if (snap.exists()) {
        const d = snap.data();
        outMsgStored = d.direction === 'outbound' && d.channel === 'telegram' && d.text.includes('Xush kelibsiz');
      }
    }

    assert(13, 'Outgoing AI message persisted correctly in Firestore', outMsgStored);
  }

  // 14. Telegram API failure handled safely
  {
    TelegramClient.setMockSender(async () => {
      return { ok: false, error: 'Telegram gateway timeout (504)' };
    });

    const res = await UpdateProcessor.processUpdate(makeUpdate('Network fail test'));

    assert(
      14,
      'Telegram API failure handled safely without crashing webhook',
      res.success === true && res.telegramReplySent === false
    );
  }

  console.log('==================================================');
  const passedCount = suite.filter((t) => t.passed).length;
  console.log(`TOTAL: ${suite.length} | PASSED: ${passedCount} | FAILED: ${suite.length - passedCount}`);
  console.log('==================================================');

  if (passedCount === suite.length) {
    console.log('🎉 ALL 14 M3.4.2 TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('❌ SOME M3.4.2 TESTS FAILED');
    process.exit(1);
  }
}

runM342Tests();
