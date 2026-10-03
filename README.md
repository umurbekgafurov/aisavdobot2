# AI SavdoBot — Telegram AI Sales Assistant & CRM

**AI SavdoBot** — O'zbekistondagi chakana savdo (retail) va Telegram do'konlar uchun sun'iy intellektga asoslangan savdo yordamchisi va sodda CRM tizimi.

> "Telegramdagi savdoni AI bilan avtomatlashtiring. Mijozlarga tez javob bering, mahsulotlarni boshqaring, omborni nazorat qiling va buyurtmalarni bitta tizimda yuriting."

---

## 🌟 Asosiy Imkoniyatlar

1. **Telegram AI Savdo Agenti**:
   - «Redmi Note 14 Pro bormi?», «Narxi qancha?», «Yetkazib berasizmi?» kabi savollarga faqatgina omborda mavjud haqiqiy tovar va narxlarga asoslanib o'zbek tilida xushmuomala javob beradi.
   - Narx yoki ombor qoldig'ini o'zidan to'qimaydi (No Hallucination).

2. **AI Bilan Mahsulot Qo'shish**:
   - Oddiy matn orqali: `Redmi Note 14 Pro 8/256, 3 200 000 so'm, 5 dona`.
   - AI tovar nomi, narxi, varianti va sonini avtomatik ajratib oladi va tasdiqlash oynasini ko'rsatadi.
   - Mahsulot rasmi orqali (Gemini Vision).
   - Excel / CSV orqali ommaviy import.

3. **Ko'p Filialli Ombor & Kirim-Chiqim (Stock Movements)**:
   - Tovar qoldig'i shunchaki raqam emas: Kirim (`IN`), Chiqim (`OUT`), Sotuv (`SALE`), Qaytarish (`RETURN`) harakatlar tarixi bilan yuritiladi.
   - Bir nechta filial omborlarini qo'llab-quvvatlaydi (masalan: Asosiy ombor, Chilonzor filial, Sergeli filial).

4. **Customer CRM & AI Lead Scoring**:
   - Mijozning har bir qiziqishi (narx so'rash, yetkazib berish, buyurtma qilish) asosida 0–100 oralig'ida lead ballini hisoblaydi (`Issiq lead`, `VIP`).
   - AI orqali suhbat xulosasi (Conversation Summary).

5. **AI Follow-up & Qayta Sotuv Tavsiyalari**:
   - Mahsulot so'rab, lekin xarid qilmagan mijozlarni aniqlaydi va admin uchun shaxsiy xushmuomala taklif xatini tayyorlaydi.

6. **Buyurtmalar & Ombor Zanjiri**:
   - Telegram orqali buyurtma kelganda ombordagi qoldiq avtomatik kamayadi (`SALE`), buyurtma tasdiqlanadi va mijozning umumiy xaridlari yangilanadi.

---

## ⚙️ Sozlash va Integratsiyalar

### 1. Muhit O'zgaruvchilari (`.env`)

`.env.example` namunasidan nusxa olib `.env` faylini yarating:

```env
GEMINI_API_KEY="AI_STUDIO_DAN_OLINGAN_KALIT"
APP_URL="https://sizning-domeningiz.uz"

# Telegram Bot sozlamalari:
TELEGRAM_BOT_TOKEN="123456789:ABCdefGhIjklmnOPQRSTUvwxyz"
TELEGRAM_WEBHOOK_SECRET="maxfiy_webhook_kaliti"

# Firebase loyihasi:
FIREBASE_PROJECT_ID="gen-lang-client-0375283044"
```

### 2. Telegram BotFather orqali Bot yaratish

1. Telegramda [@BotFather](https://t.me/BotFather) botiga kiring.
2. `/newbot` buyrug'ini bering va bot nomini kiriting (masalan: `Mening Savdo Botim`).
3. Olingan `API TOKEN`ni `.env` faylidagi `TELEGRAM_BOT_TOKEN`ga qo'ying.
4. **Guruhlar uchun maxfiylikni o'chirish (Group Privacy)**:
   - BotFatherda `/setprivacy` ni bosing.
   - O'z botingizni tanlang va **Disable** qiling (bot guruhlardagi tovar savollarini o'qib, avtomatik javob berishi uchun).
5. Webhook o'rnatish:
   ```bash
   curl -F "url=https://SIZNING_URL/api/telegram/webhook" -F "secret_token=MAXFIY_TOKEN" https://api.telegram.org/bot<TOKEN>/setWebhook
   ```

### 3. Google Gemini API sozlash

- Google AI Studio orqali olingan `GEMINI_API_KEY` tizimga kiritiladi.
- Model: `gemini-2.5-flash` yoki `gemini-3.8-flash`.

---

## 🚀 Loyihani Ishga Tushirish

```bash
# Kutubxonalarni o'rnatish
npm install

# Dasturni ishga tushirish (Dev server)
npm run dev

# Ishlab chiqarish uchun build qilish
npm run build
```

Barcha huquqlar himoyalangan © 2026 AI SavdoBot.
