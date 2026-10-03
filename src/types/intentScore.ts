export type CustomerIntentLevel = 'low' | 'medium' | 'high';

export interface CustomerIntentScore {
  customerId: string;
  businessId: string;

  level: CustomerIntentLevel;
  score: number;

  signals: string[];

  calculatedAt: number;
}
