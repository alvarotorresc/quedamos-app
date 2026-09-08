import { NOTIFICATION_TYPES, NotificationType } from './dto/update-preference.dto';
import { PushLanguage } from './push-language';

/**
 * Every push the API can send, in every language a user can read. Services used to
 * build the copy inline, which meant one Spanish string per notification for the whole
 * group — and three of them were still in English, one with the raw role value in it.
 *
 * Rules for this file:
 *  - the Spanish text of a notification that already existed is reproduced verbatim;
 *  - a type without copy in BOTH languages is a compile error (the mapped type below)
 *    and a test failure (push-contract.spec.ts);
 *  - anything the copy needs comes in as a typed `params`, never pre-formatted, so the
 *    weekday of «el aro se cierra» is rendered in the reader's language, not the
 *    sender's.
 */

/** `test` is not a preference type, but it is copy that needs both languages too. */
export const PUSH_COPY_TYPES = [...NOTIFICATION_TYPES, 'test'] as const;

export type PushCopyType = NotificationType | 'test';

export interface PushCopy {
  title: string;
  body: string;
  /** Extra localized `data` keys, merged into the FCM payload (see `new_poll`). */
  data?: Record<string, string>;
}

/** What each notification needs to render itself. */
export interface PushCopyParamsByType {
  // Events
  new_event: { actorName: string; title: string };
  event_updated: { title: string };
  event_deleted: { title: string };
  event_cancelled: { title: string };
  /** `all_confirmed` when the last attendee said yes, `manual` when the creator confirmed. */
  event_confirmed: { title: string; variant: 'all_confirmed' | 'manual' };
  event_declined: { actorName: string; title: string };
  event_reminder: { title: string };
  // Proposals
  new_proposal: { actorName: string; title: string };
  proposal_voted: { actorName: string; title: string; vote: 'yes' | 'no' };
  proposal_converted: { title: string };
  // Polls
  new_poll: { actorName: string; groupName: string; date: Date; slot: string | null };
  poll_completed: { date: Date };
  // Members
  member_joined: { actorName: string; groupName: string };
  member_left: { actorName: string; groupName: string };
  role_changed: { role: 'admin' | 'member' };
  member_kicked: { groupName: string };
  group_deleted: { groupName: string };
  // Reminders
  weekly_availability_reminder: Record<string, never>;
  // Debug
  test: Record<string, never>;
}

export type PushCopyParams<T extends PushCopyType> = PushCopyParamsByType[T];

/** Group timezone. v0.1 hardcodes Europe/Madrid, like the reminders and the poll copy. */
const TIMEZONE = 'Europe/Madrid';

const LOCALE: Record<PushLanguage, string> = { es: 'es-ES', en: 'en-GB' };

function weekday(date: Date, language: PushLanguage): string {
  return date.toLocaleDateString(LOCALE[language], { weekday: 'long', timeZone: TIMEZONE });
}

const SLOT_LABEL: Record<PushLanguage, Record<string, string>> = {
  es: { Mañana: 'por la mañana', Tarde: 'por la tarde', Noche: 'por la noche' },
  en: { Mañana: 'in the morning', Tarde: 'in the afternoon', Noche: 'at night' },
};

/** An unknown slot renders as a plain «¿Puedes el martes?» instead of «… undefined?». */
function slotSuffix(slot: string | null, language: PushLanguage): string {
  const label = slot ? SLOT_LABEL[language][slot] : undefined;
  return label ? ` ${label}` : '';
}

type CopyTable = {
  [T in PushCopyType]: {
    [L in PushLanguage]: (params: PushCopyParamsByType[T]) => PushCopy;
  };
};

const COPY: CopyTable = {
  new_event: {
    es: (p) => ({ title: 'Nueva quedada', body: `${p.actorName} ha creado "${p.title}"` }),
    en: (p) => ({ title: 'New plan', body: `${p.actorName} created "${p.title}"` }),
  },
  event_updated: {
    es: (p) => ({ title: 'Quedada actualizada', body: `"${p.title}" ha sido editada` }),
    en: (p) => ({ title: 'Plan updated', body: `"${p.title}" has been edited` }),
  },
  event_deleted: {
    es: (p) => ({ title: 'Quedada eliminada', body: `"${p.title}" ha sido eliminada` }),
    en: (p) => ({ title: 'Plan deleted', body: `"${p.title}" has been deleted` }),
  },
  event_cancelled: {
    es: (p) => ({ title: 'Quedada cancelada', body: `"${p.title}" ha sido cancelada` }),
    en: (p) => ({ title: 'Plan cancelled', body: `"${p.title}" has been cancelled` }),
  },
  event_confirmed: {
    es: (p) => ({
      title: 'Quedada confirmada',
      body:
        p.variant === 'all_confirmed'
          ? `Todos han confirmado "${p.title}"`
          : `"${p.title}" ha sido confirmada`,
    }),
    en: (p) => ({
      title: 'Plan confirmed',
      body:
        p.variant === 'all_confirmed'
          ? `Everyone confirmed "${p.title}"`
          : `"${p.title}" has been confirmed`,
    }),
  },
  event_declined: {
    es: (p) => ({
      title: 'Asistencia rechazada',
      body: `${p.actorName} ha rechazado "${p.title}"`,
    }),
    en: (p) => ({ title: 'Attendance declined', body: `${p.actorName} declined "${p.title}"` }),
  },
  event_reminder: {
    es: (p) => ({ title: 'Recordatorio', body: `"${p.title}" es mañana` }),
    en: (p) => ({ title: 'Reminder', body: `"${p.title}" is tomorrow` }),
  },
  new_proposal: {
    es: (p) => ({ title: 'Nueva propuesta', body: `${p.actorName} propone "${p.title}"` }),
    en: (p) => ({ title: 'New proposal', body: `${p.actorName} proposes "${p.title}"` }),
  },
  proposal_voted: {
    es: (p) => ({
      title: 'Voto en propuesta',
      body: `${p.actorName} ha votado ${p.vote === 'yes' ? 'a favor' : 'en contra'} en "${p.title}"`,
    }),
    en: (p) => ({
      title: 'Proposal vote',
      body: `${p.actorName} voted ${p.vote === 'yes' ? 'in favour' : 'against'} on "${p.title}"`,
    }),
  },
  proposal_converted: {
    es: (p) => ({
      title: 'Propuesta convertida',
      body: `"${p.title}" se ha convertido en quedada`,
    }),
    en: (p) => ({ title: 'Proposal converted', body: `"${p.title}" is now a plan` }),
  },
  new_poll: {
    es: (p) => ({
      title: `¿Puedes el ${weekday(p.date, 'es')}${slotSuffix(p.slot, 'es')}?`,
      body: `Pregunta ${p.actorName} · ${p.groupName}`,
      // The web service worker turns these into the notification's action buttons.
      data: { yesLabel: 'Puedo', noLabel: 'No puedo' },
    }),
    en: (p) => ({
      title: `Can you make ${weekday(p.date, 'en')}${slotSuffix(p.slot, 'en')}?`,
      body: `${p.actorName} is asking · ${p.groupName}`,
      data: { yesLabel: 'I can', noLabel: "I can't" },
    }),
  },
  poll_completed: {
    es: (p) => ({ title: 'El aro se cierra', body: `Podéis todos el ${weekday(p.date, 'es')}` }),
    en: (p) => ({ title: 'The ring closes', body: `You can all make ${weekday(p.date, 'en')}` }),
  },
  member_joined: {
    es: (p) => ({ title: 'Nuevo miembro', body: `${p.actorName} se ha unido a "${p.groupName}"` }),
    en: (p) => ({ title: 'New member', body: `${p.actorName} joined "${p.groupName}"` }),
  },
  member_left: {
    es: (p) => ({ title: 'Miembro salió', body: `${p.actorName} ha salido de "${p.groupName}"` }),
    en: (p) => ({ title: 'Member left', body: `${p.actorName} left "${p.groupName}"` }),
  },
  role_changed: {
    es: (p) => ({
      title: 'Rol actualizado',
      body: `Tu rol ha cambiado a ${p.role === 'admin' ? 'administrador' : 'miembro'}`,
    }),
    en: (p) => ({
      title: 'Role updated',
      body: `Your role has been changed to ${p.role === 'admin' ? 'admin' : 'member'}`,
    }),
  },
  member_kicked: {
    es: (p) => ({
      title: 'Te han sacado del grupo',
      body: `Ya no formas parte de "${p.groupName}"`,
    }),
    en: (p) => ({
      title: 'Removed from group',
      body: `You are no longer part of "${p.groupName}"`,
    }),
  },
  group_deleted: {
    es: (p) => ({ title: 'Grupo eliminado', body: `El grupo "${p.groupName}" ha sido eliminado` }),
    en: (p) => ({ title: 'Group deleted', body: `The group "${p.groupName}" has been deleted` }),
  },
  weekly_availability_reminder: {
    es: () => ({
      title: 'Marca tu disponibilidad',
      body: 'Todavía no has marcado disponibilidad para la semana que viene',
    }),
    en: () => ({
      title: 'Mark your availability',
      body: "You haven't marked your availability for next week yet",
    }),
  },
  test: {
    es: () => ({
      title: 'Notificación de prueba',
      body: 'Si ves esto, las notificaciones funcionan',
    }),
    en: () => ({
      title: 'Test notification',
      body: 'If you see this, notifications are working!',
    }),
  },
};

/** Pure: the same type, language and params always produce the same copy. */
export function buildPushCopy<T extends PushCopyType>(
  type: T,
  language: PushLanguage,
  params: PushCopyParams<T>,
): PushCopy {
  return COPY[type][language](params);
}
