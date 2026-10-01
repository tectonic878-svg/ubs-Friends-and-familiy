import React, { useState } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Code, 
  Smartphone, 
  Copy, 
  Check, 
  HelpCircle, 
  Calculator, 
  Sparkles,
  FileCheck,
  ExternalLink
} from 'lucide-react';
import { AnyApplication } from '../types';
import { formatMoneyUZS } from '../utils/formatters';
import { UBSLogo } from './UBSLogo';

interface TelegramBotSimulatorProps {
  applications: AnyApplication[];
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
  buttons?: { label: string; payload: string }[];
}

export const TelegramBotSimulator: React.FC<TelegramBotSimulatorProps> = ({ applications }) => {
  const [activeTab, setActiveTab] = useState<'simulator' | 'code_python' | 'code_nodejs'>('simulator');
  const [inputPrompt, setInputPrompt] = useState('');
  const [copied, setCopied] = useState(false);

  // Chat message history
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'bot',
      text: `👋 Assalomu alaykum! Universitetimizning «Friends & Family» chegirma tizimi rasmiy Telegram botiga xush kelibsiz!\n\nUshbu bot orqali siz:\n✨ Do‘stlaringiz yoki oila a’zolaringiz bilan birga 10% chegirmaga ariza topshirishingiz;\n📊 To‘lov-shartnoma tejamingizni hisoblashingiz;\n🔍 JSHSHR orqali arizangiz holatini tekshirishingiz mumkin.`,
      time: '12:00',
      buttons: [
        { label: '👥 Friends (Do‘stlar) dasturi', payload: '/friends' },
        { label: '👨‍👩‍👧‍👦 Family (Oila) dasturi', payload: '/family' },
        { label: '🧮 10% Chegirmani hisoblash', payload: '/calc' },
        { label: '🔎 Ariza holatini tekshirish', payload: '/status' },
      ],
    },
  ]);

  const handleSend = (textToSend?: string) => {
    const text = textToSend || inputPrompt;
    if (!text.trim()) return;

    const timeNow = new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: 'u_' + Date.now(),
      sender: 'user',
      text: text.trim(),
      time: timeNow,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputPrompt('');

    // Bot automatic response logic
    setTimeout(() => {
      const lower = text.toLowerCase();
      let botResponseText = '';
      let buttons: { label: string; payload: string }[] | undefined;

      if (lower.includes('/start') || lower.includes('boshlash') || lower.includes('salom')) {
        botResponseText = `Assalomu alaykum! Siz «Friends & Family» chegirma dasturlari bo‘yicha kerakli buyruqni tanlashingiz mumkin:`;
        buttons = [
          { label: '👥 Friends dasturi', payload: '/friends' },
          { label: '👨‍👩‍👧‍👦 Family dasturi', payload: '/family' },
          { label: '🧮 Chegirma hisoblagich', payload: '/calc' },
          { label: '🔎 Holatni bilish', payload: '/status' },
        ];
      } else if (lower.includes('/friends') || lower.includes('friend') || lower.includes('do‘st')) {
        botResponseText = `👥 «Friends» (Do‘stlar) dasturi:\n\n• Agar universitetimizga do‘stingiz bilan birga o‘qishga kirsangiz, har ikkingizga to‘lov-shartnomadan 10% chegirma beriladi!\n• Talablar: Ikkala talabaning 14 xonali JSHSHR raqami, pasport seriyasi va shahodatnoma/diplom nusxasi kerak.\n• Ariza sayt orqali to‘ldiriladi va admin tomonidan tekshiriladi.`;
        buttons = [
          { label: '🧮 Shartnoma summasini hisoblash', payload: '/calc' },
          { label: '🌐 Saytda ariza yuborish', payload: '/apply_web' },
        ];
      } else if (lower.includes('/family') || lower.includes('oila')) {
        botResponseText = `👨‍👩‍👧‍👦 «Family» (Oila a’zolari) dasturi:\n\n• Bir oiladan 1 nafardan 10 nafargacha talaba o‘qiyotgan bo‘lsa, har biriga 10% chegirma taqdim etiladi!\n• Kerakli ma’lumotlar: Alohida pasport seriyasi (2 harf) va raqami (7 raqam), 14 xonali JSHSHR hamda qarindoshlikni tasdiqlovchi tug‘ilganlik haqida guvohnoma.`;
        buttons = [
          { label: '🧮 2-10 kishi uchun tejashni hisoblash', payload: '/calc' },
          { label: '🌐 Sayt orqali topshirish', payload: '/apply_web' },
        ];
      } else if (lower.includes('/calc') || lower.includes('hisob')) {
        botResponseText = `🧮 10% Chegirma namunasi:\n\n• 1 talaba shartnomasi: 14 000 000 so‘m\n• 10% Chegirma tejami: 1 400 000 so‘m\n• To‘lanadigan summa: 12 600 000 so‘m\n\n📌 2 nafar oila a’zosi uchun umumiy tejamkorlik: 2 800 000 so‘m!`;
      } else if (lower.includes('/status') || lower.includes('holat') || lower.match(/\d{14}/)) {
        const jshshrMatch = lower.match(/\d{14}/);
        if (jshshrMatch) {
          const pinfl = jshshrMatch[0];
          const found = applications.find((a) => {
            if (a.type === 'friends') {
              return a.applicantStudent.jshshr === pinfl || a.friendStudent.jshshr === pinfl;
            } else {
              return a.members.some((m) => m.jshshr === pinfl);
            }
          });

          if (found) {
            botResponseText = `✅ Ariza topildi!\n\n🆔 ID: ${found.id}\n📁 Dastur: ${found.type.toUpperCase()}\n📊 Holat: ${found.status.toUpperCase()}\n🎁 Chegirma: 10%\n\n${found.adminNotes ? '💬 Admin izohi: ' + found.adminNotes : ''}`;
          } else {
            botResponseText = `⚠️ JSHSHR (${pinfl}) bo‘yicha ariza topilmadi. Iltimos raqamni to‘g‘ri kiritganingizni tekshiring.`;
          }
        } else {
          botResponseText = `🔎 Arizangiz holatini bilish uchun 14 xonali JSHSHR raqamingizni yozing (masalan: 31405021234567).`;
        }
      } else {
        botResponseText = `Kechirasiz, tushunmadim. Pastdagi tugmalardan birini bosing yoki 14 xonali JSHSHR raqamingizni yuboring:`;
        buttons = [
          { label: '👥 Friends', payload: '/friends' },
          { label: '👨‍👩‍👧‍👦 Family', payload: '/family' },
          { label: '🔎 Holat tekshirish', payload: '/status' },
        ];
      }

      const botMsg: ChatMessage = {
        id: 'b_' + Date.now(),
        sender: 'bot',
        text: botResponseText,
        time: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
        buttons,
      };
      setMessages((prev) => [...prev, botMsg]);
    }, 450);
  };

  const pythonBotCode = `# ========================================================
# Universitet "Friends & Family" Telegram Boti
# Kutubxona: aiogram 3.x (pip install aiogram aiohttp)
# ========================================================

import asyncio
import logging
from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart, Command
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton

BOT_TOKEN = "SIZNING_TELEGRAM_BOT_TOKENINGIZ" # @BotFather orqali olingan token

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

def main_keyboard():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="👥 Friends dasturi (10%)", callback_data="btn_friends")],
        [InlineKeyboardButton(text="👨‍👩‍👧‍👦 Family dasturi (10%)", callback_data="btn_family")],
        [InlineKeyboardButton(text="🧮 Chegirmani hisoblash", callback_data="btn_calc")],
        [InlineKeyboardButton(text="🔎 Ariza holatini tekshirish", callback_data="btn_status")]
    ])

@dp.message(CommandStart())
async def start_handler(message: Message):
    text = (
        "👋 Assalomu alaykum!\\n\\n"
        "Universitetimizning «Friends & Family» chegirma dasturi rasmiy botiga xush kelibsiz!\\n\\n"
        "Do‘stingiz yoki oila a’zolaringiz bilan birga o‘qib, 10% chegirmaga ega bo‘ling."
    )
    await message.answer(text, reply_markup=main_keyboard())

@dp.message(Command("friends"))
async def friends_handler(message: Message):
    text = (
        "👥 «Friends» dasturi qoidalari:\\n"
        "1. Ikkala talabaning 14 xonali JSHSHR raqami kiritiladi.\\n"
        "2. Shahodatnoma/diplom nusxalari yuklanadi.\\n"
        "3. Har ikki talabaga to‘lov-shartnomadan 10% chegirma beriladi!"
    )
    await message.answer(text)

@dp.message(Command("family"))
async def family_handler(message: Message):
    text = (
        "👨‍👩‍👧‍👦 «Family» dasturi qoidalari:\\n"
        "1. Bir oiladan 1 nafardan 10 nafargacha talaba o‘qiyotganda amal qiladi.\\n"
        "2. Alohida pasport seriyasi va raqami hamda tug‘ilganlik guvohnomasi talab etiladi.\\n"
        "3. Har qanday holatda har bir talabaga qat’iy 10% chegirma taqdim etiladi!"
    )
    await message.answer(text)

@dp.message()
async def echo_jshshr_check(message: Message):
    user_text = message.text.strip()
    if len(user_text) == 14 and user_text.isdigit():
        await message.answer(f"🔎 JSHSHR: {user_text} bo‘yicha tekshirilmoqda...\\nArizangiz ma’muriyat tomonidan ko‘rib chiqilmoqda (Kutilmoqda).")
    else:
        await message.answer("Buyruqlardan birini tanlang yoki 14 xonali JSHSHR raqamingizni yuboring:", reply_markup=main_keyboard())

async def main():
    logging.basicConfig(level=logging.INFO)
    print("Bot ishga tushdi...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
`;

  const nodejsBotCode = `// ========================================================
// Universitet "Friends & Family" Telegram Boti
// Kutubxona: telegraf (npm install telegraf dotenv)
// ========================================================

const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || 'SIZNING_BOT_TOKENINGIZ');

bot.start((ctx) => {
  return ctx.reply(
    \`👋 Assalomu alaykum, \${ctx.from.first_name}!\\n\\n\` +
    \`Universitetimizning «Friends & Family» chegirma dasturi botiga xush kelibsiz!\\n\` +
    \`Talabalar to‘lov-shartnomasiga 10% kafolatlangan chegirma beriladi.\`,
    Markup.inlineKeyboard([
      [Markup.button.callback('👥 Friends dasturi (10%)', 'friends')],
      [Markup.button.callback('👨‍👩‍👧‍👦 Family dasturi (10%)', 'family')],
      [Markup.button.callback('🧮 Chegirmani hisoblash', 'calc')],
    ])
  );
});

bot.action('friends', (ctx) => {
  return ctx.reply('👥 Friends dasturi: Do‘stingiz bilan birga o‘qib, ikkovingiz ham 10% chegirmaga ega bo‘lasiz!');
});

bot.action('family', (ctx) => {
  return ctx.reply('👨‍👩‍👧‍👦 Family dasturi: 1 dan 10 nafargacha oila a’zolarining har biriga 10% chegirma taqdim etiladi!');
});

bot.on('text', (ctx) => {
  const text = ctx.message.text.trim();
  if (text.length === 14 && /^\\d+$/.test(text)) {
    return ctx.reply(\`🔎 JSHSHR: \${text} tekshirildi. Ariza holati: Ko‘rib chiqilmoqda (10% kutilmoqda).\`);
  }
  return ctx.reply('Iltimos, tekshirish uchun 14 xonali JSHSHR raqamingizni yozing yoki menyudan foydalaning.');
});

bot.launch().then(() => console.log('Telegram bot muvaffaqiyatli ishga tushdi!'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
`;

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Navigation tabs */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'simulator'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Interaktiv Telegram Bot Simulyatori</span>
          </button>
          <button
            onClick={() => setActiveTab('code_python')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'code_python'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Code className="w-4 h-4" />
            <span>Python (Aiogram 3.x) Kodi</span>
          </button>
          <button
            onClick={() => setActiveTab('code_nodejs')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'code_nodejs'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Code className="w-4 h-4" />
            <span>Node.js (Telegraf) Kodi</span>
          </button>
        </div>

        <span className="text-[11px] text-slate-400 px-3">
          @UBSDiscountBot
        </span>
      </div>

      {/* Tab 1: Interactive in-app Telegram bot simulator */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Telegram Phone Simulator Frame */}
          <div className="lg:col-span-8 bg-[#0e1621] rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col h-[640px]">
            {/* Telegram top bar */}
            <div className="bg-[#17212b] px-4 py-3 border-b border-[#232e3c] flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <UBSLogo size="sm" showText={false} />
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    UBS Chegirma Boti
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  </h3>
                  <p className="text-[10px] text-slate-400">bot • @UBSDiscountBot</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-slate-400">
                <span className="text-[11px] bg-[#242f3d] px-2.5 py-1 rounded-full text-slate-300 font-mono">
                  10% Chegirma
                </span>
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0e1621] text-xs">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 shadow-md ${
                      m.sender === 'user'
                        ? 'bg-[#2b5278] text-white rounded-tr-xs'
                        : 'bg-[#182533] text-slate-100 rounded-tl-xs border border-[#2b394a]'
                    }`}
                  >
                    <p className="whitespace-pre-line leading-relaxed">{m.text}</p>
                    <span
                      className={`text-[9px] block text-right mt-1 font-mono ${
                        m.sender === 'user' ? 'text-blue-200' : 'text-slate-400'
                      }`}
                    >
                      {m.time}
                    </span>

                    {/* Inline keyboard buttons */}
                    {m.buttons && m.buttons.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex flex-col gap-1.5">
                        {m.buttons.map((btn, bIdx) => (
                          <button
                            key={bIdx}
                            onClick={() => handleSend(btn.payload)}
                            className="w-full py-1.5 px-3 bg-[#242f3d] hover:bg-[#2e3e52] text-blue-300 text-[11px] font-medium rounded-lg text-center transition cursor-pointer border border-[#2e3e52]"
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Telegram input bar */}
            <div className="bg-[#17212b] p-3 border-t border-[#232e3c] flex items-center gap-2">
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSend();
                }}
                placeholder="Xabar yoki JSHSHR raqamini yozing..."
                className="flex-1 bg-[#242f3d] text-white text-xs px-3.5 py-2.5 rounded-xl outline-hidden focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
              />
              <button
                onClick={() => handleSend()}
                className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition cursor-pointer shrink-0 shadow-md"
                title="Yuborish"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Guide & sample commands */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Tezkor sinov buyruqlari
              </h4>
              <p className="text-xs text-slate-500">
                Chapdagi bot simulyatoriga quyidagi buyruqlarni yuborib ko‘rishingiz mumkin:
              </p>

              <div className="space-y-2">
                <button
                  onClick={() => handleSend('/friends')}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 text-xs font-semibold text-slate-700 transition"
                >
                  /friends — Do‘stlar dasturi qoidalari
                </button>
                <button
                  onClick={() => handleSend('/family')}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 text-xs font-semibold text-slate-700 transition"
                >
                  /family — Oila dasturi qoidalari (1-10 kishi)
                </button>
                <button
                  onClick={() => handleSend('/calc')}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 text-xs font-semibold text-slate-700 transition"
                >
                  /calc — 10% chegirma hisoblagich
                </button>
                <button
                  onClick={() => handleSend('31405021234567')}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-mono text-blue-600 transition"
                >
                  31405021234567 — Mavjud ariza JSHSHR tekshiruvi
                </button>
              </div>
            </div>

            <div className="bg-blue-50 rounded-2xl p-5 border border-blue-200 text-xs text-blue-900 space-y-2">
              <span className="font-bold block">Telegram WebApp Integratsiyasi:</span>
              <p className="text-blue-800 leading-relaxed">
                Ushbu veb-sahifa Telegram WebApp formati (Mini App) bilan ham to‘liq mos keladi. Talaba Telegramdan chiqmasdan turib pasport va diplom rasmlarini biriktira oladi.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Python Code */}
      {activeTab === 'code_python' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between text-white">
            <div>
              <h3 className="text-xs font-bold text-white">Telegram Bot Python Script (Aiogram 3.x)</h3>
              <p className="text-[11px] text-slate-400">Mustaqil serverda yoki hostingda ishga tushirish uchun to‘liq tayyor kod</p>
            </div>
            <button
              onClick={() => handleCopy(pythonBotCode)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Nusxa olindi!' : 'Kodni nusxalash'}
            </button>
          </div>
          <pre className="p-6 text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed max-h-[500px]">
            {pythonBotCode}
          </pre>
        </div>
      )}

      {/* Tab 3: Node.js Code */}
      {activeTab === 'code_nodejs' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between text-white">
            <div>
              <h3 className="text-xs font-bold text-white">Telegram Bot Node.js Script (Telegraf)</h3>
              <p className="text-[11px] text-slate-400">Node.js serverda yoki Cloud Run-da ishga tushirish uchun tayyor kod</p>
            </div>
            <button
              onClick={() => handleCopy(nodejsBotCode)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Nusxa olindi!' : 'Kodni nusxalash'}
            </button>
          </div>
          <pre className="p-6 text-xs font-mono text-sky-400 overflow-x-auto leading-relaxed max-h-[500px]">
            {nodejsBotCode}
          </pre>
        </div>
      )}
    </div>
  );
};
