import { IntentParser } from '../server/ai/intentParser';
import { GeminiClient } from '../server/ai/geminiClient';

interface TestItem {
  name: string;
  passed: boolean;
  message?: string;
}

const suite: TestItem[] = [];

function assert(name: string, condition: boolean, message?: string) {
  suite.push({ name, passed: condition, message });
  console.log(`[TEST] ${condition ? '✅ PASS' : '❌ FAIL'}: ${name}${message ? ` (${message})` : ''}`);
}

async function runIntentParserTests() {
  console.log('==================================================');
  console.log('🤖 M3.2.2 Gemini Intent Parser Unit Tests');
  console.log('(Mocked GeminiClient - No real network or API calls)');
  console.log('==================================================');

  // Test 1 — Uzbek product query
  {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async () => ({
      success: true,
      text: JSON.stringify({
        intent: 'product_query',
        product_name: 'iPhone 15 Pro 256GB',
        quantity: null,
        confidence: 0.96,
        language: 'uz',
      }),
    });

    const parser = new IntentParser(mockGemini);
    const res = await parser.parseIntent({ text: 'iPhone 15 Pro 256GB bormi?' });

    assert('Test 1 - Uzbek product query returns success', res.success === true);
    assert('Test 1 - intent is product_query', res.data?.intent === 'product_query');
    assert('Test 1 - product_name extracted', res.data?.product_name === 'iPhone 15 Pro 256GB');
    assert('Test 1 - language is uz', res.data?.language === 'uz');
    assert('Test 1 - quantity is null', res.data?.quantity === null);
  }

  // Test 2 — Russian product query
  {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async () => ({
      success: true,
      text: JSON.stringify({
        intent: 'product_query',
        product_name: 'iPhone 15 Pro',
        quantity: null,
        confidence: 0.95,
        language: 'ru',
      }),
    });

    const parser = new IntentParser(mockGemini);
    const res = await parser.parseIntent({ text: 'Есть ли iPhone 15 Pro?' });

    assert('Test 2 - Russian product query returns success', res.success === true);
    assert('Test 2 - intent is product_query', res.data?.intent === 'product_query');
    assert('Test 2 - language is ru', res.data?.language === 'ru');
    assert('Test 2 - product_name is iPhone 15 Pro', res.data?.product_name === 'iPhone 15 Pro');
  }

  // Test 3 — English price query
  {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async () => ({
      success: true,
      text: JSON.stringify({
        intent: 'price_query',
        product_name: 'iPhone 15',
        quantity: null,
        confidence: 0.98,
        language: 'en',
      }),
    });

    const parser = new IntentParser(mockGemini);
    const res = await parser.parseIntent({ text: 'How much is iPhone 15?' });

    assert('Test 3 - English price query returns success', res.success === true);
    assert('Test 3 - intent is price_query', res.data?.intent === 'price_query');
    assert('Test 3 - language is en', res.data?.language === 'en');
    assert('Test 3 - product_name is iPhone 15', res.data?.product_name === 'iPhone 15');
  }

  // Test 4 — Stock query
  {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async () => ({
      success: true,
      text: JSON.stringify({
        intent: 'stock_query',
        product_name: 'iPhone 15',
        quantity: null,
        confidence: 0.92,
        language: 'uz',
      }),
    });

    const parser = new IntentParser(mockGemini);
    const res = await parser.parseIntent({ text: 'iPhone 15 dan nechta qoldi?' });

    assert('Test 4 - Stock query returns success', res.success === true);
    assert('Test 4 - intent is stock_query', res.data?.intent === 'stock_query');
  }

  // Test 5 — Order intent (with quantity = 2)
  {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async () => ({
      success: true,
      text: JSON.stringify({
        intent: 'order_intent',
        product_name: 'iPhone 15',
        quantity: 2,
        confidence: 0.97,
        language: 'uz',
      }),
    });

    const parser = new IntentParser(mockGemini);
    const res = await parser.parseIntent({ text: '2 ta iPhone 15 kerak' });

    assert('Test 5 - Order intent returns success', res.success === true);
    assert('Test 5 - intent is order_intent', res.data?.intent === 'order_intent');
    assert('Test 5 - quantity is 2', res.data?.quantity === 2);
    assert('Test 5 - product_name is iPhone 15', res.data?.product_name === 'iPhone 15');
  }

  // Test 6 — Greeting
  {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async () => ({
      success: true,
      text: JSON.stringify({
        intent: 'greeting',
        product_name: null,
        quantity: null,
        confidence: 0.99,
        language: 'uz',
      }),
    });

    const parser = new IntentParser(mockGemini);
    const res = await parser.parseIntent({ text: 'Assalomu alaykum' });

    assert('Test 6 - Greeting returns success', res.success === true);
    assert('Test 6 - intent is greeting', res.data?.intent === 'greeting');
    assert('Test 6 - product_name is null', res.data?.product_name === null);
    assert('Test 6 - quantity is null', res.data?.quantity === null);
  }

  // Test 7 — Unknown
  {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async () => ({
      success: true,
      text: JSON.stringify({
        intent: 'unknown',
        product_name: null,
        quantity: null,
        confidence: 0.95,
        language: 'unknown',
      }),
    });

    const parser = new IntentParser(mockGemini);
    const res = await parser.parseIntent({ text: 'asdfgh' });

    assert('Test 7 - Unknown returns success', res.success === true);
    assert('Test 7 - intent is unknown', res.data?.intent === 'unknown');
    assert('Test 7 - language is unknown', res.data?.language === 'unknown');
  }

  // Test 8 — Empty input
  {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    const parser = new IntentParser(mockGemini);

    const emptyRes = await parser.parseIntent({ text: '   ' });
    assert('Test 8 - Whitespace input returns success: false', emptyRes.success === false);
    assert('Test 8 - ErrorCode is EMPTY_INPUT', emptyRes.errorCode === 'EMPTY_INPUT');
  }

  // Test 9 — Gemini error handling
  {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async () => ({
      success: false,
      errorCode: 'API_ERROR',
      errorMessage: 'Network timeout',
    });

    const parser = new IntentParser(mockGemini);
    const res = await parser.parseIntent({ text: 'Salom' });

    assert('Test 9 - Gemini failure handled safely', res.success === false);
    assert('Test 9 - errorCode propagated', res.errorCode === 'API_ERROR');
  }

  // Test 10 — Invalid structured response (invalid intent enum)
  {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async () => ({
      success: true,
      text: JSON.stringify({
        intent: 'random_unsupported_intent',
        product_name: null,
        quantity: null,
        confidence: 0.9,
        language: 'uz',
      }),
    });

    const parser = new IntentParser(mockGemini);
    const res = await parser.parseIntent({ text: 'Salom' });

    assert('Test 10 - Invalid enum schema handled safely', res.success === false);
    assert('Test 10 - errorCode is INVALID_SCHEMA', res.errorCode === 'INVALID_SCHEMA');
  }

  // Bonus Test: Markdown fence stripping (```json ... ```)
  {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async () => ({
      success: true,
      text: '```json\n{"intent":"product_query","product_name":"MacBook Air M3","quantity":null,"confidence":0.95,"language":"uz"}\n```',
    });

    const parser = new IntentParser(mockGemini);
    const res = await parser.parseIntent({ text: 'MacBook Air M3 bormi?' });

    assert('Bonus - Markdown code fences stripped cleanly', res.success === true);
    assert('Bonus - product_name matched', res.data?.product_name === 'MacBook Air M3');
  }

  console.log('==================================================');
  const passed = suite.filter((t) => t.passed).length;
  console.log(`TOTAL: ${suite.length} | PASSED: ${passed} | FAILED: ${suite.length - passed}`);
  console.log('==================================================');

  if (passed === suite.length) {
    console.log('🎉 ALL M3.2.2 INTENT PARSER TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

runIntentParserTests();
