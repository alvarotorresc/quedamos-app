import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from './args.ts';
import { closeShotPage, launch, login, openShotPage, runScene, shootShot } from './browser.ts';
import { buildCatalog, buildLabels, selectShots } from './catalog.ts';
import { OUT_ROOT, loadShotsEnv } from './env.ts';
import { renderIcon } from './icon.ts';

const args = parseArgs(process.argv.slice(2));
const wantsIcon = args.only === null || args.only === 'icon';
const shots = args.only === 'icon' ? [] : selectShots(buildCatalog(), args.only);

// labels.json no depende del navegador: se escribe siempre.
mkdirSync(join(OUT_ROOT, 'web'), { recursive: true });
writeFileSync(join(OUT_ROOT, 'web', 'labels.json'), `${JSON.stringify(buildLabels(), null, 2)}\n`);

const browser = await launch();
try {
  if (wantsIcon) {
    await renderIcon(browser, join(OUT_ROOT, 'web', 'icon.png'));
    console.log('ok icon');
  }
  if (shots.length > 0) {
    // Solo hace falta la cuenta de Marta si hay capturas de producción.
    const env = loadShotsEnv();
    // Login nuevo en cada ejecución: el JWT vale 1 h de reloj real desde aquí.
    await login(env);
    // En serie: una sola sesión y nada de refrescos de token en paralelo.
    for (const shot of shots) {
      const { context, page } = await openShotPage(browser, shot, env);
      try {
        await runScene(page, shot, env);
        const path = await shootShot(page, shot, OUT_ROOT);
        console.log(`ok ${shot.id} -> ${path}`);
      } finally {
        await closeShotPage(context);
      }
    }
  }
} finally {
  await browser.close();
}
