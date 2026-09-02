import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Ionic marks alert buttons with a class per role (`alert-button-role-cancel`,
// `alert-button-role-destructive`), not with a `role` attribute. A selector on the
// attribute silently matches nothing and every button ends up in the primary colour.
const css = readFileSync(resolve(__dirname, 'index.css'), 'utf8');

// Match the selector at the start of a line so `ion-alert .alert-wrapper` does not
// resolve to the `.light ion-alert .alert-wrapper` rule that happens to come first.
function rule(selector: string): string {
  const match = new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'm').exec(css);
  return match ? match[1] : '';
}

describe('overlay theme (ion-alert / ion-action-sheet)', () => {
  it('colours the destructive alert button through the role class Ionic actually sets', () => {
    expect(rule('ion-alert .alert-button.alert-button-role-destructive')).toContain('var(--app-error)');
    expect(css).not.toContain("ion-alert .alert-button[role='destructive']");
  });

  it('mutes the cancel alert button so it does not compete with the action', () => {
    expect(rule('ion-alert .alert-button.alert-button-role-cancel')).toContain('var(--app-text-muted)');
  });

  it('lifts the alert surface off the backdrop instead of painting it near-black', () => {
    const wrapper = rule('ion-alert .alert-wrapper');
    expect(wrapper).toContain('var(--app-bg-surface)');
    expect(wrapper).toContain('var(--app-border-strong)');
    expect(wrapper).toContain('box-shadow');
  });

  it('keeps the light theme destructive rule on the same role class', () => {
    expect(rule('.light ion-alert .alert-button.alert-button-role-destructive')).toContain('var(--app-error)');
  });
});
