import { ParsedTelegramMessage, TelegramUpdate, CRMMessageType } from '../../src/types/telegram';

export class UpdateParser {
  /**
   * Safely parses any Telegram update into a standardized CRM structure.
   * Gracefully handles text, photo, voice, document, contact, and callback_query.
   * Returns null if update has no actionable message.
   */
  static parse(update: TelegramUpdate): ParsedTelegramMessage | null {
    if (!update || typeof update !== 'object') {
      return null;
    }

    const updateId = update.update_id;
    if (typeof updateId !== 'number') {
      return null;
    }

    // Support message, edited_message, or callback_query
    const rawMsg = update.message || update.edited_message || update.callback_query?.message;
    const fromUser = update.message?.from || update.edited_message?.from || update.callback_query?.from;

    if (!rawMsg || !fromUser) {
      // Non-message update (e.g. channel post or status change without user)
      return null;
    }

    const telegramMessageId = rawMsg.message_id || 0;
    const telegramChatId = String(rawMsg.chat?.id || fromUser.id);
    const telegramUserId = String(fromUser.id);
    const username = fromUser.username ? fromUser.username.replace(/^@/, '') : undefined;
    const firstName = fromUser.first_name || 'Foydalanuvchi';
    const lastName = fromUser.last_name || undefined;

    let type: CRMMessageType = 'other';
    let text = '';
    let phone: string | undefined = undefined;
    let media: ParsedTelegramMessage['media'] = null;

    if (update.callback_query) {
      type = 'callback_query';
      text = update.callback_query.data || '[Tugma bosildi]';
    } else if (rawMsg.text) {
      type = 'text';
      text = rawMsg.text.trim();
    } else if (rawMsg.photo && rawMsg.photo.length > 0) {
      type = 'photo';
      const bestPhoto = rawMsg.photo[rawMsg.photo.length - 1];
      text = rawMsg.caption || '[Rasm yuborildi]';
      media = {
        fileId: bestPhoto.file_id,
        caption: rawMsg.caption,
      };
    } else if (rawMsg.voice) {
      type = 'voice';
      text = rawMsg.caption || '[Ovozli xabar]';
      media = {
        fileId: rawMsg.voice.file_id,
        mimeType: rawMsg.voice.mime_type || 'audio/ogg',
        caption: rawMsg.caption,
      };
    } else if (rawMsg.document) {
      type = 'document';
      text = rawMsg.caption || rawMsg.document.file_name || '[Hujjat yuborildi]';
      media = {
        fileId: rawMsg.document.file_id,
        fileName: rawMsg.document.file_name,
        mimeType: rawMsg.document.mime_type,
        caption: rawMsg.caption,
      };
    } else if (rawMsg.contact) {
      type = 'contact';
      phone = rawMsg.contact.phone_number;
      text = `[Kontakt ulashildi] ${rawMsg.contact.first_name || ''} (${phone})`;
    } else {
      type = 'other';
      text = '[Boshqa turdagi xabar]';
    }

    return {
      updateId,
      telegramMessageId,
      telegramChatId,
      telegramUserId,
      username,
      firstName,
      lastName,
      phone,
      type,
      text,
      media,
      rawDate: rawMsg.date ? rawMsg.date * 1000 : Date.now(),
    };
  }
}
