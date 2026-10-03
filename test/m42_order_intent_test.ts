import { IntentParser } from '../server/ai/intentParser';
import { GeminiClient } from '../server/ai/geminiClient';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  details?: string;
}

const suite: TestResult[] = [];

function assert(num: number, name: string, condition: boolean, details?: string) {
  suite.push({ num, name, passed: condition, details });
  console.log(`[M4.2 TEST ${num}] ${condition ? '✅ PASS' : '❌ FAIL'}: ${name}${details ? ` -> ${details}` : ''}`);
}

async function runM42OrderIntentTests() {
  console.log('===============================================================');
  console.log('📦 M4.2 ORDER INTENT EXTRACTION UNIT TESTS');
  console.log('(Mocked GeminiClient — Zero live network or external API calls)');
  console.log('===============================================================');

  // 1. Order without explicit quantity -> defaults to quantity = 1
  {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async (prompt: string) => {
      return {
        success: true,
        text: JSON.stringify({
          intent: 'order_intent',
          product_name: 'iPhone 15 Pro 256GB',
          quantity: null, // Gemini didn't find an explicit number, backend defaults to 1 for order_intent
          confidence: 0.94,
          language: 'uz',
        }),
      };
    };

    const parser = new IntentParser(mockGemini);
    const res = await parser.parseIntent({ text: 'iPhone 15 Pro 256GB kerak' });

    const pass =
      res.success === true &&
      res.data?.intent === 'order_intent' &&
      res.data?.product_name === 'iPhone 15 Pro 256GB' &&
      res.data?.quantity === 1;

    assert(1, 'Order without explicit quantity defaults to quantity 1', pass, `Quantity: ${res.data?.quantity}`);
  }

  // 2. Order with quantity 2
  {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async () => ({
      success: true,
      text: JSON.stringify({
        intent: 'order_intent',
        product_name: 'iPhone 15 Pro 256GB',
        quantity: 2,
        confidence: 0.98,
        language: 'uz',
      }),
    });

    const parser = new IntentParser(mockGemini);
    const res = await parser.parseIntent({ text: '2 ta iPhone 15 Pro 256GB olaman' });

    const pass =
      res.success === true &&
      res.data?.intent === 'order_intent' &&
      res.data?.product_name === 'iPhone 15 Pro 256GB' &&
      res.data?.quantity === 2;

    assert(2, 'Order with explicit quantity 2', pass, `Quantity: ${res.data?.quantity}`);
  }

  // 3. Order with quantity 3+
  {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async () => ({
      success: true,
      text: JSON.stringify({
        intent: 'order_intent',
        product_name: 'Samsung S24',
        quantity: 5,
        confidence: 0.97,
        language: 'uz',
      }),
    });

    const parser = new IntentParser(mockGemini);
    const res = await parser.parseIntent({ text: 'Menga 5 dona Samsung S24 kerak' });

    const pass =
      res.success === true &&
      res.data?.intent === 'order_intent' &&
      res.data?.product_name === 'Samsung S24' &&
      res.data?.quantity === 5;

    assert(3, 'Order with explicit quantity 3+ (5 units)', pass, `Quantity: ${res.data?.quantity}`);
  }

  // 4. Uzbek quantity parsing ("3 dona", "2 ta")
  {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async () => ({
      success: true,
      text: JSON.stringify({
        intent: 'order_intent',
        product_name: 'Samsung S24',
        quantity: 3,
        confidence: 0.96,
        language: 'uz',
      }),
    });

    const parser = new IntentParser(mockGemini);
    const res = await parser.parseIntent({ text: 'Menga 3 dona Samsung S24 kerak' });

    const pass =
      res.success === true &&
      res.data?.intent === 'order_intent' &&
      res.data?.language === 'uz' &&
      res.data?.quantity === 3;

    assert(4, 'Uzbek quantity extraction ("3 dona")', pass, `Lang: ${res.data?.language}, Qty: ${res.data?.quantity}`);
  }

  // 5. Russian quantity parsing ("2 iPhone 15", "3 штуки")
  {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async () => ({
      success: true,
      text: JSON.stringify({
        intent: 'order_intent',
        product_name: 'iPhone 15',
        quantity: 2,
        confidence: 0.97,
        language: 'ru',
      }),
    });

    const parser = new IntentParser(mockGemini);
    const res = await parser.parseIntent({ text: 'Мне нужно 2 iPhone 15' });

    const pass =
      res.success === true &&
      res.data?.intent === 'order_intent' &&
      res.data?.language === 'ru' &&
      res.data?.quantity === 2;

    assert(5, 'Russian quantity extraction ("Мне нужно 2 iPhone 15")', pass, `Lang: ${res.data?.language}, Qty: ${res.data?.quantity}`);
  }

  // 6. English quantity parsing ("3 Samsung S24 phones", "2 pieces")
  {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async () => ({
      success: true,
      text: JSON.stringify({
        intent: 'order_intent',
        product_name: 'Samsung S24',
        quantity: 3,
        confidence: 0.95,
        language: 'en',
      }),
    });

    const parser = new IntentParser(mockGemini);
    const res = await parser.parseIntent({ text: 'I want 3 Samsung S24 phones' });

    const pass =
      res.success === true &&
      res.data?.intent === 'order_intent' &&
      res.data?.language === 'en' &&
      res.data?.quantity === 3;

    assert(6, 'English quantity extraction ("3 Samsung S24 phones")', pass, `Lang: ${res.data?.language}, Qty: ${res.data?.quantity}`);
  }

  // 7. Invalid quantity (0, negative, fractional) -> safely return quantity = null
  {
    const invalidCases = [
      { text: '0 ta iPhone 15 kerak', qty: 0 },
      { text: '-2 ta iPhone 15 kerak', qty: -2 },
      { text: '1.5 ta iPhone 15 kerak', qty: 1.5 },
      { text: '0 dona iPhone 15 berilsin', qty: null },
    ];
    let allHandledSafely = true;

    for (const c of invalidCases) {
      const mockGemini = new GeminiClient({ apiKey: 'mock' });
      (mockGemini as any).generateText = async () => ({
        success: true,
        text: JSON.stringify({
          intent: 'order_intent',
          product_name: 'iPhone 15',
          quantity: c.qty,
          confidence: 0.85,
          language: 'uz',
        }),
      });

      const parser = new IntentParser(mockGemini);
      const res = await parser.parseIntent({ text: c.text });

      // Invalid quantity must be converted to null safely
      if (!res.success || res.data?.quantity !== null) {
        allHandledSafely = false;
      }
    }

    assert(7, 'Invalid quantity (zero, negative, fractional) safely returns null', allHandledSafely);
  }

  // 8. Price question is NOT order_intent ("Narxi qancha?")
  {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async () => ({
      success: true,
      text: JSON.stringify({
        intent: 'price_query',
        product_name: 'iPhone 15 Pro 256GB',
        quantity: null,
        confidence: 0.98,
        language: 'uz',
      }),
    });

    const parser = new IntentParser(mockGemini);
    const res = await parser.parseIntent({ text: 'iPhone 15 Pro 256GB narxi qancha?' });

    const pass =
      res.success === true &&
      res.data?.intent === 'price_query' &&
      (res.data?.intent as any) !== 'order_intent';

    assert(8, 'Price inquiry ("Narxi qancha?") is NOT order_intent', pass, `Intent: ${res.data?.intent}`);
  }

  // 9. Stock question is NOT order_intent ("Nechta bor?")
  {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async () => ({
      success: true,
      text: JSON.stringify({
        intent: 'stock_query',
        product_name: 'iPhone 15 Pro 256GB',
        quantity: null,
        confidence: 0.97,
        language: 'uz',
      }),
    });

    const parser = new IntentParser(mockGemini);
    const res = await parser.parseIntent({ text: 'iPhone 15 Pro 256GB nechta bor?' });

    const pass =
      res.success === true &&
      res.data?.intent === 'stock_query' &&
      (res.data?.intent as any) !== 'order_intent';

    assert(9, 'Stock inquiry ("Nechta bor?") is NOT order_intent', pass, `Intent: ${res.data?.intent}`);
  }

  // 10. Product information question is NOT order_intent
  {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async () => ({
      success: true,
      text: JSON.stringify({
        intent: 'product_query',
        product_name: 'iPhone 15',
        quantity: null,
        confidence: 0.95,
        language: 'uz',
      }),
    });

    const parser = new IntentParser(mockGemini);
    const res = await parser.parseIntent({ text: 'iPhone 15 haqida ma\'lumot bering' });

    const pass =
      res.success === true &&
      res.data?.intent === 'product_query' &&
      (res.data?.intent as any) !== 'order_intent';

    assert(10, 'Product info inquiry is NOT order_intent', pass, `Intent: ${res.data?.intent}`);
  }

  // 11. Multiple-product message -> safely handled, does NOT silently merge products
  {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async () => ({
      success: true,
      text: JSON.stringify({
        intent: 'order_intent',
        product_name: null, // Multiple products detected, does NOT merge "iPhone 15 and MacBook Air"
        quantity: null,
        confidence: 0.5,
        language: 'uz',
      }),
    });

    const parser = new IntentParser(mockGemini);
    const res = await parser.parseIntent({ text: 'Menga 1 ta iPhone 15 va 1 ta MacBook Air kerak' });

    const pass =
      res.success === true &&
      res.data?.product_name === null; // No erroneous concatenated product created

    assert(
      11,
      'Multiple-product message handled safely without silent merge',
      pass,
      `Product: ${res.data?.product_name}`
    );
  }

  // 12. Missing product name in order request
  {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async () => ({
      success: true,
      text: JSON.stringify({
        intent: 'order_intent',
        product_name: null,
        quantity: 2,
        confidence: 0.6,
        language: 'uz',
      }),
    });

    const parser = new IntentParser(mockGemini);
    const res = await parser.parseIntent({ text: '2 ta buyurtma qilmoqchiman' });

    const pass =
      res.success === true &&
      res.data?.intent === 'order_intent' &&
      res.data?.product_name === null &&
      res.data?.quantity === 2;

    assert(12, 'Order intent with missing product name handled safely', pass, `Product: ${res.data?.product_name}, Qty: ${res.data?.quantity}`);
  }

  // 13. Low-confidence order request
  {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async () => ({
      success: true,
      text: JSON.stringify({
        intent: 'order_intent',
        product_name: 'iPhone',
        quantity: 1,
        confidence: 0.35,
        language: 'uz',
      }),
    });

    const parser = new IntentParser(mockGemini);
    const res = await parser.parseIntent({ text: 'Balki keyinroq olarmiding iPhone' });

    const pass =
      res.success === true &&
      res.data?.confidence === 0.35 &&
      res.data?.confidence < 0.5;

    assert(13, 'Low-confidence order request preserves low confidence score', pass, `Confidence: ${res.data?.confidence}`);
  }

  console.log('===============================================================');
  const passedCount = suite.filter((t) => t.passed).length;
  console.log(`TOTAL: ${suite.length} | PASSED: ${passedCount} | FAILED: ${suite.length - passedCount}`);
  console.log('===============================================================');

  if (passedCount === suite.length) {
    console.log('🎉 ALL 13 M4.2 ORDER INTENT TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('❌ SOME M4.2 TESTS FAILED');
    process.exit(1);
  }
}

runM42OrderIntentTests();
