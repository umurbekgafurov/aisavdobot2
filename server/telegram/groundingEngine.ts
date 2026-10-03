import { FirestoreService } from '../../src/services/firebaseService';
import { OrderService } from '../../src/services/orderService';
import { Product, Warehouse, Order } from '../../src/types';
import { AIParserResult, GroundedContext } from '../../src/types/crm';
import { INITIAL_PRODUCTS, INITIAL_WAREHOUSES } from '../../src/data/mockData';

export class GroundingEngine {
  /**
   * Grounds the parsed intent with real Product, Warehouse, and Order data
   */
  static async ground(params: {
    businessId: string;
    customerId: string;
    conversationId: string;
    customerName?: string;
    customerPhone?: string;
    parsedIntent: AIParserResult;
    rawMessageText: string;
  }): Promise<GroundedContext> {
    const {
      businessId,
      customerId,
      conversationId,
      customerName = 'Mijoz',
      customerPhone,
      parsedIntent,
      rawMessageText,
    } = params;

    // 1. Retrieve products for the business
    let products: Product[] = [];
    try {
      products = await FirestoreService.getProducts(businessId);
    } catch (e) {
      console.warn('[GroundingEngine] Warning fetching Firestore products:', e);
    }

    if (!products || products.length === 0) {
      products = INITIAL_PRODUCTS.map((p) => ({ ...p, businessId }));
    }

    // 2. Retrieve warehouses for the business
    let warehouses: Warehouse[] = [];
    try {
      warehouses = await FirestoreService.getWarehouses(businessId);
    } catch (e) {
      console.warn('[GroundingEngine] Warning fetching Firestore warehouses:', e);
    }

    if (!warehouses || warehouses.length === 0) {
      warehouses = INITIAL_WAREHOUSES.map((w) => ({ ...w, businessId }));
    }

    const warehouseMap = new Map<string, string>();
    warehouses.forEach((w) => warehouseMap.set(w.id, w.name));

    // 3. Match Products
    const searchQuery = (parsedIntent.productQuery || rawMessageText || '').toLowerCase();
    const matchedProducts = this.searchProducts(products, searchQuery);

    // 4. Warehouse Stock Details
    const warehouseStock = matchedProducts.slice(0, 5).map((prod) => {
      const whName = (prod.warehouseId && warehouseMap.get(prod.warehouseId)) || 'Asosiy ombor (Toshkent)';
      let status: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
      if (prod.stock <= 0) {
        status = 'out_of_stock';
      } else if (prod.stock <= (prod.lowStockThreshold || 2)) {
        status = 'low_stock';
      }
      return {
        productName: prod.name,
        warehouseName: whName,
        stock: prod.stock,
        price: prod.price,
        status,
      };
    });

    // 5. Order grounding (if intent is order_intent)
    let draftOrder: Order | null = null;
    if (parsedIntent.intent === 'order_intent') {
      const targetProduct = matchedProducts[0] || products[0];
      const qty = parsedIntent.quantity || 1;
      const unitPrice = targetProduct ? targetProduct.price : 0;
      const subtotal = unitPrice * qty;
      const deliveryPrice = 25000;
      const total = subtotal + deliveryPrice;

      try {
        draftOrder = await OrderService.createDraftOrder({
          businessId,
          customerId,
          conversationId,
          customerName,
          customerPhone: parsedIntent.customerPhone || customerPhone,
          deliveryAddress: parsedIntent.deliveryAddress || 'Toshkent shahri',
          items: targetProduct
            ? [
                {
                  productId: targetProduct.id,
                  productName: targetProduct.name,
                  quantity: qty,
                  unitPrice,
                  totalPrice: subtotal,
                },
              ]
            : [],
          subtotal,
          deliveryPrice,
          total,
          customerNote: `Telegram orqali xarid niyati: "${rawMessageText}"`,
        });
      } catch (orderErr) {
        console.warn('[GroundingEngine] Warning creating draft order:', orderErr);
      }
    }

    return {
      intent: parsedIntent.intent,
      matchedProducts,
      warehouseStock,
      draftOrder,
      businessName: 'AI SavdoBot Do\'koni',
      currency: 'UZS',
      deliveryInfo: {
        price: 25000,
        zones: ['Toshkent shahri', 'Toshkent viloyati', 'Viloyatlararo BTS pochta'],
      },
    };
  }

  private static searchProducts(products: Product[], query: string): Product[] {
    if (!query) return products.slice(0, 5);

    const tokens = query
      .toLowerCase()
      .split(/[\s,.\-!?;]+/)
      .filter((t) => t.length > 1);

    if (tokens.length === 0) return products.slice(0, 5);

    const scored = products.map((prod) => {
      let score = 0;
      const name = prod.name.toLowerCase();
      const brand = (prod.brand || '').toLowerCase();
      const model = (prod.model || '').toLowerCase();
      const desc = (prod.description || '').toLowerCase();
      const sku = (prod.sku || '').toLowerCase();

      for (const tok of tokens) {
        if (name.includes(tok)) score += 5;
        if (model.includes(tok)) score += 4;
        if (brand.includes(tok)) score += 3;
        if (sku.includes(tok)) score += 3;
        if (desc.includes(tok)) score += 1;
      }

      return { prod, score };
    });

    const filtered = scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.prod);

    return filtered.length > 0 ? filtered : products.slice(0, 3);
  }
}
