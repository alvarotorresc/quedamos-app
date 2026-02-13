import { Telegraf } from 'telegraf';
import { config } from 'dotenv';

config();

const token = process.env.TELEGRAM_BOT_TOKEN;

console.log('Testing Telegram connection...');
console.log('Token:', token ? `${token.substring(0, 20)}...` : 'MISSING');

const bot = new Telegraf(token);

console.log('Calling getMe...');

bot.telegram.getMe()
  .then((botInfo) => {
    console.log('✅ Connection successful!');
    console.log('Bot info:', botInfo);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  });

// Timeout after 10 seconds
setTimeout(() => {
  console.error('⏱️ Timeout: Connection took too long');
  process.exit(1);
}, 10000);
