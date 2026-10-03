import { UpdateProcessor } from '../server/telegram/updateProcessor';
import { IntentParser } from '../server/ai/intentParser';
import { GeminiClient } from '../server/ai/geminiClient';
import { TelegramClient } from '../server/telegram/telegramClient';
import { BusinessResolver } from '../server/telegram/businessResolver';
import { initWorkerAuth } from '../server/initWorkerAuth';
import { PendingConfirmationService } from '../server/orders/pendingConfirmationService';
import { CustomerService } from '../src/services/customerService';
import { ConversationService } from '../src/services/conversationService';
import { TelegramUpdate } from '../src/types/telegram';
import { Product } from '../src/types';
import { doc, getDoc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
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
  console.log(`[M4.3.2 TEST ${num}] ${condition ? '✅ PASS' : '❌ FAIL'}: ${name}${details ? ` -> ${details}` : ''}`);
}

async function runM432Tests() {
  console.log('===============================================================');
  console.log('📦 M4.3.2 ORDER CONFIRMATION HANDLER TESTS');
  console.log('(Mocked Telegram Client, Mocked Gemini, Real/Sandbox Firestore)');
  console.log('===============================================================');

  await initWorkerAuth();

  const timestamp = Date.now();
  const testBizA = `biz_m432_A_${timestamp}`;
  const testBizB = `biz_m432_B_${timestamp}`;

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
    id: `prod_m432_1_${timestamp}`,
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
    stock: 10,
    lowStockThreshold: 2,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const productB1: Product = {
    id: `prod_m432_b1_${timestamp}`,
    businessId: testBizB,
    warehouseId: 'wh_b',
    name: 'iPhone 15 Pro 256GB',
    sku: 'IPH-15P-256',
    category: 'Smartphones',
    brand: 'Apple',
    model: '15 Pro',
    description: 'Biz B item',
    price: 14500000,
    costPrice: 12000000,
    stock: 15,
    lowStockThreshold: 2,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await setDoc(doc(db, 'businesses', testBizA, 'products', productA1.id), productA1);
  await setDoc(doc(db, 'businesses', testBizB, 'products', productB1.id), productB1);

  BusinessResolver.setExplicitBusiness(testBizA);

  const mockGemini = new GeminiClient({ apiKey: 'mock' });
  const parser = new IntentParser(mockGemini);
  UpdateProcessor.setIntentParser(parser);

  // Initial order count for testBizA
  const ordersSnapBefore = await getDocs(
    query(collection(db, 'orders'), where('businessId', '==', testBizA))
  );
  const orderCountBefore = ordersSnapBefore.size;

  // Helper to setup a pending confirmation for a customer
  async function setupPending(userId: number, quantity = 2, biz = testBizA) {
    const custId = CustomerService.getCustomerId(biz, String(userId));
    const convId = ConversationService.getConversationId(biz, String(userId));
    return await PendingConfirmationService.createPendingConfirmation({
      businessId: biz,
      customerId: custId,
      conversationId: convId,
      productId: productA1.id,
      productName: productA1.name,
      sku: productA1.sku || null,
      quantity,
      unitPrice: productA1.price,
      currency: "so'm",
    });
  }

  // 1. Uzbek "ha" confirmation
  {
    await setupPending(8001);

    const update: TelegramUpdate = {
      update_id: timestamp + 101,
      message: {
        message_id: 201,
        from: { id: 8001, is_bot: false, first_name: 'Anvar' },
        chat: { id: 8001, type: 'private' },
        date: Math.floor(timestamp / 1000),
        text: 'ha',
      },
    };

    const res = await UpdateProcessor.processUpdate(update);
    const pass =
      res.success === true &&
      res.pendingConfirmation?.status === 'confirmed' &&
      res.pendingConfirmation?.confirmedAt !== undefined &&
      res.aiResponseText?.toLowerCase().includes('tasdiqlandi');

    assert(1, 'Uzbek "ha" confirms pending confirmation', Boolean(pass), `Status: ${res.pendingConfirmation?.status}`);
  }

  // 2. Uzbek "tasdiqlayman" confirmation
  {
    await setupPending(8002);

    const update: TelegramUpdate = {
      update_id: timestamp + 102,
      message: {
        message_id: 202,
        from: { id: 8002, is_bot: false, first_name: 'Bekzod' },
        chat: { id: 8002, type: 'private' },
        date: Math.floor(timestamp / 1000),
        text: 'tasdiqlayman',
      },
    };

    const res = await UpdateProcessor.processUpdate(update);
    assert(2, 'Uzbek "tasdiqlayman" confirms pending confirmation', res.pendingConfirmation?.status === 'confirmed', `Status: ${res.pendingConfirmation?.status}`);
  }

  // 3. Russian "да" confirmation
  {
    await setupPending(8003);

    const update: TelegramUpdate = {
      update_id: timestamp + 103,
      message: {
        message_id: 203,
        from: { id: 8003, is_bot: false, first_name: 'Dmitry' },
        chat: { id: 8003, type: 'private' },
        date: Math.floor(timestamp / 1000),
        text: 'Да',
      },
    };

    const res = await UpdateProcessor.processUpdate(update);
    const pass =
      res.pendingConfirmation?.status === 'confirmed' &&
      res.aiResponseText?.toLowerCase().includes('подтвержден');

    assert(3, 'Russian "да" confirms pending confirmation with Russian reply', Boolean(pass), `Status: ${res.pendingConfirmation?.status}`);
  }

  // 4. English "yes" confirmation
  {
    await setupPending(8004);

    const update: TelegramUpdate = {
      update_id: timestamp + 104,
      message: {
        message_id: 204,
        from: { id: 8004, is_bot: false, first_name: 'John' },
        chat: { id: 8004, type: 'private' },
        date: Math.floor(timestamp / 1000),
        text: 'yes, confirm',
      },
    };

    const res = await UpdateProcessor.processUpdate(update);
    const pass =
      res.pendingConfirmation?.status === 'confirmed' &&
      res.aiResponseText?.toLowerCase().includes('confirmed');

    assert(4, 'English "yes" confirms pending confirmation with English reply', Boolean(pass), `Status: ${res.pendingConfirmation?.status}`);
  }

  // 5. Uzbek cancellation ("yo'q" or "bekor qil")
  {
    await setupPending(8005);

    const update: TelegramUpdate = {
      update_id: timestamp + 105,
      message: {
        message_id: 205,
        from: { id: 8005, is_bot: false, first_name: 'Nodir' },
        chat: { id: 8005, type: 'private' },
        date: Math.floor(timestamp / 1000),
        text: 'yo\'q',
      },
    };

    const res = await UpdateProcessor.processUpdate(update);
    const pass =
      res.pendingConfirmation?.status === 'cancelled' &&
      res.pendingConfirmation?.cancelledAt !== undefined &&
      res.aiResponseText?.toLowerCase().includes('bekor qilindi');

    assert(5, 'Uzbek cancellation cancels pending confirmation', Boolean(pass), `Status: ${res.pendingConfirmation?.status}`);
  }

  // 6. Russian cancellation ("нет" or "отмена")
  {
    await setupPending(8006);

    const update: TelegramUpdate = {
      update_id: timestamp + 106,
      message: {
        message_id: 206,
        from: { id: 8006, is_bot: false, first_name: 'Sergey' },
        chat: { id: 8006, type: 'private' },
        date: Math.floor(timestamp / 1000),
        text: 'отмена',
      },
    };

    const res = await UpdateProcessor.processUpdate(update);
    const pass =
      res.pendingConfirmation?.status === 'cancelled' &&
      res.aiResponseText?.toLowerCase().includes('отменен');

    assert(6, 'Russian cancellation cancels pending confirmation with Russian reply', Boolean(pass), `Status: ${res.pendingConfirmation?.status}`);
  }

  // 7. English cancellation ("no" or "cancel")
  {
    await setupPending(8007);

    const update: TelegramUpdate = {
      update_id: timestamp + 107,
      message: {
        message_id: 207,
        from: { id: 8007, is_bot: false, first_name: 'Michael' },
        chat: { id: 8007, type: 'private' },
        date: Math.floor(timestamp / 1000),
        text: 'cancel it',
      },
    };

    const res = await UpdateProcessor.processUpdate(update);
    const pass =
      res.pendingConfirmation?.status === 'cancelled' &&
      res.aiResponseText?.toLowerCase().includes('cancelled');

    assert(7, 'English cancellation cancels pending confirmation with English reply', Boolean(pass), `Status: ${res.pendingConfirmation?.status}`);
  }

  // 8. Ambiguous confirmation ("balki", "o'ylab ko'raman", "maybe")
  {
    await setupPending(8008);

    const update: TelegramUpdate = {
      update_id: timestamp + 108,
      message: {
        message_id: 208,
        from: { id: 8008, is_bot: false, first_name: 'Suhrob' },
        chat: { id: 8008, type: 'private' },
        date: Math.floor(timestamp / 1000),
        text: 'o\'ylab ko\'raman',
      },
    };

    const res = await UpdateProcessor.processUpdate(update);
    const pass =
      res.pendingConfirmation?.status === 'pending_confirmation' &&
      res.confirmationAction === 'ambiguous';

    assert(8, 'Ambiguous message keeps pending confirmation active', Boolean(pass), `Status: ${res.pendingConfirmation?.status}`);
  }

  // 9. Confirmation without active pending state
  {
    // Customer 8009 has NO pending confirmation
    (mockGemini as any).generateText = async () => ({
      success: true,
      text: JSON.stringify({
        intent: 'greeting',
        product_name: null,
        confidence: 0.9,
        language: 'uz',
      }),
    });

    const update: TelegramUpdate = {
      update_id: timestamp + 109,
      message: {
        message_id: 209,
        from: { id: 8009, is_bot: false, first_name: 'Akmal' },
        chat: { id: 8009, type: 'private' },
        date: Math.floor(timestamp / 1000),
        text: 'ha',
      },
    };

    const res = await UpdateProcessor.processUpdate(update);
    const pass = res.pendingConfirmation === undefined && res.status !== 'confirmation_confirmed';

    assert(9, 'Confirmation without pending state treated as normal message', Boolean(pass), `Pending: ${res.pendingConfirmation}`);
  }

  // 10. Expired confirmation (>15 minutes)
  {
    const pending = await setupPending(8010);

    // Artificially expire the confirmation in Firestore (expiresAt in the past)
    const expiredPending = {
      ...pending,
      expiresAt: Date.now() - 60000, // expired 1 minute ago
    };
    await setDoc(doc(db, 'pending_confirmations', pending.id), expiredPending);

    const update: TelegramUpdate = {
      update_id: timestamp + 110,
      message: {
        message_id: 210,
        from: { id: 8010, is_bot: false, first_name: 'Farhod' },
        chat: { id: 8010, type: 'private' },
        date: Math.floor(timestamp / 1000),
        text: 'ha',
      },
    };

    const res = await UpdateProcessor.processUpdate(update);
    const pass =
      res.pendingConfirmation?.status === 'expired' &&
      res.aiResponseText?.toLowerCase().includes('tugagan');

    assert(10, 'Expired confirmation cannot be confirmed and informs customer', Boolean(pass), `Status: ${res.pendingConfirmation?.status}`);
  }

  // 11. Duplicate confirmation Telegram update
  {
    await setupPending(8011);

    const update: TelegramUpdate = {
      update_id: timestamp + 111,
      message: {
        message_id: 211,
        from: { id: 8011, is_bot: false, first_name: 'Rustam' },
        chat: { id: 8011, type: 'private' },
        date: Math.floor(timestamp / 1000),
        text: 'ha, tasdiqlayman',
      },
    };

    const res1 = await UpdateProcessor.processUpdate(update);
    // Send exact same update again
    const res2 = await UpdateProcessor.processUpdate(update);

    const pass = res1.pendingConfirmation?.status === 'confirmed' && res2.isDuplicate === true;
    assert(11, 'Duplicate confirmation update safely ignored by idempotency', Boolean(pass), `isDuplicate: ${res2.isDuplicate}`);
  }

  // 12. Repeated confirmation after already confirmed
  {
    await setupPending(8012);

    // First confirmation
    const updateA: TelegramUpdate = {
      update_id: timestamp + 112,
      message: {
        message_id: 212,
        from: { id: 8012, is_bot: false, first_name: 'Davron' },
        chat: { id: 8012, type: 'private' },
        date: Math.floor(timestamp / 1000),
        text: 'ha',
      },
    };
    await UpdateProcessor.processUpdate(updateA);

    // Second different update but same customer saying "ha" again
    const updateB: TelegramUpdate = {
      update_id: timestamp + 113,
      message: {
        message_id: 213,
        from: { id: 8012, is_bot: false, first_name: 'Davron' },
        chat: { id: 8012, type: 'private' },
        date: Math.floor(timestamp / 1000),
        text: 'tasdiqlayman',
      },
    };
    const resSecond = await UpdateProcessor.processUpdate(updateB);

    const pass =
      resSecond.pendingConfirmation?.status === 'confirmed' &&
      resSecond.aiResponseText?.toLowerCase().includes('allaqachon');

    assert(12, 'Repeated confirmation message after already confirmed handled safely', Boolean(pass), `Reply: ${resSecond.aiResponseText}`);
  }

  // 13. Repeated cancellation after already cancelled
  {
    await setupPending(8013);

    const updateA: TelegramUpdate = {
      update_id: timestamp + 114,
      message: {
        message_id: 214,
        from: { id: 8013, is_bot: false, first_name: 'Sanjar' },
        chat: { id: 8013, type: 'private' },
        date: Math.floor(timestamp / 1000),
        text: 'yo\'q',
      },
    };
    await UpdateProcessor.processUpdate(updateA);

    const updateB: TelegramUpdate = {
      update_id: timestamp + 115,
      message: {
        message_id: 215,
        from: { id: 8013, is_bot: false, first_name: 'Sanjar' },
        chat: { id: 8013, type: 'private' },
        date: Math.floor(timestamp / 1000),
        text: 'bekor qil',
      },
    };
    const resSecond = await UpdateProcessor.processUpdate(updateB);

    const pass =
      resSecond.pendingConfirmation?.status === 'cancelled' &&
      resSecond.aiResponseText?.toLowerCase().includes('allaqachon');

    assert(13, 'Repeated cancellation message after already cancelled handled safely', Boolean(pass), `Reply: ${resSecond.aiResponseText}`);
  }

  // 14. Tenant isolation: Biz B customer confirmation does NOT affect Biz A
  {
    const pendingA = await setupPending(8014, 2, testBizA);

    BusinessResolver.setExplicitBusiness(testBizB);

    // Customer on Biz B says "ha"
    const updateB: TelegramUpdate = {
      update_id: timestamp + 116,
      message: {
        message_id: 216,
        from: { id: 8014, is_bot: false, first_name: 'ClientB' },
        chat: { id: 8014, type: 'private' },
        date: Math.floor(timestamp / 1000),
        text: 'ha',
      },
    };
    await UpdateProcessor.processUpdate(updateB);

    // Verify Biz A's pending state is STILL untouched and still in 'pending_confirmation' status
    const snapA = await getDoc(doc(db, 'pending_confirmations', pendingA.id));
    const stillPending = snapA.data()?.status === 'pending_confirmation';

    assert(14, 'Tenant isolation: Biz B action cannot confirm or affect Biz A pending state', stillPending, `Biz A status: ${snapA.data()?.status}`);

    BusinessResolver.setExplicitBusiness(testBizA);
  }

  // 15. Product / quantity change ("Yo'q, 3 ta kerak")
  {
    await setupPending(8015, 2);

    (mockGemini as any).generateText = async () => ({
      success: true,
      text: JSON.stringify({
        intent: 'order_intent',
        product_name: 'iPhone 15 Pro 256GB',
        quantity: 3,
        confidence: 0.98,
        language: 'uz',
      }),
    });

    const update: TelegramUpdate = {
      update_id: timestamp + 117,
      message: {
        message_id: 217,
        from: { id: 8015, is_bot: false, first_name: 'Sherzod' },
        chat: { id: 8015, type: 'private' },
        date: Math.floor(timestamp / 1000),
        text: 'Yo\'q, 3 ta kerak',
      },
    };

    const res = await UpdateProcessor.processUpdate(update);

    // Old pending confirmation was cleared and replaced by new pending confirmation with quantity 3
    const pass =
      res.pendingConfirmation !== undefined &&
      res.pendingConfirmation.status === 'pending_confirmation' &&
      res.pendingConfirmation.quantity === 3 &&
      res.pendingConfirmation.subtotal === 39000000;

    assert(15, 'Quantity change cancels previous pending confirmation and creates new one with 3 units', Boolean(pass), `New Qty: ${res.pendingConfirmation?.quantity}, Subtotal: ${res.pendingConfirmation?.subtotal}`);
  }

  // 16. No final order created
  {
    const ordersSnapAfter = await getDocs(
      query(collection(db, 'orders'), where('businessId', '==', testBizA))
    );
    const orderCountAfter = ordersSnapAfter.size;
    assert(16, 'No final order created in orders collection', orderCountAfter === orderCountBefore, `Orders before: ${orderCountBefore}, after: ${orderCountAfter}`);
  }

  // 17. No stock mutation
  {
    const prodSnapAfter = await getDoc(doc(db, 'businesses', testBizA, 'products', productA1.id));
    const stockAfter = prodSnapAfter.data()?.stock;
    assert(17, 'No stock mutation in products collection', stockAfter === productA1.stock, `Stock before: ${productA1.stock}, after: ${stockAfter}`);
  }

  // 18. No price mutation
  {
    const prodSnapAfter = await getDoc(doc(db, 'businesses', testBizA, 'products', productA1.id));
    const priceAfter = prodSnapAfter.data()?.price;
    assert(18, 'No price mutation in products collection', priceAfter === productA1.price, `Price before: ${productA1.price}, after: ${priceAfter}`);
  }

  console.log('===============================================================');
  const passedCount = suite.filter((t) => t.passed).length;
  console.log(`TOTAL: ${suite.length} | PASSED: ${passedCount} | FAILED: ${suite.length - passedCount}`);
  console.log('===============================================================');

  if (passedCount === suite.length) {
    console.log('🎉 ALL 18 M4.3.2 CONFIRMATION HANDLER TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('❌ SOME M4.3.2 TESTS FAILED');
    process.exit(1);
  }
}

runM432Tests();
