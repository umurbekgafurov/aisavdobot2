import { GeminiClient } from '../server/ai/geminiClient';

interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

const results: TestResult[] = [];

function assert(name: string, condition: boolean, message?: string) {
  results.push({ name, passed: condition, message });
  console.log(`[TEST] ${condition ? '✅ PASS' : '❌ FAIL'}: ${name}${message ? ` - ${message}` : ''}`);
}

async function runGeminiClientUnitTests() {
  console.log('==================================================');
  console.log('🤖 M3.2.1 Gemini Client Unit Tests (Mocked - No live API calls)');
  console.log('==================================================');

  // Test 1: Missing API Key handling
  {
    const clientNoKey = new GeminiClient({ apiKey: '', model: 'gemini-3.8-flash' });
    assert('Missing API key isConfigured() is false', clientNoKey.isConfigured() === false);

    const res = await clientNoKey.generateText('Salom');
    assert('Missing API key returns success: false', res.success === false);
    assert('Missing API key errorCode is MISSING_API_KEY', res.errorCode === 'MISSING_API_KEY');
  }

  // Test 2: Empty prompt validation
  {
    const client = new GeminiClient({ apiKey: 'mock-key', model: 'gemini-3.8-flash' });
    const emptyRes = await client.generateText('');
    assert('Empty prompt returns success: false', emptyRes.success === false);
    assert('Empty prompt errorCode is EMPTY_PROMPT', emptyRes.errorCode === 'EMPTY_PROMPT');
  }

  // Test 3: Model and Client configuration
  {
    const customClient = new GeminiClient({ apiKey: 'mock-test-key-xyz', model: 'gemini-3.8-flash' });
    assert('Client configured successfully with key', customClient.isConfigured() === true);
    assert('Client correctly returns configured model name', customClient.getModelName() === 'gemini-3.8-flash');
  }

  // Test 4: Mocked successful response (does NOT make live API calls)
  {
    const mockClient = new GeminiClient({ apiKey: 'mock-key', model: 'gemini-3.8-flash' });
    // Mock internal client models.generateContent
    (mockClient as any).client = {
      models: {
        generateContent: async (_params: any) => ({
          text: 'Ha, iPhone 15 Pro omborimizda 5 dona mavjud.',
        }),
      },
    };

    const res = await mockClient.generateText('iPhone 15 Pro bormi?');
    assert('Mocked response returns success: true', res.success === true);
    assert('Mocked response contains expected text', res.text === 'Ha, iPhone 15 Pro omborimizda 5 dona mavjud.');
  }

  // Test 5: Mocked API error handling (safe failure, no throw)
  {
    const mockClient = new GeminiClient({ apiKey: 'mock-key', model: 'gemini-3.8-flash' });
    (mockClient as any).client = {
      models: {
        generateContent: async (_params: any) => {
          throw new Error('API server internal failure (500)');
        },
      },
    };

    const res = await mockClient.generateText('Test');
    assert('API error returns success: false', res.success === false);
    assert('API error returns errorCode API_ERROR', res.errorCode === 'API_ERROR');
    assert('API error returns safe error message', typeof res.errorMessage === 'string');
  }

  // Test 6: Mocked Rate Limit / Quota handling
  {
    const mockClient = new GeminiClient({ apiKey: 'mock-key', model: 'gemini-3.8-flash' });
    (mockClient as any).client = {
      models: {
        generateContent: async (_params: any) => {
          throw new Error('429 RESOURCE_EXHAUSTED: You exceeded your current quota');
        },
      },
    };

    const res = await mockClient.generateText('Test');
    assert('Rate limit returns success: false', res.success === false);
    assert('Rate limit returns errorCode RATE_LIMIT', res.errorCode === 'RATE_LIMIT');
  }

  console.log('==================================================');
  const passed = results.filter((r) => r.passed).length;
  console.log(`TOTAL: ${results.length} | PASSED: ${passed} | FAILED: ${results.length - passed}`);
  console.log('==================================================');

  if (passed === results.length) {
    console.log('🎉 ALL M3.2.1 UNIT TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

runGeminiClientUnitTests();
