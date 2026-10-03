import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  Unsubscribe,
  increment
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Conversation } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';

export class ConversationService {
  /**
   * Generates a deterministic conversation ID for a given business and telegram chat ID.
   */
  static getConversationId(businessId: string, telegramChatId: string): string {
    const cleanBiz = businessId.replace(/[^a-zA-Z0-9]/g, '_');
    return `conv_${cleanBiz}_${telegramChatId}`;
  }

  /**
   * Upserts a conversation when a Telegram message arrives.
   */
  static async upsertTelegramConversation(params: {
    businessId: string;
    customerId: string;
    telegramChatId: string;
    lastMessagePreview: string;
    customerName?: string;
    customerUsername?: string;
  }): Promise<Conversation> {
    const { businessId, customerId, telegramChatId, lastMessagePreview, customerName, customerUsername } = params;
    const conversationId = this.getConversationId(businessId, telegramChatId);
    const conversationRef = doc(db, 'conversations', conversationId);
    const now = Date.now();

    try {
      const snap = await getDoc(conversationRef);

      if (snap.exists()) {
        const existing = snap.data() as Conversation;
        const updatePayload: any = {
          lastMessagePreview: lastMessagePreview.slice(0, 200),
          lastMessageAt: now,
          updatedAt: now,
          unreadCount: increment(1),
        };
        if (customerName) updatePayload.customerName = customerName;
        if (customerUsername) updatePayload.customerUsername = customerUsername;
        if (existing.status === 'closed') updatePayload.status = 'open';

        await updateDoc(conversationRef, updatePayload);
        return {
          ...existing,
          id: conversationId,
          ...updatePayload,
          unreadCount: (existing.unreadCount || 0) + 1,
        };
      } else {
        const newConversation: Conversation = {
          id: conversationId,
          businessId,
          customerId,
          channel: 'telegram',
          telegramChatId,
          status: 'open',
          assignedTo: null,
          lastMessagePreview: lastMessagePreview.slice(0, 200),
          lastMessageAt: now,
          unreadCount: 1,
          customerName: customerName || 'Mijoz',
          customerUsername: customerUsername || '',
          createdAt: now,
          updatedAt: now,
        };

        await setDoc(conversationRef, newConversation);
        return newConversation;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `conversations/${conversationId}`);
    }
  }

  /**
   * Mark a conversation as read (resets unreadCount to 0)
   */
  static async markConversationRead(conversationId: string): Promise<void> {
    try {
      const ref = doc(db, 'conversations', conversationId);
      await updateDoc(ref, { unreadCount: 0, updatedAt: Date.now() });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `conversations/${conversationId}`);
    }
  }

  /**
   * Get single conversation by ID
   */
  static async getConversation(conversationId: string): Promise<Conversation | null> {
    try {
      const snap = await getDoc(doc(db, 'conversations', conversationId));
      if (!snap.exists()) return null;
      return snap.data() as Conversation;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `conversations/${conversationId}`);
    }
  }

  /**
   * Fetch all conversations for a business
   */
  static async getConversationsByBusiness(businessId: string): Promise<Conversation[]> {
    try {
      const q = query(collection(db, 'conversations'), where('businessId', '==', businessId));
      const snap = await getDocs(q);
      const list: Conversation[] = [];
      snap.forEach((d) => list.push(d.data() as Conversation));
      return list.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'conversations');
    }
  }

  /**
   * Realtime subscription for conversations list
   */
  static subscribeConversations(
    businessId: string,
    onData: (conversations: Conversation[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(collection(db, 'conversations'), where('businessId', '==', businessId));
    return onSnapshot(
      q,
      (snap) => {
        const list: Conversation[] = [];
        snap.forEach((d) => list.push(d.data() as Conversation));
        list.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
        onData(list);
      },
      (err) => {
        console.error('[ConversationService realtime error]', err);
        if (onError) onError(err);
      }
    );
  }
}
