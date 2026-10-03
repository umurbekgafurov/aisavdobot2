import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  orderBy,
  getDocs,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ConversationMessage, CRMMessageType } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';

export class MessageService {
  /**
   * Generates a deterministic message ID to prevent duplicate message ingestion
   */
  static getMessageId(businessId: string, telegramChatId: string, telegramMessageId: number): string {
    const cleanBiz = businessId.replace(/[^a-zA-Z0-9]/g, '_');
    return `msg_${cleanBiz}_${telegramChatId}_${telegramMessageId}`;
  }

  /**
   * Stores an inbound or outbound message under the conversation's messages subcollection.
   */
  static async storeMessage(params: {
    businessId: string;
    customerId: string;
    conversationId: string;
    direction: 'inbound' | 'outbound';
    channel?: 'telegram' | 'web';
    telegramMessageId: number;
    telegramChatId: string;
    type: CRMMessageType;
    text: string;
    media?: {
      fileId?: string;
      mimeType?: string;
      fileName?: string;
      caption?: string;
    } | null;
    aiProcessed?: boolean;
    aiIntent?: string | null;
    createdAt?: number;
  }): Promise<{ message: ConversationMessage; isDuplicate: boolean }> {
    const {
      businessId,
      customerId,
      conversationId,
      direction,
      channel = 'telegram',
      telegramMessageId,
      telegramChatId,
      type,
      text,
      media = null,
      aiProcessed = false,
      aiIntent = null,
      createdAt = Date.now(),
    } = params;

    const messageId = this.getMessageId(businessId, telegramChatId, telegramMessageId);
    const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

    try {
      const snap = await getDoc(messageRef);
      if (snap.exists()) {
        return {
          message: snap.data() as ConversationMessage,
          isDuplicate: true,
        };
      }

      const newMsg: ConversationMessage = {
        id: messageId,
        businessId,
        customerId,
        conversationId,
        direction,
        channel,
        telegramMessageId,
        telegramChatId,
        type,
        text,
        media,
        aiProcessed,
        aiIntent,
        createdAt,
      };

      await setDoc(messageRef, newMsg);
      return { message: newMsg, isDuplicate: false };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `conversations/${conversationId}/messages/${messageId}`);
    }
  }

  /**
   * Update message with AI intent & product resolution result
   */
  static async updateMessageAIResult(
    conversationId: string,
    messageId: string,
    aiData: Partial<ConversationMessage>
  ): Promise<void> {
    const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    try {
      // Remove any undefined keys to comply with Firestore schema requirements
      const cleanedData: Record<string, any> = {};
      for (const [key, value] of Object.entries(aiData)) {
        if (value !== undefined) {
          cleanedData[key] = value;
        }
      }
      await setDoc(messageRef, cleanedData, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `conversations/${conversationId}/messages/${messageId}`);
    }
  }

  /**
   * Fetch all messages for a conversation
   */
  static async getMessages(conversationId: string): Promise<ConversationMessage[]> {
    try {
      const q = query(
        collection(db, 'conversations', conversationId, 'messages'),
        orderBy('createdAt', 'asc')
      );
      const snap = await getDocs(q);
      const list: ConversationMessage[] = [];
      snap.forEach((d) => list.push(d.data() as ConversationMessage));
      return list;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, `conversations/${conversationId}/messages`);
    }
  }

  /**
   * Realtime subscription for conversation messages
   */
  static subscribeMessages(
    conversationId: string,
    onData: (messages: ConversationMessage[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(
      q,
      (snap) => {
        const list: ConversationMessage[] = [];
        snap.forEach((d) => list.push(d.data() as ConversationMessage));
        onData(list);
      },
      (err) => {
        console.error('[MessageService realtime error]', err);
        if (onError) onError(err);
      }
    );
  }
}
