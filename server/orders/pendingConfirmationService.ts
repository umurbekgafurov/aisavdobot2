import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { handleFirestoreError, OperationType } from '../../src/lib/firestoreErrors';
import { PendingOrderConfirmation, PendingConfirmationStatus } from '../../src/types/orders';

export const PENDING_CONFIRMATION_EXPIRATION_MS = 15 * 60 * 1000; // 15 minutes

export interface CreatePendingConfirmationInput {
  businessId: string;
  customerId: string;
  conversationId: string;
  productId: string;
  productName: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  currency?: string;
}

export type ConfirmationActionType = 'confirm' | 'cancel' | 'ambiguous' | 'change' | 'other';

export interface ConfirmationActionResult {
  action: ConfirmationActionType;
  language: 'uz' | 'ru' | 'en' | 'unknown';
}

export class PendingConfirmationService {
  /**
   * Deterministic ID scoped strictly by businessId + customerId + conversationId
   */
  static getPendingConfirmationId(businessId: string, customerId: string, conversationId: string): string {
    const cleanBiz = businessId.replace(/[^a-zA-Z0-9]/g, '_');
    const cleanCust = customerId.replace(/[^a-zA-Z0-9]/g, '_');
    const cleanConv = conversationId.replace(/[^a-zA-Z0-9]/g, '_');
    return `pending_${cleanBiz}_${cleanCust}_${cleanConv}`;
  }

  /**
   * Normalizes customer text for robust confirmation detection
   */
  static normalizeText(text: string): string {
    return (text || '')
      .toLowerCase()
      .replace(/[\u2018\u2019\u0060\u00B4]/g, "'") // unify curly quotes to standard apostrophe
      .replace(/[.,\/#!$%\^&\*;:{}=\-_~()?]/g, ' ') // replace punctuation with spaces
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Detects whether an incoming message is a confirmation, cancellation, ambiguous statement, or change
   */
  static detectConfirmationAction(text: string): ConfirmationActionResult {
    const normalized = this.normalizeText(text);

    if (!normalized) {
      return { action: 'other', language: 'unknown' };
    }

    // Check for quantity or product change signals first:
    // e.g. "yo'q 3 ta kerak", "3 ta kerak", "2 dona olaman", "net mne nuzhno 3", "no 3 please"
    const hasQuantitySignal = /\b(\d+)\s*(ta|dona|sht|шт|pcs?|units?)\b/i.test(normalized);
    const hasChangeIntentSignal = /\b(kerak|olaman|boshqa|boshqasi|almashtir|нужно|другой|хочу|want|need|instead)\b/i.test(normalized);

    if (hasQuantitySignal || (hasChangeIntentSignal && /\b(yo'q|bekor|нет|отмена|no|cancel|\d+)\b/i.test(normalized))) {
      const isRu = /[а-яё]/i.test(normalized);
      const isEn = /\b(no|cancel|need|want|pcs|units)\b/i.test(normalized);
      return { action: 'change', language: isRu ? 'ru' : isEn ? 'en' : 'uz' };
    }

    // Uzbek Confirmations: "ha", "ha tasdiqlayman", "tasdiqlayman", "buyurtma bering", "olaman"
    const uzConfirmPatterns = [
      /^ha$/,
      /^ha\s+tasdiqlayman$/,
      /^tasdiqlayman$/,
      /^buyurtma\s+bering$/,
      /^olaman$/,
      /^ha\s+olaman$/,
      /^ha\s+albatta$/,
    ];
    if (uzConfirmPatterns.some((pattern) => pattern.test(normalized))) {
      return { action: 'confirm', language: 'uz' };
    }

    // Russian Confirmations: "да", "подтверждаю", "заказываю"
    const ruConfirmPatterns = [
      /^да$/,
      /^подтверждаю$/,
      /^заказываю$/,
      /^да\s+подтверждаю$/,
      /^да\s+заказываю$/,
      /^да\s+конечно$/,
    ];
    if (ruConfirmPatterns.some((pattern) => pattern.test(normalized))) {
      return { action: 'confirm', language: 'ru' };
    }

    // English Confirmations: "yes", "confirm", "i confirm", "place the order"
    const enConfirmPatterns = [
      /^yes$/,
      /^confirm$/,
      /^i\s+confirm$/,
      /^place\s+the\s+order$/,
      /^yes\s+confirm$/,
      /^yes\s+please$/,
      /^yes\s+place\s+the\s+order$/,
    ];
    if (enConfirmPatterns.some((pattern) => pattern.test(normalized))) {
      return { action: 'confirm', language: 'en' };
    }

    // Uzbek Cancellations: "yo'q", "yo‘q", "bekor", "bekor qil", "bekor qiling"
    const uzCancelPatterns = [
      /^yo'q$/,
      /^yo'q\s+rahmat$/,
      /^bekor$/,
      /^bekor\s+qil$/,
      /^bekor\s+qiling$/,
      /^kerak\s+emas$/,
      /^bekor\s+qilinsin$/,
    ];
    if (uzCancelPatterns.some((pattern) => pattern.test(normalized))) {
      return { action: 'cancel', language: 'uz' };
    }

    // Russian Cancellations: "нет", "отмена", "отменить"
    const ruCancelPatterns = [
      /^нет$/,
      /^нет\s+спасибо$/,
      /^отмена$/,
      /^отменить$/,
      /^не\s+надо$/,
      /^отмените$/,
    ];
    if (ruCancelPatterns.some((pattern) => pattern.test(normalized))) {
      return { action: 'cancel', language: 'ru' };
    }

    // English Cancellations: "no", "cancel", "cancel it"
    const enCancelPatterns = [
      /^no$/,
      /^no\s+thanks$/,
      /^cancel$/,
      /^cancel\s+it$/,
      /^don't\s+order$/,
      /^do\s+not\s+order$/,
    ];
    if (enCancelPatterns.some((pattern) => pattern.test(normalized))) {
      return { action: 'cancel', language: 'en' };
    }

    // Ambiguous: "balki", "o'ylab ko'raman", "keyin", "maybe", "not sure", "может быть", "подумаю"
    const uzAmbiguousPatterns = [
      /^balki$/,
      /^o'ylab\s+ko'raman$/,
      /^keyin$/,
      /^shoshmay\s+turing$/,
      /^aniq\s+emas$/,
    ];
    if (uzAmbiguousPatterns.some((pattern) => pattern.test(normalized))) {
      return { action: 'ambiguous', language: 'uz' };
    }

    const ruAmbiguousPatterns = [
      /^может\s+быть$/,
      /^подумаю$/,
      /^я\s+подумаю$/,
      /^позже$/,
      /^не\s+уверен$/,
    ];
    if (ruAmbiguousPatterns.some((pattern) => pattern.test(normalized))) {
      return { action: 'ambiguous', language: 'ru' };
    }

    const enAmbiguousPatterns = [
      /^maybe$/,
      /^not\s+sure$/,
      /^i\s+will\s+think$/,
      /^later$/,
      /^let\s+me\s+think$/,
    ];
    if (enAmbiguousPatterns.some((pattern) => pattern.test(normalized))) {
      return { action: 'ambiguous', language: 'en' };
    }

    return { action: 'other', language: 'unknown' };
  }

  /**
   * Creates a pending confirmation state with backend-calculated price and subtotal
   */
  static async createPendingConfirmation(input: CreatePendingConfirmationInput): Promise<PendingOrderConfirmation> {
    if (!input.businessId || !input.businessId.trim()) {
      throw new Error('[PendingConfirmation] businessId is required.');
    }
    if (!input.customerId || !input.customerId.trim()) {
      throw new Error('[PendingConfirmation] customerId is required.');
    }
    if (!input.conversationId || !input.conversationId.trim()) {
      throw new Error('[PendingConfirmation] conversationId is required.');
    }
    if (!input.productId || !input.productId.trim()) {
      throw new Error('[PendingConfirmation] productId is required.');
    }
    if (!input.productName || !input.productName.trim()) {
      throw new Error('[PendingConfirmation] productName is required.');
    }
    if (typeof input.quantity !== 'number' || !Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new Error(`[PendingConfirmation] Invalid quantity: ${input.quantity}. Must be positive integer.`);
    }
    if (typeof input.unitPrice !== 'number' || isNaN(input.unitPrice) || input.unitPrice <= 0) {
      throw new Error(`[PendingConfirmation] Invalid unitPrice: ${input.unitPrice}. Must be positive number.`);
    }

    const businessId = input.businessId.trim();
    const customerId = input.customerId.trim();
    const conversationId = input.conversationId.trim();
    const productId = input.productId.trim();
    const productName = input.productName.trim();
    const sku = input.sku ? input.sku.trim() : null;
    const quantity = input.quantity;
    const unitPrice = input.unitPrice;

    // Deterministic calculation by backend only: never trust client/Gemini
    const subtotal = Math.round(quantity * unitPrice * 100) / 100;
    const currency = input.currency || "so'm";
    const now = Date.now();
    const expiresAt = now + PENDING_CONFIRMATION_EXPIRATION_MS;

    const id = this.getPendingConfirmationId(businessId, customerId, conversationId);

    const pendingData: PendingOrderConfirmation = {
      id,
      businessId,
      customerId,
      conversationId,
      productId,
      productName,
      sku,
      quantity,
      unitPrice,
      subtotal,
      currency,
      status: 'pending_confirmation',
      createdAt: now,
      expiresAt,
    };

    try {
      const docRef = doc(db, 'pending_confirmations', id);
      await setDoc(docRef, pendingData);

      try {
        const convRef = doc(db, 'conversations', conversationId);
        await setDoc(convRef, {
          id: conversationId,
          businessId,
          customerId,
          pendingConfirmation: pendingData,
        }, { merge: true });
      } catch (convErr: any) {
        console.warn('[PendingConfirmation] Notice updating conversation doc:', convErr?.message || convErr);
      }

      console.log(`[PendingConfirmation] Created pending state for ${productName} (${quantity} pcs) for conv: ${conversationId}`);
      return pendingData;
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `pending_confirmations/${id}`);
      throw err;
    }
  }

  /**
   * Retrieves raw pending confirmation document regardless of status or expiration.
   * Strictly validates businessId, customerId, and conversationId.
   */
  static async getRawPendingConfirmation(
    businessId: string,
    customerId: string,
    conversationId: string
  ): Promise<PendingOrderConfirmation | null> {
    const id = this.getPendingConfirmationId(businessId, customerId, conversationId);
    const docRef = doc(db, 'pending_confirmations', id);

    try {
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        return null;
      }

      const data = snap.data() as PendingOrderConfirmation;

      // Strict multi-tenant security verification
      if (
        data.businessId !== businessId ||
        data.customerId !== customerId ||
        data.conversationId !== conversationId
      ) {
        console.warn(`[PendingConfirmation Security] Scope mismatch for confirmation ${id}`);
        return null;
      }

      return data;
    } catch (err: any) {
      handleFirestoreError(err, OperationType.GET, `pending_confirmations/${id}`);
      return null;
    }
  }

  /**
   * Retrieves active pending confirmation scoped by businessId, customerId, and conversationId.
   * If expired, not found, or not in pending_confirmation status, returns null.
   */
  static async getPendingConfirmation(
    businessId: string,
    customerId: string,
    conversationId: string
  ): Promise<PendingOrderConfirmation | null> {
    const data = await this.getRawPendingConfirmation(businessId, customerId, conversationId);
    if (!data) {
      return null;
    }

    if (data.status !== 'pending_confirmation') {
      return null;
    }

    // Check 15-minute expiration
    if (data.expiresAt && data.expiresAt < Date.now()) {
      console.log(`[PendingConfirmation] Confirmation ${data.id} has expired at ${new Date(data.expiresAt).toISOString()}`);
      return null;
    }

    return data;
  }

  /**
   * Transitions a pending confirmation to 'confirmed' status (M4.3.2).
   * Does NOT create final order, does NOT modify stock, does NOT notify admin.
   */
  static async confirmPendingConfirmation(
    businessId: string,
    customerId: string,
    conversationId: string
  ): Promise<{
    success: boolean;
    reason?: 'not_found' | 'expired' | 'already_confirmed' | 'already_cancelled';
    alreadyConfirmed?: boolean;
    pending?: PendingOrderConfirmation;
  }> {
    const existing = await this.getRawPendingConfirmation(businessId, customerId, conversationId);
    if (!existing) {
      return { success: false, reason: 'not_found' };
    }

    // Safe against repeated confirmation
    if (existing.status === 'confirmed') {
      return { success: true, alreadyConfirmed: true, pending: existing };
    }

    if (existing.status === 'cancelled') {
      return { success: false, reason: 'already_cancelled', pending: existing };
    }

    const now = Date.now();
    // Expiration check
    if (existing.status === 'expired' || (existing.expiresAt && existing.expiresAt < now)) {
      const expiredData: PendingOrderConfirmation = {
        ...existing,
        status: 'expired',
        expiredAt: now,
      };
      try {
        await setDoc(doc(db, 'pending_confirmations', existing.id), expiredData);
        await setDoc(doc(db, 'conversations', conversationId), { pendingConfirmation: expiredData }, { merge: true });
      } catch {
        // Non-blocking
      }
      return { success: false, reason: 'expired', pending: expiredData };
    }

    // Valid pending confirmation -> transition to 'confirmed'
    const updated: PendingOrderConfirmation = {
      ...existing,
      status: 'confirmed',
      confirmedAt: now,
    };

    try {
      const docRef = doc(db, 'pending_confirmations', existing.id);
      await setDoc(docRef, updated);

      try {
        const convRef = doc(db, 'conversations', conversationId);
        await setDoc(convRef, { pendingConfirmation: updated }, { merge: true });
      } catch {
        // Non-blocking
      }

      console.log(`[PendingConfirmation] Successfully confirmed pending confirmation ${existing.id} for ${existing.productName}`);
      return { success: true, pending: updated };
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `pending_confirmations/${existing.id}`);
      throw err;
    }
  }

  /**
   * Transitions a pending confirmation to 'cancelled' status (M4.3.2).
   * Does NOT create final order, does NOT modify stock.
   */
  static async cancelPendingConfirmation(
    businessId: string,
    customerId: string,
    conversationId: string
  ): Promise<{
    success: boolean;
    reason?: 'not_found' | 'expired' | 'already_confirmed' | 'already_cancelled';
    alreadyCancelled?: boolean;
    pending?: PendingOrderConfirmation;
  }> {
    const existing = await this.getRawPendingConfirmation(businessId, customerId, conversationId);
    if (!existing) {
      return { success: false, reason: 'not_found' };
    }

    if (existing.status === 'cancelled') {
      return { success: true, alreadyCancelled: true, pending: existing };
    }

    if (existing.status === 'confirmed') {
      return { success: false, reason: 'already_confirmed', pending: existing };
    }

    const now = Date.now();
    if (existing.status === 'expired' || (existing.expiresAt && existing.expiresAt < now)) {
      const expiredData: PendingOrderConfirmation = {
        ...existing,
        status: 'expired',
        expiredAt: now,
      };
      try {
        await setDoc(doc(db, 'pending_confirmations', existing.id), expiredData);
        await setDoc(doc(db, 'conversations', conversationId), { pendingConfirmation: expiredData }, { merge: true });
      } catch {
        // Non-blocking
      }
      return { success: false, reason: 'expired', pending: expiredData };
    }

    const updated: PendingOrderConfirmation = {
      ...existing,
      status: 'cancelled',
      cancelledAt: now,
    };

    try {
      const docRef = doc(db, 'pending_confirmations', existing.id);
      await setDoc(docRef, updated);

      try {
        const convRef = doc(db, 'conversations', conversationId);
        await setDoc(convRef, { pendingConfirmation: updated }, { merge: true });
      } catch {
        // Non-blocking
      }

      console.log(`[PendingConfirmation] Successfully cancelled pending confirmation ${existing.id}`);
      return { success: true, pending: updated };
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `pending_confirmations/${existing.id}`);
      throw err;
    }
  }

  /**
   * Clears pending confirmation (e.g. on cancellation, completion, or overwrite)
   */
  static async clearPendingConfirmation(
    businessId: string,
    customerId: string,
    conversationId: string
  ): Promise<void> {
    const id = this.getPendingConfirmationId(businessId, customerId, conversationId);
    try {
      const docRef = doc(db, 'pending_confirmations', id);
      await deleteDoc(docRef);

      try {
        const convRef = doc(db, 'conversations', conversationId);
        await setDoc(convRef, { pendingConfirmation: null }, { merge: true });
      } catch {
        // Non-blocking
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `pending_confirmations/${id}`);
    }
  }

  /**
   * Generates the customer confirmation question message based on language
   */
  static formatConfirmationQuestion(
    pending: PendingOrderConfirmation,
    language: 'uz' | 'ru' | 'en' | 'unknown'
  ): string {
    const lang = language === 'ru' ? 'ru' : language === 'en' ? 'en' : 'uz';
    const formattedUnit = pending.unitPrice.toLocaleString('uz-UZ').replace(/,/g, ' ');
    const formattedTotal = pending.subtotal.toLocaleString('uz-UZ').replace(/,/g, ' ');

    if (lang === 'ru') {
      return `${pending.quantity} шт. ${pending.productName} в наличии.\nЦена: ${formattedUnit} сум/шт.\nJami: ${formattedTotal} сум.\nПодтверждаете заказ?`;
    }

    if (lang === 'en') {
      return `${pending.quantity} pcs of ${pending.productName} available.\nPrice: ${formattedUnit} UZS each.\nTotal: ${formattedTotal} UZS.\nWould you like to confirm the order?`;
    }

    // Default: Uzbek Latin
    return `${pending.quantity} dona ${pending.productName} mavjud.\nNarxi: ${formattedUnit} so'm/dona.\nJami: ${formattedTotal} so'm.\nBuyurtmani tasdiqlaysizmi?`;
  }

  /**
   * Confirmation accepted response message (M4.3.2)
   */
  static formatConfirmedMessage(
    pending: PendingOrderConfirmation,
    language: 'uz' | 'ru' | 'en' | 'unknown'
  ): string {
    const lang = language === 'ru' ? 'ru' : language === 'en' ? 'en' : 'uz';
    if (lang === 'ru') {
      return 'Спасибо! Ваш заказ подтвержден. В ближайшее время он будет оформлен.';
    }
    if (lang === 'en') {
      return 'Thank you! Your order has been confirmed. It will be processed shortly.';
    }
    return "Rahmat! Buyurtmangiz tasdiqlandi. Tez orada buyurtmangiz rasmiylashtiriladi.";
  }

  /**
   * Cancellation response message (M4.3.2)
   */
  static formatCancelledMessage(
    pending: PendingOrderConfirmation,
    language: 'uz' | 'ru' | 'en' | 'unknown'
  ): string {
    const lang = language === 'ru' ? 'ru' : language === 'en' ? 'en' : 'uz';
    if (lang === 'ru') {
      return 'Ваш заказ отменен. Если вам понадобится что-то еще, обращайтесь!';
    }
    if (lang === 'en') {
      return 'Your order has been cancelled. Let us know if you need anything else!';
    }
    return "Buyurtmangiz bekor qilindi. Boshqa mahsulot kerak bo'lsa, bemalol murojaat qiling!";
  }

  /**
   * Ambiguous response message keeping confirmation pending (M4.3.2)
   */
  static formatAmbiguousMessage(
    pending: PendingOrderConfirmation,
    language: 'uz' | 'ru' | 'en' | 'unknown'
  ): string {
    const lang = language === 'ru' ? 'ru' : language === 'en' ? 'en' : 'uz';
    if (lang === 'ru') {
      return 'Для подтверждения заказа напишите «Да» или «Нет» для отмены.';
    }
    if (lang === 'en') {
      return 'Please reply with "Yes" to confirm your order or "No" to cancel it.';
    }
    return 'Buyurtmani tasdiqlash uchun "Ha" yoki bekor qilish uchun "Yo\'q" deb yozing.';
  }

  /**
   * Expired confirmation message (M4.3.2)
   */
  static formatExpiredMessage(language: 'uz' | 'ru' | 'en' | 'unknown'): string {
    const lang = language === 'ru' ? 'ru' : language === 'en' ? 'en' : 'uz';
    if (lang === 'ru') {
      return 'Извините, время подтверждения заказа истекло (15 минут). Пожалуйста, начните заказ заново.';
    }
    if (lang === 'en') {
      return 'Sorry, the order confirmation time has expired (15 minutes). Please start your order again.';
    }
    return "Kechirasiz, buyurtmani tasdiqlash vaqti tugagan (15 daqiqa). Iltimos, xaridni qaytadan boshlang.";
  }

  /**
   * Repeated confirmation message (already confirmed) (M4.3.2)
   */
  static formatAlreadyConfirmedMessage(language: 'uz' | 'ru' | 'en' | 'unknown'): string {
    const lang = language === 'ru' ? 'ru' : language === 'en' ? 'en' : 'uz';
    if (lang === 'ru') {
      return 'Ваш заказ уже подтвержден. Наш менеджер скоро свяжется с вами.';
    }
    if (lang === 'en') {
      return 'Your order has already been confirmed. Our manager will contact you soon.';
    }
    return "Buyurtmangiz allaqachon tasdiqlangan. Tez orada menejerimiz bog'lanadi.";
  }

  /**
   * Repeated cancellation message (already cancelled) (M4.3.2)
   */
  static formatAlreadyCancelledMessage(language: 'uz' | 'ru' | 'en' | 'unknown'): string {
    const lang = language === 'ru' ? 'ru' : language === 'en' ? 'en' : 'uz';
    if (lang === 'ru') {
      return 'Ваш заказ уже был отменен.';
    }
    if (lang === 'en') {
      return 'Your order has already been cancelled.';
    }
    return "Buyurtmangiz allaqachon bekor qilingan.";
  }
}
