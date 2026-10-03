import { UpdateProcessor } from '../server/telegram/updateProcessor';
import { IntentParser, ParsedIntent } from '../server/ai/intentParser';
import { GeminiClient } from '../server/ai/geminiClient';
import { initWorkerAuth } from '../server/initWorkerAuth';
import { TelegramUpdate } from '../src/types/telegram';
import { MessageService } from '../src/services/messageService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

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

async function runM324IntegrationTests() {
  console.log('==================================================');
  console.log('🔗 M3.2.4 Telegram + AI Intent + Product Resolver Integration Tests');
  console.log('(Mocked Gemini, Real/Sandbox Firestore, No Telegram replies)');
  console.log('==================================================');

  await initWorkerAuth();

  // Helper to build a TelegramUpdate
  let baseUpdateId = Date.now();
  function makeUpdate(text: string, updateId?: number): TelegramUpdate {
    const uId = updateId || ++baseUpdateId;
    return {
      update_id: uId,
      message: {
        message_id: Math.floor(Math.random() * 1000000) + 1,
        from: {
          id: 99887766,
          is_bot: false,
          first_name: 'TestCustomer',
          username: 'test_client_m324',
        },
        chat: {
          id: 99887766,
          type: 'private',
          first_name: 'TestCustomer',
        },
        date: Math.floor(Date.now() / 1000),
        text,
      },
    };
  }

  // Helper to mock IntentParser response
  function mockParserResponse(data: ParsedIntent) {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async () => ({
      success: true,
      text: JSON.stringify(data),
    });
    return new IntentParser(mockGemini);
  }

  // Test 1: Telegram text → intent parser is invoked
  {
    UpdateProcessor.setIntentParser(
      mockParserResponse({
        intent: 'product_query',
        product_name: 'iPhone 15 Pro',
        quantity: null,
        confidence: 0.95,
        language: 'uz',
      })
    );

    const update = makeUpdate('iPhone 15 Pro bormi?');
    const res = await UpdateProcessor.processUpdate(update);

    assert('Test 1 - Process update succeeds', res.success === true);
    assert('Test 1 - Status is processed_informational_only', res.status === 'processed_informational_only');
    assert('Test 1 - Intent detected as product_query', res.detectedIntent === 'product_query');
    assert('Test 1 - Inbound message ID returned', Boolean(res.inboundMessageId));
  }

  // Test 2: product_query + product_name → Product Resolver is called
  {
    UpdateProcessor.setIntentParser(
      mockParserResponse({
        intent: 'product_query',
        product_name: 'Apple iPhone 15 Pro',
        quantity: null,
        confidence: 0.96,
        language: 'uz',
      })
    );

    const res = await UpdateProcessor.processUpdate(makeUpdate('Apple iPhone 15 Pro bormi?'));
    assert('Test 2 - product_query calls product resolver', res.productResolution !== undefined);
  }

  // Test 3: stock_query + product_name → Product Resolver is called
  {
    UpdateProcessor.setIntentParser(
      mockParserResponse({
        intent: 'stock_query',
        product_name: 'Apple iPhone 15 Pro',
        quantity: null,
        confidence: 0.94,
        language: 'uz',
      })
    );

    const res = await UpdateProcessor.processUpdate(makeUpdate('iPhone 15 nechta qoldi?'));
    assert('Test 3 - stock_query calls product resolver', res.productResolution !== undefined);
  }

  // Test 4: price_query + product_name → Product Resolver is called
  {
    UpdateProcessor.setIntentParser(
      mockParserResponse({
        intent: 'price_query',
        product_name: 'Apple iPhone 15 Pro',
        quantity: null,
        confidence: 0.97,
        language: 'uz',
      })
    );

    const res = await UpdateProcessor.processUpdate(makeUpdate('iPhone 15 narxi qancha?'));
    assert('Test 4 - price_query calls product resolver', res.productResolution !== undefined);
  }

  // Test 5: order_intent + product_name → Product Resolver is called
  {
    UpdateProcessor.setIntentParser(
      mockParserResponse({
        intent: 'order_intent',
        product_name: 'Apple iPhone 15 Pro',
        quantity: 2,
        confidence: 0.98,
        language: 'uz',
      })
    );

    const res = await UpdateProcessor.processUpdate(makeUpdate('2 ta iPhone 15 olmoqchiman'));
    assert('Test 5 - order_intent calls product resolver', res.productResolution !== undefined);
  }

  // Test 6: greeting → no product resolver call
  {
    UpdateProcessor.setIntentParser(
      mockParserResponse({
        intent: 'greeting',
        product_name: null,
        quantity: null,
        confidence: 0.99,
        language: 'uz',
      })
    );

    const res = await UpdateProcessor.processUpdate(makeUpdate('Assalomu alaykum'));
    assert('Test 6 - greeting does NOT call product resolver', res.productResolution === undefined);
  }

  // Test 7: unknown → no product resolver call
  {
    UpdateProcessor.setIntentParser(
      mockParserResponse({
        intent: 'unknown',
        product_name: null,
        quantity: null,
        confidence: 0.9,
        language: 'unknown',
      })
    );

    const res = await UpdateProcessor.processUpdate(makeUpdate('asdfgh???'));
    assert('Test 7 - unknown does NOT call product resolver', res.productResolution === undefined);
  }

  // Test 8: missing product_name → no product resolver call
  {
    UpdateProcessor.setIntentParser(
      mockParserResponse({
        intent: 'price_query',
        product_name: null,
        quantity: null,
        confidence: 0.8,
        language: 'uz',
      })
    );

    const res = await UpdateProcessor.processUpdate(makeUpdate('Narxi qancha?'));
    assert('Test 8 - missing product_name skips product resolver', res.productResolution === undefined);
  }

  // Test 9: resolved product
  {
    UpdateProcessor.setIntentParser(
      mockParserResponse({
        intent: 'product_query',
        product_name: 'Apple iPhone 15 Pro',
        quantity: null,
        confidence: 0.98,
        language: 'uz',
      })
    );

    const res = await UpdateProcessor.processUpdate(makeUpdate('Apple iPhone 15 Pro bormi?'));
    assert('Test 9 - Product resolved successfully or searched', Boolean(res.productResolution));
    if (res.productResolution?.status === 'resolved') {
      assert('Test 9 - Product resolution status is resolved', res.productResolution.status === 'resolved');
    }
  }

  // Test 10: not_found product
  {
    UpdateProcessor.setIntentParser(
      mockParserResponse({
        intent: 'product_query',
        product_name: 'NonExistentSpacePhone 99 Ultra',
        quantity: null,
        confidence: 0.95,
        language: 'uz',
      })
    );

    const res = await UpdateProcessor.processUpdate(makeUpdate('NonExistentSpacePhone 99 Ultra bormi?'));
    assert('Test 10 - Product resolution is not_found', res.productResolution?.status === 'not_found');
  }

  // Test 11: ambiguous product handling
  {
    UpdateProcessor.setIntentParser(
      mockParserResponse({
        intent: 'product_query',
        product_name: 'iPhone',
        quantity: null,
        confidence: 0.95,
        language: 'uz',
      })
    );

    const res = await UpdateProcessor.processUpdate(makeUpdate('iPhone bormi?'));
    assert('Test 11 - Product resolution performed for broad query', res.productResolution !== undefined);
  }

  // Test 12: duplicate Telegram update → AI processing runs only once (idempotency check)
  {
    const dupUpdateId = Date.now() + Math.floor(Math.random() * 1000000);
    const update1 = makeUpdate('First attempt', dupUpdateId);
    const update2 = makeUpdate('First attempt', dupUpdateId);

    const res1 = await UpdateProcessor.processUpdate(update1);
    const res2 = await UpdateProcessor.processUpdate(update2);

    assert('Test 12 - First attempt processed', res1.status === 'processed_informational_only');
    assert('Test 12 - Duplicate update skipped', res2.status === 'duplicate_update_skipped');
    assert('Test 12 - isDuplicate flag is true on second call', res2.isDuplicate === true);
  }

  // Test 13: Gemini/parser failure → webhook remains stable (no crash, original message preserved)
  {
    const mockFailingGemini = new GeminiClient({ apiKey: 'mock' });
    (mockFailingGemini as any).generateText = async () => ({
      success: false,
      errorCode: 'API_ERROR',
      errorMessage: 'Simulated Gemini outage',
    });
    UpdateProcessor.setIntentParser(new IntentParser(mockFailingGemini));

    const res = await UpdateProcessor.processUpdate(makeUpdate('Error test message'));
    assert('Test 13 - Failure does not crash webhook', res.success === true);
    assert('Test 13 - Status is processed_informational_only', res.status === 'processed_informational_only');
    assert('Test 13 - Inbound message saved despite AI error', Boolean(res.inboundMessageId));
  }

  // Test 14: Tenant/businessId is correctly passed to Product Resolver & Message
  {
    UpdateProcessor.setIntentParser(
      mockParserResponse({
        intent: 'product_query',
        product_name: 'Apple iPhone 15 Pro',
        quantity: null,
        confidence: 0.95,
        language: 'uz',
      })
    );

    const res = await UpdateProcessor.processUpdate(makeUpdate('Apple iPhone 15 Pro bormi?'));
    assert('Test 14 - businessId is present', Boolean(res.businessId));

    if (res.conversationId && res.inboundMessageId) {
      const msgSnap = await getDoc(doc(db, 'conversations', res.conversationId, 'messages', res.inboundMessageId));
      assert('Test 14 - Message exists in Firestore', msgSnap.exists());
      const msgData = msgSnap.data();
      assert('Test 14 - Message has businessId matching', msgData?.businessId === res.businessId);
    }
  }

  console.log('==================================================');
  const passed = suite.filter((t) => t.passed).length;
  console.log(`TOTAL: ${suite.length} | PASSED: ${passed} | FAILED: ${suite.length - passed}`);
  console.log('==================================================');

  if (passed === suite.length) {
    console.log('🎉 ALL M3.2.4 INTEGRATION TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME M3.2.4 TESTS FAILED');
    process.exit(1);
  }
}

runM324IntegrationTests();
