import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
const rootBlock = css.match(/:root\s*\{[^}]*\}/)?.[0] ?? '';
const lightBlock = css.match(/\.light\s*\{[^}]*\}/)?.[0] ?? '';

describe('tokens un mundo, dos luces (spec §5.1)', () => {
  it('blocks are extracted (guardrail against broken delimiters)', () => {
    expect(rootBlock).not.toBe('');
    expect(lightBlock).not.toBe('');
  });
  it('noche es el default (:root)', () => {
    expect(rootBlock).toContain('--app-bg: #14120E');
    expect(rootBlock).toContain('--app-bg-light: #191712');
    expect(rootBlock).toContain('--app-text: #F2EFE7');
    expect(rootBlock).toContain('--app-text-muted: #8F887A');
    expect(rootBlock).toContain('--app-apagado: #5E584C');
    expect(rootBlock).toContain('--app-primary-solid: #F2EFE7');
    expect(rootBlock).toContain('--app-on-primary: #14120E');
    expect(rootBlock).toContain('--app-success: #7FA98B');
    expect(rootBlock).toContain('--app-error: #D06A5C');
  });
  it('día es papel (.light)', () => {
    expect(lightBlock).toContain('--app-bg: #F5F1E8');
    expect(lightBlock).toContain('--app-bg-light: #FCFAF4');
    expect(lightBlock).toContain('--app-text: #33302A');
    expect(lightBlock).toContain('--app-text-muted: #6E6858');
    expect(lightBlock).toContain('--app-apagado: #C9C0AE');
    expect(lightBlock).toContain('--app-primary-solid: #33302A');
    expect(lightBlock).toContain('--app-on-primary: #F5F1E8');
    expect(lightBlock).toContain('--app-success: #3E7350');
    expect(lightBlock).toContain('--app-error: #B04436');
  });
  it('el azul ya no es token de UI', () => {
    expect(rootBlock).not.toContain('#60a5fa');
    expect(rootBlock).not.toContain('#2563eb');
    expect(lightBlock).not.toContain('#2563eb');
    expect(lightBlock).not.toContain('#60a5fa');
  });
});
