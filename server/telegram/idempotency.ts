import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';

export class IdempotencyService {
  /**
   * Checks if a Telegram update has already been processed.
   * If not processed, stores the update_id to prevent duplicate ingestion.
   */
  static async checkAndRecordUpdate(updateId: number, businessId: string): Promise<boolean> {
    const docId = `upd_${updateId}`;
    const updateRef = doc(db, 'telegram_updates', docId);

    try {
      const snap = await getDoc(updateRef);
      if (snap.exists()) {
        console.log(`[Idempotency] ⏭️ Update ${updateId} already processed. Skipping.`);
        return true; // Already processed
      }

      await setDoc(updateRef, {
        updateId,
        businessId,
        processedAt: Date.now(),
      });

      return false; // New update, proceed
    } catch (err) {
      console.warn(`[Idempotency] Warning checking update ${updateId}:`, err);
      // Fail-safe: allow processing if Firestore transient check fails
      return false;
    }
  }
}
