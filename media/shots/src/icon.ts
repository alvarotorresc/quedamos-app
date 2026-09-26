import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Browser } from 'playwright';
import { ICON_SIZE } from './catalog.ts';
import { assertPng } from './guards.ts';

// Geometría de apps/mobile/public/favicon.svg (aro de 6 con el hueco abajo, slots 0,1,2,4,5)
// y colores de apps/mobile/src/ui/Logo.tsx (variante color), en ese orden.
const ARC_ROTATIONS = [-110.55, -50.55, 9.45, 129.45, 189.45] as const;
const ARC_COLORS = ['#60A5FA', '#F59E0B', '#F472B6', '#34D399', '#FB7185'] as const;
const DOT_COLOR = '#A78BFA';
const BACKGROUND = '#14120E';
const LOGO_PX = 720;

export function iconHtml(): string {
  const arcs = ARC_ROTATIONS.map(
    (rotate, i) =>
      `<circle cx="0" cy="0" r="100" fill="none" stroke="${ARC_COLORS[i]}" stroke-width="20" stroke-linecap="round" stroke-dasharray="71.72 556.60" transform="rotate(${rotate})"/>`,
  ).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:${ICON_SIZE.width}px;height:${ICON_SIZE.height}px;background:${BACKGROUND};}
body{display:flex;align-items:center;justify-content:center;}
</style></head><body><svg width="${LOGO_PX}" height="${LOGO_PX}" viewBox="-120 -120 240 240" xmlns="http://www.w3.org/2000/svg"><g>${arcs}<circle cx="0" cy="106" r="13" fill="${DOT_COLOR}"/></g></svg></body></html>`;
}

export async function renderIcon(browser: Browser, outPath: string): Promise<void> {
  const context = await browser.newContext({
    viewport: { width: ICON_SIZE.width, height: ICON_SIZE.height },
    deviceScaleFactor: 1,
  });
  try {
    const page = await context.newPage();
    await page.setContent(iconHtml());
    const buf = await page.screenshot({ fullPage: false });
    assertPng(buf, ICON_SIZE, 'icon');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, buf);
  } finally {
    await context.close();
  }
}
