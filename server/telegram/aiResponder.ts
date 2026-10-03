import { GoogleGenAI } from '@google/genai';
import { GroundedContext } from '../../src/types/crm';

export class AIResponder {
  private static getGeminiClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return null;
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  /**
   * Generates a grounded AI response for Telegram based on intent and real store data.
   */
  static async generateResponse(params: {
    customerName: string;
    rawMessageText: string;
    groundedContext: GroundedContext;
  }): Promise<string> {
    const { customerName, rawMessageText, groundedContext } = params;
    const { intent, matchedProducts, warehouseStock, draftOrder, businessName } = groundedContext;

    // 1. Try Gemini AI Model ('gemini-3.8-flash')
    const ai = this.getGeminiClient();
    if (ai) {
      try {
        const topProduct = matchedProducts[0];
        const stockInfo = warehouseStock[0];

        const systemPrompt = `Siz O'zbekistondagi "${businessName}" do'konining professional, samimiy va tezkor Telegram savdo yordamchisisiz (AI SavdoBot).
Sizning vazifangiz mijozga do'kondagi haqiqiy ma'lumotlar asosida aniq va chiroyli javob qaytarish.

Qoidalar:
- O'zbek tilida (mijoz ruschada yozgan bo'lsa ruschada), xushmuomala, emoji'lar bilan boyitilgan ixcham javob bering.
- Narxlarni faqat berilgan ma'lumotlardan oling, aslo to'qib chiqarmang. Narxni "so'm" bilan formatlang (masalan, 14 900 000 so'm).
- Ombordagi qoldiqni aniq ayting.
- Intentga qarab:
  * "greeting": Salomlashing, do'konga xush kelibsiz deng va qanday mahsulot izlayotganini so'rang.
  * "product_query": Mahsulot modeli, afzalliklari va narxini tushuntiring.
  * "stock_query": Omborda nechta borligini va qaysi omborda ekanligini ayting.
  * "price_query": Narxini ayting va buyurtma berishni taklif qiling.
  * "order_intent": Buyurtma qabul qilinganini (draft raqami: ${draftOrder?.id || 'Yangi'}), jami summani (${draftOrder?.total?.toLocaleString() || 'aniqlanmoqda'} so'm) ko'rsating va tasdiqlash uchun manzil/raqamni aniqlashtiring.
  * "unknown": Qanday yordam bera olishingizni muloyimlik bilan taklif qiling.

Mavjud ma'lumotlar (GROUNDED CONTEXT):
- Intent: ${intent}
- Mijoz ismi: ${customerName}
- Eng mos mahsulot: ${topProduct ? `${topProduct.name} (${topProduct.price?.toLocaleString()} so'm, omborda: ${topProduct.stock} dona)` : 'Katalogdagi mahsulotlar'}
- Ombor ma'lumoti: ${stockInfo ? `${stockInfo.warehouseName}: ${stockInfo.stock} dona (${stockInfo.status})` : 'Mavjud'}
${draftOrder ? `- Yaratilgan qoralama buyurtma: ID ${draftOrder.id}, Jami: ${draftOrder.total?.toLocaleString()} so'm` : ''}

Mijoz xabari: "${rawMessageText}"`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: systemPrompt,
        });

        const reply = response.text?.trim();
        if (reply) {
          return reply;
        }
      } catch (err: any) {
        console.warn('[AIResponder] Gemini generation notice, using grounded response:', err?.message?.slice(0, 100) || 'quota limit');
      }
    }

    // 2. High-quality deterministic fallback response
    return this.generateFallbackResponse(params);
  }

  /**
   * Deterministic fallback response generation based on grounded data
   */
  private static generateFallbackResponse(params: {
    customerName: string;
    rawMessageText: string;
    groundedContext: GroundedContext;
  }): string {
    const { customerName, groundedContext } = params;
    const { intent, matchedProducts, warehouseStock, draftOrder, businessName } = groundedContext;
    const topProd = matchedProducts[0];
    const stock = warehouseStock[0];
    const greetingName = customerName && customerName !== 'Mijoz' ? `, ${customerName}` : '';

    switch (intent) {
      case 'greeting':
        return `Assalomu alaykum${greetingName}! 👋\n\n"${businessName}" rasmiy savdo botiga xush kelibsiz!\n\nBizda smartfonlar, gadjetlar va maishiy texnikalarning eng so'nggi modellari mavjud. Sizga qaysi mahsulot kerak? Narxlar va ombordagi mavjudlikni darhol tekshirib beraman.`;

      case 'price_query':
        if (topProd) {
          return `📱 ${topProd.name}\n💰 Narxi: ${topProd.price.toLocaleString()} so'm\n📦 Omborda mavjud: ${topProd.stock} dona\n\nYetkazib berish xizmati mavjud! Buyurtma berishni istaysizmi?`;
        }
        return `Assalomu alaykum! Do'konimizdagi barcha mahsulotlar eng maqbul narxlarda taklif etiladi. Qaysi modelning narxini bilmoqchisiz?`;

      case 'stock_query':
        if (topProd && stock) {
          if (stock.stock > 0) {
            return `✅ Ha, mavjud!\n\n📱 Mahsulot: ${topProd.name}\n🏬 Ombor: ${stock.warehouseName}\n📦 Qoldiq: ${stock.stock} dona\n💰 Narxi: ${topProd.price.toLocaleString()} so'm\n\nBuyurtma berish uchun "olaman" deb yozishingiz yoki telefon raqamingizni qoldirishingiz mumkin.`;
          } else {
            return `Afsuski, ${topProd.name} ayni damda omborimizda tugagan. Tez kunlarda yangi partiya kelishi kutilmoqda. Boshqa muqobil modellarni ko'rib chiqishni istaysizmi?`;
          }
        }
        return `Omborda mavjudligini aniqlash uchun qaysi mahsulot kerakligini yozib yuboring.`;

      case 'order_intent':
        if (draftOrder && topProd) {
          return `🎉 Buyurtmangiz qabul qilindi!\n\n📋 Buyurtma ID: #${draftOrder.id.slice(-6)}\n🛍 Mahsulot: ${topProd.name} (${draftOrder.items[0]?.quantity || 1} dona)\n💰 Mahsulot summasi: ${draftOrder.subtotal?.toLocaleString()} so'm\n🚚 Yetkazib berish: ${draftOrder.deliveryPrice?.toLocaleString()} so'm\n💳 Jami: ${draftOrder.total?.toLocaleString()} so'm\n\nBuyurtmani yakunlash uchun telefon raqamingiz va yetkazish manzilini yuboring. Tez orada menejerimiz siz bilan bog'lanadi!`;
        }
        return `Xaridingiz uchun tashakkur! Qaysi mahsulotdan necha dona olmoqchisiz va qaysi manzilga yetkazib beraylik? Telefon raqamingizni yuborsangiz, darhol buyurtmani rasmiylashtiramiz.`;

      case 'product_query':
        if (topProd) {
          return `📱 ${topProd.name}\n${topProd.description ? `ℹ️ ${topProd.description}\n` : ''}💰 Narxi: ${topProd.price.toLocaleString()} so'm\n📦 Omborda: ${topProd.stock} dona mavjud\n\nBatafsil ma'lumot yoki buyurtma berish uchun yozishingiz mumkin.`;
        }
        return `Bizda smartfonlar va aksessuarlarning keng assortimenti mavjud. Qidirayotgan mahsulotingiz nomini yozing, barcha xususiyatlarini taqdim etamiz!`;

      case 'unknown':
      default:
        return `Assalomu alaykum${greetingName}! 👋\n\nXabaringiz qabul qilindi. Sizga qanday yordam bera olaman?\n• Mahsulot narxini bilish\n• Omborda bor-yo'qligini tekshirish\n• Buyurtma berish\n\nIltimos, qiziqtirgan savolingizni yozib yuboring.`;
    }
  }
}
