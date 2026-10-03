import { GoogleGenAI } from '@google/genai';
import { Product, AIIntent } from '../types';

export interface AISalesContext {
  businessName: string;
  phone: string;
  address: string;
  workingHours: string;
  deliveryZones: string[];
  deliveryPrice: number;
  freeDeliveryThreshold?: number;
  paymentMethods: string[];
  products: Product[];
  customerName?: string;
  conversationHistory: { role: 'user' | 'model'; content: string }[];
}

export interface IntentDetectionResult {
  intent: AIIntent;
  confidence: number;
  extractedProductQuery?: string;
  extractedQuantity?: number;
  extractedVariant?: string;
  extractedPhone?: string;
  extractedAddress?: string;
  needsHumanAttention: boolean;
  attentionReason?: string;
}

export interface ProductExtractionResult {
  name: string;
  variant?: string;
  brand?: string;
  model?: string;
  category?: string;
  price: number;
  costPrice?: number;
  quantity: number;
  confidence: number;
}

// Client-side or proxy-backed Gemini instance
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (window as any).__GEMINI_API_KEY__ || '';
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * 1. Intent Detection with fallback heuristics
 */
export async function detectCustomerIntent(
  userMessage: string,
  history: { role: string; content: string }[] = []
): Promise<IntentDetectionResult> {
  const lower = userMessage.toLowerCase();

  // Fast offline regex / heuristics for responsiveness and reliability
  const isAskingPrice = lower.includes('narx') || lower.includes('qancha') || lower.includes('nechapul') || lower.includes('necha pul') || lower.includes('som') || lower.includes('so\'m');
  const isAskingStock = lower.includes('bormi') || lower.includes('mavjudmi') || lower.includes('qoldiq') || lower.includes('yetib keld') || lower.includes('keldimi');
  const isAskingDelivery = lower.includes('yetkaz') || lower.includes('dostavka') || lower.includes('pochta') || lower.includes('viloyat') || lower.includes('kuryer');
  const isAskingPayment = lower.includes('tolov') || lower.includes('to\'lov') || lower.includes('click') || lower.includes('payme') || lower.includes('naqd') || lower.includes('uzum') || lower.includes('kredit') || lower.includes('nasiya');
  const isOrdering = lower.includes('buyurtma') || lower.includes('olaman') || lower.includes('beraman') || lower.includes('zakaz') || lower.includes('yuboring');
  const isAskingDiscount = lower.includes('chegirma') || lower.includes('skidka') || lower.includes('arzon') || lower.includes('kelishtir');

  // Detect discount or human escalation
  if (isAskingDiscount) {
    return {
      intent: 'HUMAN_AGENT_REQUEST',
      confidence: 0.95,
      needsHumanAttention: true,
      attentionReason: "Mijoz chegirma yoki maxsus narx so'ramoqda. Biznes egasi tasdiqlashi lozim."
    };
  }

  // Attempt Gemini API if key is available
  try {
    const ai = getGeminiClient();
    if (ai) {
      const prompt = `Siz Telegram savdo botining intentsiyani aniqlash tizimisiz.
Mijoz xabari: "${userMessage}"
Intentsiyalar:
- PRODUCT_SEARCH (mahsulot izlash)
- PRICE_REQUEST (narx so'rash)
- STOCK_CHECK (mavjudlikni so'rash)
- DELIVERY_QUESTION (yetkazib berish haqida)
- PAYMENT_QUESTION (to'lov usullari)
- ORDER_REQUEST (buyurtma berish)
- HUMAN_AGENT_REQUEST (operator, chegirma, shikoyat)
- OTHER (boshqa)

Faqat JSON formatida javob bering:
{
  "intent": "...",
  "confidence": 0.95,
  "extractedProductQuery": "agar mahsulot nomi bo'lsa",
  "extractedQuantity": 1,
  "extractedVariant": "agar xotira/rang bo'lsa",
  "extractedPhone": "agar telefon yozgan bo'lsa",
  "extractedAddress": "agar manzil bo'lsa",
  "needsHumanAttention": false,
  "attentionReason": ""
}`;
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });
      if (response.text) {
        return JSON.parse(response.text) as IntentDetectionResult;
      }
    }
  } catch (err) {
    console.warn('Gemini intent detection fallback used:', err);
  }

  // Heuristic rule matching
  if (isOrdering) {
    const phoneMatch = userMessage.match(/(\+?998\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}|\d{9})/);
    return {
      intent: 'ORDER_REQUEST',
      confidence: 0.9,
      extractedPhone: phoneMatch ? phoneMatch[0] : undefined,
      needsHumanAttention: false
    };
  }
  if (isAskingPrice) return { intent: 'PRICE_REQUEST', confidence: 0.88, needsHumanAttention: false };
  if (isAskingStock) return { intent: 'STOCK_CHECK', confidence: 0.88, needsHumanAttention: false };
  if (isAskingDelivery) return { intent: 'DELIVERY_QUESTION', confidence: 0.88, needsHumanAttention: false };
  if (isAskingPayment) return { intent: 'PAYMENT_QUESTION', confidence: 0.88, needsHumanAttention: false };

  return { intent: 'PRODUCT_SEARCH', confidence: 0.75, needsHumanAttention: false };
}

/**
 * 2. Search products strictly in structured catalog
 */
export function searchCatalog(query: string, products: Product[]): Product[] {
  if (!query || !query.trim()) return products;
  const q = query.toLowerCase().trim();
  const tokens = q.split(/\s+/).filter(Boolean);

  return products.filter((p) => {
    const haystack = `${p.name} ${p.brand} ${p.model} ${p.category} ${p.sku} ${p.variants?.map(v => v.name).join(' ') || ''}`.toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}

/**
 * 3. Generate grounded sales answer
 */
export async function generateSalesResponse(
  userMessage: string,
  context: AISalesContext
): Promise<{ text: string; matchedProducts: Product[]; needsHumanAttention: boolean; attentionReason?: string }> {
  // First, check intent
  const intentResult = await detectCustomerIntent(userMessage);

  if (intentResult.needsHumanAttention) {
    return {
      text: "Assalomu alaykum! Bu masala (maxsus chegirma yoki taklif) bo'yicha do'konimiz menejeri tez orada shaxsan siz bilan bog'lanadi va eng qulay shartlarni taklif qiladi.",
      matchedProducts: [],
      needsHumanAttention: true,
      attentionReason: intentResult.attentionReason
    };
  }

  // Search in local catalog
  const matched = searchCatalog(userMessage, context.products);
  const matchedProduct = matched.length > 0 ? matched[0] : null;

  // If Gemini API is reachable, use strict prompt
  try {
    const ai = getGeminiClient();
    if (ai) {
      const catalogSummary = context.products.map(p => 
        `- ${p.name} (${p.brand || ''}): Narxi: ${p.price.toLocaleString()} so'm, Omborda: ${p.stock} dona, Variantlar: ${p.variants?.map(v => `${v.name} (${v.price.toLocaleString()} so'm)`).join(', ') || 'standart'}`
      ).join('\n');

      const systemPrompt = `Siz "${context.businessName}" do'konining Telegram savdo bo'yicha aqlli va xushmuomala sotuvchi agentisiz.
QAT'IY QOIDALAR:
1. Siz faqat quyidagi berilgan mahsulotlar ro'yxatidagi ma'lumotlarga asoslanib javob berasiz.
2. Narx, qoldiq yoki xususiyatlarni O'ZINGIZDAN TO'QIMANG! Agar omborda bo'lmasa yoki narxi bo'lmasa, "Afsuski hozirda bu mahsulot omborda qolmagan" deb ayting.
3. Yetkazib berish: ${context.deliveryZones.join(', ')}. Yetkazib berish narxi: ${context.deliveryPrice > 0 ? context.deliveryPrice.toLocaleString() + ' so\'m' : 'Bepul'}.
4. To'lov usullari: ${context.paymentMethods.join(', ')}.
5. Agar mijoz buyurtma qilmoqchi bo'lsa, xushmuomala holda telefon raqami va yetkazib berish manzilini so'rang.
6. Javobingiz o'zbek tilida, lo'nda, do'stona va Telegram formatida (chiroyli emoji bilan) bo'lsin.

DO'KON MAHSULOTLARI:
${catalogSummary}
`;
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nMijoz: "${userMessage}"\nDo'kon xodimi sifatida javob bering:` }] }
        ]
      });

      if (response.text) {
        return {
          text: response.text.trim(),
          matchedProducts: matched,
          needsHumanAttention: false
        };
      }
    }
  } catch (err) {
    console.warn('Gemini response fallback used:', err);
  }

  // Grounded Deterministic Uzbek Sales Engine (No hallucinations)
  if (matchedProduct) {
    if (intentResult.intent === 'STOCK_CHECK' || userMessage.toLowerCase().includes('bormi')) {
      if (matchedProduct.stock > 0) {
        const variantText = matchedProduct.variants?.length 
          ? `\nVariantlar: ${matchedProduct.variants.map(v => `${v.name} - ${v.price.toLocaleString()} so'm`).join(', ')}`
          : '';
        return {
          text: `Ha, ${matchedProduct.name} mavjud!\n💰 Narxi: ${matchedProduct.price.toLocaleString()} so'm\n📦 Qoldiq: ${matchedProduct.stock} dona mavjud.${variantText}\n\nBuyurtma berishni istaysizmi? Telefon raqamingizni yuborsangiz, rasmiylashtirib beramiz.`,
          matchedProducts: [matchedProduct],
          needsHumanAttention: false
        };
      } else {
        return {
          text: `Afsuski, hozirda ${matchedProduct.name} omborimizda tugagan. Yangi partiya kelishi bilan xabar berishimizni xohlaysizmi?`,
          matchedProducts: [matchedProduct],
          needsHumanAttention: false
        };
      }
    }

    if (intentResult.intent === 'PRICE_REQUEST') {
      return {
        text: `${matchedProduct.name} narxi: ${matchedProduct.price.toLocaleString()} so'm.\n📦 Hozirda omborda ${matchedProduct.stock} dona bor.\n\nYetkazib berish yoki xarid qilish uchun telefon raqamingizni qoldirishingiz mumkin.`,
        matchedProducts: [matchedProduct],
        needsHumanAttention: false
      };
    }
  }

  if (intentResult.intent === 'DELIVERY_QUESTION') {
    return {
      text: `Ha, ${context.deliveryZones.join(', ')} bo'ylab yetkazib berish xizmatimiz mavjud! 🚚\nYetkazib berish narxi: ${context.deliveryPrice > 0 ? context.deliveryPrice.toLocaleString() + ' so\'m' : 'Toshkent bo\'ylab bepul'}.\nKuryerimiz buyurtmangizni tezda yetkazib beradi.`,
      matchedProducts: [],
      needsHumanAttention: false
    };
  }

  if (intentResult.intent === 'PAYMENT_QUESTION') {
    return {
      text: `Bizda to'lov quyidagi usullarda qabul qilinadi: ${context.paymentMethods.join(', ')} 💳.\nBuyurtmani olgandan so'ng naqd yoki karta orqali to'lashingiz mumkin.`,
      matchedProducts: [],
      needsHumanAttention: false
    };
  }

  if (intentResult.intent === 'ORDER_REQUEST') {
    return {
      text: `Albatta! Buyurtmani tezda rasmiylashtirish uchun quyidagilarni yuboring:\n1. 📱 Telefon raqamingiz\n2. 📍 Yetkazib berish manzili\n\nKuryerimiz tez orada siz bilan bog'lanadi!`,
      matchedProducts: matched,
      needsHumanAttention: false
    };
  }

  return {
    text: `Assalomu alaykum! "${context.businessName}" do'koniga xush kelibsiz! 👋\nQaysi mahsulot yoki model haqida ma'lumot olishni istaysiz? Bizda smartfonlar, noutbuklar va original aksessuarlar kafolat bilan mavjud.`,
    matchedProducts: [],
    needsHumanAttention: false
  };
}

/**
 * 4. Parse raw text into structured product for quick AI addition
 * e.g. "Redmi Note 14 Pro 8/256, 3 200 000 so'm, 5 dona"
 */
export async function parseProductFromText(rawText: string): Promise<ProductExtractionResult> {
  try {
    const ai = getGeminiClient();
    if (ai) {
      const prompt = `Foydalanuvchi matnidan mahsulot ma'lumotlarini ajratib oling:
"${rawText}"

Faqat JSON formatda chiqaring:
{
  "name": "Mahsulot nomi",
  "variant": "Xotira/rang/variant",
  "brand": "Brend nomi",
  "model": "Model",
  "category": "Kategoriya (Telefonlar, Noutbuklar, Aksessuarlar va h.k.)",
  "price": 3200000,
  "costPrice": 2700000,
  "quantity": 5,
  "confidence": 0.95
}`;
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });
      if (response.text) {
        return JSON.parse(response.text) as ProductExtractionResult;
      }
    }
  } catch (err) {
    console.warn('Gemini text parser fallback used:', err);
  }

  // Regex fallback parser
  let name = rawText.split(/[,;\n]/)[0].trim();
  let variant = '';
  let quantity = 1;
  let price = 0;

  // Extract quantity
  const qtyMatch = rawText.match(/(\d+)\s*(dona|ta|shtuk|pcs)/i);
  if (qtyMatch) {
    quantity = parseInt(qtyMatch[1], 10);
  }

  // Extract price
  const priceClean = rawText.replace(/\s/g, '');
  const priceMatch = priceClean.match(/(\d{5,9})/);
  if (priceMatch) {
    price = parseInt(priceMatch[1], 10);
  }

  // Extract variant if has 8/256 or 128gb or similar
  const variantMatch = rawText.match(/(\d+[\/]\d+|\d+\s*gb|\d+\s*tb)/i);
  if (variantMatch) {
    variant = variantMatch[0];
  }

  return {
    name: name || 'Yangi mahsulot',
    variant: variant || undefined,
    category: 'Telefonlar',
    price: price || 1000000,
    costPrice: Math.round(price * 0.85) || 850000,
    quantity: quantity || 1,
    confidence: 0.85
  };
}

/**
 * 5. Generate Admin response draft for escalated queries
 */
export async function generateAdminDraft(
  customerName: string,
  userQuestion: string,
  businessName: string
): Promise<string> {
  try {
    const ai = getGeminiClient();
    if (ai) {
      const prompt = `Siz "${businessName}" do'koni ma'murisiz.
Mijoz: "${customerName}"
Mijoz savoli: "${userQuestion}"

Mijozga do'stona, o'zbek tilida, xushmuomala va professional sotuvchi sifatida javob xati qoralamasini yozing. Chegirma yoki maxsus taklif bo'lsa, xushfe'l ohangda bayon eting:`;
      const res = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt
      });
      if (res.text) return res.text.trim();
    }
  } catch (e) {
    console.warn('Draft gen fallback:', e);
  }

  return `Assalomu alaykum, ${customerName} aka! 
Siz so'ragan taklif bo'yicha menejerimiz bilan kelishdik. 2 dona xarid qilsangiz, har biriga maxsus qulay chegirma va bepul yetkazib berish xizmatini taqdim etamiz. 
Buyurtmani rasmiylashtirish uchun telefon raqamingizni qoldirishingiz mumkinmi?`;
}
