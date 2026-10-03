import { UpdateProcessor } from '../server/telegram/updateProcessor';
import { TelegramClient } from '../server/telegram/telegramClient';
import { BusinessResolver } from '../server/telegram/businessResolver';
import { initWorkerAuth } from '../server/initWorkerAuth';
import { TelegramUpdate } from '../src/types/telegram';
import { Product } from '../src/types';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../src/lib/firebase';
import { IntentParser, ParsedIntent } from '../server/ai/intentParser';
import { ReplyGenerator } from '../server/ai/replyGenerator';
import { GeminiClient } from '../server/ai/geminiClient';

interface QAResult {
  num: number;
  category: string;
  name: string;
  passed: boolean;
  details?: string;
}

const qaResults: QAResult[] = [];

function record(num: number, category: string, name: string, condition: boolean, details?: string) {
  qaResults.push({ num, category, name, passed: condition, details });
  console.log(`[QA ${num}] [${category}] ${condition ? '✅ PASS' : '❌ FAIL'}: ${name}${details ? ` -> ${details}` : ''}`);
}

async function runProductionQA() {
  console.log('===============================================================');
  console.log('🛡️ M3.5 PRODUCTION TELEGRAM QA & VERIFICATION SUITE');
  console.log('Target Firebase: ai-savdobot | QA Simulation (Mocked Gemini + TG)');
  console.log('===============================================================');

  // Authenticate backend worker
  await initWorkerAuth();

  const bizA = `biz_qa_A_${Date.now()}`;
  const bizB = `biz_qa_B_${Date.now()}`;

  // Telegram capture
  const outboundTelegramCapture: Array<{ chatId: string | number; text: string }> = [];

  TelegramClient.setMockSender(async (chatId, text) => {
    outboundTelegramCapture.push({ chatId, text });
    return {
      ok: true,
      result: {
        message_id: Math.floor(Math.random() * 800000) + 200000,
        chat: { id: chatId },
        text,
      },
    };
  });

  // Seed sample products for Biz A
  const iphoneA: Product = {
    id: `prod_qa_iph15_${Date.now()}`,
    businessId: bizA,
    warehouseId: 'wh_main',
    name: 'iPhone 15 Pro 256GB',
    sku: 'IPH-15P-256',
    category: 'Smartphones',
    brand: 'Apple',
    model: '15 Pro',
    description: 'Black Titanium',
    price: 13000000,
    costPrice: 11000000,
    stock: 7,
    lowStockThreshold: 2,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const macbookOutOfStockA: Product = {
    id: `prod_qa_mbp_out_${Date.now()}`,
    businessId: bizA,
    warehouseId: 'wh_main',
    name: 'MacBook Air M2 8GB',
    sku: 'MBA-M2-8',
    category: 'Laptops',
    brand: 'Apple',
    model: 'Air M2',
    description: 'Midnight',
    price: 10500000,
    costPrice: 9000000,
    stock: 0, // OUT OF STOCK
    lowStockThreshold: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const watchVariant1A: Product = {
    id: `prod_qa_watch1_${Date.now()}`,
    businessId: bizA,
    warehouseId: 'wh_main',
    name: 'Apple Watch Series 9 41mm',
    sku: 'AW9-41',
    category: 'Wearables',
    brand: 'Apple',
    model: 'Series 9',
    description: '41mm Midnight',
    price: 4800000,
    costPrice: 4000000,
    stock: 3,
    lowStockThreshold: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const watchVariant2A: Product = {
    id: `prod_qa_watch2_${Date.now()}`,
    businessId: bizA,
    warehouseId: 'wh_main',
    name: 'Apple Watch Series 9 45mm',
    sku: 'AW9-45',
    category: 'Wearables',
    brand: 'Apple',
    model: 'Series 9',
    description: '45mm Midnight',
    price: 5200000,
    costPrice: 4300000,
    stock: 4,
    lowStockThreshold: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Seed product for Biz B (different price & stock)
  const iphoneB: Product = {
    id: `prod_qa_iph15_b_${Date.now()}`,
    businessId: bizB,
    warehouseId: 'wh_bizb',
    name: 'iPhone 15 Pro 256GB',
    sku: 'BIZB-15P-256',
    category: 'Smartphones',
    brand: 'Apple',
    model: '15 Pro',
    description: 'White Titanium Biz B',
    price: 14200000, // Different price!
    costPrice: 12000000,
    stock: 18,       // Different stock!
    lowStockThreshold: 3,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await setDoc(doc(db, 'businesses', bizA, 'products', iphoneA.id), iphoneA);
  await setDoc(doc(db, 'businesses', bizA, 'products', macbookOutOfStockA.id), macbookOutOfStockA);
  await setDoc(doc(db, 'businesses', bizA, 'products', watchVariant1A.id), watchVariant1A);
  await setDoc(doc(db, 'businesses', bizA, 'products', watchVariant2A.id), watchVariant2A);
  await setDoc(doc(db, 'businesses', bizB, 'products', iphoneB.id), iphoneB);

  BusinessResolver.setExplicitBusiness(bizA);

  function createTgUpdate(text: string, updateId?: number, userId = 99881122): TelegramUpdate {
    return {
      update_id: updateId || (Date.now() + Math.floor(Math.random() * 1000000)),
      message: {
        message_id: Math.floor(Math.random() * 900000) + 10000,
        from: {
          id: userId,
          is_bot: false,
          first_name: 'QATester',
          last_name: 'Client',
          username: 'qa_real_client',
        },
        chat: {
          id: userId,
          type: 'private',
          first_name: 'QATester',
        },
        date: Math.floor(Date.now() / 1000),
        text,
      },
    };
  }

  // Realistic mock engine for Gemini (Intent parsing & grounded reply generation)
  function setupMockGemini() {
    const mockGemini = new GeminiClient({ apiKey: 'mock' });
    (mockGemini as any).generateText = async (prompt: string) => {
      // 1. Intent Parser call
      if (prompt.includes('retail intent extraction engine')) {
        const textMatch = prompt.match(/Customer message:\s*"([^"]+)"/i);
        const text = textMatch ? textMatch[1].toLowerCase() : '';

        if (text.includes('assalom') || text.includes('salom')) {
          return {
            success: true,
            text: JSON.stringify({ intent: 'greeting', product_name: null, quantity: null, confidence: 0.99, language: 'uz' }),
          };
        }
        if (text.includes('здравствуйте') || text.includes('есть ли')) {
          return {
            success: true,
            text: JSON.stringify({ intent: 'product_query', product_name: 'iPhone 15 Pro 256GB', quantity: null, confidence: 0.97, language: 'ru' }),
          };
        }
        if (text.includes('hello') || text.includes('do you have')) {
          return {
            success: true,
            text: JSON.stringify({ intent: 'product_query', product_name: 'iPhone 15 Pro 256GB', quantity: null, confidence: 0.98, language: 'en' }),
          };
        }
        if (text.includes('narxi') || text.includes('qancha')) {
          return {
            success: true,
            text: JSON.stringify({ intent: 'price_query', product_name: 'iPhone 15 Pro 256GB', quantity: null, confidence: 0.98, language: 'uz' }),
          };
        }
        if (text.includes('nechta')) {
          return {
            success: true,
            text: JSON.stringify({ intent: 'stock_query', product_name: 'iPhone 15 Pro 256GB', quantity: null, confidence: 0.97, language: 'uz' }),
          };
        }
        if (text.includes('galaxy fold 99')) {
          return {
            success: true,
            text: JSON.stringify({ intent: 'product_query', product_name: 'Galaxy Fold 99 Ultra', quantity: null, confidence: 0.95, language: 'uz' }),
          };
        }
        if (text.includes('apple watch series 9')) {
          return {
            success: true,
            text: JSON.stringify({ intent: 'product_query', product_name: 'Apple Watch Series 9', quantity: null, confidence: 0.96, language: 'uz' }),
          };
        }
        if (text.includes('macbook')) {
          return {
            success: true,
            text: JSON.stringify({ intent: 'product_query', product_name: 'MacBook Air M2 8GB', quantity: null, confidence: 0.96, language: 'uz' }),
          };
        }
        if (text.includes('iphone 15 pro 256gb')) {
          return {
            success: true,
            text: JSON.stringify({ intent: 'product_query', product_name: 'iPhone 15 Pro 256GB', quantity: null, confidence: 0.98, language: 'uz' }),
          };
        }
        return {
          success: true,
          text: JSON.stringify({ intent: 'unknown', product_name: null, quantity: null, confidence: 0.8, language: 'uz' }),
        };
      }

      // 2. Reply Generator call
      if (prompt.includes('TRUSTED BACKEND DATA')) {
        // Extract backend data from prompt
        const jsonMatch = prompt.match(/TRUSTED BACKEND DATA \(JSON\):\s*(\{[\s\S]*?\})\s*STRICT SAFETY/);
        let backendData: any = {};
        if (jsonMatch) {
          try {
            backendData = JSON.parse(jsonMatch[1]);
          } catch {}
        }

        const lang = prompt.includes('Russian') ? 'ru' : prompt.includes('English') ? 'en' : 'uz';

        if (backendData.detected_intent === 'greeting') {
          return {
            success: true,
            text: JSON.stringify({ reply: 'Assalomu alaykum! Do\'konimizga xush kelibsiz. Sizga qanday yordam bera olamiz?', language: 'uz' }),
          };
        }

        if (backendData.resolution_status === 'not_found') {
          return {
            success: true,
            text: JSON.stringify({ reply: `Kechirasiz, "${backendData.queried_product_name}" do'konimizda topilmadi.`, language: 'uz' }),
          };
        }

        if (backendData.resolution_status === 'ambiguous') {
          const variants = backendData.matching_candidates?.map((c: any) => c.name).join(' va ') || 'bir nechta variant';
          return {
            success: true,
            text: JSON.stringify({ reply: `Bizda ${variants} variantlari mavjud. Qaysi biri sizga ma'qul?`, language: 'uz' }),
          };
        }

        if (backendData.resolution_status === 'resolved') {
          const prod = backendData.resolved_product?.name || '';
          const stock = backendData.stock?.quantity ?? 0;
          const price = backendData.price?.amount ? backendData.price.amount.toLocaleString().replace(/,/g, ' ') : null;

          if (stock <= 0) {
            return {
              success: true,
              text: JSON.stringify({ reply: `Kechirasiz, ${prod} hozirda omborimizda tugagan.`, language: lang }),
            };
          }

          if (lang === 'ru') {
            return {
              success: true,
              text: JSON.stringify({ reply: `Здравствуйте! Да, ${prod} есть в наличии (${stock} шт.). Цена: ${price} сум.`, language: 'ru' }),
            };
          }

          if (lang === 'en') {
            return {
              success: true,
              text: JSON.stringify({ reply: `Hello! Yes, ${prod} is available in stock (${stock} units) for ${price} UZS.`, language: 'en' }),
            };
          }

          if (backendData.detected_intent === 'price_query') {
            return {
              success: true,
              text: JSON.stringify({ reply: `${prod} narxi ${price} so'm.`, language: 'uz' }),
            };
          }

          if (backendData.detected_intent === 'stock_query') {
            return {
              success: true,
              text: JSON.stringify({ reply: `Hozirda omborimizda ${stock} dona ${prod} mavjud.`, language: 'uz' }),
            };
          }

          return {
            success: true,
            text: JSON.stringify({ reply: `Ha, ${prod} mavjud. Omborda ${stock} dona bor, narxi ${price} so'm.`, language: 'uz' }),
          };
        }

        return {
          success: true,
          text: JSON.stringify({ reply: 'Sizga qanday yordam bera olaman?', language: 'uz' }),
        };
      }

      return { success: false, errorCode: 'UNKNOWN_PROMPT' };
    };

    UpdateProcessor.setIntentParser(new IntentParser(mockGemini));
    UpdateProcessor.setReplyGenerator(new ReplyGenerator(mockGemini));
  }

  setupMockGemini();

  // --- SECTION 1: 10 REAL TELEGRAM USER SCENARIOS ---

  // Scenario 1: Customer sends: "Assalomu alaykum"
  {
    outboundTelegramCapture.length = 0;
    const res = await UpdateProcessor.processUpdate(createTgUpdate('Assalomu alaykum'));
    const sent = outboundTelegramCapture[outboundTelegramCapture.length - 1];
    record(
      1,
      'User Scenario',
      'Greeting: "Assalomu alaykum"',
      res.success && res.detectedIntent === 'greeting' && res.telegramReplySent === true && Boolean(sent && sent.text.includes('Assalomu alaykum')),
      `Reply: ${sent?.text}`
    );
  }

  // Scenario 2: Customer asks: "iPhone 15 Pro 256GB bormi?"
  {
    outboundTelegramCapture.length = 0;
    const res = await UpdateProcessor.processUpdate(createTgUpdate('iPhone 15 Pro 256GB bormi?'));
    const sent = outboundTelegramCapture[outboundTelegramCapture.length - 1];
    record(
      2,
      'User Scenario',
      'Product Query: "iPhone 15 Pro 256GB bormi?"',
      res.success && res.productResolution?.status === 'resolved' && res.telegramReplySent === true && Boolean(sent && sent.text.includes('13 000 000') && sent.text.includes('7 dona')),
      `Reply: ${sent?.text}`
    );
  }

  // Scenario 3: Customer asks: "iPhone 15 Pro 256GB narxi qancha?"
  {
    outboundTelegramCapture.length = 0;
    const res = await UpdateProcessor.processUpdate(createTgUpdate('iPhone 15 Pro 256GB narxi qancha?'));
    const sent = outboundTelegramCapture[outboundTelegramCapture.length - 1];
    record(
      3,
      'User Scenario',
      'Price Query: "iPhone 15 Pro 256GB narxi qancha?"',
      res.success && res.productResolution?.status === 'resolved' && res.telegramReplySent === true && Boolean(sent && sent.text.includes('13 000 000')),
      `Reply: ${sent?.text}`
    );
  }

  // Scenario 4: Customer asks: "Nechta bor?"
  {
    outboundTelegramCapture.length = 0;
    const res = await UpdateProcessor.processUpdate(createTgUpdate('iPhone 15 Pro 256GB nechta bor?'));
    const sent = outboundTelegramCapture[outboundTelegramCapture.length - 1];
    record(
      4,
      'User Scenario',
      'Stock Query: "iPhone 15 Pro 256GB nechta bor?"',
      res.success && res.productResolution?.status === 'resolved' && res.telegramReplySent === true && Boolean(sent && sent.text.includes('7 dona')),
      `Reply: ${sent?.text}`
    );
  }

  // Scenario 5: Customer asks for a nonexistent product
  {
    outboundTelegramCapture.length = 0;
    const res = await UpdateProcessor.processUpdate(createTgUpdate('Galaxy Fold 99 Ultra bormi?'));
    const sent = outboundTelegramCapture[outboundTelegramCapture.length - 1];
    record(
      5,
      'User Scenario',
      'Nonexistent Product: "Galaxy Fold 99 Ultra bormi?"',
      res.success && res.productResolution?.status === 'not_found' && res.telegramReplySent === true && Boolean(sent && sent.text.includes('topilmadi')),
      `Reply: ${sent?.text}`
    );
  }

  // Scenario 6: Customer asks for a product with multiple variants
  {
    outboundTelegramCapture.length = 0;
    const res = await UpdateProcessor.processUpdate(createTgUpdate('Apple Watch Series 9 bormi?'));
    const sent = outboundTelegramCapture[outboundTelegramCapture.length - 1];
    record(
      6,
      'User Scenario',
      'Multiple Variants Ambiguity: "Apple Watch Series 9 bormi?"',
      res.success && res.productResolution?.status === 'ambiguous' && res.telegramReplySent === true && Boolean(sent && sent.text.includes('41mm') && sent.text.includes('45mm')),
      `Reply: ${sent?.text}`
    );
  }

  // Scenario 7: Customer asks in Russian
  {
    outboundTelegramCapture.length = 0;
    const res = await UpdateProcessor.processUpdate(createTgUpdate('Здравствуйте, есть ли iPhone 15 Pro 256GB?'));
    const sent = outboundTelegramCapture[outboundTelegramCapture.length - 1];
    record(
      7,
      'User Scenario',
      'Russian Customer: "Здравствуйте, есть ли iPhone 15 Pro 256GB?"',
      res.success && res.telegramReplySent === true && Boolean(sent && sent.text.includes('Здравствуйте') && sent.text.includes('наличии')),
      `Reply: ${sent?.text}`
    );
  }

  // Scenario 8: Customer asks in English
  {
    outboundTelegramCapture.length = 0;
    const res = await UpdateProcessor.processUpdate(createTgUpdate('Hello, do you have iPhone 15 Pro 256GB in stock?'));
    const sent = outboundTelegramCapture[outboundTelegramCapture.length - 1];
    record(
      8,
      'User Scenario',
      'English Customer: "Hello, do you have iPhone 15 Pro 256GB in stock?"',
      res.success && res.telegramReplySent === true && Boolean(sent && sent.text.includes('Hello') && sent.text.includes('available')),
      `Reply: ${sent?.text}`
    );
  }

  // Scenario 9: Customer asks about an out-of-stock product
  {
    outboundTelegramCapture.length = 0;
    const res = await UpdateProcessor.processUpdate(createTgUpdate('MacBook Air M2 8GB bormi?'));
    const sent = outboundTelegramCapture[outboundTelegramCapture.length - 1];
    record(
      9,
      'User Scenario',
      'Out of stock product: "MacBook Air M2 8GB bormi?"',
      res.success && res.telegramReplySent === true && Boolean(sent && sent.text.includes('tugagan')),
      `Reply: ${sent?.text}`
    );
  }

  // Scenario 10: Send the same Telegram update twice and verify only one response
  {
    outboundTelegramCapture.length = 0;
    const uniqueUpdateId = Date.now() + Math.floor(Math.random() * 1000000);
    const upd1 = createTgUpdate('Idempotency test message', uniqueUpdateId);
    const upd2 = createTgUpdate('Idempotency test message', uniqueUpdateId);

    const res1 = await UpdateProcessor.processUpdate(upd1);
    const res2 = await UpdateProcessor.processUpdate(upd2);

    record(
      10,
      'User Scenario',
      'Duplicate update -> exactly ONE Telegram response',
      res1.telegramReplySent === true && res2.isDuplicate === true && res2.telegramReplySent === undefined && outboundTelegramCapture.length === 1,
      `Replies sent: ${outboundTelegramCapture.length}`
    );
  }

  // --- SECTION 2: FIRESTORE INTEGRITY VERIFICATION ---

  {
    // Check conversation, incoming message, and outgoing message
    const lastUpdateId = Date.now() + Math.floor(Math.random() * 1000000);
    const res = await UpdateProcessor.processUpdate(createTgUpdate('iPhone 15 Pro 256GB bormi?', lastUpdateId, 99881122));

    let customerValid = false;
    let convValid = false;
    let inMsgValid = false;
    let outMsgValid = false;
    let noUndefinedInDocs = true;
    let noSecretsFound = true;

    if (res.customerId && res.conversationId && res.inboundMessageId && res.outboundMessageId) {
      // 1. Customer
      const custSnap = await getDoc(doc(db, 'customers', res.customerId));
      customerValid = custSnap.exists() && custSnap.data()?.telegramUserId === '99881122';

      // 2. Conversation
      const convSnap = await getDoc(doc(db, 'conversations', res.conversationId));
      convValid = convSnap.exists() && convSnap.data()?.businessId === bizA;

      // 3. Inbound message
      const inSnap = await getDoc(doc(db, 'conversations', res.conversationId, 'messages', res.inboundMessageId));
      const inData = inSnap.data();
      inMsgValid = inSnap.exists() && inData?.direction === 'inbound' && inData?.aiProcessed === true && inData?.aiProductResolution === 'resolved';

      // 4. Outbound message
      const outSnap = await getDoc(doc(db, 'conversations', res.conversationId, 'messages', res.outboundMessageId));
      const outData = outSnap.data();
      outMsgValid = outSnap.exists() && outData?.direction === 'outbound' && Boolean(outData?.text);

      // 5. Undefined check across documents
      const allDocs = [custSnap.data() || {}, convSnap.data() || {}, inData || {}, outData || {}];
      for (const d of allDocs) {
        for (const [k, v] of Object.entries(d)) {
          if (v === undefined) noUndefinedInDocs = false;
        }
      }

      // 6. Secrets check
      const serialized = JSON.stringify(allDocs);
      if (process.env.GEMINI_API_KEY && serialized.includes(process.env.GEMINI_API_KEY)) noSecretsFound = false;
      if (process.env.TELEGRAM_BOT_TOKEN && serialized.includes(process.env.TELEGRAM_BOT_TOKEN)) noSecretsFound = false;
    }

    record(11, 'Firestore Integrity', 'Customer & Conversation created properly', customerValid && convValid);
    record(12, 'Firestore Integrity', 'Inbound & Outbound messages stored with AI data', inMsgValid && outMsgValid);
    record(13, 'Firestore Integrity', 'Zero undefined fields & Zero secrets leaked', noUndefinedInDocs && noSecretsFound);
  }

  // --- SECTION 3: MULTI-TENANCY VERIFICATION ---

  {
    outboundTelegramCapture.length = 0;

    // Inquire Business A
    BusinessResolver.setExplicitBusiness(bizA);
    await UpdateProcessor.processUpdate(createTgUpdate('iPhone 15 Pro 256GB narxi qancha?', undefined, 111111));
    const replyA = outboundTelegramCapture[outboundTelegramCapture.length - 1];

    // Inquire Business B (Has price 14,200,000 and stock 18)
    BusinessResolver.setExplicitBusiness(bizB);
    await UpdateProcessor.processUpdate(createTgUpdate('iPhone 15 Pro 256GB narxi qancha?', undefined, 222222));
    const replyB = outboundTelegramCapture[outboundTelegramCapture.length - 1];

    const passTenantPrices =
      replyA &&
      replyB &&
      replyA.text.includes('13 000 000') &&
      replyB.text.includes('14 200 000') &&
      !replyA.text.includes('14 200 000') &&
      !replyB.text.includes('13 000 000');

    record(14, 'Multi-Tenancy', 'Strict cross-tenant price isolation', Boolean(passTenantPrices), `Biz A: ${replyA?.text} | Biz B: ${replyB?.text}`);

    // Inquire stock on Business A (7) vs Business B (18)
    BusinessResolver.setExplicitBusiness(bizA);
    await UpdateProcessor.processUpdate(createTgUpdate('iPhone 15 Pro 256GB nechta bor?', undefined, 111111));
    const stockReplyA = outboundTelegramCapture[outboundTelegramCapture.length - 1];

    BusinessResolver.setExplicitBusiness(bizB);
    await UpdateProcessor.processUpdate(createTgUpdate('iPhone 15 Pro 256GB nechta bor?', undefined, 222222));
    const stockReplyB = outboundTelegramCapture[outboundTelegramCapture.length - 1];

    const passTenantStocks =
      stockReplyA &&
      stockReplyB &&
      stockReplyA.text.includes('7 dona') &&
      stockReplyB.text.includes('18 dona');

    record(15, 'Multi-Tenancy', 'Strict cross-tenant stock isolation', Boolean(passTenantStocks), `Biz A: ${stockReplyA?.text} | Biz B: ${stockReplyB?.text}`);

    BusinessResolver.setExplicitBusiness(bizA);
  }

  // --- SECTION 4: FAILURE CASES & RESILIENCE ---

  // Failure Case 1: Gemini outage / API failure
  {
    outboundTelegramCapture.length = 0;
    const failingGemini = new GeminiClient({ apiKey: 'mock' });
    (failingGemini as any).generateText = async () => ({
      success: false,
      errorCode: 'UNAVAILABLE',
      errorMessage: 'Service temporarily overloaded (503)',
    });

    UpdateProcessor.setIntentParser(new IntentParser(failingGemini));
    UpdateProcessor.setReplyGenerator(new ReplyGenerator(failingGemini));

    const res = await UpdateProcessor.processUpdate(createTgUpdate('Salom'));
    const sent = outboundTelegramCapture[outboundTelegramCapture.length - 1];

    record(
      16,
      'Failure Resilience',
      'Gemini unavailable -> Deterministic fallback sent safely',
      res.success === true && res.telegramReplySent === true && Boolean(sent && sent.text.length > 5),
      `Fallback delivered: ${sent?.text}`
    );
  }

  // Failure Case 2: Telegram API failure (504 timeout)
  {
    TelegramClient.setMockSender(async () => {
      return { ok: false, error: 'Telegram gateway timeout 504' };
    });

    const res = await UpdateProcessor.processUpdate(createTgUpdate('Test TG network crash'));

    record(
      17,
      'Failure Resilience',
      'Telegram API failure -> Webhook survives without throwing',
      res.success === true && res.telegramReplySent === false,
      `Status: ${res.status}`
    );
  }

  console.log('===============================================================');
  const passed = qaResults.filter((r) => r.passed).length;
  console.log(`TOTAL QA CHECKS: ${qaResults.length} | PASSED: ${passed} | FAILED: ${qaResults.length - passed}`);
  console.log('===============================================================');

  if (passed === qaResults.length) {
    console.log('🎉 ALL 17 M3.5 PRODUCTION QA SCENARIOS PASSED WITH ZERO ERRORS!');
    process.exit(0);
  } else {
    console.error('❌ SOME QA SCENARIOS FAILED');
    process.exit(1);
  }
}

runProductionQA();
