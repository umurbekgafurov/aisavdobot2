import { CRMMessageType } from './telegram';

export type ConversationStatus = 'open' | 'closed' | 'archived' | 'pending';

export interface Conversation {
  id: string;
  businessId: string;
  customerId: string;
  channel: 'telegram' | 'web';
  telegramChatId: string;
  status: ConversationStatus;
  assignedTo: string | null;
  lastMessagePreview: string;
  lastMessageAt: number;
  unreadCount: number;
  customerName?: string;
  customerUsername?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ConversationMessage {
  id: string;
  businessId: string;
  customerId: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  channel: 'telegram' | 'web';
  telegramMessageId: number;
  telegramChatId: string;
  type: CRMMessageType;
  text: string;
  media: {
    fileId?: string;
    mimeType?: string;
    fileName?: string;
    caption?: string;
  } | null;
  aiProcessed: boolean;
  aiIntent: string | null;
  aiConfidence?: number;
  aiLanguage?: string;
  aiProductName?: string | null;
  aiProductResolution?: 'resolved' | 'not_found' | 'ambiguous' | 'skipped' | 'error';
  aiProductId?: string | null;
  aiResolvedProduct?: any;
  aiCandidates?: any[];
  aiError?: string;
  createdAt: number;
}

export type CRMOrderStatus = 'draft' | 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export type AIParserIntent =
  | 'product_query'
  | 'stock_query'
  | 'price_query'
  | 'order_intent'
  | 'greeting'
  | 'unknown';

export interface AIParserResult {
  intent: AIParserIntent;
  confidence: number;
  productQuery?: string;
  quantity?: number;
  customerPhone?: string;
  deliveryAddress?: string;
  notes?: string;
  extractedKeywords?: string[];
}

export interface GroundedContext {
  intent: AIParserIntent;
  matchedProducts: any[];
  warehouseStock: Array<{
    productName: string;
    warehouseName: string;
    stock: number;
    price: number;
    status: 'in_stock' | 'low_stock' | 'out_of_stock';
  }>;
  draftOrder?: any | null;
  businessName: string;
  currency: string;
  deliveryInfo?: {
    price: number;
    zones: string[];
  };
}

export interface AIPipelineResult {
  parsedIntent: AIParserResult;
  groundedContext: GroundedContext;
  aiResponseText: string;
  sentToTelegram: boolean;
  orderCreated?: any | null;
}

export interface OrderIntentResult {
  hasOrderIntent: boolean;
  confidence: number;
  reason?: string;
  detectedItems?: Array<{
    query: string;
    quantity: number;
  }>;
}
