import { useState } from 'react';
import { useRespondEvent } from './useEvents';
import { useAuthStore } from '../stores/auth';
import { apiDateToKey, formatDateKey } from '../lib/date-utils';
import type { AttendeeStatus, Event } from '../services/events';

export interface EventResponseState {
  /** Tu respuesta actual; 'pending' también cuando no estás invitado. */
  myStatus: AttendeeStatus;
  /** Estás en la lista de asistentes de la quedada. */
  isInvited: boolean;
  /** Estás invitado y aún no has dicho nada. */
  isPending: boolean;
  /** La quedada ya pasó: responder no cambiaría nada. */
  isPastEvent: boolean;
  isCancelled: boolean;
  /** Se puede responder ahora mismo: invitado, ni cancelada ni pasada. */
  canRespond: boolean;
  /** Hay una respuesta en vuelo. */
  isResponding: boolean;
  /** Acabas de confirmar en esta pantalla — para celebrarlo con una animación. */
  justConfirmed: boolean;
  respond: (status: 'confirmed' | 'declined') => void;
}

/**
 * Un «voy / no voy» compartido: lee tu asistencia de la quedada y manda la
 * respuesta. Lo usan la ficha de la lista de quedadas y la hoja de detalle del
 * calendario, que antes solo sabía mirar.
 *
 * Acepta `null` porque la hoja se monta antes de tener quedada que enseñar y no
 * puede llamar al hook dentro de un condicional.
 */
export function useEventResponse(event: Event | null): EventResponseState {
  const userId = useAuthStore((s) => s.user?.id);
  const respondEvent = useRespondEvent(event?.groupId ?? '');
  const [justConfirmed, setJustConfirmed] = useState(false);

  const myAttendee = event?.attendees.find((a) => a.userId === userId);
  const myStatus: AttendeeStatus = myAttendee?.status ?? 'pending';
  const isInvited = !!myAttendee;
  const isPending = isInvited && myStatus === 'pending';

  const isCancelled = event?.status === 'cancelled';
  // Una quedada de hoy sigue siendo respondible: solo cuenta como pasada a partir de ayer.
  const isPastEvent = !!event && apiDateToKey(event.date) < formatDateKey(new Date());
  const canRespond = isInvited && !isCancelled && !isPastEvent;

  const respond = (status: 'confirmed' | 'declined') => {
    if (!event) return;
    respondEvent.mutate(
      { eventId: event.id, status },
      {
        onSuccess: () => {
          if (status === 'confirmed') setJustConfirmed(true);
        },
      },
    );
  };

  return {
    myStatus,
    isInvited,
    isPending,
    isPastEvent,
    isCancelled,
    canRespond,
    isResponding: respondEvent.isPending,
    justConfirmed,
    respond,
  };
}
