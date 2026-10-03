import type { Request } from 'express';

export class WebhookSecurity {
  /**
   * Validates the Telegram Webhook secret token header.
   * Compares req.headers['x-telegram-bot-api-secret-token'] with TELEGRAM_WEBHOOK_SECRET.
   * Never exposes or logs the token.
   */
  static validateRequest(req: Request, configuredSecret?: string): { valid: boolean; reason?: string } {
    const secret = configuredSecret || process.env.TELEGRAM_WEBHOOK_SECRET || '';

    // If no secret is configured on server (e.g. local dev without webhook secret)
    if (!secret) {
      return { valid: true };
    }

    const incomingHeader = req.headers['x-telegram-bot-api-secret-token'];

    if (!incomingHeader) {
      return {
        valid: false,
        reason: 'Missing X-Telegram-Bot-Api-Secret-Token header',
      };
    }

    if (incomingHeader !== secret) {
      return {
        valid: false,
        reason: 'Invalid secret token',
      };
    }

    return { valid: true };
  }
}
