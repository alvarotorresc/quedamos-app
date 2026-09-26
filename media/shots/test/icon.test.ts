import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iconHtml } from '../src/icon.ts';

test('icon: cinco arcos con los colores del Logo, punto violeta, fondo #14120E', () => {
  const html = iconHtml();
  const svg = html.slice(html.indexOf('<svg'));
  assert.equal((svg.match(/<circle/g) ?? []).length, 6);
  for (const color of ['#60A5FA', '#F59E0B', '#F472B6', '#34D399', '#FB7185', '#A78BFA']) {
    assert.ok(svg.includes(color), color);
  }
  assert.ok(html.includes('#14120E'));
  // Ni clases ni <style> en el SVG: la hoja del favicon repinta los arcos en mono.
  assert.ok(!svg.includes('class=') && !svg.includes('<style'));
});
