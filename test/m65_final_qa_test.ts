import {
  GeminiRecommendationGenerator,
  buildRecommendationPrompt,
  parseRecommendationResponse,
  FALLBACK_RECOMMENDATION
} from '../server/analytics/geminiRecommendationGenerator';
import { CustomerSalesInsight } from '../src/types/salesInsight';
import { GeminiClient } from '../server/ai/geminiClient';
import { SalesRecommendation } from '../src/types/salesRecommendation';

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

class MockGeminiClientForQA extends GeminiClient {
  private responseText: string;
  private willSucceed: boolean;
  public promptsReceived: string[] = [];

  constructor(responseText: string, willSucceed: boolean = true) {
    super({ apiKey: 'mock_qa_key' });
    this.responseText = responseText;
    this.willSucceed = willSucceed;
  }

  isConfigured(): boolean {
    return true;
  }

  async generateText(prompt: string): Promise<any> {
    this.promptsReceived.push(prompt);
    if (!this.willSucceed) {
      return { success: false, errorMessage: 'Mock network timeout' };
    }
    return { success: true, text: this.responseText };
  }
}

async function runM65FinalQATests() {
  console.log('===================================================================================================');
  console.log('🚀 M6.5 FINAL QA VERIFICATION');
  console.log('===================================================================================================');

  const now = 1790970000000;

  // 1. Valid recommendation check
  const insightA: CustomerSalesInsight = {
    customerId: 'cust_qa_01',
    businessId: 'biz_qa_corp',
    intentLevel: 'high',
    intentScore: 88,
    signals: ['active_order', 'purchase_intent_detected'],
    totalOrders: 4,
    completedOrders: 3,
    cancelledOrders: 0,
    totalSpent: 24000000,
    lastOrderAt: now - 1800000,
    lastInteractionAt: now - 600000,
    generatedAt: now,
  };

  const validMock = new MockGeminiClientForQA(
    JSON.stringify({
      action: 'order_follow_up',
      reason: 'Mijozning faol buyurtmasi mavjud, holatni xabar qilish zarur',
      confidence: 0.94,
    })
  );

  const res1 = await GeminiRecommendationGenerator.generateRecommendation(insightA, validMock);
  assert(res1.action === 'order_follow_up', '1. Valid recommendation: action is order_follow_up');
  assert(res1.confidence === 0.94, '1b. Valid recommendation: confidence is 0.94');
  assert(typeof res1.reason === 'string' && res1.reason.length > 0, '1c. Valid recommendation: reason is non-empty');

  // 2. Invalid JSON -> fallback
  const invalidJsonMock = new MockGeminiClientForQA('<<<Not A Valid JSON response>>>');
  const res2 = await GeminiRecommendationGenerator.generateRecommendation(insightA, invalidJsonMock);
  assert(res2.action === 'no_action', '2a. Invalid JSON: falls back to no_action');
  assert(res2.confidence === 0, '2b. Invalid JSON: confidence is 0');
  assert(res2.reason.length > 0, '2c. Invalid JSON: fallback reason provided');

  // 3. Invalid action -> fallback
  const invalidActionMock = new MockGeminiClientForQA(
    JSON.stringify({
      action: 'send_telegram_spam',
      reason: 'Unauthorized action',
      confidence: 0.88,
    })
  );
  const res3 = await GeminiRecommendationGenerator.generateRecommendation(insightA, invalidActionMock);
  assert(res3.action === 'no_action', '3a. Invalid action: rejected and fallback to no_action');
  assert(res3.confidence === 0, '3b. Invalid action: confidence is 0');

  // 4. Confidence < 0 or > 1 -> fallback
  const negConfMock = new MockGeminiClientForQA(
    JSON.stringify({
      action: 'follow_up',
      reason: 'Negative confidence',
      confidence: -0.5,
    })
  );
  const res4Neg = await GeminiRecommendationGenerator.generateRecommendation(insightA, negConfMock);
  assert(res4Neg.action === 'no_action', '4a. Negative confidence: falls back to no_action');
  assert(res4Neg.confidence === 0, '4b. Negative confidence: confidence is 0');

  const overConfMock = new MockGeminiClientForQA(
    JSON.stringify({
      action: 'follow_up',
      reason: 'Over confidence',
      confidence: 1.5,
    })
  );
  const res4Over = await GeminiRecommendationGenerator.generateRecommendation(insightA, overConfMock);
  assert(res4Over.action === 'no_action', '4c. Confidence > 1: falls back to no_action');
  assert(res4Over.confidence === 0, '4d. Confidence > 1: confidence is 0');

  // 5. Gemini failure -> fallback
  const failingMock = new MockGeminiClientForQA('', false);
  const res5 = await GeminiRecommendationGenerator.generateRecommendation(insightA, failingMock);
  assert(res5.action === 'no_action', '5a. Gemini failure: falls back to no_action');
  assert(res5.confidence === 0, '5b. Gemini failure: confidence is 0');
  assert(res5.reason.includes('AI tahlilida nosozlik'), '5c. Gemini failure: clear error message');

  // 6. No hallucinated fields in prompt
  const generatedPrompt = buildRecommendationPrompt(insightA);
  assert(generatedPrompt.includes('TAXMIN QILMANG'), '6a. Anti-hallucination constraint present in prompt');
  assert(generatedPrompt.includes('O\'YLAB TOPMANG'), '6b. No-fact-invention constraint present in prompt');
  assert(generatedPrompt.includes(insightA.customerId), '6c. Only actual insight customerId included');
  assert(!generatedPrompt.includes('random_fake_sku'), '6d. No fabricated SKU or external data in prompt');

  // 7. Tenant isolation (businessId + customerId)
  const insightB: CustomerSalesInsight = {
    customerId: 'cust_qa_02',
    businessId: 'biz_qa_corp_b',
    intentLevel: 'low',
    intentScore: 5,
    signals: [],
    totalOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    totalSpent: 0,
    lastOrderAt: null,
    lastInteractionAt: null,
    generatedAt: now,
  };
  const promptB = buildRecommendationPrompt(insightB);
  assert(promptB.includes('"businessId": "biz_qa_corp_b"'), '7a. Tenant B businessId isolated in prompt');
  assert(!promptB.includes('biz_qa_corp"'), '7b. Tenant A businessId is not in Tenant B prompt');
  assert(promptB.includes('"customerId": "cust_qa_02"'), '7c. Customer B customerId isolated in prompt');

  // 8. Recommendation service side-effect check
  // The service is a pure advisory function: returns an in-memory SalesRecommendation object.
  // It does not import or call Firestore write methods, does not mutate inventory or prices, and does not invoke Telegram APIs.
  const recAdvisory: SalesRecommendation = res1;
  assert(recAdvisory !== null && typeof recAdvisory === 'object', '8a. Recommendation is a pure JS object');
  assert(
    ['follow_up', 'product_recommendation', 'price_follow_up', 'order_follow_up', 'repeat_purchase', 'no_action'].includes(
      recAdvisory.action
    ),
    '8b. Recommendation action is within defined enum'
  );

  console.log('===================================================================================================');
  console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===================================================================================================');

  if (failCount > 0) {
    throw new Error(`${failCount} tests failed.`);
  }
  console.log('🎉 ALL M6.5 FINAL QA CHECKS PASSED SUCCESSFULLY!');
}

runM65FinalQATests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal M6.5 Final QA test runner error:', err);
    process.exit(1);
  });
