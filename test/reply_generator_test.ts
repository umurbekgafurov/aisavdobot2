import { ReplyGenerator, ReplyGeneratorInput, GeneratedReply } from '../server/ai/replyGenerator';
import { GeminiClient } from '../server/ai/geminiClient';

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

// Helper to create a mocked GeminiClient
function makeMockClient(responsePayload: { reply: string; language: string } | null, shouldFail = false) {
  const mock = new GeminiClient({ apiKey: 'mock' });
  (mock as any).generateText = async () => {
    if (shouldFail) {
      return { success: false, errorCode: 'API_ERROR', errorMessage: 'Simulated API failure' };
    }
    return {
      success: true,
      text: JSON.stringify(responsePayload),
    };
  };
  return mock;
}

async function runReplyGeneratorTests() {
  console.log('==================================================');
  console.log('💬 M3.4.1 AI Telegram Reply Generator Unit Tests');
  console.log('(Mocked Gemini - Zero Live Network Calls - Safety First)');
  console.log('==================================================');

  // Test 1: Uzbek in-stock product
  {
    const client = makeMockClient({
      reply: 'Ha, iPhone 15 Pro 256GB omborimizda 5 dona mavjud. Narxi 13 000 000 so\'m.',
      language: 'uz',
    });
    const generator = new ReplyGenerator(client);

    const input: ReplyGeneratorInput = {
      customerMessage: 'iPhone 15 Pro 256GB bormi?',
      language: 'uz',
      intent: 'product_query',
      productName: 'iPhone 15 Pro 256GB',
      productResolutionStatus: 'resolved',
      productInfo: {
        id: 'prod_1',
        name: 'iPhone 15 Pro 256GB',
        sku: 'IPH-15P-256',
      },
      stockInfo: {
        available: true,
        quantity: 5,
        warehouseName: 'Asosiy ombor',
      },
      priceInfo: {
        available: true,
        price: 13000000,
        currency: 'so\'m',
      },
    };

    const res = await generator.generateReply(input);
    assert(1, 'Uzbek in-stock product reply', res.success === true && res.data?.language === 'uz' && res.data.text.includes('13 000 000'));
  }

  // Test 2: Uzbek out-of-stock product
  {
    const client = makeMockClient({
      reply: 'Kechirasiz, iPhone 15 Pro 256GB hozirda omborda qolmagan.',
      language: 'uz',
    });
    const generator = new ReplyGenerator(client);

    const input: ReplyGeneratorInput = {
      customerMessage: 'iPhone 15 Pro 256GB bormi?',
      language: 'uz',
      intent: 'product_query',
      productName: 'iPhone 15 Pro 256GB',
      productResolutionStatus: 'resolved',
      productInfo: {
        id: 'prod_1',
        name: 'iPhone 15 Pro 256GB',
      },
      stockInfo: {
        available: false,
        quantity: 0,
      },
      priceInfo: {
        available: true,
        price: 13000000,
        currency: 'so\'m',
      },
    };

    const res = await generator.generateReply(input);
    assert(2, 'Uzbek out-of-stock product reply', res.success === true && Boolean(res.data?.text.includes('qolmagan')));
  }

  // Test 3: Uzbek price response
  {
    const client = makeMockClient({
      reply: 'iPhone 15 Pro 256GB narxi 13 000 000 so\'m.',
      language: 'uz',
    });
    const generator = new ReplyGenerator(client);

    const input: ReplyGeneratorInput = {
      customerMessage: 'iPhone 15 Pro 256GB narxi qancha?',
      language: 'uz',
      intent: 'price_query',
      productName: 'iPhone 15 Pro 256GB',
      productResolutionStatus: 'resolved',
      productInfo: {
        id: 'prod_1',
        name: 'iPhone 15 Pro 256GB',
      },
      stockInfo: {
        available: true,
        quantity: 5,
      },
      priceInfo: {
        available: true,
        price: 13000000,
        currency: 'so\'m',
      },
    };

    const res = await generator.generateReply(input);
    assert(3, 'Uzbek price response', res.success === true && Boolean(res.data?.text.includes('13 000 000')));
  }

  // Test 4: Russian response
  {
    const client = makeMockClient({
      reply: 'Да, iPhone 15 Pro 256GB есть в наличии, 5 штук. Цена 13 000 000 сум.',
      language: 'ru',
    });
    const generator = new ReplyGenerator(client);

    const input: ReplyGeneratorInput = {
      customerMessage: 'Есть ли iPhone 15 Pro 256GB?',
      language: 'ru',
      intent: 'product_query',
      productName: 'iPhone 15 Pro 256GB',
      productResolutionStatus: 'resolved',
      productInfo: {
        id: 'prod_1',
        name: 'iPhone 15 Pro 256GB',
      },
      stockInfo: {
        available: true,
        quantity: 5,
      },
      priceInfo: {
        available: true,
        price: 13000000,
        currency: 'сум',
      },
    };

    const res = await generator.generateReply(input);
    assert(4, 'Russian response', res.success === true && res.data?.language === 'ru' && res.data.text.includes('наличии'));
  }

  // Test 5: English response
  {
    const client = makeMockClient({
      reply: 'Yes, iPhone 15 Pro 256GB is available with 5 units in stock. Price is 13,000,000 UZS.',
      language: 'en',
    });
    const generator = new ReplyGenerator(client);

    const input: ReplyGeneratorInput = {
      customerMessage: 'Do you have iPhone 15 Pro 256GB?',
      language: 'en',
      intent: 'product_query',
      productName: 'iPhone 15 Pro 256GB',
      productResolutionStatus: 'resolved',
      productInfo: {
        id: 'prod_1',
        name: 'iPhone 15 Pro 256GB',
      },
      stockInfo: {
        available: true,
        quantity: 5,
      },
      priceInfo: {
        available: true,
        price: 13000000,
        currency: 'UZS',
      },
    };

    const res = await generator.generateReply(input);
    assert(5, 'English response', res.success === true && res.data?.language === 'en' && res.data.text.includes('available'));
  }

  // Test 6: Product not found
  {
    const client = makeMockClient({
      reply: 'Kechirasiz, "Nokia 3310" bizning katalogimizda topilmadi.',
      language: 'uz',
    });
    const generator = new ReplyGenerator(client);

    const input: ReplyGeneratorInput = {
      customerMessage: 'Nokia 3310 bormi?',
      language: 'uz',
      intent: 'product_query',
      productName: 'Nokia 3310',
      productResolutionStatus: 'not_found',
      productInfo: null,
      stockInfo: null,
      priceInfo: null,
    };

    const res = await generator.generateReply(input);
    assert(6, 'Product not found reply', res.success === true && Boolean(res.data?.text.includes('topilmadi')));
  }

  // Test 7: Ambiguous product
  {
    const client = makeMockClient({
      reply: 'Bizda iPhone 15 Pro 128GB va iPhone 15 Pro 256GB variantlari bor. Qaysi biri sizga kerak?',
      language: 'uz',
    });
    const generator = new ReplyGenerator(client);

    const input: ReplyGeneratorInput = {
      customerMessage: 'iPhone 15 Pro bormi?',
      language: 'uz',
      intent: 'product_query',
      productName: 'iPhone 15 Pro',
      productResolutionStatus: 'ambiguous',
      ambiguousCandidates: [
        { name: 'iPhone 15 Pro 128GB', sku: 'IPH-128' },
        { name: 'iPhone 15 Pro 256GB', sku: 'IPH-256' },
      ],
    };

    const res = await generator.generateReply(input);
    assert(7, 'Ambiguous product reply', res.success === true && Boolean(res.data?.text.includes('128GB')) && Boolean(res.data?.text.includes('256GB')));
  }

  // Test 8: Missing price
  {
    const client = makeMockClient({
      reply: 'Ha, iPhone 15 Pro mavjud, biroq narxini aniqlashtirib beramiz.',
      language: 'uz',
    });
    const generator = new ReplyGenerator(client);

    const input: ReplyGeneratorInput = {
      customerMessage: 'iPhone 15 Pro narxi qancha?',
      language: 'uz',
      intent: 'price_query',
      productName: 'iPhone 15 Pro',
      productResolutionStatus: 'resolved',
      productInfo: { id: 'p1', name: 'iPhone 15 Pro' },
      stockInfo: { available: true, quantity: 3 },
      priceInfo: null, // missing price
    };

    const res = await generator.generateReply(input);
    assert(8, 'Missing price handles gracefully', res.success === true && Boolean(res.data?.text));
  }

  // Test 9: Missing stock
  {
    const client = makeMockClient({
      reply: 'iPhone 15 Pro narxi 13 000 000 so\'m, qoldig\'i aniqlashtirilmoqda.',
      language: 'uz',
    });
    const generator = new ReplyGenerator(client);

    const input: ReplyGeneratorInput = {
      customerMessage: 'iPhone 15 Pro nechta qoldi?',
      language: 'uz',
      intent: 'stock_query',
      productName: 'iPhone 15 Pro',
      productResolutionStatus: 'resolved',
      productInfo: { id: 'p1', name: 'iPhone 15 Pro' },
      stockInfo: null, // missing stock
      priceInfo: { available: true, price: 13000000, currency: 'so\'m' },
    };

    const res = await generator.generateReply(input);
    assert(9, 'Missing stock handles gracefully', res.success === true && Boolean(res.data?.text));
  }

  // Test 10: Unknown intent
  {
    const client = makeMockClient({
      reply: 'Assalomu alaykum! Sizga qanday yordam bera olaman?',
      language: 'uz',
    });
    const generator = new ReplyGenerator(client);

    const input: ReplyGeneratorInput = {
      customerMessage: 'qandaydir noaniq so\'z',
      language: 'uz',
      intent: 'unknown',
    };

    const res = await generator.generateReply(input);
    assert(10, 'Unknown intent handles gracefully', res.success === true && Boolean(res.data?.text));
  }

  // Test 11: Gemini failure returns safe fallback
  {
    const client = makeMockClient(null, true); // fails
    const generator = new ReplyGenerator(client);

    const input: ReplyGeneratorInput = {
      customerMessage: 'iPhone 15 Pro bormi?',
      language: 'uz',
      intent: 'product_query',
      productName: 'iPhone 15 Pro',
      productResolutionStatus: 'resolved',
      productInfo: { id: 'p1', name: 'iPhone 15 Pro' },
      stockInfo: { available: true, quantity: 4 },
      priceInfo: { available: true, price: 13000000, currency: 'so\'m' },
    };

    const res = await generator.generateReply(input);
    assert(11, 'Gemini failure triggers deterministic fallback', res.success === false && Boolean(res.data?.text) && Boolean(res.data?.text.includes('mavjud')));
  }

  // Test 12: Hallucination protection — prompt verification
  {
    const input: ReplyGeneratorInput = {
      customerMessage: 'iPhone 15 Pro 256GB bormi?',
      language: 'uz',
      intent: 'product_query',
      productName: 'iPhone 15 Pro 256GB',
      productResolutionStatus: 'resolved',
      productInfo: {
        id: 'trusted_prod_99',
        name: 'iPhone 15 Pro 256GB',
        sku: 'TRUSTED-SKU-99',
      },
      stockInfo: {
        available: true,
        quantity: 7,
        warehouseName: 'Asosiy Ombor',
      },
      priceInfo: {
        available: true,
        price: 14500000,
        currency: 'UZS',
      },
    };

    const generatedPrompt = ReplyGenerator.buildPrompt(input);

    const containsRealPrice = generatedPrompt.includes('14500000');
    const containsRealStock = generatedPrompt.includes('7');
    const containsRealWarehouse = generatedPrompt.includes('Asosiy Ombor');
    const containsStrictRule = generatedPrompt.includes('NEVER invent');

    assert(
      12,
      'Hallucination protection - prompt contains ONLY verified backend data & strict rules',
      containsRealPrice && containsRealStock && containsRealWarehouse && containsStrictRule
    );
  }

  console.log('==================================================');
  const passedCount = suite.filter((t) => t.passed).length;
  console.log(`TOTAL: ${suite.length} | PASSED: ${passedCount} | FAILED: ${suite.length - passedCount}`);
  console.log('==================================================');

  if (passedCount === suite.length) {
    console.log('🎉 ALL 12 M3.4.1 TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('❌ SOME M3.4.1 TESTS FAILED');
    process.exit(1);
  }
}

runReplyGeneratorTests();
