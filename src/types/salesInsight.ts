import { CustomerIntentLevel } from './intentScore';

export interface CustomerSalesInsight {
  customerId: string;
  businessId: string;

  intentLevel: CustomerIntentLevel;
  intentScore: number;

  signals: string[];

  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalSpent: number;

  lastOrderAt: number | null;
  lastInteractionAt: number | null;

  generatedAt: number;
}
