// `npm run rodaje [-- --keep]`: rueda en producción, dentro del grupo de demo, la quedada
// «Cena del viernes» de principio a fin (crear, responder, confirmar) y captura cada estado
// en es y en para el vídeo. Autorizado por el dueño (2026-09-26). Al terminar borra la
// quedada salvo con --keep. Nunca imprime contraseñas ni tokens.
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, BrowserContext, Locator, Page } from 'playwright';
import {
  closeShotPage,
  dismissMazo,
  gotoAndSettle,
  launch,
  loginAs,
  openShotPage,
  settle,
  shootShot,
} from './browser.ts';
import { LANGS, SIZES, VIEWPORTS, type Lang } from './catalog.ts';
import {
  DEFAULT_API_URL,
  DEMO_ACCOUNTS,
  MEDIA_ROOT,
  OUT_ROOT,
  SHOTS_ROOT,
  demoEmail,
  loadSeedVars,
  loadShotsEnv,
  readDemoPasswords,
  type DemoAccount,
} from './env.ts';
import { RodajeApi, type ApiEvent } from './rodaje-api.ts';
import {
  RODAJE_EVENT,
  emptyTaps,
  isRodajeEvent,
  missingTaps,
  normalizeBox,
  parseRodajeArgs,
  rodajeOut,
  rodajeState,
  type TapId,
} from './rodaje-plan.ts';

const GROUP_NAME = 'Ruta 2026';
const RODAJE_DIR = join(OUT_ROOT, 'rodaje');
const VIEWPORT = VIEWPORTS.mobile;
/** La acción de cada paso se hace en la pasada de este idioma; el otro solo recarga. */
const ACT_LANG: Lang = 'en';
const OTHER_LANG: Lang = 'es';

// Textos de i18n/locales/{es,en}.json usados como selectores.
const TEXT = {
  letsMeet: { es: 'Quedamos', en: "Let's meet" }, // calendar.letsMeet
  sheetTitle: { es: 'Nueva quedada', en: 'New plan' }, // plans.create.title
  namePlaceholder: { es: 'Ruta, cena, cine...', en: 'Hike, dinner, movies...' }, // plans.create.namePlaceholder
  submit: { es: 'Crear quedada', en: 'Create plan' }, // plans.create.submit
  going: { es: 'Voy', en: "I'm going" }, // mazo.going
  goingQuestion: { es: `${RODAJE_EVENT.title}. ¿Vas?`, en: `${RODAJE_EVENT.title}. Going?` }, // mazo.goingQuestion
  confirmEvent: { es: 'Confirmar quedada', en: 'Confirm plan' }, // plans.confirmEvent
} as const;

type Who = 'marta' | 'hugo';

const args = parseRodajeArgs(process.argv.slice(2));
const env = loadShotsEnv();
const seedVars = loadSeedVars();
const passwords = readDemoPasswords(seedVars);
const apiUrl = (seedVars.API_URL || DEFAULT_API_URL).replace(/\/+$/, '');

const authPath = (account: DemoAccount): string => join(SHOTS_ROOT, '.auth', `${account}.json`);
const rel = (path: string): string => path.slice(MEDIA_ROOT.length + 1);

// ---------- API ----------

const api = {} as Record<DemoAccount, RodajeApi>;
for (const account of DEMO_ACCOUNTS) {
  const session = await loginAs(env, { email: demoEmail(account), password: passwords[account] }, authPath(account));
  api[account] = new RodajeApi(apiUrl, session.access_token, account);
}
const martaId = (await api.marta.me()).id;
const hugoId = (await api.hugo.me()).id;
const group = (await api.marta.listGroups()).find((g) => g.name === GROUP_NAME);
if (!group) throw new Error(`Marta no está en el grupo «${GROUP_NAME}»`);
const groupId = group.id;

async function findRodajeEvents(): Promise<ApiEvent[]> {
  return (await api.marta.listEvents(groupId)).filter((e) => isRodajeEvent(e, martaId));
}

async function cleanup(): Promise<void> {
  for (const event of await findRodajeEvents()) {
    await api.marta.deleteEvent(groupId, event.id);
    console.log('borrada una «Cena del viernes» previa/del rodaje');
  }
  const left = await findRodajeEvents();
  if (left.length > 0) throw new Error(`Siguen ${left.length} «${RODAJE_EVENT.title}» tras borrar`);
}

async function rodajeEvent(): Promise<ApiEvent> {
  const events = await findRodajeEvents();
  if (events.length !== 1) throw new Error(`Se esperaba 1 «${RODAJE_EVENT.title}» y hay ${events.length}`);
  return events[0] as ApiEvent;
}

/** Hugo no puede tener nada pendiente: el mazo no deja saltar una tarjeta sin responderla. */
async function assertHugoHasNothingPending(): Promise<void> {
  const today = env.seedToday;
  const polls = (await api.hugo.listPolls(groupId)).filter(
    (p) => p.status === 'open' && p.date.slice(0, 10) >= today && !p.responses.some((r) => r.userId === hugoId),
  );
  const events = (await api.hugo.listEvents(groupId)).filter(
    (e) =>
      e.status !== 'cancelled' &&
      e.date.slice(0, 10) >= today &&
      e.attendees.some((a) => a.userId === hugoId && a.status === 'pending'),
  );
  if (polls.length + events.length > 0) {
    throw new Error(
      `Hugo tiene ${polls.length} preguntas y ${events.length} quedadas pendientes: el mazo las enseñaría antes o después de la cena y no se pueden saltar sin responder`,
    );
  }
}

// ---------- Navegador ----------

const pages = new Map<string, { context: BrowserContext; page: Page }>();

async function pageFor(browser: Browser, who: Who, lang: Lang): Promise<Page> {
  const key = `${who}-${lang}`;
  const existing = pages.get(key);
  if (existing) return existing.page;
  const opened = await openShotPage(
    browser,
    { id: `rodaje/${key}`, device: 'mobile', lang, theme: 'dark' },
    env,
    authPath(who),
  );
  pages.set(key, opened);
  return opened.page;
}

const taps = emptyTaps();

async function measureTap(lang: Lang, tap: TapId, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error(`${lang}.${tap}: el elemento no tiene caja (¿oculto?)`);
  taps[lang][tap] = normalizeBox(box, VIEWPORT);
}

async function capture(page: Page, lang: Lang, id: string): Promise<void> {
  const path = await shootShot(
    page,
    { id: `rodaje/${lang}/${id}`, theme: 'dark', size: SIZES.mobile, out: rodajeOut(lang, id) },
    OUT_ROOT,
  );
  console.log(`ok ${rel(path)}`);
}

/**
 * Lleva la página al estado, mide su toque (si lo tiene) y captura. Se llama una vez por
 * idioma: la pasada de ACT_LANG es la que luego ejecuta la acción.
 */
async function shootState(
  browser: Browser,
  id: string,
  lang: Lang,
  prepare: (page: Page, lang: Lang) => Promise<Locator | void>,
): Promise<Page> {
  const state = rodajeState(id);
  const page = await pageFor(browser, state.who, lang);
  const target = await prepare(page, lang);
  if (state.tap) {
    if (!target) throw new Error(`${id}: falta el elemento del toque «${state.tap}»`);
    await measureTap(lang, state.tap, target);
  }
  await capture(page, lang, id);
  return page;
}

/** Mismo estado en los dos idiomas; la página de ACT_LANG queda lista para la acción. */
async function shootBoth(
  browser: Browser,
  id: string,
  prepare: (page: Page, lang: Lang) => Promise<Locator | void>,
): Promise<Page> {
  await shootState(browser, id, OTHER_LANG, prepare);
  return shootState(browser, id, ACT_LANG, prepare);
}

async function calendar(page: Page, lang: Lang): Promise<void> {
  await gotoAndSettle(page, '/tabs/calendar');
  await dismissMazo(page, lang);
  await page.locator('[data-testid="day-row"]').first().waitFor();
  await settle(page);
}

async function bestDayButton(page: Page, lang: Lang): Promise<Locator> {
  const panel = page.getByTestId('best-day-panel');
  await panel.waitFor();
  const day = (await panel.locator('span').first().textContent())?.trim();
  if (day !== String(Number(RODAJE_EVENT.date.slice(8)))) {
    throw new Error(`La tarjeta del mejor día es del ${day ?? '?'}, no del viernes ${RODAJE_EVENT.date}`);
  }
  return panel.getByRole('button', { name: TEXT.letsMeet[lang], exact: true });
}

async function openSheet(page: Page, lang: Lang): Promise<Locator> {
  await calendar(page, lang);
  await (await bestDayButton(page, lang)).click();
  const sheet = page.locator('ion-modal').filter({ hasText: TEXT.sheetTitle[lang] });
  await sheet.waitFor();
  const input = sheet.getByPlaceholder(TEXT.namePlaceholder[lang]);
  await input.waitFor();
  return input;
}

/** El mazo de Hugo, con la cena como primera (y única) tarjeta. */
async function mazo(page: Page, lang: Lang): Promise<Locator> {
  await gotoAndSettle(page, '/tabs/calendar');
  const heading = page.getByRole('heading', { name: TEXT.goingQuestion[lang], exact: true });
  await heading.waitFor({ timeout: 15_000 });
  await settle(page);
  return heading.locator('xpath=..').getByRole('button', { name: TEXT.going[lang], exact: true });
}

/**
 * La tarjeta de la cena en Quedadas, entera en pantalla. El div más interno con día, título
 * y aro es la fila principal de EventCard; su padre es la raíz de la tarjeta.
 */
async function planCard(page: Page): Promise<Locator> {
  await gotoAndSettle(page, '/tabs/plans');
  const card = page
    .locator('div')
    .filter({ has: page.getByText(RODAJE_EVENT.title, { exact: true }) })
    .filter({ has: page.getByTestId('attendee-ring') })
    .filter({ has: page.getByTestId('event-day') })
    .last()
    .locator('xpath=..');
  await card.waitFor();
  await card.scrollIntoViewIfNeeded();
  await settle(page);
  return card;
}

async function statusOf(userId: string): Promise<string | undefined> {
  return (await rodajeEvent()).attendees.find((a) => a.userId === userId)?.status;
}

async function plansBoth(browser: Browser, id: string): Promise<void> {
  await shootBoth(browser, id, async (page) => {
    await planCard(page);
  });
}

// ---------- Rodaje ----------

async function rodaje(browser: Browser): Promise<void> {
  // 2. Hugo antes de nada.
  await shootBoth(browser, 'h-cal', calendar);

  // 3. Marta con la tarjeta del mejor día (viernes 2).
  await shootBoth(browser, 'm-cal', async (page, lang) => {
    await calendar(page, lang);
    return bestDayButton(page, lang);
  });

  // 4. Hoja abierta con el título vacío (la app lo precarga: se borra).
  await shootBoth(browser, 'm-hoja-vacia', async (page, lang) => {
    const input = await openSheet(page, lang);
    await input.fill('');
    await input.blur();
    await settle(page);
    return input;
  });

  // 5. Hoja con el título escrito. El título se reescribe en cada pasada (la hoja se reabre).
  const martaAct = await shootBoth(browser, 'm-hoja-llena', async (page, lang) => {
    const input = await openSheet(page, lang);
    await input.fill(RODAJE_EVENT.title);
    await input.blur();
    await settle(page);
    return page.locator('ion-modal').getByRole('button', { name: TEXT.submit[lang], exact: true });
  });
  // Acción: crear de verdad, una sola vez.
  await martaAct.locator('ion-modal').getByRole('button', { name: TEXT.submit[ACT_LANG], exact: true }).click();
  await martaAct.locator('ion-modal').filter({ hasText: TEXT.sheetTitle[ACT_LANG] }).waitFor({ state: 'hidden' });
  const created = await rodajeEvent();
  if (created.status !== 'pending') throw new Error(`La cena nace ${created.status}, no pending`);
  console.log('creada «Cena del viernes» desde la UI (2026-10-02)');

  // 6. Marta tras crear: la pasada de la acción sin recargar, la otra recargando.
  await settle(martaAct);
  await shootState(browser, 'm-cal-creada', ACT_LANG, async () => undefined);
  await shootState(browser, 'm-cal-creada', OTHER_LANG, calendar);

  // 7. Hugo abre la app: mazo con la cena.
  const hugoAct = await shootBoth(browser, 'h-mazo', mazo);
  await (await mazo(hugoAct, ACT_LANG)).click();
  await hugoAct.getByRole('heading', { name: TEXT.goingQuestion[ACT_LANG] }).waitFor({ state: 'detached' });
  if ((await statusOf(hugoId)) !== 'confirmed') throw new Error('La respuesta «Voy» de Hugo no llegó a la API');
  console.log('Hugo: «Voy» desde el mazo');

  // 8. Lo que enseña la app justo después (con movimiento reducido, el mazo se cierra al calendario).
  await hugoAct.locator('[data-testid="day-row"]').first().waitFor();
  await settle(hugoAct);
  await shootState(browser, 'h-voy', ACT_LANG, async () => undefined);
  await shootState(browser, 'h-voy', OTHER_LANG, calendar);

  // 9. Respuestas por API y Hugo en Quedadas tras cada una.
  await plansBoth(browser, 'h-plan-2');
  const eventId = created.id;
  await api.noa.respondEvent(groupId, eventId, 'confirmed');
  await plansBoth(browser, 'h-plan-3');
  await api.julia.respondEvent(groupId, eventId, 'confirmed');
  await plansBoth(browser, 'h-plan-4');
  await api.leo.respondEvent(groupId, eventId, 'declined');
  await plansBoth(browser, 'h-plan-leo');

  // 10. Marta con «Confirmar quedada».
  const martaPlans = await shootBoth(browser, 'm-plan-pendiente', async (page, lang) => {
    const card = await planCard(page);
    const button = card.getByRole('button', { name: TEXT.confirmEvent[lang], exact: true });
    await button.scrollIntoViewIfNeeded();
    await settle(page);
    return button;
  });
  const card = await planCard(martaPlans);
  await card.getByRole('button', { name: TEXT.confirmEvent[ACT_LANG], exact: true }).click();
  await martaPlans.locator('ion-alert button').filter({ hasText: TEXT.confirmEvent[ACT_LANG] }).click();
  await martaPlans.locator('ion-alert').waitFor({ state: 'detached' });
  await card.getByTestId('attendee-ring-check').waitFor();
  if ((await rodajeEvent()).status !== 'confirmed') throw new Error('La cena no quedó confirmada en la API');
  console.log('Marta: «Confirmar quedada» desde la UI');

  // 11. Marta y Hugo tras confirmar.
  await card.scrollIntoViewIfNeeded();
  await settle(martaPlans);
  await shootState(browser, 'm-plan-confirmada', ACT_LANG, async () => undefined);
  await shootState(browser, 'm-plan-confirmada', OTHER_LANG, async (page) => {
    await planCard(page);
  });
  await plansBoth(browser, 'h-plan-confirmada');
}

rmSync(RODAJE_DIR, { recursive: true, force: true });
mkdirSync(RODAJE_DIR, { recursive: true });

let browser: Browser | null = null;
let failed = false;
try {
  // 1. Idempotencia y comprobaciones de solo lectura antes de escribir nada más.
  await cleanup();
  await assertHugoHasNothingPending();
  browser = await launch();
  await rodaje(browser);
  const missing = missingTaps(taps, LANGS);
  if (missing.length > 0) throw new Error(`Faltan toques: ${missing.join(', ')}`);
  writeFileSync(join(RODAJE_DIR, 'taps.json'), `${JSON.stringify(taps, null, 2)}\n`);
  console.log(`ok ${rel(join(RODAJE_DIR, 'taps.json'))}`);
} catch (error) {
  failed = true;
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
} finally {
  for (const { context } of pages.values()) await closeShotPage(context).catch(() => undefined);
  await browser?.close();
  if (args.keep) {
    console.log('--keep: la quedada se queda en el grupo');
  } else {
    // 12. Borrar y comprobar que el grupo de demo queda como estaba.
    try {
      await cleanup();
      console.log('quedada del rodaje borrada');
      const verify = spawnSync('npm', ['run', '--silent', 'verify'], { cwd: join(MEDIA_ROOT, 'seed'), stdio: 'inherit' });
      if (verify.status !== 0) throw new Error('media/seed verify no dio OK');
    } catch (error) {
      failed = true;
      console.error(error instanceof Error ? error.message : error);
    }
  }
}
if (failed) process.exitCode = 1;
