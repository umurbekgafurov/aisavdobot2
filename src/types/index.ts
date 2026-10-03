export * from './telegram';
export * from './crm';
// Re-export orders domain types
export * from './orders';
export * from './notifications';
export * from './salesSignals';
export * from './intentScore';
export * from './salesInsight';
export * from './salesRecommendation';
export * from './salesAction';
export * from './customerSegmentation';

export type CustomerStatus = 'Yangi' | 'Faol' | 'Qiziqmoqda' | 'Buyurtma berdi' | 'Sotib oldi' | 'Yo\'qotilgan';
export type CustomerTag = 'Issiq lead' | 'Qayta aloqa' | 'VIP' | 'Yangi mijoz';

export type StockMovementType =
  | 'STOCK_IN'
  | 'STOCK_OUT'
  | 'SALE'
  | 'RETURN'
  | 'DAMAGE'
  | 'ADJUSTMENT'
  | 'IN' // backwards compatibility
  | 'OUT';

export type OrderStatus = 'Yangi' | 'Tasdiqlandi' | 'Tayyorlanmoqda' | 'Yetkazilmoqda' | 'Yetkazildi' | 'Bekor qilindi';
export type PaymentStatus = 'Kutilmoqda' | 'To\'landi' | 'Qisman to\'landi' | 'Qaytarildi';

export type AIIntent =
  | 'PRODUCT_SEARCH'
  | 'PRICE_REQUEST'
  | 'STOCK_CHECK'
  | 'DELIVERY_QUESTION'
  | 'PAYMENT_QUESTION'
  | 'PRODUCT_COMPARISON'
  | 'ORDER_REQUEST'
  | 'COMPLAINT'
  | 'RETURN_REQUEST'
  | 'HUMAN_AGENT_REQUEST'
  | 'OTHER';

export interface Business {
  id: string;
  userId?: string;
  businessId?: string;
  businessName?: string;
  name: string;
  ownerUid: string;
  phone: string;
  address: string;
  workingHours: string;
  deliveryZones: string[];
  deliveryPrice: number;
  freeDeliveryThreshold?: number;
  paymentMethods: string[];
  currency: string;
  defaultWarehouseId?: string;
  telegramBotToken?: string;
  telegramBotUsername?: string;
  telegramConnected: boolean;
  settings: {
    autoReply: boolean;
    groupAutoReply: boolean;
    humanApprovalRequired: boolean;
    followUp: boolean;
  };
  createdAt: number;
  updatedAt?: number;
}

export interface Warehouse {
  id: string;
  businessId: string;
  name: string;
  address: string;
  active?: boolean;
  isDefault?: boolean;
  createdAt: number;
  updatedAt?: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  costPrice?: number;
  stock: number;
  sku?: string;
}

export interface Product {
  id: string;
  businessId: string;
  warehouseId: string;
  name: string;
  sku: string;
  category: string;
  brand: string;
  model: string;
  description: string;
  price: number;
  costPrice: number;
  stock: number;
  lowStockThreshold: number;
  imageUrl?: string;
  photos?: string[];
  variants?: ProductVariant[];
  attributes?: Record<string, string>;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface StockMovement {
  id: string;
  businessId: string;
  warehouseId: string;
  productId: string;
  productName?: string;
  type: StockMovementType;
  quantity: number; // positive or negative
  reason: string;
  referenceType?: string;
  referenceId?: string;
  createdAt: number;
  createdBy: string;
}

export interface Customer {
  id: string;
  businessId: string;
  telegramUserId?: string;
  telegramUsername?: string;
  telegramChatId?: string;
  username?: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  tags?: CustomerTag[];
  source: string;
  totalOrders: number;
  totalSpent: number;
  lastInteraction?: number;
  lastMessageAt?: number;
  leadScore?: number;
  status: CustomerStatus;
  notes?: string;
  aiSummary?: string;
  createdAt: number;
  updatedAt?: number;
}


export interface TelegramMessage {
  id: string;
  businessId: string;
  customerId: string;
  sender: 'customer' | 'bot' | 'human';
  senderName: string;
  text: string;
  intent?: AIIntent;
  confidence?: number;
  aiGenerated?: boolean;
  needsHumanAttention?: boolean;
  humanApproved?: boolean;
  timestamp: number;
}

export interface AIActionLog {
  id: string;
  businessId: string;
  customerId?: string;
  type: 'INTENT_DETECTION' | 'PRODUCT_EXTRACTION' | 'LEAD_SCORING' | 'RESPONSE_GENERATION' | 'SUMMARY' | 'FOLLOWUP' | 'IMAGE_ANALYSIS';
  input: string;
  output: string;
  confidence: number;
  createdAt: number;
}

export interface AIFollowupRecommendation {
  id: string;
  customerId: string;
  customerName: string;
  productName: string;
  lastInteractionDays: number;
  reason: string;
  suggestedMessage: string;
  status: 'pending' | 'sent' | 'dismissed';
}
