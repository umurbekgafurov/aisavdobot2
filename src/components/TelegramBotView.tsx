import React, { useState } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShoppingBag,
  ExternalLink,
  Info,
  Settings2,
  Layers
} from 'lucide-react';
import { Product, Customer, Order, TelegramMessage } from '../types';
import { generateSalesResponse } from '../services/aiService';

interface TelegramBotViewProps {
  products: Product[];
  customers: Customer[];
  onOrderCreated: (order: Order) => Promise<void>;
  onCustomerUpdated: (customer: Customer) => Promise<void>;
}

export const TelegramBotView: React.FC<TelegramBotViewProps> = ({
  products,
  customers,
  onOrderCreated,
  onCustomerUpdated,
}) => {
  const [messages, setMessages] = useState<TelegramMessage[]>([
    {
      id: 'm1',
      businessId: 'biz-default',
      customerId: 'cust-1',
      sender: 'customer',
      senderName: 'Akmal',
      text: 'Redmi Note 14 Pro bormi?',
      timestamp: Date.now() - 50000,
    },
    {
      id: 'm2',
      businessId: 'biz-default',
      customerId: 'cust-1',
      sender: 'bot',
      senderName: 'SavdoBot AI',
      text: 'Ha, Redmi Note 14 Pro 8/256 mavjud! 📱\n💰 Narxi: 3 200 000 so\'m.\n📦 Hozirda omborda 5 dona bor.\n\nBuyurtma berishni istaysizmi? Telefon raqamingizni yuborsangiz, rasmiylashtirib beramiz.',
      timestamp: Date.now() - 40000,
      aiGenerated: true,
    },
    {
      id: 'm3',
      businessId: 'biz-default',
      customerId: 'cust-1',
      sender: 'customer',
      senderName: 'Akmal',
      text: 'Yetkazib berasizlarmi?',
      timestamp: Date.now() - 30000,
    },
    {
      id: 'm4',
      businessId: 'biz-default',
      customerId: 'cust-1',
      sender: 'bot',
      senderName: 'SavdoBot AI',
      text: 'Ha, Toshkent bo‘ylab va butun O\'zbekiston bo\'ylab yetkazib berish xizmatimiz mavjud! 🚚\nToshkent shahrida 1 000 000 so\'mdan yuqori xaridlar uchun yetkazib berish bepul.',
      timestamp: Date.now() - 20000,
      aiGenerated: true,
    }
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [activeGroupMode, setActiveGroupMode] = useState(false);
  const [orderModal, setOrderModal] = useState<{ show: boolean; product?: Product; phone?: string }>({ show: false });

  // Fast scenario test buttons (as required in Sections 16, 17, 41)
  const scenarios = [
    { label: 'Redmi Note 14 Pro bormi?', text: 'Redmi Note 14 Pro bormi?' },
    { label: 'Yetkazib berasizlarmi?', text: 'Yetkazib berasizlarmi?' },
    { label: '2 dona olsam qancha chegirma?', text: '2 dona olsam qancha chegirma qilasiz?' },
    { label: 'iPhone 15 Pro 256GB olaman (+998 90 123 45 67)', text: 'iPhone 15 Pro 256GB bitta olaman, telefonim: +998 90 123 45 67, Yunusobodga yetkazing.' },
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim()) return;

    const userMsg: TelegramMessage = {
      id: `msg-${Date.now()}`,
      businessId: 'biz-default',
      customerId: 'cust-1',
      sender: 'customer',
      senderName: 'Akmal (Mijoz)',
      text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsBotTyping(true);

    try {
      // 1. Process customer message through strict grounded AI
      const aiResponse = await generateSalesResponse(text, {
        businessName: 'Telefon Market & Gadgets',
        phone: '+998 71 200 00 20',
        address: 'Toshkent sh., Yunusobod 107',
        workingHours: '09:00 - 21:00',
        deliveryZones: ['Toshkent shahri', 'Viloyatlar (BTS Pochta)'],
        deliveryPrice: 25000,
        freeDeliveryThreshold: 1000000,
        paymentMethods: ['Naqd pul', 'Click', 'Payme', 'Uzum Bank'],
        products,
        conversationHistory: messages.map((m) => ({
          role: m.sender === 'customer' ? 'user' : 'model',
          content: m.text,
        })),
      });

      // 2. Add AI reply
      const botMsg: TelegramMessage = {
        id: `msg-${Date.now() + 1}`,
        businessId: 'biz-default',
        customerId: 'cust-1',
        sender: 'bot',
        senderName: 'SavdoBot AI',
        text: aiResponse.text,
        timestamp: Date.now(),
        aiGenerated: true,
        needsHumanAttention: aiResponse.needsHumanAttention,
      };

      setMessages((prev) => [...prev, botMsg]);

      // 3. Automated Order trigger check if message contains purchase intent + contact info
      const phoneMatch = text.match(/(\+?998\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}|\d{9})/);
      const isOrdering = text.toLowerCase().includes('olaman') || text.toLowerCase().includes('buyurtma');

      if (isOrdering && aiResponse.matchedProducts.length > 0) {
        const prod = aiResponse.matchedProducts[0];
        const newOrderId = `ORD-${Date.now().toString().slice(-4)}`;
        
        // Execute consistency flow: Order + Stock -1 + Customer update
        await onOrderCreated({
          id: newOrderId,
          businessId: 'biz-default',
          customerId: 'cust-1',
          customerName: 'Akmal Rahimov',
          customerPhone: phoneMatch ? phoneMatch[0] : '+998 90 123 45 67',
          items: [
            {
              productId: prod.id,
              productName: prod.name,
              variantName: prod.variants?.[0]?.name || 'Standart',
              quantity: 1,
              unitPrice: prod.price,
              totalPrice: prod.price,
            }
          ],
          subtotal: prod.price,
          deliveryFee: 0,
          discount: 0,
          total: prod.price,
          paymentStatus: 'Kutilmoqda',
          orderStatus: 'Tasdiqlandi',
          deliveryAddress: 'Toshkent sh., Yunusobod tumani',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Add confirmation message to chat
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now() + 2}`,
              businessId: 'biz-default',
              customerId: 'cust-1',
              sender: 'bot',
              senderName: 'SavdoBot AI',
              text: `✅ Rahmat! Buyurtmangiz #${newOrderId} muvaffaqiyatli rasmiylashtirildi!\n📦 Mahsulot: ${prod.name}\n💰 Jami: ${prod.price.toLocaleString()} so'm\n🚚 Kuryerimiz tez orada siz bilan bog'lanadi.`,
              timestamp: Date.now(),
              aiGenerated: true,
            }
          ]);
        }, 1000);
      }
    } finally {
      setIsBotTyping(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Bot Connection Status Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Telegram SavdoBot (Jonli Sinov)</h2>
              <span className="px-2 py-0.5 text-[11px] font-bold text-emerald-700 bg-emerald-100 rounded-full flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                🟢 Ulanmoqda / Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Bot Username: <strong className="text-sky-600">@savdobot_demo_bot</strong> • Webhook: <code>/api/telegram/webhook</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMessages([])}
            className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Chatni tozalash
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Telegram Chat Simulation (2 cols) */}
        <div className="lg:col-span-2 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden flex flex-col h-[600px] shadow-inner">
          {/* Telegram Header */}
          <div className="bg-sky-600 text-white px-4 py-3 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                SB
              </div>
              <div>
                <div className="font-bold text-sm">Telefon Market SavdoBot</div>
                <div className="text-[11px] text-sky-100">bot • har doim onlayn</div>
              </div>
            </div>
            <span className="text-xs font-semibold bg-sky-700/60 px-2.5 py-1 rounded-lg">
              O'zbek tili
            </span>
          </div>

          {/* Quick Scenario Prompts */}
          <div className="bg-white/80 backdrop-blur-xs border-b border-slate-200/80 px-3 py-2 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            <span className="font-semibold text-slate-500 shrink-0">Sinov ssenariylari:</span>
            {scenarios.map((sc, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(sc.text)}
                className="px-2.5 py-1 bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200 rounded-lg whitespace-nowrap font-medium transition-all shadow-2xs"
              >
                {sc.label}
              </button>
            ))}
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px]">
            {messages.map((m) => {
              const isMe = m.sender === 'customer';
              return (
                <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl p-3.5 shadow-xs text-xs leading-relaxed ${
                      isMe
                        ? 'bg-sky-500 text-white rounded-br-none'
                        : 'bg-white text-slate-900 rounded-bl-none border border-slate-200'
                    }`}
                  >
                    {!isMe && (
                      <div className="flex items-center justify-between gap-2 mb-1 pb-1 border-b border-slate-100 font-bold text-sky-600 text-[11px]">
                        <span className="flex items-center gap-1">
                          <Bot className="w-3.5 h-3.5" />
                          SavdoBot AI
                        </span>
                        {m.needsHumanAttention && (
                          <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded-md font-semibold">
                            Admin e'tibori
                          </span>
                        )}
                      </div>
                    )}
                    <p className="whitespace-pre-line">{m.text}</p>
                    <div
                      className={`text-[10px] text-right mt-1.5 ${
                        isMe ? 'text-sky-100' : 'text-slate-400'
                      }`}
                    >
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })}

            {isBotTyping && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl rounded-bl-none p-3 shadow-xs border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-sky-500 animate-bounce"></span>
                    <span className="w-2 h-2 rounded-full bg-sky-500 animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-2 h-2 rounded-full bg-sky-500 animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                  <span>SavdoBot AI yozmoqda...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Box */}
          <div className="bg-white p-3 border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
              placeholder="Telegram orqali savol bering (masalan: Redmi Note 14 Pro narxi qancha?)..."
              className="flex-1 p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isBotTyping || !inputMessage.trim()}
              className="p-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl shadow-xs transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Telegram Bot & Group Onboarding Instructions (Section 17 of Brief) */}
        <div className="space-y-4">
          {/* Telegram Group Onboarding Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-600" />
              Telegram Guruhlarga Ulash Qoidalari
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Telegram maxfiylik sozlamalari (Group Privacy) bot barcha xabarlarni o'qishini cheklashi mumkin.
            </p>

            <div className="space-y-2 text-xs text-slate-700">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2">
                <span className="font-bold text-sky-600">1.</span>
                <span>Botni o'z Telegram guruhingizga qo'shing.</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2">
                <span className="font-bold text-sky-600">2.</span>
                <span>Botga xabarlarni yozish ruxsatini (Admin huquqlarini) bering.</span>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2 text-amber-900 font-medium">
                <span className="font-bold text-amber-600">3.</span>
                <span>
                  <strong>BotFather</strong>da <code>/setprivacy</code> orqali <strong>Disable</strong> qiling (agar guruhdagi barcha xabarlarga avtomatik javob berishini istasangiz).
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2">
                <span className="font-bold text-sky-600">4.</span>
                <span>Bot faqat to'g'ridan-to'g'ri murojaatda yoki <code>@savdobot</code> eslatilganda javob beradi (spam bo'lmasligi uchun).</span>
              </div>
            </div>
          </div>

          {/* Connected Groups */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Ulangan Guruhlar</h3>
              <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                2 ta faol
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">Telefon Market Savdo Guruh</div>
                  <div className="text-[11px] text-slate-400">1 420 a'zo • Asosiy katalog ulangan</div>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">Chilonzor Filial Mijozlari</div>
                  <div className="text-[11px] text-slate-400">380 a'zo • Chilonzor ombori ulangan</div>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
