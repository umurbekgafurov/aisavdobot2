export class TelegramClient {
  private static apiBase = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org';
  private static mockSender: ((chatId: string | number, text: string) => Promise<{ ok: boolean; result?: any; error?: string }>) | null = null;

  /**
   * Set a mock sender for testing (bypasses network)
   */
  static setMockSender(sender: ((chatId: string | number, text: string) => Promise<{ ok: boolean; result?: any; error?: string }>) | null) {
    this.mockSender = sender;
  }

  private static getToken(): string {
    return process.env.TELEGRAM_BOT_TOKEN || '';
  }

  /**
   * Test bot identity via /getMe
   */
  static async getMe(): Promise<{ ok: boolean; result?: any; error?: string }> {
    const token = this.getToken();
    if (!token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured.' };

    try {
      const res = await fetch(`${this.apiBase}/bot${token}/getMe`);
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Set webhook with secret token
   */
  static async setTelegramWebhook(url: string, secretToken?: string): Promise<{ ok: boolean; data?: any; error?: string }> {
    const token = this.getToken();
    if (!token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured.' };

    try {
      const payload: Record<string, any> = {
        url,
        allowed_updates: ['message', 'edited_message', 'callback_query'],
        drop_pending_updates: false,
      };

      const secret = secretToken || process.env.TELEGRAM_WEBHOOK_SECRET;
      if (secret) {
        payload.secret_token = secret;
      }

      const res = await fetch(`${this.apiBase}/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return { ok: data.ok, data };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Delete webhook (e.g. for polling or disabling)
   */
  static async deleteTelegramWebhook(): Promise<{ ok: boolean; data?: any; error?: string }> {
    const token = this.getToken();
    if (!token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured.' };

    try {
      const res = await fetch(`${this.apiBase}/bot${token}/deleteWebhook`);
      const data = await res.json();
      return { ok: data.ok, data };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Get current webhook status from Telegram
   */
  static async getTelegramWebhookInfo(): Promise<{ ok: boolean; result?: any; error?: string }> {
    const token = this.getToken();
    if (!token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured.' };

    try {
      const res = await fetch(`${this.apiBase}/bot${token}/getWebhookInfo`);
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Send text reply to a Telegram chat
   */
  static async sendMessage(chatId: string | number, text: string): Promise<{ ok: boolean; result?: any; error?: string }> {
    if (this.mockSender) {
      return this.mockSender(chatId, text);
    }

    const token = this.getToken();
    if (!token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured.' };

    try {
      const res = await fetch(`${this.apiBase}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
        }),
        signal: AbortSignal.timeout(3500),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }
}
