/**
 * Customer Sales Signals interface for M6.2
 * Computed deterministically from CRM data (customers, orders, messages)
 * without invoking external AI models.
 */
export interface CustomerSalesSignals {
  customerId: string;
  businessId: string;

  hasActiveOrder: boolean;
  hasCompletedOrder: boolean;
  hasCancelledOrder: boolean;

  isRepeatCustomer: boolean;

  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalSpent: number;

  lastOrderAt: number | null;
  lastInteractionAt: number | null;

  purchaseIntentDetected: boolean;
  productInquiryDetected: boolean;
  priceInquiryDetected: boolean;
  stockInquiryDetected: boolean;
}
