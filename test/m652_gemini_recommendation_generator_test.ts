import {
  GeminiRecommendationGenerator,
  buildRecommendationPrompt,
  parseRecommendationResponse,
  extractJsonFromText,
  FALLBACK_RECOMMENDATION
} from '../server/analytics/geminiRecommendationGenerator';
import { CustomerSalesInsight } from '../src/types/salesInsight';
import { GeminiClient } from '../server/ai/geminiClient';

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

// Mock Gemini Client for test isolation
class MockGeminiClient extends GeminiClient {
  private responseText: string = '';
  private willSucceed: boolean = true;
  private errMsg?: string;

  constructor(responseText: string, willSucceed: boolean = true, errMsg?: string) {
    super({ apiKey: 'mock_key' });
    this.responseText = responseText;
    this.willSucceed = willSucceed;
    this.errMsg = errMsg;
  }

  isConfigured(): boolean {
    return true;
  }

  async generateText(prompt: string): Promise<any> {
    if (!this.willSucceed) {
      return { success: false, errorMessage: this.errMsg || 'Simulated Gemini Error' };
    }
    return { success: true, text: this.responseText };
  }
}

async function runM652Tests() {
  console.log('===================================================================================================');
  console.log('🚀 M6.5 PART 2 — GEMINI RECOMMENDATION GENERATOR VERIFICATION');
  console.log('===================================================================================================');

  const now = 1790960000000;

  // Base Insights
  const highInsight: CustomerSalesInsight = {
    customerId: 'cust_hi_1',
    businessId: 'biz_a',
    intentLevel: 'high',
    intentScore: 85,
    signals: ['active_order', 'purchase_intent_detected'],
    totalOrders: 3,
    completedOrders: 2,
    cancelledOrders: 0,
    totalSpent: 15000000,
    lastOrderAt: now - 3600000,
    lastInteractionAt: now - 1800000,
    generatedAt: now,
  };

  const mediumInsight: CustomerSalesInsight = {
    customerId: 'cust_med_1',
    businessId: 'biz_a',
    intentLevel: 'medium',
    intentScore: 55,
    signals: ['price_inquiry_detected', 'product_inquiry_detected'],
    totalOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    totalSpent: 0,
    lastOrderAt: null,
    lastInteractionAt: now - 7200000,
    generatedAt: now,
  };

  const lowInsight: CustomerSalesInsight = {
    customerId: 'cust_low_1',
    businessId: 'biz_a',
    intentLevel: 'low',
    intentScore: 10,
    signals: [],
    totalOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    totalSpent: 0,
    lastOrderAt: null,
    lastInteractionAt: now - 86400000,
    generatedAt: now,
  };

  // -------------------------------------------------------------
  // Test 1: High intent → valid recommendation
  // -------------------------------------------------------------
  const highAiResponse = JSON.stringify({
    action: 'order_follow_up',
    reason: 'Mijozning faol buyurtmasi mavjud, yetkazib berish holati bo‘yicha xabar berish maqsadga muvofiq',
    confidence: 0.92,
  });
  const mockClientHigh = new MockGeminiClient(highAiResponse);
  const recHigh = await GeminiRecommendationGenerator.generateRecommendation(highInsight, mockClientHigh);

  assert(recHigh.action === 'order_follow_up', 'Test 1a: High intent action is order_follow_up');
  assert(recHigh.confidence === 0.92, 'Test 1b: Confidence is 0.92');
  assert(recHigh.reason.includes('faol buyurtmasi'), 'Test 1c: Reason mentions faol buyurtma');

  // -------------------------------------------------------------
  // Test 2: Medium intent → valid recommendation
  // -------------------------------------------------------------
  const medAiResponse = JSON.stringify({
    action: 'price_follow_up',
    reason: 'Mijoz narx so‘ragan ammo buyurtma bermagan, maxsus taklif yoki chegirma berish tavsiya etiladi',
    confidence: 0.81,
  });
  const mockClientMed = new MockGeminiClient(medAiResponse);
  const recMed = await GeminiRecommendationGenerator.generateRecommendation(mediumInsight, mockClientMed);

  assert(recMed.action === 'price_follow_up', 'Test 2a: Medium intent action is price_follow_up');
  assert(recMed.confidence === 0.81, 'Test 2b: Confidence is 0.81');

  // -------------------------------------------------------------
  // Test 3: Low intent → valid recommendation
  // -------------------------------------------------------------
  const lowAiResponse = JSON.stringify({
    action: 'no_action',
    reason: 'Mijozda xarid niyati past va hech qanday faol so‘rov yo‘q',
    confidence: 0.95,
  });
  const mockClientLow = new MockGeminiClient(lowAiResponse);
  const recLow = await GeminiRecommendationGenerator.generateRecommendation(lowInsight, mockClientLow);

  assert(recLow.action === 'no_action', 'Test 3a: Low intent action is no_action');
  assert(recLow.confidence === 0.95, 'Test 3b: Confidence is 0.95');

  // -------------------------------------------------------------
  // Test 4: Valid raw JSON parsing
  // -------------------------------------------------------------
  const rawJson = '{"action": "follow_up", "reason": "Suhbatni davom ettirish", "confidence": 0.85}';
  const parsedRaw = parseRecommendationResponse(rawJson);
  assert(parsedRaw.action === 'follow_up', 'Test 4a: Parsed raw JSON action is follow_up');
  assert(parsedRaw.confidence === 0.85, 'Test 4b: Parsed raw JSON confidence is 0.85');

  // -------------------------------------------------------------
  // Test 5: Markdown fenced JSON parsing (```json ... ```)
  // -------------------------------------------------------------
  const fencedJson = '```json\n{"action": "product_recommendation", "reason": "Yangi modelni taklif qilish", "confidence": 0.77}\n```';
  const parsedFenced = parseRecommendationResponse(fencedJson);
  assert(parsedFenced.action === 'product_recommendation', 'Test 5a: Markdown fenced action parsed successfully');
  assert(parsedFenced.confidence === 0.77, 'Test 5b: Markdown fenced confidence parsed successfully');

  // -------------------------------------------------------------
  // Test 6: Invalid JSON handling → Fallback
  // -------------------------------------------------------------
  const brokenJson = '{"action": "follow_up", "reason": "broken...';
  const parsedBroken = parseRecommendationResponse(brokenJson);
  assert(parsedBroken.action === 'no_action', 'Test 6a: Broken JSON falls back to no_action');
  assert(parsedBroken.confidence === 0, 'Test 6b: Broken JSON fallback confidence is 0');

  // -------------------------------------------------------------
  // Test 7: Invalid action handling → Fallback
  // -------------------------------------------------------------
  const invalidActionJson = '{"action": "send_spam_discount", "reason": "Spam yuborish", "confidence": 0.99}';
  const parsedInvalidAction = parseRecommendationResponse(invalidActionJson);
  assert(parsedInvalidAction.action === 'no_action', 'Test 7: Invalid action rejected and falls back to no_action');
  assert(parsedInvalidAction.confidence === 0, 'Test 7b: Fallback confidence is 0');

  // -------------------------------------------------------------
  // Test 8: Confidence > 1 handling → Fallback
  // -------------------------------------------------------------
  const overConfidenceJson = '{"action": "follow_up", "reason": "Too confident", "confidence": 1.45}';
  const parsedOver = parseRecommendationResponse(overConfidenceJson);
  assert(parsedOver.action === 'no_action', 'Test 8: Confidence > 1 falls back to no_action');
  assert(parsedOver.confidence === 0, 'Test 8b: Confidence reset to 0');

  // -------------------------------------------------------------
  // Test 9: Confidence < 0 handling → Fallback
  // -------------------------------------------------------------
  const underConfidenceJson = '{"action": "follow_up", "reason": "Negative", "confidence": -0.2}';
  const parsedUnder = parseRecommendationResponse(underConfidenceJson);
  assert(parsedUnder.action === 'no_action', 'Test 9: Confidence < 0 falls back to no_action');

  // -------------------------------------------------------------
  // Test 10: Gemini API failure handling → Fallback
  // -------------------------------------------------------------
  const failingClient = new MockGeminiClient('', false, 'API Rate Limit Exceeded');
  const failedRec = await GeminiRecommendationGenerator.generateRecommendation(highInsight, failingClient);
  assert(failedRec.action === 'no_action', 'Test 10a: Gemini failure safely falls back to no_action');
  assert(failedRec.confidence === 0, 'Test 10b: Gemini failure confidence is 0');
  assert(failedRec.reason.includes('AI tahlilida nosozlik'), 'Test 10c: Clean error message in reason');

  // -------------------------------------------------------------
  // Test 11: Empty / Missing insight data handling → Fallback
  // -------------------------------------------------------------
  const emptyRec1 = await GeminiRecommendationGenerator.generateRecommendation(null as any);
  assert(emptyRec1.action === 'no_action', 'Test 11a: Null insight falls back to no_action');

  const emptyRec2 = await GeminiRecommendationGenerator.generateRecommendation({} as any);
  assert(emptyRec2.action === 'no_action', 'Test 11b: Empty insight falls back to no_action');

  // -------------------------------------------------------------
  // Test 12: No hallucinated fields in prompt
  // -------------------------------------------------------------
  const prompt = buildRecommendationPrompt(highInsight);
  assert(prompt.includes('MIJOZ MA\'LUMOTLARI:'), 'Test 12a: Prompt contains customer data section');
  assert(prompt.includes('"customerId": "cust_hi_1"'), 'Test 12b: Prompt includes actual customerId');
  assert(prompt.includes('TAXMIN QILMANG'), 'Test 12c: Anti-hallucination constraint present');
  assert(prompt.includes('O\'YLAB TOPMANG'), 'Test 12d: No-fact-invention constraint present');

  // -------------------------------------------------------------
  // Test 13: Deterministic fallback structure
  // -------------------------------------------------------------
  assert(FALLBACK_RECOMMENDATION.action === 'no_action', 'Test 13a: Fallback action is no_action');
  assert(FALLBACK_RECOMMENDATION.confidence === 0, 'Test 13b: Fallback confidence is 0');
  assert(typeof FALLBACK_RECOMMENDATION.reason === 'string', 'Test 13c: Fallback reason is string');

  console.log('===================================================================================================');
  console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===================================================================================================');

  if (failCount > 0) {
    throw new Error(`${failCount} tests failed.`);
  }
  console.log('🎉 ALL 13 M6.5 PART 2 GEMINI RECOMMENDATION GENERATOR TESTS PASSED SUCCESSFULLY!');
}

runM652Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal M6.5 Part 2 test runner error:', err);
    process.exit(1);
  });
