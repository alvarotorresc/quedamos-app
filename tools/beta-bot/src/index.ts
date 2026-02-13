import { Telegraf, Context } from 'telegraf';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Load environment variables
config();

// ES modules compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const BETA_INVITE_CODE = process.env.BETA_INVITE_CODE!;
const ADMIN_TELEGRAM_ID = parseInt(process.env.ADMIN_TELEGRAM_ID!);
const WEB_URL = process.env.WEB_URL!;

// Validate env vars
if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_KEY || !BETA_INVITE_CODE || !ADMIN_TELEGRAM_ID || !WEB_URL) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// File path for APK file_id persistence
const APK_FILE_ID_PATH = path.join(__dirname, '..', '.apk-file-id');

// Initialize Supabase admin client
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Initialize Telegram bot
const bot = new Telegraf(BOT_TOKEN);

// Debug: log bot initialization
console.log('✓ Bot instance created');

// In-memory state management
type ConversationStep = 'idle' | 'awaiting_code' | 'awaiting_name' | 'awaiting_email' | 'registered';

interface UserState {
  step: ConversationStep;
  name?: string;
  email?: string;
}

const userStates = new Map<number, UserState>();
let apkFileId: string | null = null;

// === Utility Functions ===

/**
 * Generate a readable random password
 * Format: 8 characters with letters, numbers, and one special char
 */
function generatePassword(): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$%&*';

  const pick = (str: string) => str[Math.floor(Math.random() * str.length)];

  // Ensure at least one of each type
  let password = [
    pick(uppercase),
    pick(lowercase),
    pick(numbers),
    pick(special),
  ];

  // Fill remaining with random mix
  const all = lowercase + uppercase + numbers;
  for (let i = password.length; i < 8; i++) {
    password.push(pick(all));
  }

  // Shuffle
  password = password.sort(() => Math.random() - 0.5);

  return password.join('');
}

/**
 * Check if email already exists in Supabase
 */
async function emailExists(email: string): Promise<boolean> {
  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('Error checking email:', error);
    return false;
  }

  return data.users.some(user => user.email === email);
}

/**
 * Load APK file_id from persistent storage
 */
function loadApkFileId(): void {
  try {
    if (fs.existsSync(APK_FILE_ID_PATH)) {
      apkFileId = fs.readFileSync(APK_FILE_ID_PATH, 'utf-8').trim();
      console.log('✅ APK file_id loaded:', apkFileId);
    } else {
      console.log('⚠️ No APK file_id found. Use /upload to set one.');
    }
  } catch (error) {
    console.error('Error loading APK file_id:', error);
  }
}

/**
 * Save APK file_id to persistent storage
 */
function saveApkFileId(fileId: string): void {
  try {
    fs.writeFileSync(APK_FILE_ID_PATH, fileId, 'utf-8');
    console.log('✅ APK file_id saved:', fileId);
  } catch (error) {
    console.error('Error saving APK file_id:', error);
  }
}

/**
 * Get user state or initialize
 */
function getUserState(userId: number): UserState {
  if (!userStates.has(userId)) {
    userStates.set(userId, { step: 'idle' });
  }
  return userStates.get(userId)!;
}

/**
 * Check if user is admin
 */
function isAdmin(userId: number): boolean {
  return userId === ADMIN_TELEGRAM_ID;
}

// === Bot Commands ===

bot.command('start', async (ctx) => {
  console.error(`[DEBUG] /start command from user ${ctx.from.id}`);
  const userId = ctx.from.id;
  const state = getUserState(userId);

  if (state.step === 'registered') {
    await ctx.reply(
      '✅ Ya estás registrado.\n\n' +
      'Comandos disponibles:\n' +
      '• /apk - Descargar la app\n' +
      '• /web - Enlace a la versión web'
    );
    return;
  }

  // Reset state and start registration
  userStates.set(userId, { step: 'awaiting_code' });

  await ctx.reply(
    '👋 ¡Bienvenido a la beta privada de Quedamos!\n\n' +
    '🔐 Por favor, introduce el código de invitación:'
  );
});

bot.command('apk', async (ctx) => {
  const userId = ctx.from.id;
  const state = getUserState(userId);

  if (state.step !== 'registered') {
    await ctx.reply('⛔️ Primero debes registrarte con /start');
    return;
  }

  if (!apkFileId) {
    await ctx.reply('⚠️ El APK aún no está disponible. Contacta con el administrador.');
    return;
  }

  await ctx.replyWithDocument(apkFileId, {
    caption: '📱 Quedamos App - Beta Privada\n\nInstala el APK en tu dispositivo Android.',
  });
});

bot.command('web', async (ctx) => {
  const userId = ctx.from.id;
  const state = getUserState(userId);

  if (state.step !== 'registered') {
    await ctx.reply('⛔️ Primero debes registrarte con /start');
    return;
  }

  await ctx.reply(`🌐 Accede a la versión web:\n${WEB_URL}`);
});

bot.command('upload', async (ctx) => {
  const userId = ctx.from.id;

  if (!isAdmin(userId)) {
    await ctx.reply('⛔️ Comando solo para administradores.');
    return;
  }

  await ctx.reply(
    '📤 Envía el archivo APK a continuación.\n\n' +
    'El bot guardará el file_id para distribuirlo a nuevos usuarios.'
  );
});

bot.command('users', async (ctx) => {
  const userId = ctx.from.id;

  if (!isAdmin(userId)) {
    await ctx.reply('⛔️ Comando solo para administradores.');
    return;
  }

  try {
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
      await ctx.reply(`❌ Error al obtener usuarios: ${error.message}`);
      return;
    }

    if (data.users.length === 0) {
      await ctx.reply('📋 No hay usuarios registrados aún.');
      return;
    }

    const userList = data.users
      .map((user, index) => {
        const name = user.user_metadata?.name || 'Sin nombre';
        const email = user.email || 'Sin email';
        const confirmed = user.email_confirmed_at ? '✅' : '⏳';
        return `${index + 1}. ${name} - ${email} ${confirmed}`;
      })
      .join('\n');

    await ctx.reply(`📋 Usuarios registrados (${data.users.length}):\n\n${userList}`);
  } catch (error) {
    console.error('Error listing users:', error);
    await ctx.reply('❌ Error al obtener la lista de usuarios.');
  }
});

// === Message Handlers ===

bot.on('document', async (ctx) => {
  const userId = ctx.from.id;

  if (!isAdmin(userId)) {
    return;
  }

  const document = ctx.message.document;

  if (!document.file_name?.endsWith('.apk')) {
    await ctx.reply('⚠️ Por favor, envía un archivo .apk válido.');
    return;
  }

  apkFileId = document.file_id;
  saveApkFileId(apkFileId);

  await ctx.reply(
    '✅ APK cargado correctamente.\n\n' +
    'Los nuevos usuarios recibirán este archivo al registrarse.'
  );
});

bot.on('text', async (ctx) => {
  console.error(`[DEBUG] Text message from user ${ctx.from.id}: ${ctx.message.text.substring(0, 20)}...`);
  const userId = ctx.from.id;
  const state = getUserState(userId);
  const text = ctx.message.text.trim();

  // Handle conversation flow
  switch (state.step) {
    case 'awaiting_code':
      if (text.toUpperCase() === BETA_INVITE_CODE) {
        state.step = 'awaiting_name';
        userStates.set(userId, state);
        await ctx.reply('✅ Código correcto.\n\n📝 ¿Cuál es tu nombre?');
      } else {
        await ctx.reply('❌ Código incorrecto. Inténtalo de nuevo o usa /start para reiniciar.');
      }
      break;

    case 'awaiting_name':
      if (text.length < 2) {
        await ctx.reply('⚠️ Por favor, introduce un nombre válido (mínimo 2 caracteres).');
        return;
      }

      state.name = text;
      state.step = 'awaiting_email';
      userStates.set(userId, state);
      await ctx.reply('📧 ¿Cuál es tu email?');
      break;

    case 'awaiting_email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(text)) {
        await ctx.reply('⚠️ Por favor, introduce un email válido.');
        return;
      }

      // Check if email already exists
      const exists = await emailExists(text);
      if (exists) {
        await ctx.reply(
          '⚠️ Este email ya está registrado.\n\n' +
          'Si olvidaste tu contraseña, usa la opción de recuperación en la app.'
        );
        return;
      }

      state.email = text;

      // Create user in Supabase
      try {
        const password = generatePassword();

        // First, create the user with a temporary password
        const { data, error } = await supabase.auth.admin.createUser({
          email: state.email,
          password,
          email_confirm: true, // Mark as confirmed to avoid issues
          user_metadata: { name: state.name },
        });

        if (error) {
          console.error('Error creating user:', error);
          await ctx.reply(`❌ Error al crear la cuenta: ${error.message}`);
          return;
        }

        // Send password reset email so user can set their own password
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(state.email, {
          redirectTo: `${WEB_URL}/reset-password`,
        });

        if (resetError) {
          console.error('Error sending reset email:', resetError);
          // Don't fail, just log - user can still use the temp password
        }

        state.step = 'registered';
        userStates.set(userId, state);

        // Send success message
        await ctx.reply(
          '🎉 ¡Cuenta creada con éxito!\n\n' +
          '📧 Te hemos enviado un email para establecer tu contraseña.\n\n' +
          `📩 Email: ${state.email}\n\n` +
          '⚠️ Si no recibes el email:\n' +
          '1. Revisa tu carpeta de spam\n' +
          '2. Usa la opción "Olvidé mi contraseña" en la app\n\n' +
          `💡 También puedes usar esta contraseña temporal:\n\`${password}\``,
          { parse_mode: 'Markdown' }
        );

        // Send APK if available
        if (apkFileId) {
          await ctx.replyWithDocument(apkFileId, {
            caption: '📱 Descarga la app para Android:',
          });
        } else {
          await ctx.reply('⚠️ El APK aún no está disponible. Contacta con el administrador.');
        }

        // Send web link
        await ctx.reply(
          `🌐 También puedes usar la versión web:\n${WEB_URL}\n\n` +
          'Comandos disponibles:\n' +
          '• /apk - Volver a descargar la app\n' +
          '• /web - Enlace a la versión web'
        );

      } catch (error) {
        console.error('Error creating user:', error);
        await ctx.reply('❌ Error al crear la cuenta. Contacta con el administrador.');
      }
      break;

    default:
      await ctx.reply('Usa /start para comenzar el registro.');
      break;
  }
});

// === Bot Lifecycle ===

// Load APK file_id on startup
loadApkFileId();

// Launch bot
console.error('🚀 Starting bot...');

// Start polling manually
bot.telegram.getMe().then((botInfo) => {
  console.error('✅ Connected to Telegram API');
  console.error(`📱 Bot: @${botInfo.username} (${botInfo.first_name})`);
  console.error('');
  console.error('🔧 Configuration:');
  console.error(`📋 Admin ID: ${ADMIN_TELEGRAM_ID}`);
  console.error(`🔐 Invite code: ${BETA_INVITE_CODE}`);
  console.error(`🌐 Web URL: ${WEB_URL}`);
  console.error('');
  console.error('✅ Bot is running. You can now:');
  console.error('   1. Open Telegram and search for @QuedamosBetaBot');
  console.error('   2. Send /start to begin registration');
  console.error('   3. Use /upload to add the APK file');
  console.error('');
  console.error('Press Ctrl+C to stop.');
  console.error('');

  // Start polling
  return bot.launch({ dropPendingUpdates: true });
}).catch((error) => {
  console.error('❌ Error starting bot:', error);
  process.exit(1);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
