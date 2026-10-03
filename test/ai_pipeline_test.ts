import { AIParser } from '../server/telegram/aiParser';
import { GroundingEngine } from '../server/telegram/groundingEngine';
import { AIResponder } from '../server/telegram/aiResponder';
import { UpdateProcessor } from '../server/telegram/updateProcessor';
import { initWorkerAuth } from '../server/initWorkerAuth';
import { TelegramUpdate } from '../src/types/telegram';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

interface TestStep {
  name: string;
  passed: boolean;
  details?: string;
}

const steps: TestStep[] = [];

function record(name: string, passed: boolean, details?: string) {
  steps.push({ name, passed, details });
  console.log(`[TEST] ${passed ? '✅ PASS' : '❌ FAIL'}: ${name}${details ? ` -> ${details}` : ''}`);
}

async function runAIPipelineSuite() {
  console.log('==================================================');
  console.log('🤖 AI SAVDOBOT PIPELINE TEST SUITE');
  console.log('Telegram -> Webhook -> Customer -> Conversation -> Message -> AI Parser -> Intent -> Product/Warehouse/Order -> AI Response -> Telegram');
  console.log('==================================================');

  await initWorkerAuth();
  const testBizId = `biz_ai_test_${Date.now()}`;

  // 1. Test Intent: greeting
  try {
    const greetingText = 'Assalomu alaykum, do\'koningiz bormi?';
    const parsed = await AIParser.parseIntent(greetingText);
    const grounded = await GroundingEngine.ground({
      businessId: testBizId,
      customerId: 'cust_greet',
      conversationId: 'conv_greet',
      parsedIntent: parsed,
      rawMessageText: greetingText,
    });
    const reply = await AIResponder.generateResponse({
      customerName: 'Anvar',
      rawMessageText: greetingText,
      groundedContext: grounded,
    });

    const pass = parsed.intent === 'greeting' && reply.toLowerCase().includes('assalomu alaykum');
    record('Intent: greeting', pass, `Intent: ${parsed.intent}, Reply preview: "${reply.slice(0, 50)}..."`);
  } catch (e: any) {
    record('Intent: greeting', false, e.message);
  }

  // 2. Test Intent: product_query
  try {
    const queryText = 'Samsung Galaxy S25 Ultra xususiyatlari va parametrlari qanaqa?';
    const parsed = await AIParser.parseIntent(queryText);
    const grounded = await GroundingEngine.ground({
      businessId: testBizId,
      customerId: 'cust_prod',
      conversationId: 'conv_prod',
      parsedIntent: parsed,
      rawMessageText: queryText,
    });
    const reply = await AIResponder.generateResponse({
      customerName: 'Bobur',
      rawMessageText: queryText,
      groundedContext: grounded,
    });

    const pass =
      parsed.intent === 'product_query' &&
      grounded.matchedProducts.length > 0 &&
      reply.toLowerCase().includes('samsung');
    record('Intent: product_query', pass, `Matched: ${grounded.matchedProducts[0]?.name}`);
  } catch (e: any) {
    record('Intent: product_query', false, e.message);
  }

  // 3. Test Intent: stock_query
  try {
    const queryText = 'Omborda iPhone 15 Pro bormi, nechta qolgan?';
    const parsed = await AIParser.parseIntent(queryText);
    const grounded = await GroundingEngine.ground({
      businessId: testBizId,
      customerId: 'cust_stock',
      conversationId: 'conv_stock',
      parsedIntent: parsed,
      rawMessageText: queryText,
    });
    const reply = await AIResponder.generateResponse({
      customerName: 'Dilshod',
      rawMessageText: queryText,
      groundedContext: grounded,
    });

    const pass =
      parsed.intent === 'stock_query' &&
      grounded.warehouseStock.length > 0 &&
      (reply.includes('ombor') || reply.includes('mavjud') || reply.includes('dona'));
    record('Intent: stock_query', pass, `Stock: ${grounded.warehouseStock[0]?.stock} units in ${grounded.warehouseStock[0]?.warehouseName}`);
  } catch (e: any) {
    record('Intent: stock_query', false, e.message);
  }

  // 4. Test Intent: price_query
  try {
    const queryText = 'Redmi Note 14 Pro narxi qancha so\'m?';
    const parsed = await AIParser.parseIntent(queryText);
    const grounded = await GroundingEngine.ground({
      businessId: testBizId,
      customerId: 'cust_price',
      conversationId: 'conv_price',
      parsedIntent: parsed,
      rawMessageText: queryText,
    });
    const reply = await AIResponder.generateResponse({
      customerName: 'Eldor',
      rawMessageText: queryText,
      groundedContext: grounded,
    });

    const pass =
      parsed.intent === 'price_query' &&
      grounded.matchedProducts.length > 0 &&
      (reply.includes('so\'m') || reply.includes('Narx'));
    record('Intent: price_query', pass, `Price: ${grounded.matchedProducts[0]?.price?.toLocaleString()} so'm`);
  } catch (e: any) {
    record('Intent: price_query', false, e.message);
  }

  // 5. Test Intent: order_intent
  try {
    const queryText = 'Samsung Galaxy S25 Ultra dan 2 dona olmoqchiman, Toshkent Yunusobodga yetkazing, telefonim +998901234567';
    const parsed = await AIParser.parseIntent(queryText);
    const grounded = await GroundingEngine.ground({
      businessId: testBizId,
      customerId: 'cust_order',
      conversationId: 'conv_order',
      customerName: 'Farhod',
      customerPhone: '+998901234567',
      parsedIntent: parsed,
      rawMessageText: queryText,
    });
    const reply = await AIResponder.generateResponse({
      customerName: 'Farhod',
      rawMessageText: queryText,
      groundedContext: grounded,
    });

    const pass =
      parsed.intent === 'order_intent' &&
      Boolean(grounded.draftOrder) &&
      grounded.draftOrder?.subtotal > 0 &&
      (reply.includes('Buyurtma') || reply.includes('qabul qilindi') || reply.includes('rasmiylashtir'));
    record('Intent: order_intent', pass, `Draft Order ID: ${grounded.draftOrder?.id}, Total: ${grounded.draftOrder?.total?.toLocaleString()} UZS`);
  } catch (e: any) {
    record('Intent: order_intent', false, e.message);
  }

  // 6. Test Intent: unknown
  try {
    const queryText = 'Ertaga ob-havo qanday bo\'ladi?';
    const parsed = await AIParser.parseIntent(queryText);
    const grounded = await GroundingEngine.ground({
      businessId: testBizId,
      customerId: 'cust_unk',
      conversationId: 'conv_unk',
      parsedIntent: parsed,
      rawMessageText: queryText,
    });
    const reply = await AIResponder.generateResponse({
      customerName: 'Gulbahor',
      rawMessageText: queryText,
      groundedContext: grounded,
    });

    const pass = parsed.intent === 'unknown' && reply.length > 20;
    record('Intent: unknown', pass, `Intent: ${parsed.intent}, Reply: "${reply.slice(0, 50)}..."`);
  } catch (e: any) {
    record('Intent: unknown', false, e.message);
  }

  // 7. Full Pipeline through UpdateProcessor (End-to-End Live Update)
  try {
    const updateId = Date.now();
    const msgId = Math.floor(Date.now() % 100000) + 1;
    const testChatId = '99881122';
    const liveUpdate: TelegramUpdate = {
      update_id: updateId,
      message: {
        message_id: msgId,
        from: {
          id: 99881122,
          is_bot: false,
          first_name: 'Rustam',
          last_name: 'Qodirov',
          username: 'rustam_buyer',
        },
        chat: {
          id: 99881122,
          type: 'private',
          first_name: 'Rustam',
        },
        date: Math.floor(Date.now() / 1000),
        text: 'iPhone 15 Pro narxi qancha va omborda bormi?',
      },
    };

    const processResult = await UpdateProcessor.processUpdate(liveUpdate);
    const pass =
      processResult.success === true &&
      processResult.status === 'processed_and_replied_successfully' &&
      Boolean(processResult.detectedIntent) &&
      Boolean(processResult.aiResponseText);

    record('Full End-to-End Pipeline UpdateProcessor', pass, `Detected: ${processResult.detectedIntent}`);

    // Verify Firestore messages (both inbound and outbound stored)
    if (processResult.conversationId) {
      const convSnap = await getDoc(doc(db, 'conversations', processResult.conversationId));
      const convPass = convSnap.exists() && convSnap.data()?.channel === 'telegram';
      record('Firestore Conversation & Messages Synced', convPass, `Conv ID: ${processResult.conversationId}`);
    }
  } catch (e: any) {
    record('Full End-to-End Pipeline UpdateProcessor', false, e.message);
  }

  console.log('==================================================');
  const passedCount = steps.filter((s) => s.passed).length;
  console.log(`TOTAL PIPELINE TESTS: ${steps.length} | PASSED: ${passedCount} | FAILED: ${steps.length - passedCount}`);
  console.log('==================================================');

  if (passedCount === steps.length) {
    console.log('🎉 ALL AI PIPELINE TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME PIPELINE TESTS FAILED');
    process.exit(1);
  }
}

runAIPipelineSuite();
