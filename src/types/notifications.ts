export interface AdminOrderNotificationItem {
  productId: string;
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface AdminOrderNotificationPayload {
  notificationId: string;
  orderId: string;
  businessId: string;
  customerId: string;
  customerName?: string;
  customerContact?: string;
  customerPhone?: string;
  customerUsername?: string;
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  total: number;
  currency: string;
  createdAt: number;
  items: AdminOrderNotificationItem[];
  formattedText: string;
}

export interface PrepareNotificationResult {
  success: boolean;
  payload?: AdminOrderNotificationPayload;
  isAlreadyPrepared?: boolean;
  error?: string;
  code?:
    | 'NOT_FOUND'
    | 'TENANT_MISMATCH'
    | 'INVALID_ORDER_STATUS'
    | 'STOCK_MUTATION_REQUIRED'
    | 'EMPTY_ITEMS'
    | 'PREPARATION_FAILED';
}

export interface AdminRecipientDeliveryResult {
  chatId: string;
  success: boolean;
  messageId?: number;
  error?: string;
}

export interface SendAdminNotificationResult {
  success: boolean;
  orderId: string;
  businessId: string;
  notificationId?: string;
  isAlreadySent?: boolean;
  recipientsFound: number;
  recipientsSent: number;
  deliveries: AdminRecipientDeliveryResult[];
  error?: string;
  code?:
    | 'ALREADY_SENT'
    | 'NO_ADMIN_RECIPIENTS'
    | 'STOCK_MUTATION_REQUIRED'
    | 'INVALID_ORDER_STATUS'
    | 'TENANT_MISMATCH'
    | 'PARTIAL_DELIVERY'
    | 'ALL_DELIVERIES_FAILED'
    | 'PREPARATION_FAILED';
}

