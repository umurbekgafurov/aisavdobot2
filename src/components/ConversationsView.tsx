import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Search,
  CheckCheck,
  User,
  ShoppingBag,
  Send,
  FileText,
  Mic,
  Image as ImageIcon,
  Phone,
  RefreshCw,
  Clock,
  Sparkles,
  Tag,
  Warehouse as WarehouseIcon,
  Play,
  CheckCircle,
  HelpCircle,
  DollarSign,
  Box,
  Layers,
  ChevronDown,
  ChevronUp,
  Calendar,
  Package
} from 'lucide-react';
import { Conversation, ConversationMessage, Customer, Order } from '../types';
import { MessageService } from '../services/messageService';
import { ConversationService } from '../services/conversationService';
import { getOrderStatusBadge, getInventoryStatusBadge } from './OrdersView';

interface ConversationsViewProps {
  businessId: string;
  conversations: Conversation[];
  customers: Customer[];
  orders: Order[];
  onRefresh?: () => void;
}

export const ConversationsView: React.FC<ConversationsViewProps> = ({
  businessId,
  conversations,
  customers,
  orders,
  onRefresh,
}) => {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(() => {
    return conversations.length > 0 ? conversations[0].id : null;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showOrderContext, setShowOrderContext] = useState(true);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  // AI Pipeline Simulator State
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulatorQuery, setSimulatorQuery] = useState('Samsung Galaxy S25 Ultra narxi qancha va omborda bormi?');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatorResult, setSimulatorResult] = useState<any | null>(null);

  // If selectedConvId is not set and conversations arrive, auto-select first
  useEffect(() => {
    if (!selectedConvId && conversations.length > 0) {
      setSelectedConvId(conversations[0].id);
    }
  }, [conversations, selectedConvId]);

  // Realtime subscription for messages of selected conversation
  useEffect(() => {
    if (!selectedConvId) {
      setMessages([]);
      return;
    }

    setIsLoadingMessages(true);

    // Mark as read when opened
    ConversationService.markConversationRead(selectedConvId).catch(() => {});

    const unsubscribe = MessageService.subscribeMessages(
      selectedConvId,
      (newMessages) => {
        setMessages(newMessages);
        setIsLoadingMessages(false);
      },
      (err) => {
        console.warn('Realtime messages subscription error:', err);
        setIsLoadingMessages(false);
      }
    );

    return () => unsubscribe();
  }, [selectedConvId]);

  const activeConv = conversations.find((c) => c.id === selectedConvId);
  const activeCustomer = activeConv
    ? customers.find((c) => c.id === activeConv.customerId || (c.telegramChatId && c.telegramChatId === activeConv.telegramChatId))
    : null;

  // Filter orders strictly for this conversation / customer and current business
  const conversationOrders = activeConv
    ? orders
        .filter((o) => {
          if (businessId && o.businessId && o.businessId !== businessId) return false;
          const matchesCustomer =
            (activeCustomer && o.customerId === activeCustomer.id) ||
            (activeConv.customerId && o.customerId === activeConv.customerId);
          const matchesConversation =
            activeConv.id && o.conversationId === activeConv.id;
          return matchesCustomer || matchesConversation;
        })
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    : [];

  const isActiveOrderStatus = (status?: string) => {
    const s = (status || '').toLowerCase();
    return s === 'confirmed' || s === 'processing' || s === 'tasdiqlandi' || s === 'tayyorlanmoqda';
  };

  const isRecentOrderStatus = (status?: string) => {
    const s = (status || '').toLowerCase();
    return s === 'completed' || s === 'cancelled' || s === 'yetkazildi' || s === 'bekor qilindi';
  };

  const activeOrders = conversationOrders.filter((o) => isActiveOrderStatus(o.status || o.orderStatus));
  const recentOrders = conversationOrders.filter((o) => isRecentOrderStatus(o.status || o.orderStatus));
  const customerOrders = conversationOrders;

  const filteredConversations = conversations.filter((c) => {
    const name = (c.customerName || '').toLowerCase();
    const uname = (c.customerUsername || '').toLowerCase();
    const preview = (c.lastMessagePreview || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    return name.includes(q) || uname.includes(q) || preview.includes(q);
  });

  const formatTime = (ts?: number) => {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Hozirgina';
    if (mins < 60) return `${mins} daqiqa oldin`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} soat oldin`;
    return new Date(ts).toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' });
  };

  const getIntentBadge = (intent?: string | null) => {
    if (!intent) return null;
    switch (intent) {
      case 'greeting':
        return { label: 'Salomlashish', bg: 'bg-blue-100 text-blue-700', icon: <Sparkles className="w-3 h-3" /> };
      case 'product_query':
        return { label: 'Mahsulot so\'rovi', bg: 'bg-purple-100 text-purple-700', icon: <Box className="w-3 h-3" /> };
      case 'stock_query':
        return { label: 'Ombor / Qoldiq', bg: 'bg-cyan-100 text-cyan-800', icon: <WarehouseIcon className="w-3 h-3" /> };
      case 'price_query':
        return { label: 'Narx so\'rovi', bg: 'bg-emerald-100 text-emerald-800', icon: <DollarSign className="w-3 h-3" /> };
      case 'order_intent':
        return { label: 'Buyurtma niyati', bg: 'bg-amber-100 text-amber-800 font-bold', icon: <ShoppingBag className="w-3 h-3" /> };
      case 'unknown':
      default:
        return { label: 'Umumiy / Boshqa', bg: 'bg-slate-100 text-slate-700', icon: <HelpCircle className="w-3 h-3" /> };
    }
  };

  const handleRunSimulator = async (customQuery?: string) => {
    const q = customQuery || simulatorQuery;
    if (!q.trim() || isSimulating) return;

    setIsSimulating(true);
    setSimulatorResult(null);

    try {
      const res = await fetch('/api/telegram/test-ai-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: q,
          businessId,
          customerName: activeCustomer ? activeCustomer.firstName : 'Mijoz',
        }),
      });
      const data = await res.json();
      setSimulatorResult(data);
    } catch (err) {
      console.error('Simulator error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !activeConv || isSending) return;
    setIsSending(true);

    try {
      // 1. Store outbound message in Firestore
      await MessageService.storeMessage({
        businessId,
        customerId: activeConv.customerId,
        conversationId: activeConv.id,
        direction: 'outbound',
        telegramMessageId: Date.now(),
        telegramChatId: activeConv.telegramChatId,
        type: 'text',
        text: replyText.trim(),
      });

      // 2. Send to Telegram chat via server endpoint
      try {
        await fetch('/api/telegram/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: activeConv.telegramChatId,
            text: replyText.trim(),
          }),
        });
      } catch {
        // Fallback silently if offline or token missing
      }

      setReplyText('');
    } catch (err) {
      console.error('Failed to send reply:', err);
    } finally {
      setIsSending(false);
    }
  };

  const scenarioQueries = [
    { label: '👋 Salomlashish', text: 'Assalomu alaykum, do\'koningiz bormi?', intent: 'greeting' },
    { label: '📱 Mahsulot haqida', text: 'Samsung Galaxy S25 Ultra xususiyatlari qanaqa?', intent: 'product_query' },
    { label: '📦 Ombor qoldig\'i', text: 'Omborda iPhone 15 Pro bormi, nechta qolgan?', intent: 'stock_query' },
    { label: '💰 Narx so\'rash', text: 'Redmi Note 14 Pro narxi qancha so\'m?', intent: 'price_query' },
    { label: '🛍 Buyurtma berish', text: 'Samsung Galaxy S25 Ultra dan 1 dona olmoqchiman, Toshkentga yetkazing', intent: 'order_intent' },
    { label: '❓ Noma\'lum so\'rov', text: 'Ertaga ob-havo qanday bo\'ladi?', intent: 'unknown' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-indigo-600" />
            Telegram Suhbatlar & AI Pipeline (CRM)
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Telegram xabarlari $\rightarrow$ AI Parser $\rightarrow$ Intent $\rightarrow$ Ombor / Mahsulot / Buyurtma $\rightarrow$ AI Javob
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSimulator(!showSimulator)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              showSimulator
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            {showSimulator ? 'Simulyatorni yopish' : 'AI Pipeline Sinovi'}
          </button>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4" />
              Yangilash
            </button>
          )}
        </div>
      </div>

      {/* AI Pipeline Interactive Simulator Panel */}
      {showSimulator && (
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-lg border border-indigo-800/50 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">AI SavdoBot Pipeline Sinovi</h3>
                <p className="text-xs text-indigo-200/80">
                  Telegram $\rightarrow$ Webhook $\rightarrow$ Mijoz $\rightarrow$ Suhbat $\rightarrow$ Xabar $\rightarrow$ AI Parser $\rightarrow$ Intent $\rightarrow$ Ombor/Mahsulot/Buyurtma $\rightarrow$ AI Javob
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-semibold">
              Live Gemini 3.8 Flash
            </span>
          </div>

          {/* Quick Scenario Buttons for the 6 Intents */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-indigo-300">6 ta asosiy intent bo'yicha tezkor sinovlar:</div>
            <div className="flex flex-wrap gap-2">
              {scenarioQueries.map((sc, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSimulatorQuery(sc.text);
                    handleRunSimulator(sc.text);
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-xs rounded-lg transition-colors border border-white/10 text-slate-100 flex items-center gap-1.5"
                >
                  <span>{sc.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Input and Submit */}
          <div className="flex gap-2">
            <input
              type="text"
              value={simulatorQuery}
              onChange={(e) => setSimulatorQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRunSimulator()}
              placeholder="Mijoz nomidan xabar yozing (masalan: Samsung S25 Ultra bormi?)..."
              className="flex-1 px-4 py-2.5 bg-slate-800/90 border border-indigo-700/50 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              onClick={() => handleRunSimulator()}
              disabled={isSimulating || !simulatorQuery.trim()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-md transition-colors"
            >
              {isSimulating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
              <span>{isSimulating ? 'Tahlil...' : 'Pipeline ishga tushirish'}</span>
            </button>
          </div>

          {/* Pipeline Trace Result */}
          {simulatorResult && simulatorResult.ok && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              {/* Step 1: AI Parser */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs text-indigo-300 font-semibold uppercase tracking-wider">
                  <span>1. AI Parser</span>
                  <span className="px-2 py-0.5 bg-indigo-500/20 rounded text-[11px] text-indigo-200">
                    {Math.round((simulatorResult.parsedIntent?.confidence || 0.9) * 100)}% ishonch
                  </span>
                </div>
                <div className="text-base font-bold text-white flex items-center gap-2">
                  <Tag className="w-4 h-4 text-indigo-400" />
                  <span className="font-mono text-emerald-400">{simulatorResult.parsedIntent?.intent}</span>
                </div>
                <div className="text-xs text-slate-300 space-y-1">
                  {simulatorResult.parsedIntent?.productQuery && (
                    <p>Mahsulot: <strong className="text-white">{simulatorResult.parsedIntent.productQuery}</strong></p>
                  )}
                  {simulatorResult.parsedIntent?.quantity && (
                    <p>Miqdor: <strong className="text-white">{simulatorResult.parsedIntent.quantity} dona</strong></p>
                  )}
                  {simulatorResult.parsedIntent?.customerPhone && (
                    <p>Telefon: <strong className="text-white">{simulatorResult.parsedIntent.customerPhone}</strong></p>
                  )}
                </div>
              </div>

              {/* Step 2: Product / Warehouse / Order Grounding */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs text-indigo-300 font-semibold uppercase tracking-wider">
                  <span>2. Do'kon Grounding</span>
                  <WarehouseIcon className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <div className="text-xs text-slate-200 space-y-1.5">
                  <p>
                    Mos mahsulot:{' '}
                    <strong className="text-white">
                      {simulatorResult.groundedContext?.topProduct || 'Topilmadi'}
                    </strong>
                  </p>
                  {simulatorResult.groundedContext?.topProductPrice && (
                    <p>
                      Narxi:{' '}
                      <span className="text-emerald-400 font-bold">
                        {simulatorResult.groundedContext.topProductPrice.toLocaleString()} so'm
                      </span>
                    </p>
                  )}
                  {simulatorResult.groundedContext?.warehouseStock?.[0] && (
                    <p>
                      Ombor qoldig'i:{' '}
                      <span className="text-cyan-300 font-semibold">
                        {simulatorResult.groundedContext.warehouseStock[0].stock} dona ({simulatorResult.groundedContext.warehouseStock[0].warehouseName})
                      </span>
                    </p>
                  )}
                  {simulatorResult.groundedContext?.draftOrderId && (
                    <p className="text-amber-300 font-medium">
                      📋 Buyurtma ID: #{simulatorResult.groundedContext.draftOrderId.slice(-6)} ({simulatorResult.groundedContext.draftOrderTotal?.toLocaleString()} so'm)
                    </p>
                  )}
                </div>
              </div>

              {/* Step 3: AI Response */}
              <div className="bg-slate-800/80 border border-indigo-700/60 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs text-indigo-300 font-semibold uppercase tracking-wider">
                  <span>3. Telegram Javob</span>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="bg-slate-900/90 rounded-lg p-2.5 text-xs text-emerald-100 font-sans whitespace-pre-wrap max-h-36 overflow-y-auto border border-slate-700">
                  {simulatorResult.aiResponseText}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row h-[700px]">
        {/* Left: Conversations list */}
        <div className="w-full md:w-80 lg:w-96 border-r border-gray-200 flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-gray-200 bg-gray-50">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Suhbatlarni qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">Hozircha suhbatlar yo'q</p>
                <p className="text-xs text-gray-400 mt-1">
                  Telegram botga xabar yozilganda bu yerda paydo bo'ladi.
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === selectedConvId;
                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConvId(conv.id)}
                    className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors ${
                      isSelected ? 'bg-indigo-50/70 border-l-4 border-indigo-600' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm">
                        {(conv.customerName || 'M')[0].toUpperCase()}
                      </div>
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-semibold text-sm text-gray-900 truncate">
                          {conv.customerName || 'Telegram Foydalanuvchi'}
                        </span>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">
                          {formatTime(conv.lastMessageAt)}
                        </span>
                      </div>
                      {conv.customerUsername && (
                        <p className="text-xs text-indigo-600 font-medium truncate mb-1">
                          @{conv.customerUsername}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 truncate">{conv.lastMessagePreview || '—'}</p>
                    </div>

                    {conv.unreadCount > 0 && (
                      <span className="flex-shrink-0 px-2 py-0.5 bg-indigo-600 text-white rounded-full text-[11px] font-bold">
                        {conv.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Message history & Customer card */}
        {activeConv ? (
          <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
            {/* Header */}
            <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
                  {(activeConv.customerName || 'M')[0].toUpperCase()}
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 text-sm">
                    {activeConv.customerName || 'Mijoz'}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {activeConv.customerUsername && <span>@{activeConv.customerUsername}</span>}
                    <span>•</span>
                    <span className="text-emerald-600 font-medium">Telegram Faol</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowOrderContext(!showOrderContext)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    activeOrders.length > 0
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  title="Buyurtmalar kontekstini ko'rsatish/yashirish"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Buyurtmalar ({conversationOrders.length})</span>
                  {activeOrders.length > 0 && (
                    <span className="px-1.5 py-0.2 bg-amber-600 text-white rounded-full text-[10px] font-bold">
                      {activeOrders.length} faol
                    </span>
                  )}
                  {showOrderContext ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>ID: {activeConv.telegramChatId}</span>
                </div>
              </div>
            </div>

            {/* Conversation Order Context Panel (M5.4.2) */}
            {showOrderContext && (
              <div className="bg-white border-b border-gray-200 p-3 shadow-xs space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Active Orders Section */}
                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80">
                    <div className="flex items-center justify-between pb-1.5 border-b border-amber-200/60 mb-2">
                      <span className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                        <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
                        Faol Buyurtmalar ({activeOrders.length})
                      </span>
                      <span className="text-[10px] text-amber-700 font-medium">confirmed / processing</span>
                    </div>

                    {activeOrders.length === 0 ? (
                      <div className="py-2.5 text-center text-xs text-slate-400 italic">
                        Faol buyurtmalar yo‘q
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {activeOrders.map((ord) => {
                          const statusBadge = getOrderStatusBadge(ord.status || ord.orderStatus);
                          const inventoryBadge = getInventoryStatusBadge(ord.inventoryStatus);
                          const currency = ord.currency || "so'm";
                          const formattedDate = new Date(ord.createdAt).toLocaleString('uz-UZ', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          });

                          return (
                            <div
                              key={ord.id}
                              onClick={() => setActiveOrder(ord)}
                              className="p-2.5 bg-white rounded-lg border border-amber-200 hover:border-amber-400 transition-all cursor-pointer shadow-xs hover:shadow-sm group"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-mono font-bold text-xs text-slate-900 group-hover:text-sky-600 transition-colors">
                                  #{ord.id}
                                </span>
                                <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                  <Calendar className="w-2.5 h-2.5" />
                                  {formattedDate}
                                </span>
                              </div>

                              <div className="text-xs font-semibold text-slate-800 truncate mb-1">
                                {ord.items && ord.items.length > 0
                                  ? ord.items.map((i) => `${i.productName} × ${i.quantity}`).join(', ')
                                  : 'Mahsulot yo\'q'}
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                                <span className="font-bold text-slate-900">
                                  {ord.total?.toLocaleString() ?? 0} {currency}
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-md ${statusBadge.className}`}>
                                    {statusBadge.icon}
                                    {statusBadge.label}
                                  </span>
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-md ${inventoryBadge.className}`}>
                                    {inventoryBadge.icon}
                                    {inventoryBadge.label}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Recent Orders Section */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 mb-2">
                      <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        So‘nggi Buyurtmalar ({recentOrders.length})
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">completed / cancelled</span>
                    </div>

                    {recentOrders.length === 0 ? (
                      <div className="py-2.5 text-center text-xs text-slate-400 italic">
                        So‘nggi buyurtmalar yo‘q
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {recentOrders.map((ord) => {
                          const statusBadge = getOrderStatusBadge(ord.status || ord.orderStatus);
                          const inventoryBadge = getInventoryStatusBadge(ord.inventoryStatus);
                          const currency = ord.currency || "so'm";
                          const formattedDate = new Date(ord.createdAt).toLocaleString('uz-UZ', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          });

                          return (
                            <div
                              key={ord.id}
                              onClick={() => setActiveOrder(ord)}
                              className="p-2.5 bg-white rounded-lg border border-slate-200 hover:border-slate-400 transition-all cursor-pointer shadow-xs hover:shadow-sm group"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-mono font-bold text-xs text-slate-900 group-hover:text-sky-600 transition-colors">
                                  #{ord.id}
                                </span>
                                <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                  <Calendar className="w-2.5 h-2.5" />
                                  {formattedDate}
                                </span>
                              </div>

                              <div className="text-xs font-semibold text-slate-800 truncate mb-1">
                                {ord.items && ord.items.length > 0
                                  ? ord.items.map((i) => `${i.productName} × ${i.quantity}`).join(', ')
                                  : 'Mahsulot yo\'q'}
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                                <span className="font-bold text-slate-900">
                                  {ord.total?.toLocaleString() ?? 0} {currency}
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-md ${statusBadge.className}`}>
                                    {statusBadge.icon}
                                    {statusBadge.label}
                                  </span>
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-md ${inventoryBadge.className}`}>
                                    {inventoryBadge.icon}
                                    {inventoryBadge.label}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoadingMessages ? (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  Xabarlar yuklanmoqda...
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                  <p>Hozircha xabarlar tarixi mavjud emas.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isInbound = msg.direction === 'inbound';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                          isInbound
                            ? 'bg-white text-gray-800 rounded-bl-xs border border-gray-200'
                            : 'bg-indigo-600 text-white rounded-br-xs'
                        }`}
                      >
                        {msg.type === 'photo' && (
                          <div className="flex items-center gap-1.5 text-xs mb-1 opacity-80">
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Rasm</span>
                          </div>
                        )}
                        {msg.type === 'voice' && (
                          <div className="flex items-center gap-1.5 text-xs mb-1 opacity-80">
                            <Mic className="w-3.5 h-3.5" />
                            <span>Ovozli xabar</span>
                          </div>
                        )}
                        {msg.type === 'document' && (
                          <div className="flex items-center gap-1.5 text-xs mb-1 opacity-80">
                            <FileText className="w-3.5 h-3.5" />
                            <span>Hujjat</span>
                          </div>
                        )}
                        {msg.type === 'contact' && (
                          <div className="flex items-center gap-1.5 text-xs mb-1 opacity-80">
                            <Phone className="w-3.5 h-3.5" />
                            <span>Kontakt</span>
                          </div>
                        )}

                        {msg.aiIntent && (() => {
                          const badge = getIntentBadge(msg.aiIntent);
                          if (!badge) return null;
                          return (
                            <div className="mb-1.5 flex items-center gap-1">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.bg}`}>
                                {badge.icon}
                                <span>{badge.label}</span>
                              </span>
                            </div>
                          );
                        })()}

                        <p className="whitespace-pre-wrap">{msg.text}</p>

                        <div
                          className={`text-[10px] mt-1 flex items-center justify-end gap-1 ${
                            isInbound ? 'text-gray-400' : 'text-indigo-200'
                          }`}
                        >
                          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {!isInbound && <CheckCheck className="w-3 h-3" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Footer */}
            <div className="p-3 bg-white border-t border-gray-200 flex items-center gap-2">
              <input
                type="text"
                placeholder="Javob yozing..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendReply();
                }}
                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <button
                onClick={handleSendReply}
                disabled={!replyText.trim() || isSending}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Send className="w-4 h-4" />
                <span>Yuborish</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
            <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-base font-medium">Suhbatni tanlang</p>
            <p className="text-xs text-gray-400 mt-1">
              Chap tomondagi ro'yxatdan suhbat ustiga bosing.
            </p>
          </div>
        )}
      </div>

      {/* Reusable Order Detail Modal (M5.4.2) */}
      {activeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">Buyurtma #{activeOrder.id}</h3>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md ${
                      getOrderStatusBadge(activeOrder.status || activeOrder.orderStatus).className
                    }`}
                  >
                    {getOrderStatusBadge(activeOrder.status || activeOrder.orderStatus).icon}
                    {getOrderStatusBadge(activeOrder.status || activeOrder.orderStatus).label}
                  </span>
                </div>
                <span className="text-xs text-slate-400 mt-0.5 block">
                  {new Date(activeOrder.createdAt).toLocaleString('uz-UZ')}
                </span>
              </div>
              <button
                onClick={() => setActiveOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="my-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">Ombor holati:</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-md ${
                      getInventoryStatusBadge(activeOrder.inventoryStatus).className
                    }`}
                  >
                    {getInventoryStatusBadge(activeOrder.inventoryStatus).icon}
                    {getInventoryStatusBadge(activeOrder.inventoryStatus).label}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">Admin xabari:</span>
                  <span className="text-[11px] font-semibold text-slate-700">
                    {activeOrder.adminNotificationSent ? 'Telegram xabari yuborilgan' : 'Yuborilmagan'}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-1.5 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-slate-500" />
                  Tarkibi ({activeOrder.items?.length || 0} ta mahsulot):
                </h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {activeOrder.items?.map((i, idx) => {
                    const currency = activeOrder.currency || "so'm";
                    return (
                      <div key={idx} className="p-2.5 flex items-center justify-between bg-white">
                        <div>
                          <div className="font-semibold text-slate-800">{i.productName}</div>
                          <div className="text-[11px] text-slate-400">
                            {i.quantity} dona × {i.unitPrice?.toLocaleString()} {currency}
                            {i.sku && ` (SKU: ${i.sku})`}
                          </div>
                        </div>
                        <div className="font-bold text-slate-900">
                          {((i.lineTotal ?? i.totalPrice ?? (i.unitPrice * i.quantity))).toLocaleString()} {currency}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Mahsulotlar (Subtotal):</span>
                  <span className="font-medium text-slate-800">
                    {activeOrder.subtotal?.toLocaleString() ?? 0} {activeOrder.currency || "so'm"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Yetkazib berish:</span>
                  <span className="font-medium text-slate-800">
                    {(activeOrder.deliveryFee || activeOrder.deliveryPrice || 0).toLocaleString()} {activeOrder.currency || "so'm"}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 text-sm pt-1.5 border-t border-slate-200">
                  <span>Jami:</span>
                  <span className="text-emerald-700">
                    {activeOrder.total?.toLocaleString() ?? 0} {activeOrder.currency || "so'm"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setActiveOrder(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl text-xs transition-colors"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
