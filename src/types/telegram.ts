export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramContact {
  phone_number: string;
  first_name: string;
  last_name?: string;
  user_id?: number;
  vcard?: string;
}

export interface TelegramRawMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
  voice?: TelegramVoice;
  contact?: TelegramContact;
  caption?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramRawMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramRawMessage;
  edited_message?: TelegramRawMessage;
  callback_query?: TelegramCallbackQuery;
}

export type CRMMessageType = 'text' | 'photo' | 'voice' | 'document' | 'contact' | 'callback_query' | 'other';

export interface ParsedTelegramMessage {
  updateId: number;
  telegramMessageId: number;
  telegramChatId: string;
  telegramUserId: string;
  username?: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  type: CRMMessageType;
  text: string;
  media: {
    fileId?: string;
    mimeType?: string;
    fileName?: string;
    caption?: string;
  } | null;
  rawDate: number;
}

export interface TelegramConnection {
  telegramConnected: boolean;
  telegramBotUsername?: string;
  telegramBotId?: string;
  telegramWebhookActive?: boolean;
}
