import { SalesRecommendationAction } from './salesRecommendation';

export type SalesAssistantActionType = SalesRecommendationAction;

export interface SalesAssistantAction {
  action: SalesAssistantActionType;
  customerId: string;
  businessId: string;
  reason: string;
  confidence: number;
  suggestedText: string;
}
