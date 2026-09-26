import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { VIEWPORTS, weekRowIndex, type Lang, type Shot } from './catalog.ts';
import {
  BASE_URL,
  SHOTS_ROOT,
  buildSupabaseSession,
  findSupabaseSession,
  fixedClock,
  patchSupabaseSession,
  supabaseStorageKey,
  type ShotsEnv,
  type SupabasePasswordGrantResponse,
} from './env.ts';
import { assertNoSkeletons, assertPng, assertRoute, assertTheme, captureStable } from './guards.ts';

/** Sesión de Marta en producción. Está gitignorada (media/shots/.gitignore). */
export const AUTH_STATE = join(SHOTS_ROOT, '.auth', 'state.json');
const TIMEZONE = 'Europe/Madrid';
const LOCALES: Record<Lang, string> = { es: 'es-ES', en: 'en-GB' };

// Textos de i18n/locales/{es,en}.json usados como selectores.
const TEXT = {
  toMap: { es: 'Al mapa', en: 'To the map' }, // mazo.toMap
  ask: { es: 'Preguntar', en: 'Ask' }, // calendar.ask
  askTitle: { es: 'Preguntar al grupo', en: 'Ask the group' }, // calendar.askTitle
  proposalsTab: { es: 'Propuestas', en: 'Proposals' }, // plans.tabs.proposals
} as const;

// Sin toasts de Ionic, sin cursor y con las animaciones y transiciones llevadas a su
// último fotograma (1 ms, no 0, para que sigan disparando animationend/transitionend).
const PAGE_CSS = `
ion-toast { display: none !important; }
*, *::before, *::after {
  animation-delay: -1ms !important;
  animation-duration: 1ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 1ms !important;
  transition-delay: 0s !important;
  caret-color: transparent !important;
}`;

export function launch(): Promise<Browser> {
  return chromium.launch();
}

/**
 * Login real con el reloj real, una vez por ejecución de `shoot`: el JWT resultante vale
 * una hora para el servidor, y la ejecución entera tiene que caber en ella.
 *
 * Va directo contra la API de Supabase (grant_type=password) en vez de por el formulario:
 * la web dispara hCaptcha invisible en /login y en headless no es fiable. La sesión
 * resultante se guarda con la misma forma que un storageState de Playwright para que
 * openShotPage la lea igual que antes.
 */
export async function login(env: ShotsEnv): Promise<void> {
  const res = await fetch(`${env.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: env.supabaseAnonKey },
    body: JSON.stringify({ email: env.email, password: env.password }),
  });
  if (!res.ok) {
    throw new Error(`Login de Marta contra Supabase falló: ${res.status} ${res.statusText}`);
  }
  const session = buildSupabaseSession((await res.json()) as SupabasePasswordGrantResponse);
  const state = {
    cookies: [],
    origins: [
      { origin: BASE_URL, localStorage: [{ name: supabaseStorageKey(env.supabaseUrl), value: JSON.stringify(session) }] },
    ],
  };
  mkdirSync(dirname(AUTH_STATE), { recursive: true });
  writeFileSync(AUTH_STATE, JSON.stringify(state));
}

export async function openShotPage(
  browser: Browser,
  shot: Shot,
  env: ShotsEnv,
): Promise<{ context: BrowserContext; page: Page }> {
  const vp = VIEWPORTS[shot.device];
  const context = await browser.newContext({
    storageState: AUTH_STATE,
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor,
    isMobile: vp.isMobile,
    hasTouch: vp.hasTouch,
    locale: LOCALES[shot.lang],
    timezoneId: TIMEZONE,
    colorScheme: shot.theme,
    reducedMotion: 'reduce',
  });
  await context.addInitScript(
    ({ theme, lang }) => {
      try {
        localStorage.setItem('theme', theme);
        localStorage.setItem('quedamos-lang', lang);
        localStorage.setItem('quedamos_push_priming_seen', '1');
      } catch {
        // sin almacenamiento la guarda de tema lo detecta
      }
    },
    { theme: shot.theme, lang: shot.lang },
  );
  await context.addInitScript((css) => {
    const style = document.createElement('style');
    style.textContent = css;
    document.documentElement.appendChild(style);
  }, PAGE_CSS);
  // Reloj fijado en SEED_TODAY (futuro) y sesión con expires_at adelantado a ese reloj, para
  // que supabase-js no la vea caducada ni refresque. Tokens intactos. Este init script se
  // registra después del de tema/idioma y pisa el valor que carga storageState.
  const fixed = fixedClock(env.seedToday, new Date());
  const stored = findSupabaseSession(JSON.parse(readFileSync(AUTH_STATE, 'utf8')));
  if (stored === null) throw new Error(`${shot.id}: no hay sesión sb-*-auth-token en ${AUTH_STATE}`);
  await context.addInitScript(
    ({ name, value }) => {
      try {
        localStorage.setItem(name, value);
      } catch {
        // sin almacenamiento no hay sesión: assertRoute lo detecta
      }
    },
    { name: stored.name, value: patchSupabaseSession(stored.value, fixed.getTime()) },
  );
  const page = await context.newPage();
  await page.clock.setFixedTime(fixed);
  return { context, page };
}

/**
 * Cierra el contexto sin volver a guardar storageState: con expires_at adelantado el
 * navegador no refresca, así que el refresh token no rota y el fichero sigue siendo el del login.
 */
export async function closeShotPage(context: BrowserContext): Promise<void> {
  await context.close();
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => document.querySelectorAll('.skeleton').length === 0, null, {
    timeout: 20_000,
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete));
}

async function gotoAndSettle(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`);
  await settle(page);
  // Sin sesión, ProtectedRoute manda a /login o a /, y esa pantalla pasaría el resto de guardas.
  assertRoute(new URL(page.url()).pathname, path, path);
}

/** El mazo se abre solo si hay preguntas o quedadas pendientes; «Al mapa» solo lo cierra. */
async function dismissMazo(page: Page, lang: Lang): Promise<void> {
  const toMap = page.getByRole('button', { name: TEXT.toMap[lang] });
  const visible = await toMap.waitFor({ state: 'visible', timeout: 2_000 }).then(
    () => true,
    () => false,
  );
  if (!visible) return;
  await toMap.click();
  await toMap.waitFor({ state: 'detached' });
}

// SOLO NAVEGACIÓN. Nunca pulsar el botón de enviar de la hoja de preguntar (calendar.askAction),
// Puedo/No puedo/Voy del mazo, votos ni envíos de formulario: escribirían en producción y
// mandarían pushes a los cinco miembros.
export async function runScene(page: Page, shot: Shot, env: ShotsEnv): Promise<void> {
  const { lang } = shot;
  switch (shot.scene) {
    case 'calendar':
      await gotoAndSettle(page, '/tabs/calendar');
      await dismissMazo(page, lang);
      await page.locator('[data-testid="day-row"]').first().waitFor();
      break;
    case 'ask': {
      await gotoAndSettle(page, '/tabs/calendar');
      await dismissMazo(page, lang);
      const row = page.locator('[data-testid="day-row"]').nth(weekRowIndex(env.seedToday));
      // Esquina izquierda (el número del día): en el centro puede caer el botón del aro,
      // que abre el detalle de disponibilidad en vez de seleccionar el día.
      await row.click({ position: { x: 10, y: 10 } });
      await row.getByRole('button', { name: TEXT.ask[lang], exact: true }).click();
      await page.getByRole('heading', { name: TEXT.askTitle[lang] }).waitFor();
      break;
    }
    case 'proposals':
      await gotoAndSettle(page, '/tabs/plans');
      await page.getByRole('tab', { name: TEXT.proposalsTab[lang] }).click();
      await settle(page);
      break;
    case 'plans':
      await gotoAndSettle(page, '/tabs/plans');
      break;
    case 'group': {
      // GroupPage (la lista) no fija quedamos_current_group_id: lo hace useAutoSelectGroup,
      // que solo corren Calendar/Plans. Con el login por API ya no llega precargado desde
      // una sesión de navegador previa, así que se fuerza aquí antes de leerlo.
      await gotoAndSettle(page, '/tabs/calendar');
      const groupId = await page.evaluate(() => localStorage.getItem('quedamos_current_group_id'));
      if (!groupId) throw new Error(`${shot.id}: no hay quedamos_current_group_id; ¿Marta está en el grupo demo?`);
      await gotoAndSettle(page, `/tabs/group/${groupId}`);
      break;
    }
    case 'profile':
      await gotoAndSettle(page, '/tabs/profile');
      break;
  }
}

export async function shootShot(page: Page, shot: Shot, outRoot: string): Promise<string> {
  assertNoSkeletons(await page.locator('.skeleton').count(), shot.id);
  assertTheme(
    await page.evaluate(() => document.documentElement.classList.contains('light')),
    shot.theme,
    shot.id,
  );
  const buf = await captureStable(
    () => page.screenshot({ fullPage: false, animations: 'disabled', caret: 'hide' }),
    { label: shot.id },
  );
  assertPng(buf, shot.size, shot.id);
  const path = join(outRoot, shot.out);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
  return path;
}
