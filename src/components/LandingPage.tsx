import React, { useState } from 'react';
import {
  Sparkles,
  Bot,
  Warehouse,
  Package,
  Send,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  MessageSquare,
  ShieldCheck,
  ChevronRight,
  Play
} from 'lucide-react';

interface LandingPageProps {
  onStart: () => void;
  onExploreDemo: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart, onExploreDemo }) => {
  const [testQuestion, setTestQuestion] = useState('Redmi Note 14 Pro bormi?');
  const [testAnswer, setTestAnswer] = useState(
    'Ha, Redmi Note 14 Pro 8/256 mavjud!\n💰 Narxi: 3 200 000 so\'m.\n📦 Hozirda omborda 5 dona bor.\n\nBuyurtma berishni istaysizmi?'
  );

  const features = [
    {
      icon: <Bot className="w-6 h-6 text-sky-500" />,
      title: "Telegram AI Savdo Agenti",
      desc: "Mijozlarning «Bormi?», «Narxi qancha?», «Yetkazib berasizmi?» kabi takroriy savollariga 24/7 ombor qoldig'iga asoslanib aniq javob beradi."
    },
    {
      icon: <Package className="w-6 h-6 text-indigo-500" />,
      title: "Katalog & AI Bilan Mahsulot Qo'shish",
      desc: "«Redmi Note 14 Pro, 3 200 000 so'm, 5 ta» deb yozsangiz kifoya — AI tovar nomi, narxi va sonini o'zi aniqlab bazaga kiritadi."
    },
    {
      icon: <Warehouse className="w-6 h-6 text-emerald-500" />,
      title: "Ombor va Kirim/Chiqim Nazorati",
      desc: "Har bir sotuvda tovar qoldig'i avtomatik kamayadi. Filiallar va omborlararo harakatlarni to'liq kuzatib boring."
    },
    {
      icon: <TrendingUp className="w-6 h-6 text-amber-500" />,
      title: "CRM & AI Follow-up",
      desc: "Narx so'rab xarid qilmagan mijozlarni AI aniqlaydi va sizga shaxsiy xushmuomala xabarlar bilan qayta sotishni tavsiya qiladi."
    }
  ];

  const pricing = [
    {
      name: "Boshlang'ich (Starter)",
      price: "199 000",
      period: "oyiga",
      features: [
        "1 ta Telegram Bot",
        "500 tagacha mahsulot",
        "Avtomatik javoblar (AI)",
        "Ombor qoldiqlari nazorati",
        "1 ta omborxona"
      ],
      popular: false,
    },
    {
      name: "Professional (Pro)",
      price: "399 000",
      period: "oyiga",
      features: [
        "Cheksiz Telegram Guruhlar & Bot",
        "AI bilan matn va rasmdan mahsulot qo'shish",
        "AI Follow-up va Qayta Savdo",
        "3 tagacha filial omborlari",
        "To'liq CRM va mijozlar tahlili",
        "24/7 ustuvor qo'llab-quvvatlash"
      ],
      popular: true,
    },
    {
      name: "Biznes (Enterprise)",
      price: "799 000",
      period: "oyiga",
      features: [
        "Ko'p filialli tarmoqlar uchun",
        "1C / MoySklad integratsiyalari",
        "Shaxsiy AI savdo modeli sozlash",
        "Cheksiz xodimlar hisobi",
        "Shaxsiy menejer biriktirish"
      ],
      popular: false,
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-sky-500 selection:text-white">
      {/* Navigation */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-sky-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold text-slate-900 tracking-tight">AI SavdoBot</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onExploreDemo}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
            >
              Demo ko'rish
            </button>
            <button
              onClick={onStart}
              className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              Boshlash
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 border border-sky-200/80 text-sky-700 text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
            O'zbekistondagi Telegram savdo do'konlari uchun #1 AI CRM
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
            Telegramdagi savdoni <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent">
              AI bilan avtomatlashtiring
            </span>
          </h1>

          <p className="max-w-2xl mx-auto mt-5 text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            Mijozlarga tez javob bering, mahsulotlarni boshqaring, omborni nazorat qiling va buyurtmalarni bitta qulay tizimda yuriting.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              onClick={onStart}
              className="w-full sm:w-auto px-6 py-3.5 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              Tizimga kirish / Boshlash
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onExploreDemo}
              className="w-full sm:w-auto px-6 py-3.5 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 text-sky-600 fill-sky-600" />
              Interaktiv Demo Sinov
            </button>
          </div>

          {/* Interactive Chat Mockup Card */}
          <div className="mt-12 max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden text-left text-xs">
            <div className="bg-sky-600 px-4 py-3 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold">
                <Bot className="w-4 h-4" />
                SavdoBot Jonli Misol
              </div>
              <span className="text-[11px] bg-sky-700/60 px-2 py-0.5 rounded-md">24/7 Online</span>
            </div>

            <div className="p-4 space-y-3 bg-slate-50">
              <div className="flex justify-end">
                <div className="bg-sky-500 text-white rounded-2xl rounded-br-none p-3 max-w-[80%]">
                  {testQuestion}
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-bl-none p-3 max-w-[85%] whitespace-pre-line leading-relaxed">
                  {testAnswer}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards Grid */}
      <section className="py-16 bg-white border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Kichik va O'rta Savdo Do'konlari Uchun Barcha Asboblar
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              Murakkab CRM atamalarisiz — oddiy, tezkor va Telegram do'koningizga moslashtirilgan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="p-6 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-200/80 transition-all hover:border-slate-300"
              >
                <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-2xs w-fit mb-4">
                  {f.icon}
                </div>
                <h3 className="font-bold text-slate-900 text-base mb-1.5">{f.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center max-w-xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Qulay Tarif Rejalari</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              Har qanday savdo hajmiga mos, 14 kunlik bepul sinov muddati bilan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pricing.map((p, idx) => (
              <div
                key={idx}
                className={`bg-white rounded-2xl p-6 border transition-all flex flex-col justify-between ${
                  p.popular
                    ? 'border-sky-500 ring-2 ring-sky-500/20 shadow-md relative'
                    : 'border-slate-200/80 shadow-xs'
                }`}
              >
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-sky-600 text-white font-bold text-[10px] uppercase tracking-wider rounded-full shadow-xs">
                    Eng Ommabop
                  </span>
                )}
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">{p.name}</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900">{p.price}</span>
                    <span className="text-xs text-slate-500 font-semibold">so'm / {p.period}</span>
                  </div>

                  <ul className="mt-6 space-y-2.5 text-xs text-slate-600">
                    {p.features.map((item, fIdx) => (
                      <li key={fIdx} className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-100">
                  <button
                    onClick={onStart}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all ${
                      p.popular
                        ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    Boshlash
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-white border-t border-slate-200 text-center text-xs text-slate-500">
        <p>© 2026 AI SavdoBot. O'zbekistondagi do'konlar va chakana savdo uchun maxsus ishlab chiqilgan.</p>
      </footer>
    </div>
  );
};
