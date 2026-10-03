import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebhookSecurity } from './server/telegram/webhookSecurity';
import { UpdateProcessor } from './server/telegram/updateProcessor';
import { TelegramClient } from './server/telegram/telegramClient';
import { initWorkerAuth } from './server/initWorkerAuth';
import { AIParser } from './server/telegram/aiParser';
import { GroundingEngine } from './server/telegram/groundingEngine';
import { AIResponder } from './server/telegram/aiResponder';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Parse JSON bodies
app.use(express.json());

// 1. & 2. Server-side environment variables verification
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const APP_URL = (process.env.APP_URL || '').replace(/\/$/, '');

console.log('==================================================');
console.log('[Telegram Bot Integration Diagnostic]');
console.log('1. TELEGRAM_BOT_TOKEN set on server:', Boolean(TELEGRAM_BOT_TOKEN));
console.log('2. TELEGRAM_WEBHOOK_SECRET set on server:', Boolean(TELEGRAM_WEBHOOK_SECRET));
console.log('3. APP_URL:', APP_URL || '(None - Localhost)');
console.log('4. Environment:', process.env.NODE_ENV || 'development');
console.log('5. Firebase Project:', process.env.FIREBASE_PROJECT_ID || 'ai-savdobot');
console.log('==================================================');

/**
 * 3. Verify Telegram Bot API connection works
 */
async function verifyTelegramBotConnection() {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('[Telegram API] ℹ️ TELEGRAM_BOT_TOKEN is not configured on server. CRM starting in standalone mode.');
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' };
  }

  const result = await TelegramClient.getMe();
  if (result.ok && result.result) {
    console.log(`[Telegram API] ✅ Bot Connected! Name: "${result.result.first_name}", Username: @${result.result.username}, ID: ${result.result.id}`);
  } else {
    console.warn('[Telegram API] ⚠️ getMe failed or bot token invalid:', result.error || result);
  }
  return result;
}

/**
 * 4. Server-side Telegram webhook endpoint: POST /api/telegram/webhook
 * 5. Webhook secret verification for security
 */
app.post('/api/telegram/webhook', async (req: Request, res: Response) => {
  // Validate secret token header
  const security = WebhookSecurity.validateRequest(req);
  if (!security.valid) {
    console.warn('[Telegram Webhook] ⚠️ Rejected update:', security.reason);
    return res.status(403).json({ error: 'Unauthorized: invalid webhook secret' });
  }

  try {
    const processResult = await UpdateProcessor.processUpdate(req.body);
    return res.status(200).json({ ok: true, result: processResult });
  } catch (err: any) {
    console.error('[Telegram Webhook] Error processing update:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
});

/**
 * Webhook Management Utilities
 */
app.post('/api/telegram/set-webhook', async (req: Request, res: Response) => {
  const customUrl = req.body?.url || `${APP_URL}/api/telegram/webhook`;
  const secret = req.body?.secret || TELEGRAM_WEBHOOK_SECRET;
  const result = await TelegramClient.setTelegramWebhook(customUrl, secret);
  res.json(result);
});

app.post('/api/telegram/delete-webhook', async (_req: Request, res: Response) => {
  const result = await TelegramClient.deleteTelegramWebhook();
  res.json(result);
});

app.get('/api/telegram/webhook-info', async (_req: Request, res: Response) => {
  const result = await TelegramClient.getTelegramWebhookInfo();
  res.json(result);
});

/**
 * Backward compatibility endpoints for UI
 */
app.post('/api/telegram/register-webhook', async (req: Request, res: Response) => {
  const customUrl = req.body?.url || `${APP_URL}/api/telegram/webhook`;
  stopPollingWorker();
  const result = await TelegramClient.setTelegramWebhook(customUrl, TELEGRAM_WEBHOOK_SECRET);
  res.json({ ok: result.ok, webhookUrl: customUrl, data: result });
});

/**
 * Polling Worker (Development & Fallback Engine)
 */
let isPollingActive = false;
let pollingOffset = 0;

async function startPollingWorker() {
  if (!TELEGRAM_BOT_TOKEN || isPollingActive) return;
  isPollingActive = true;

  console.log('[Telegram Polling Worker] 🚀 Starting polling listener for instant development messaging...');

  // Delete webhook so Telegram delivers updates to getUpdates
  await TelegramClient.deleteTelegramWebhook();

  // Polling loop
  (async () => {
    while (isPollingActive) {
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${pollingOffset}&timeout=20`
        );
        if (!response.ok) {
          await new Promise((r) => setTimeout(r, 2500));
          continue;
        }

        const data = await response.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            pollingOffset = update.update_id + 1;
            await UpdateProcessor.processUpdate(update);
          }
        }
      } catch {
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
  })();
}

function stopPollingWorker() {
  isPollingActive = false;
}

// API to check Telegram integration status
app.get('/api/telegram/status', async (_req: Request, res: Response) => {
  let botInfo: any = null;
  let webhookInfo: any = null;
  let error: string | null = null;

  if (TELEGRAM_BOT_TOKEN) {
    try {
      const [meRes, whRes] = await Promise.all([
        TelegramClient.getMe(),
        TelegramClient.getTelegramWebhookInfo(),
      ]);
      botInfo = meRes;
      webhookInfo = whRes;
    } catch (e: any) {
      error = e.message;
    }
  }

  res.json({
    tokenConfigured: Boolean(TELEGRAM_BOT_TOKEN),
    secretConfigured: Boolean(TELEGRAM_WEBHOOK_SECRET),
    appUrl: APP_URL || null,
    isHttps: APP_URL.startsWith('https://'),
    isPollingActive,
    botInfo,
    webhookInfo,
    error,
  });
});

app.post('/api/telegram/enable-polling', async (_req: Request, res: Response) => {
  startPollingWorker();
  res.json({ ok: true, isPollingActive: true });
});

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'AI SavdoBot',
    environment: process.env.NODE_ENV || 'development',
    time: new Date().toISOString(),
  });
});

app.post('/api/telegram/send-message', async (req: Request, res: Response) => {
  const { chatId, text } = req.body;
  if (!chatId || !text) {
    return res.status(400).json({ ok: false, error: 'chatId and text required' });
  }
  const result = await TelegramClient.sendMessage(chatId, text);
  res.json(result);
});

/**
 * AI Pipeline Testing Endpoint
 * Allows testing the complete AI Parser -> Intent -> Grounding -> AI Response flow
 */
app.post('/api/telegram/test-ai-pipeline', async (req: Request, res: Response) => {
  const { text, businessId = 'biz-default', customerName = 'Sinovchi' } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ ok: false, error: 'Text query is required' });
  }

  try {
    // 1. AI Parser
    const parsedIntent = await AIParser.parseIntent(text);

    // 2. Grounding Engine (Product / Warehouse / Order)
    const groundedContext = await GroundingEngine.ground({
      businessId,
      customerId: 'test_cust_sim',
      conversationId: 'test_conv_sim',
      customerName,
      parsedIntent,
      rawMessageText: text,
    });

    // 3. AI Response Generator
    const aiResponseText = await AIResponder.generateResponse({
      customerName,
      rawMessageText: text,
      groundedContext,
    });

    res.json({
      ok: true,
      query: text,
      parsedIntent,
      groundedContext: {
        intent: groundedContext.intent,
        matchedProductsCount: groundedContext.matchedProducts.length,
        topProduct: groundedContext.matchedProducts[0]?.name || null,
        topProductPrice: groundedContext.matchedProducts[0]?.price || null,
        warehouseStock: groundedContext.warehouseStock,
        draftOrderId: groundedContext.draftOrder?.id || null,
        draftOrderTotal: groundedContext.draftOrder?.total || null,
      },
      aiResponseText,
    });
  } catch (err: any) {
    console.error('[API test-ai-pipeline error]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Server Initialization
async function startServer() {
  // Initialize worker authentication for Firestore persistence
  await initWorkerAuth();

  if (!isProd) {
    // Mount Vite dev server middleware (Full-Stack Express + Vite)
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, async () => {
    console.log(`🚀 Express server running on port ${PORT}`);

    // Verify Bot connection
    await verifyTelegramBotConnection();

    // Start polling in development or if webhook is unreachable (e.g. 302 on dev domain or localhost)
    if (!isProd || !APP_URL || APP_URL.includes('localhost') || APP_URL.includes('ais-dev-')) {
      if (TELEGRAM_BOT_TOKEN) {
        console.log('[Telegram Bot] Starting polling worker for reliable development response.');
        await startPollingWorker();
      }
    } else if (TELEGRAM_BOT_TOKEN) {
      console.log('[Telegram Bot] Registering production webhook...');
      await TelegramClient.setTelegramWebhook(`${APP_URL}/api/telegram/webhook`, TELEGRAM_WEBHOOK_SECRET);
    }
  });
}

startServer();

