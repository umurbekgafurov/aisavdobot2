import { TelegramUpdate } from '../../src/types/telegram';
import { UpdateParser } from './updateParser';
import { BusinessResolver } from './businessResolver';
import { IdempotencyService } from './idempotency';
import { CustomerService } from '../../src/services/customerService';
import { ConversationService } from '../../src/services/conversationService';
import { MessageService } from '../../src/services/messageService';
import { TelegramClient } from './telegramClient';
import { IntentParser, ParsedIntent, AIIntent } from '../ai/intentParser';
import { ProductResolver, ProductResolution } from '../products/productResolver';
import { ReplyGenerator, ReplyGeneratorInput } from '../ai/replyGenerator';
import { PendingConfirmationService, ConfirmationActionType } from '../orders/pendingConfirmationService';
import { PendingOrderConfirmation, Order } from '../../src/types/orders';
import { OrderService } from '../orders/orderService';
import { AdminNotificationService } from '../notifications/adminNotificationService';

export interface ProcessResult {
  success: boolean;
  status: string;
  updateId?: number;
  businessId?: string;
  customerId?: string;
  conversationId?: string;
  inboundMessageId?: string;
  outboundMessageId?: string;
  detectedIntent?: AIIntent;
  parsedIntent?: ParsedIntent;
  productResolution?: ProductResolution;
  pendingConfirmation?: PendingOrderConfirmation;
  createdOrder?: Order;
  confirmationAction?: ConfirmationActionType;
  aiResponseText?: string;
  telegramReplySent?: boolean;
  isDuplicate?: boolean;
}

export class UpdateProcessor {
  private static intentParser = new IntentParser();
  private static replyGenerator = new ReplyGenerator();
  private static autoCreateOrder = false;

  /**
   * Set custom IntentParser (for testing or mocking)
   */
  static setIntentParser(parser: IntentParser) {
    this.intentParser = parser;
  }

  /**
   * Set custom ReplyGenerator (for testing or mocking)
   */
  static setReplyGenerator(generator: ReplyGenerator) {
    this.replyGenerator = generator;
  }

  /**
   * Enable/disable automatic order creation on confirmation (M4.4.1)
   */
  static setAutoCreateOrder(enabled: boolean) {
    this.autoCreateOrder = enabled;
  }

  /**
   * Telegram Message Pipeline (M3.1 + M3.2.4 Integration):
   *
   * Telegram
   *    ↓
   * Webhook
   *    ↓
   * Customer (upsert)
   *    ↓
   * Conversation (upsert)
   *    ↓
   * Inbound Message (stored)
   *    ↓
   * M3.2.2 Intent Parser (gemini-based natural language classification)
   *    ↓
   * M3.2.3 Product Resolver (tenant-isolated product lookup if product_name present)
   *    ↓
   * Persist AI Processing Result to Inbound Message (Informational only — NO automated Telegram reply)
   */
  static async processUpdate(update: TelegramUpdate): Promise<ProcessResult> {
    // 1. Parse update
    const parsed = UpdateParser.parse(update);
    if (!parsed) {
      return {
        success: true,
        status: 'ignored_unsupported_or_empty_update',
      };
    }

    // 2. Resolve business/tenant
    const businessId = await BusinessResolver.resolveBusiness(parsed.username);

    // 3. Idempotency guard (Telegram update_id) - prevents duplicate processing
    const isDuplicate = await IdempotencyService.checkAndRecordUpdate(parsed.updateId, businessId);
    if (isDuplicate) {
      return {
        success: true,
        status: 'duplicate_update_skipped',
        updateId: parsed.updateId,
        businessId,
        isDuplicate: true,
      };
    }

    try {
      // 4. Customer upsert
      const customer = await CustomerService.upsertTelegramCustomer({
        businessId,
        telegramUserId: parsed.telegramUserId,
        telegramChatId: parsed.telegramChatId,
        username: parsed.username,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        phone: parsed.phone,
      });

      // 5. Conversation upsert (registers inbound)
      const conversation = await ConversationService.upsertTelegramConversation({
        businessId,
        customerId: customer.id,
        telegramChatId: parsed.telegramChatId,
        lastMessagePreview: parsed.text,
        customerName: [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Mijoz',
        customerUsername: customer.username,
      });

      // 6. Inbound Message storage (M3.1 message persistence)
      const { message: inboundMsg, isDuplicate: isMsgDuplicate } = await MessageService.storeMessage({
        businessId,
        customerId: customer.id,
        conversationId: conversation.id,
        direction: 'inbound',
        channel: 'telegram',
        telegramMessageId: parsed.telegramMessageId,
        telegramChatId: parsed.telegramChatId,
        type: parsed.type,
        text: parsed.text,
        media: parsed.media,
        aiProcessed: false,
        aiIntent: null,
        createdAt: parsed.rawDate,
      });

      if (isMsgDuplicate) {
        return {
          success: true,
          status: 'duplicate_message_skipped',
          updateId: parsed.updateId,
          businessId,
          customerId: customer.id,
          conversationId: conversation.id,
          inboundMessageId: inboundMsg.id,
          isDuplicate: true,
        };
      }

      // 6.5. M4.3.2 Confirmation Response Handler:
      // If customer has an active pending confirmation, handle confirmation, cancellation,
      // ambiguous reply, or product/quantity change.
      const existingConfirmation = await PendingConfirmationService.getRawPendingConfirmation(
        businessId,
        customer.id,
        conversation.id
      );

      const actionResult = PendingConfirmationService.detectConfirmationAction(parsed.text);

      if (existingConfirmation) {
        if (actionResult.action === 'change') {
          // Invalidate/clear previous pending confirmation and restart flow with new product/quantity
          console.log(`[UpdateProcessor M4.3.2] Customer requested change ("${parsed.text}"). Invalidating previous pending confirmation.`);
          await PendingConfirmationService.clearPendingConfirmation(businessId, customer.id, conversation.id);
          // Continues down to Steps 7-10 to create a fresh pending confirmation with newly validated product/quantity!
        } else if (actionResult.action === 'confirm' || actionResult.action === 'cancel' || actionResult.action === 'ambiguous') {
          let confirmationReplyText = '';
          let confirmationPending: PendingOrderConfirmation | undefined;
          let createdFinalOrder: Order | undefined;

          if (existingConfirmation.status === 'confirmed' && actionResult.action === 'confirm') {
            // Repeated confirmation after already confirmed
            confirmationReplyText = PendingConfirmationService.formatAlreadyConfirmedMessage(actionResult.language);
            confirmationPending = existingConfirmation;
          } else if (existingConfirmation.status === 'cancelled' && actionResult.action === 'cancel') {
            // Repeated cancellation after already cancelled
            confirmationReplyText = PendingConfirmationService.formatAlreadyCancelledMessage(actionResult.language);
            confirmationPending = existingConfirmation;
          } else if (existingConfirmation.status === 'pending_confirmation') {
            const now = Date.now();
            if (existingConfirmation.expiresAt && existingConfirmation.expiresAt < now) {
              // Expired confirmation
              const expRes = await PendingConfirmationService.confirmPendingConfirmation(businessId, customer.id, conversation.id);
              confirmationPending = expRes.pending;
              confirmationReplyText = PendingConfirmationService.formatExpiredMessage(actionResult.language);
            } else if (actionResult.action === 'confirm') {
              // Confirmed! Transition to 'confirmed'
              const confirmRes = await PendingConfirmationService.confirmPendingConfirmation(businessId, customer.id, conversation.id);
              confirmationPending = confirmRes.pending;

              if (this.autoCreateOrder && confirmRes.success && confirmRes.pending) {
                const orderRes = await OrderService.createOrderFromConfirmedPending({
                  businessId,
                  pendingConfirmation: confirmRes.pending,
                });
                if (orderRes.success && orderRes.order) {
                  createdFinalOrder = orderRes.order;
                  confirmationPending = {
                    ...confirmRes.pending,
                    orderId: orderRes.order.id,
                  };

                  // M4.4.2: Atomic Stock Mutation & Warehouse Ledger
                  try {
                    const stockRes = await OrderService.mutateStockForConfirmedOrder({
                      businessId,
                      orderId: orderRes.order.id,
                    });
                    if (stockRes.success && stockRes.order) {
                      createdFinalOrder = stockRes.order;

                      // M4.5.1 + M4.5.2: Admin Notification via Telegram
                      try {
                        await AdminNotificationService.sendOrderNotificationToAdmins({
                          businessId,
                          order: stockRes.order,
                          customer,
                        });
                      } catch (notifErr: any) {
                        console.warn('[UpdateProcessor] Admin notification failed non-blockingly:', notifErr?.message);
                      }
                    }
                  } catch (stockErr: any) {
                    console.error('[UpdateProcessor] Stock mutation error for confirmed order:', stockErr?.message);
                  }
                }
              }

              confirmationReplyText = PendingConfirmationService.formatConfirmedMessage(confirmRes.pending!, actionResult.language);
            } else if (actionResult.action === 'cancel') {
              // Cancelled! Transition to 'cancelled'
              const cancelRes = await PendingConfirmationService.cancelPendingConfirmation(businessId, customer.id, conversation.id);
              confirmationPending = cancelRes.pending;
              confirmationReplyText = PendingConfirmationService.formatCancelledMessage(cancelRes.pending!, actionResult.language);
            } else if (actionResult.action === 'ambiguous') {
              // Ambiguous -> Keep pending confirmation active
              confirmationPending = existingConfirmation;
              confirmationReplyText = PendingConfirmationService.formatAmbiguousMessage(existingConfirmation, actionResult.language);
            }
          }

          if (confirmationReplyText) {
            let telegramReplySent = false;
            let outboundMsgId: string | undefined;

            if (parsed.telegramChatId) {
              const sendRes = await TelegramClient.sendMessage(parsed.telegramChatId, confirmationReplyText);
              if (sendRes.ok) {
                telegramReplySent = true;
              } else {
                console.warn('[UpdateProcessor] Telegram sendMessage failed:', sendRes.error);
              }

              const outboundTelegramMsgId = sendRes.result?.message_id || (parsed.telegramMessageId + 1000000);
              const { message: outMsg } = await MessageService.storeMessage({
                businessId,
                customerId: customer.id,
                conversationId: conversation.id,
                direction: 'outbound',
                channel: 'telegram',
                telegramMessageId: outboundTelegramMsgId,
                telegramChatId: parsed.telegramChatId,
                type: 'text',
                text: confirmationReplyText,
                aiProcessed: true,
                aiIntent: actionResult.action === 'confirm' ? 'order_intent' : null,
                createdAt: Date.now(),
              });
              outboundMsgId = outMsg.id;

              try {
                await ConversationService.upsertTelegramConversation({
                  businessId,
                  customerId: customer.id,
                  telegramChatId: parsed.telegramChatId,
                  lastMessagePreview: `[AI] ${confirmationReplyText}`,
                  customerName: [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Mijoz',
                  customerUsername: customer.username,
                });
              } catch (convErr: any) {
                console.warn('[UpdateProcessor] Notice updating conversation preview:', convErr?.message || convErr);
              }
            }

            return {
              success: true,
              status: `confirmation_${confirmationPending?.status || 'handled'}`,
              updateId: parsed.updateId,
              businessId,
              customerId: customer.id,
              conversationId: conversation.id,
              inboundMessageId: inboundMsg.id,
              outboundMessageId: outboundMsgId,
              pendingConfirmation: confirmationPending,
              createdOrder: createdFinalOrder,
              confirmationAction: actionResult.action,
              aiResponseText: confirmationReplyText,
              telegramReplySent,
            };
          }
        }
      }

      // 7. M3.2.4: Pass incoming text to Intent Parser
      let parsedIntentData: ParsedIntent | undefined;
      let productResolution: ProductResolution | undefined;

      try {
        const parseResult = await this.intentParser.parseIntent({ text: parsed.text });

        if (parseResult.success && parseResult.data) {
          parsedIntentData = parseResult.data;
          console.log(`[UpdateProcessor AI] Intent: "${parsedIntentData.intent}", Product: "${parsedIntentData.product_name}", Conf: ${parsedIntentData.confidence}`);

          // 8. If intent is product-related and product_name is available, resolve against current tenant
          const productIntents: AIIntent[] = ['product_query', 'stock_query', 'price_query', 'order_intent'];

          if (productIntents.includes(parsedIntentData.intent) && parsedIntentData.product_name) {
            productResolution = await ProductResolver.resolveProduct({
              businessId,
              productName: parsedIntentData.product_name,
            });
            console.log(`[UpdateProcessor ProductResolver] Resolution: "${productResolution.status}" for "${parsedIntentData.product_name}"`);
          }

          // 9. Persist AI processing result using existing message model
          const aiUpdateData: Record<string, any> = {
            aiProcessed: true,
            aiIntent: parsedIntentData.intent,
            aiConfidence: parsedIntentData.confidence,
            aiLanguage: parsedIntentData.language,
            aiProductName: parsedIntentData.product_name,
            aiProductResolution: productResolution ? productResolution.status : 'skipped',
            aiProductId: productResolution?.status === 'resolved' ? productResolution.product.id : null,
          };

          if (productResolution?.status === 'resolved' && productResolution.product) {
            aiUpdateData.aiResolvedProduct = productResolution.product;
          }
          if (productResolution?.status === 'ambiguous' && productResolution.candidates) {
            aiUpdateData.aiCandidates = productResolution.candidates;
          }

          await MessageService.updateMessageAIResult(conversation.id, inboundMsg.id, aiUpdateData);
        } else {
          // Gemini parsing returned a controlled failure
          console.warn(`[UpdateProcessor AI] Intent parsing failed safely: ${parseResult.errorCode} - ${parseResult.errorMessage}`);
          await MessageService.updateMessageAIResult(conversation.id, inboundMsg.id, {
            aiProcessed: false,
            aiIntent: null,
            aiProductResolution: 'error',
            aiError: parseResult.errorMessage || parseResult.errorCode || 'AI parsing failed',
          });
        }
      } catch (aiErr: any) {
        // Safe error handling: preserve the original message, never crash the webhook
        console.error('[UpdateProcessor AI] Safe error catch:', aiErr?.message || aiErr);
        await MessageService.updateMessageAIResult(conversation.id, inboundMsg.id, {
          aiProcessed: false,
          aiIntent: null,
          aiProductResolution: 'error',
          aiError: aiErr?.message || 'Unexpected AI processing error',
        });
      }

      // 10. M4.3.1 Order Confirmation Workflow:
      // If purchase intent is detected and validated against backend product/stock/price,
      // create pending_confirmation state and generate the confirmation question.
      let aiReplyText = '';
      let outboundMsgId: string | undefined;
      let telegramReplySent = false;
      let pendingConfirmation: PendingOrderConfirmation | undefined;

      try {
        const resolvedProd = productResolution?.status === 'resolved' ? productResolution.product : null;
        const lang = parsedIntentData?.language || 'uz';

        if (parsedIntentData?.intent === 'order_intent' && resolvedProd) {
          const requestedQuantity = (parsedIntentData.quantity && parsedIntentData.quantity > 0) ? parsedIntentData.quantity : 1;
          const currentStock = typeof resolvedProd.stock === 'number' ? resolvedProd.stock : 0;
          const currentPrice = typeof resolvedProd.price === 'number' ? resolvedProd.price : 0;

          if (currentStock < requestedQuantity) {
            // Insufficient stock -> cannot create pending confirmation
            if (lang === 'ru') {
              aiReplyText = `Извините, "${resolvedProd.name}" недостаточно на складе (в наличии только ${currentStock} шт.).`;
            } else if (lang === 'en') {
              aiReplyText = `Sorry, there is not enough stock for "${resolvedProd.name}" (only ${currentStock} available).`;
            } else {
              aiReplyText = `Kechirasiz, "${resolvedProd.name}" mahsulotidan omborda yetarli emas (faqat ${currentStock} dona bor).`;
            }
          } else if (currentPrice <= 0) {
            // Missing price -> cannot create pending confirmation
            if (lang === 'ru') {
              aiReplyText = `Извините, цена для "${resolvedProd.name}" пока не установлена. Наш менеджер свяжется с вами.`;
            } else if (lang === 'en') {
              aiReplyText = `Sorry, the price for "${resolvedProd.name}" is currently unavailable. Our manager will contact you.`;
            } else {
              aiReplyText = `Kechirasiz, "${resolvedProd.name}" mahsuloti narxi ko'rsatilmagan. Tez orada menejerimiz siz bilan bog'lanadi.`;
            }
          } else {
            // Valid purchase intent + verified stock & price -> Create pending confirmation!
            pendingConfirmation = await PendingConfirmationService.createPendingConfirmation({
              businessId,
              customerId: customer.id,
              conversationId: conversation.id,
              productId: resolvedProd.id,
              productName: resolvedProd.name,
              sku: resolvedProd.sku || null,
              quantity: requestedQuantity,
              unitPrice: currentPrice,
              currency: "so'm",
            });

            aiReplyText = PendingConfirmationService.formatConfirmationQuestion(pendingConfirmation, lang);
          }
        }

        // If not handled by order confirmation (e.g. product_query, price_query, greeting, not_found, etc.), use ReplyGenerator
        if (!aiReplyText) {
          const replyInput: ReplyGeneratorInput = {
            customerMessage: parsed.text,
            language: lang,
            intent: parsedIntentData?.intent || 'unknown',
            productName: parsedIntentData?.product_name || null,
            productResolutionStatus: productResolution?.status || 'skipped',
            productInfo: resolvedProd
              ? {
                  id: resolvedProd.id,
                  name: resolvedProd.name,
                  sku: resolvedProd.sku,
                  category: resolvedProd.category,
                }
              : null,
            stockInfo: resolvedProd
              ? {
                  available: (resolvedProd.stock || 0) > 0,
                  quantity: resolvedProd.stock || 0,
                }
              : null,
            priceInfo:
              resolvedProd && typeof resolvedProd.price === 'number' && resolvedProd.price > 0
                ? {
                    available: true,
                    price: resolvedProd.price,
                    currency: 'so\'m',
                  }
                : null,
            ambiguousCandidates:
              productResolution?.status === 'ambiguous' && productResolution.candidates
                ? productResolution.candidates.map((c) => ({
                    id: c.id,
                    name: c.name,
                    sku: c.sku,
                    price: c.price,
                  }))
                : null,
          };

          const replyResult = await this.replyGenerator.generateReply(replyInput);
          if (replyResult.data?.text) {
            aiReplyText = replyResult.data.text;
          } else {
            const fallback = ReplyGenerator.generateFallbackReply(replyInput);
            aiReplyText = fallback.text;
          }
        }

        // Deliver text reply to Telegram
        if (aiReplyText && parsed.telegramChatId) {
          const sendRes = await TelegramClient.sendMessage(parsed.telegramChatId, aiReplyText);
          if (sendRes.ok) {
            telegramReplySent = true;
          } else {
            console.warn('[UpdateProcessor] Telegram sendMessage failed:', sendRes.error);
          }

          // Persist outgoing AI reply into conversation messages
          const outboundTelegramMsgId = sendRes.result?.message_id || (parsed.telegramMessageId + 1000000);
          const { message: outMsg } = await MessageService.storeMessage({
            businessId,
            customerId: customer.id,
            conversationId: conversation.id,
            direction: 'outbound',
            channel: 'telegram',
            telegramMessageId: outboundTelegramMsgId,
            telegramChatId: parsed.telegramChatId,
            type: 'text',
            text: aiReplyText,
            aiProcessed: true,
            aiIntent: parsedIntentData?.intent || null,
            createdAt: Date.now(),
          });
          outboundMsgId = outMsg.id;

          // Update conversation preview to show outbound reply
          try {
            await ConversationService.upsertTelegramConversation({
              businessId,
              customerId: customer.id,
              telegramChatId: parsed.telegramChatId,
              lastMessagePreview: `[AI] ${aiReplyText}`,
              customerName: [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Mijoz',
              customerUsername: customer.username,
            });
          } catch (convErr: any) {
            console.warn('[UpdateProcessor] Notice updating conversation preview:', convErr?.message || convErr);
          }
        }
      } catch (replyErr: any) {
        console.error('[UpdateProcessor] Error generating or sending reply:', replyErr?.message || replyErr);
      }

      return {
        success: true,
        status: telegramReplySent ? 'processed_and_replied_successfully' : 'processed_informational_only',
        updateId: parsed.updateId,
        businessId,
        customerId: customer.id,
        conversationId: conversation.id,
        inboundMessageId: inboundMsg.id,
        outboundMessageId: outboundMsgId,
        detectedIntent: parsedIntentData?.intent,
        parsedIntent: parsedIntentData,
        productResolution,
        pendingConfirmation,
        aiResponseText: aiReplyText,
        telegramReplySent,
      };
    } catch (err: any) {
      console.error('[UpdateProcessor] ❌ Error in message pipeline:', err);
      return {
        success: false,
        status: `processing_error: ${err.message || 'unknown'}`,
        updateId: parsed.updateId,
        businessId,
      };
    }
  }
}
