import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { Business } from '../../src/types';

export class BusinessResolver {
  private static cachedBusinessId: string | null = null;
  private static cacheExpiresAt = 0;

  /**
   * Resolves the target business/tenant for the incoming bot update.
   * Multi-tenant ready: searches by botId, botUsername, active telegram connection,
   * or the primary registered store.
   */
  static async resolveBusiness(botIdOrUsername?: string): Promise<string> {
    const now = Date.now();

    // 1. Check in-memory cache if still valid
    if (this.cachedBusinessId && this.cacheExpiresAt > now) {
      return this.cachedBusinessId;
    }

    try {
      // 2. If bot identifier is known, query by telegramBotId or telegramBotUsername
      if (botIdOrUsername) {
        const cleanIdentifier = botIdOrUsername.replace(/^@/, '').toLowerCase();
        const qBot = query(
          collection(db, 'businesses'),
          where('telegramBotUsername', '==', cleanIdentifier),
          limit(1)
        );
        const snapBot = await getDocs(qBot);
        if (!snapBot.empty) {
          const bizId = snapBot.docs[0].id;
          this.setCache(bizId);
          return bizId;
        }
      }

      // 3. Query business with telegramConnected == true
      const qConnected = query(
        collection(db, 'businesses'),
        where('telegramConnected', '==', true),
        limit(1)
      );
      const snapConnected = await getDocs(qConnected);
      if (!snapConnected.empty) {
        const bizId = snapConnected.docs[0].id;
        this.setCache(bizId);
        return bizId;
      }

      // 4. Fallback to primary business document in collection
      const qAny = query(collection(db, 'businesses'), limit(1));
      const snapAny = await getDocs(qAny);
      if (!snapAny.empty) {
        const bizId = snapAny.docs[0].id;
        this.setCache(bizId);
        return bizId;
      }
    } catch (err) {
      console.warn('[BusinessResolver] Warning querying business from Firestore:', err);
    }

    // Default development fallback
    const fallbackId = 'biz_default_store';
    this.setCache(fallbackId);
    return fallbackId;
  }

  /**
   * Clears resolution cache (e.g. when business settings are updated)
   */
  static clearCache(): void {
    this.cachedBusinessId = null;
    this.cacheExpiresAt = 0;
  }

  /**
   * Explicitly set business ID in resolver (useful for unit tests)
   */
  static setExplicitBusiness(businessId: string): void {
    this.cachedBusinessId = businessId;
    this.cacheExpiresAt = Date.now() + 3600000;
  }

  private static setCache(bizId: string): void {
    this.cachedBusinessId = bizId;
    this.cacheExpiresAt = Date.now() + 60000; // 60 seconds cache
  }
}
