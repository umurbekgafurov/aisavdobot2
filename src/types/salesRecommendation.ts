export type SalesRecommendationAction =
  | 'follow_up'
  | 'product_recommendation'
  | 'price_follow_up'
  | 'order_follow_up'
  | 'repeat_purchase'
  | 'no_action';

export interface SalesRecommendation {
  action: SalesRecommendationAction;
  reason: string;
  confidence: number;
}
