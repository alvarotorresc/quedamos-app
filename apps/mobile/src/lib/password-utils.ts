import type { TFunction } from 'i18next';

export interface PasswordCheck {
  key: string;
  label: string;
  ok: boolean;
}

export function getPasswordChecks(password: string, t: TFunction): PasswordCheck[] {
  return [
    { key: 'minLength', label: t('register.checks.minLength'), ok: password.length >= 8 },
    { key: 'uppercase', label: t('register.checks.uppercase'), ok: /[A-Z]/.test(password) },
    { key: 'number', label: t('register.checks.number'), ok: /\d/.test(password) },
    { key: 'special', label: t('register.checks.special'), ok: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function getStrength(
  checks: PasswordCheck[],
  t: TFunction,
): { level: number; label: string; color: string } {
  const passed = checks.filter((c) => c.ok).length;
  if (passed <= 1) return { level: 1, label: t('register.strength.weak'), color: 'bg-danger' };
  if (passed <= 2) return { level: 2, label: t('register.strength.fair'), color: 'bg-warning' };
  if (passed <= 3) return { level: 3, label: t('register.strength.good'), color: 'bg-primary' };
  return { level: 4, label: t('register.strength.strong'), color: 'bg-success' };
}
