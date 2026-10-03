import { doc, getDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { Order } from '../../src/types/orders';
import { Customer } from '../../src/types';
import {
  AdminOrderNotificationPayload,
  PrepareNotificationResult,
  SendAdminNotificationResult,
  AdminRecipientDeliveryResult,
} from '../../src/types/notifications';
import { TelegramClient } from '../telegram/telegramClient';

export interface PrepareNotificationOptions {
  businessId: string;
  orderId?: string;
  order?: Order;
  customer?: Customer;
  persistPreparationFlag?: boolean;
}

export interface SendAdminNotificationOptions {
  businessId: string;
  orderId?: string;
  order?: Order;
  customer?: Customer;
  forceResend?: boolean;
}

export class AdminNotificationService {
  /**
   * Resolves verified admin Telegram chat IDs for a business (M4.5.2).
   *
   * Security & Isolation Rules:
   * 1. Strictly tenant-isolated by businessId.
   * 2. NEVER takes chat ID from untrusted customer/user input.
   * 3. Sources:
   *    - businesses/{businessId} admin Telegram fields
   *    - businesses/{businessId}/members subcollection (role: admin/owner)
   *    - users collection records with matching businessId & role
   */
  static async resolveAdminChatIds(businessId: string): Promise<string[]> {
    if (!businessId || typeof businessId !== 'string' || !businessId.trim()) {
      return [];
    }

    const chatIds: string[] = [];

    // 1. Check business document
    try {
      const bizSnap = await getDoc(doc(db, 'businesses', businessId));
      if (bizSnap.exists()) {
        const bData = bizSnap.data() as any;

        if (bData.adminTelegramChatId) chatIds.push(String(bData.adminTelegramChatId).trim());
        if (bData.ownerTelegramChatId) chatIds.push(String(bData.ownerTelegramChatId).trim());
        if (bData.adminChatId) chatIds.push(String(bData.adminChatId).trim());
        if (bData.telegramChatId) chatIds.push(String(bData.telegramChatId).trim());

        if (Array.isArray(bData.telegramAdminChatIds)) {
          bData.telegramAdminChatIds.forEach((id: any) => {
            if (id) chatIds.push(String(id).trim());
          });
        }
        if (Array.isArray(bData.adminChatIds)) {
          bData.adminChatIds.forEach((id: any) => {
            if (id) chatIds.push(String(id).trim());
          });
        }

        // Nested settings
        if (bData.settings) {
          if (bData.settings.adminChatId) chatIds.push(String(bData.settings.adminChatId).trim());
          if (bData.settings.adminTelegramChatId) chatIds.push(String(bData.settings.adminTelegramChatId).trim());
          if (Array.isArray(bData.settings.adminTelegramChatIds)) {
            bData.settings.adminTelegramChatIds.forEach((id: any) => {
              if (id) chatIds.push(String(id).trim());
            });
          }
        }
      }
    } catch (bizErr) {
      console.warn(`[AdminNotificationService] Failed reading business doc for ${businessId}:`, bizErr);
    }

    // 2. Check businesses/{businessId}/members subcollection
    try {
      const membersSnap = await getDocs(collection(db, 'businesses', businessId, 'members'));
      membersSnap.forEach((mDoc) => {
        const mData = mDoc.data() as any;
        const role = String(mData.role || '').toLowerCase();
        if (role === 'admin' || role === 'owner' || !mData.role) {
          if (mData.active !== false) {
            const cId = mData.telegramChatId || mData.chatId;
            if (cId) chatIds.push(String(cId).trim());
          }
        }
      });
    } catch {
      // Non-blocking: collection may not exist yet in all businesses
    }

    // 3. Check users collection
    try {
      const usersSnap = await getDocs(
        query(collection(db, 'users'), where('businessId', '==', businessId))
      );
      usersSnap.forEach((uDoc) => {
        const uData = uDoc.data() as any;
        const role = String(uData.role || '').toLowerCase();
        if (role === 'admin' || role === 'owner') {
          const cId = uData.telegramChatId || uData.chatId;
          if (cId) chatIds.push(String(cId).trim());
        }
      });
    } catch {
      // Non-blocking
    }

    // Clean, validate digits, and deduplicate
    const uniqueChatIds = Array.from(new Set(chatIds)).filter((id) => id.length > 0);
    return uniqueChatIds;
  }

  /**
   * Prepares the admin notification payload for a confirmed order.
   *
   * CRITICAL ARCHITECTURAL CONSTRAINTS (M4.5.1):
   * 1. Notification is ONLY prepared if the order is confirmed AND stock mutation succeeded.
   * 2. If stock mutation failed, was not run, or stock is insufficient -> NO NOTIFICATION.
   * 3. Strictly enforces tenant isolation: order.businessId === businessId.
   * 4. Does NOT call Telegram API.
   * 5. Does NOT mutate stock or warehouse ledger.
   * 6. Does NOT mutate order status, items, or totals.
   * 7. Idempotent: detects already prepared notifications.
   * 8. Safe handling of missing or incomplete customer data without crashing.
   */
  static async prepareOrderNotification(
    options: PrepareNotificationOptions
  ): Promise<PrepareNotificationResult> {
    const { businessId, orderId, persistPreparationFlag = false } = options;

    // 1. Business ID validation
    if (!businessId || typeof businessId !== 'string' || !businessId.trim()) {
      return {
        success: false,
        code: 'TENANT_MISMATCH',
        error: 'businessId is required and must be non-empty',
      };
    }

    try {
      // 2. Resolve order
      let order = options.order;
      if (!order) {
        if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
          return {
            success: false,
            code: 'NOT_FOUND',
            error: 'Either order or orderId must be provided',
          };
        }

        const orderRef = doc(db, 'orders', orderId);
        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) {
          return {
            success: false,
            code: 'NOT_FOUND',
            error: `Order "${orderId}" not found`,
          };
        }
        order = orderSnap.data() as Order;
      }

      // 3. Strict Tenant Isolation
      if (order.businessId !== businessId) {
        console.warn(
          `[AdminNotificationService Security] Tenant isolation violation: Order ${order.id} belongs to ${order.businessId}, requested by ${businessId}`
        );
        return {
          success: false,
          code: 'TENANT_MISMATCH',
          error: 'Tenant isolation violation: Order belongs to a different business',
        };
      }

      // 4. Order Confirmation Status Verification
      if (order.status !== 'confirmed') {
        return {
          success: false,
          code: 'INVALID_ORDER_STATUS',
          error: `Order status is "${order.status}". Admin notification can only be prepared for confirmed orders.`,
        };
      }

      // 5. CRITICAL: Stock Mutation & Warehouse Ledger Verification
      // Stock mutation must have completed successfully before admin notification is prepared.
      const isStockMutated = order.inventoryProcessed === true && order.inventoryStatus === 'completed';
      if (!isStockMutated) {
        console.warn(
          `[AdminNotificationService] Rejected notification for order ${order.id}: stock mutation not completed (inventoryProcessed: ${order.inventoryProcessed}, inventoryStatus: "${order.inventoryStatus}")`
        );
        return {
          success: false,
          code: 'STOCK_MUTATION_REQUIRED',
          error: `Stock mutation has not completed successfully for order ${order.id}. Current inventoryStatus: "${order.inventoryStatus || 'unprocessed'}". Admin notification cannot be prepared.`,
        };
      }

      // 6. Items validation
      if (!Array.isArray(order.items) || order.items.length === 0) {
        return {
          success: false,
          code: 'EMPTY_ITEMS',
          error: `Order ${order.id} has no items`,
        };
      }

      // 7. Resolve Customer Information safely (without crashing on missing data)
      let customer = options.customer;
      if (!customer && order.customerId) {
        try {
          const custSnap = await getDoc(doc(db, 'businesses', businessId, 'customers', order.customerId));
          if (custSnap.exists()) {
            customer = custSnap.data() as Customer;
          }
        } catch {
          // Non-blocking: missing customer in Firestore should not crash notification preparation
        }
      }

      // Build customer name & contact safely
      const nameParts = [customer?.firstName, customer?.lastName].filter(Boolean);
      const customerName =
        nameParts.length > 0
          ? nameParts.join(' ')
          : order.customerName || (customer as any)?.name || 'Mijoz';

      const customerPhone = customer?.phone || order.customerPhone || undefined;
      const rawUsername = customer?.telegramUsername || customer?.username || undefined;
      const customerUsername = rawUsername ? rawUsername.replace(/^@/, '') : undefined;

      const contactTokens: string[] = [];
      if (customerPhone) contactTokens.push(customerPhone);
      if (customerUsername) contactTokens.push(`@${customerUsername}`);
      const customerContact = contactTokens.length > 0 ? contactTokens.join(' / ') : undefined;

      // 8. Extract Item Details
      const primaryItem = order.items[0];
      const productName = primaryItem.productName || 'Mahsulot';
      const sku = primaryItem.sku || undefined;
      const quantity = primaryItem.quantity || 1;
      const unitPrice = primaryItem.unitPrice || 0;
      const subtotal = order.subtotal;
      const total = order.total;
      const currency = order.currency || "so'm";
      const createdAt = order.createdAt || Date.now();

      // 9. Format Admin Notification Text
      const formattedText = this.formatAdminMessage({
        orderId: order.id,
        customerName,
        customerContact,
        productName,
        sku,
        quantity,
        unitPrice,
        total,
        currency,
        itemsCount: order.items.length,
        createdAt,
      });

      // 10. Assemble Payload
      const notificationId = `notif_ord_${order.id}`;
      const payload: AdminOrderNotificationPayload = {
        notificationId,
        orderId: order.id,
        businessId,
        customerId: order.customerId,
        customerName,
        customerContact,
        customerPhone,
        customerUsername,
        productName,
        sku,
        quantity,
        unitPrice,
        subtotal,
        total,
        currency,
        createdAt,
        items: order.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal ?? item.quantity * item.unitPrice,
        })),
        formattedText,
      };

      // 11. Idempotency check & optional tracking
      const isAlreadyPrepared = Boolean(order.adminNotificationPrepared);

      if (persistPreparationFlag && !isAlreadyPrepared) {
        try {
          await updateDoc(doc(db, 'orders', order.id), {
            adminNotificationPrepared: true,
            adminNotificationPreparedAt: Date.now(),
            updatedAt: Date.now(),
          });
        } catch (updateErr: any) {
          console.warn('[AdminNotificationService] Notice recording preparation flag:', updateErr?.message);
        }
      }

      return {
        success: true,
        payload,
        isAlreadyPrepared,
      };
    } catch (err: any) {
      console.error('[AdminNotificationService] Error preparing order notification:', err);
      return {
        success: false,
        code: 'PREPARATION_FAILED',
        error: err?.message || 'Failed to prepare admin notification',
      };
    }
  }

  /**
   * Sends the admin notification to all registered business admins via Telegram (M4.5.2).
   *
   * Flow & Resilience:
   * 1. Requires order.status === 'confirmed', inventoryProcessed === true, inventoryStatus === 'completed'.
   * 2. Checks order.adminNotificationSent for idempotency (skips duplicates).
   * 3. Sends to each resolved admin independently.
   * 4. If Telegram fails for one or all admins:
   *    - Does NOT cancel or rollback order.
   *    - Does NOT rollback stock or warehouse ledger.
   *    - Returns safe error without crashing pipeline.
   */
  static async sendOrderNotificationToAdmins(
    options: SendAdminNotificationOptions
  ): Promise<SendAdminNotificationResult> {
    const { businessId, orderId, forceResend = false } = options;

    if (!businessId || typeof businessId !== 'string' || !businessId.trim()) {
      return {
        success: false,
        orderId: orderId || '',
        businessId: businessId || '',
        code: 'TENANT_MISMATCH',
        error: 'businessId is required and must be non-empty',
        recipientsFound: 0,
        recipientsSent: 0,
        deliveries: [],
      };
    }

    try {
      // 1. Resolve order
      let order = options.order;
      if (!order) {
        if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
          return {
            success: false,
            orderId: '',
            businessId,
            code: 'PREPARATION_FAILED',
            error: 'Either order or orderId must be provided',
            recipientsFound: 0,
            recipientsSent: 0,
            deliveries: [],
          };
        }

        const orderSnap = await getDoc(doc(db, 'orders', orderId));
        if (!orderSnap.exists()) {
          return {
            success: false,
            orderId,
            businessId,
            code: 'PREPARATION_FAILED',
            error: `Order "${orderId}" not found`,
            recipientsFound: 0,
            recipientsSent: 0,
            deliveries: [],
          };
        }
        order = orderSnap.data() as Order;
      }

      // 2. Strict Tenant Isolation
      if (order.businessId !== businessId) {
        return {
          success: false,
          orderId: order.id,
          businessId,
          code: 'TENANT_MISMATCH',
          error: 'Tenant isolation violation: Order belongs to a different business',
          recipientsFound: 0,
          recipientsSent: 0,
          deliveries: [],
        };
      }

      // 3. Idempotency Check: already sent?
      if (order.adminNotificationSent === true && !forceResend) {
        return {
          success: true,
          orderId: order.id,
          businessId,
          notificationId: order.adminNotificationPayloadId || `notif_ord_${order.id}`,
          isAlreadySent: true,
          recipientsFound: (order.adminNotificationRecipients || []).length,
          recipientsSent: 0,
          deliveries: [],
        };
      }

      // 4. Prepare payload (verifies order status === 'confirmed' AND stock mutation completed)
      const prepRes = await this.prepareOrderNotification({
        businessId,
        order,
        customer: options.customer,
      });

      if (!prepRes.success || !prepRes.payload) {
        return {
          success: false,
          orderId: order.id,
          businessId,
          code: prepRes.code as any,
          error: prepRes.error,
          recipientsFound: 0,
          recipientsSent: 0,
          deliveries: [],
        };
      }

      // 5. Resolve Admin Recipients for this business
      const adminChatIds = await this.resolveAdminChatIds(businessId);
      if (adminChatIds.length === 0) {
        console.warn(`[AdminNotificationService] No admin Telegram chat IDs configured for business ${businessId}.`);
        return {
          success: true,
          orderId: order.id,
          businessId,
          notificationId: prepRes.payload.notificationId,
          recipientsFound: 0,
          recipientsSent: 0,
          code: 'NO_ADMIN_RECIPIENTS',
          deliveries: [],
        };
      }

      // 6. Send Telegram notification to each admin
      const deliveries: AdminRecipientDeliveryResult[] = [];
      const successfulRecipients: string[] = [];

      for (const chatId of adminChatIds) {
        try {
          const sendRes = await TelegramClient.sendMessage(chatId, prepRes.payload.formattedText);
          if (sendRes.ok) {
            successfulRecipients.push(chatId);
            deliveries.push({
              chatId,
              success: true,
              messageId: sendRes.result?.message_id,
            });
          } else {
            console.warn(`[AdminNotificationService] Telegram sendMessage failed for admin ${chatId}:`, sendRes.error);
            deliveries.push({
              chatId,
              success: false,
              error: sendRes.error || 'Telegram delivery failed',
            });
          }
        } catch (deliveryErr: any) {
          console.error(`[AdminNotificationService] Exception delivering to admin ${chatId}:`, deliveryErr);
          deliveries.push({
            chatId,
            success: false,
            error: deliveryErr?.message || 'Network error',
          });
        }
      }

      // 7. Persist notification sent flag on Order if at least one admin was notified
      if (successfulRecipients.length > 0) {
        try {
          await updateDoc(doc(db, 'orders', order.id), {
            adminNotificationSent: true,
            adminNotificationSentAt: Date.now(),
            adminNotificationRecipients: successfulRecipients,
            adminNotificationPayloadId: prepRes.payload.notificationId,
            updatedAt: Date.now(),
          });
        } catch (updateErr: any) {
          console.warn(`[AdminNotificationService] Failed to mark order ${order.id} as adminNotificationSent:`, updateErr);
        }
      }

      const allFailed = deliveries.length > 0 && successfulRecipients.length === 0;
      const partial = successfulRecipients.length > 0 && successfulRecipients.length < adminChatIds.length;

      return {
        success: !allFailed,
        orderId: order.id,
        businessId,
        notificationId: prepRes.payload.notificationId,
        recipientsFound: adminChatIds.length,
        recipientsSent: successfulRecipients.length,
        deliveries,
        code: allFailed ? 'ALL_DELIVERIES_FAILED' : partial ? 'PARTIAL_DELIVERY' : undefined,
      };
    } catch (err: any) {
      console.error('[AdminNotificationService] Fatal error in sendOrderNotificationToAdmins:', err);
      return {
        success: false,
        orderId: orderId || '',
        businessId,
        code: 'PREPARATION_FAILED',
        error: err?.message || 'Unexpected failure in admin notification service',
        recipientsFound: 0,
        recipientsSent: 0,
        deliveries: [],
      };
    }
  }

  /**
   * Helper to format a clean, human-readable notification text in Uzbek.
   */
  static formatAdminMessage(data: {
    orderId: string;
    customerName: string;
    customerContact?: string;
    productName: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    total: number;
    currency: string;
    itemsCount: number;
    createdAt?: number;
  }): string {
    const contactLine = data.customerContact ? data.customerContact : 'Kiritilmagan';
    const skuDisplay = data.sku ? ` (${data.sku})` : '';
    const formatMoney = (n: number) => n.toLocaleString().replace(/[\s\u00A0]/g, ' ');

    const dateObj = new Date(data.createdAt || Date.now());
    const dateStr = dateObj.toLocaleString('uz-UZ', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).replace(/[\s\u00A0]/g, ' ');

    return [
      `🛒 YANGI BUYURTMA!`,
      ``,
      `Buyurtma: #${data.orderId}`,
      ``,
      `👤 Mijoz: ${data.customerName}`,
      `📱 Aloqa: ${contactLine}`,
      ``,
      `📦 Mahsulot: ${data.productName}${skuDisplay}`,
      `🔢 Soni: ${data.quantity} dona`,
      `💰 Narxi: ${formatMoney(data.unitPrice)} ${data.currency}`,
      `💵 Jami: ${formatMoney(data.total)} ${data.currency}`,
      ``,
      `🕐 Sana: ${dateStr}`,
      ``,
      `✅ Ombor qoldig'i muvaffaqiyatli kamaytirildi va chiqim qayd etildi.`,
    ].join('\n');
  }
}

