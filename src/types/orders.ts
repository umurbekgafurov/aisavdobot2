/**
 * Explicit order status lifecycle for M4 Order domain:
 * - pending_confirmation: Created/drafted, waiting for customer or manager confirmation
 * - confirmed: Confirmed by customer/seller
 * - processing: In preparation/packaging in warehouse
 * - completed: Delivered & completed
 * - cancelled: Cancelled by customer or seller
 */
export type OrderDomainStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'processing'
  | 'completed'
  | 'cancelled';

export type OrderInventoryStatus = 'pending' | 'completed' | 'failed' | 'insufficient_stock';

export const VALID_ORDER_STATUSES: readonly OrderDomainStatus[] = [
  'pending_confirmation',
  'confirmed',
  'processing',
  'completed',
  'cancelled',
] as const;

/**
 * Item in an order
 */
export interface OrderItem {
  productId: string;
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  lineTotal?: number;
  // Backwards compatibility for existing UI views
  totalPrice?: number;
  variantName?: string;
}

/**
 * Clean Order domain model
 */
export interface Order {
  id: string;
  orderId?: string; // Alias or mirror for id
  businessId: string;
  customerId: string;
  conversationId?: string | null;
  status?: OrderDomainStatus | string;
  items: OrderItem[];
  subtotal: number;
  total: number;
  currency?: string;
  createdAt: number;
  updatedAt: number;

  // Inventory processing tracking (M4.4.2)
  inventoryProcessed?: boolean;
  inventoryProcessedAt?: number | null;
  inventoryStatus?: 'pending' | 'completed' | 'failed' | 'insufficient_stock';
  ledgerMovementIds?: string[];

  // Admin notification tracking (M4.5.1 / M4.5.2)
  adminNotificationPrepared?: boolean;
  adminNotificationPreparedAt?: number | null;
  adminNotificationSent?: boolean;
  adminNotificationSentAt?: number | null;
  adminNotificationRecipients?: string[];
  adminNotificationPayloadId?: string;

  // Backwards compatibility with existing UI views
  orderStatus?: string;
  paymentStatus?: string;
  customerName?: string;
  customerPhone?: string;
  source?: string;
  deliveryAddress?: string;
  notes?: string;
  customerNote?: string | null;
  deliveryFee?: number;
  deliveryPrice?: number;
  discount?: number;
}

/**
 * Input payload for creating an order
 */
export interface CreateOrderItemInput {
  productId: string;
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  variantName?: string;
}

export interface CreateOrderInput {
  businessId: string;
  customerId: string;
  conversationId?: string | null;
  items: CreateOrderItemInput[];
  status?: OrderDomainStatus;
  currency?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  notes?: string;
  customerNote?: string | null;
  deliveryPrice?: number;
}

/**
 * Pending Confirmation Status lifecycle (M4.3.1 + M4.3.2)
 */
export type PendingConfirmationStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'cancelled'
  | 'expired';

/**
 * Temporary Pending Order Confirmation state (M4.3.1 + M4.3.2)
 */
export interface PendingOrderConfirmation {
  id: string;
  orderId?: string | null;
  businessId: string;
  customerId: string;
  conversationId: string;
  productId: string;
  productName: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  currency: string;
  status: PendingConfirmationStatus;
  createdAt: number;
  expiresAt: number;
  confirmedAt?: number;
  cancelledAt?: number;
  expiredAt?: number;
}

