import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CreateEventModal } from './CreateEventModal';
import { createWrapper } from '../test/test-utils';

// IonModal is a Stencil web component that only projects its children after an
// async "present" animation — it never runs under jsdom, so children stay stuck
// inside a <template>. Render them directly, like EventCard.test.tsx does.
vi.mock('@ionic/react', () => ({
  IonModal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div data-testid="ion-modal">{children}</div> : null,
}));

// Group members for the manual "invite specific members" selector — includes
// Sara, who is NOT in the prefill's availableMembers, so toggling her on
// diverges the live selection from the prefill's "who can" set.
vi.mock('../hooks/useGroups', () => ({
  useGroup: () => ({
    data: {
      id: 'g1',
      name: 'Grupo',
      emoji: '👥',
      createdById: 'u1',
      createdAt: '2026-01-01',
      members: [
        { userId: 'u1', joinedAt: '2026-01-01', role: 'member', user: { id: 'u1', name: 'Álvaro', avatarEmoji: '😊' } },
        { userId: 'u2', joinedAt: '2026-01-01', role: 'member', user: { id: 'u2', name: 'Misa', avatarEmoji: '😊' } },
        { userId: 'u3', joinedAt: '2026-01-01', role: 'member', user: { id: 'u3', name: 'Sara', avatarEmoji: '😊' } },
      ],
    },
  }),
}));

const prefill = {
  date: '2026-02-13', dateLabel: 'viernes, 13 de febrero', weekday: 'viernes',
  suggestedTime: '19:00', suggestedSlot: 'Tarde',
  availableMembers: [
    { userId: 'u1', name: 'Álvaro', color: '#60A5FA' },
    { userId: 'u2', name: 'Misa', color: '#F59E0B' },
  ],
  availableCount: 2, weather: null,
};

describe('CreateEventModal prellenado', () => {
  it('con prefill: título por defecto, hora sugerida y submit habilitado (2 toques)', () => {
    render(
      <CreateEventModal isOpen onClose={vi.fn()} groupId="g1" prefill={prefill} />,
      { wrapper: createWrapper() },
    );
    const title = screen.getByDisplayValue('plans.create.defaultTitle');
    expect(title).toBeInTheDocument();
    expect(screen.getByDisplayValue('19:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'plans.create.submit' })).toBeEnabled();
  });

  it('muestra el resumen de chips solo cuando la selección diverge del prellenado', () => {
    render(
      <CreateEventModal isOpen onClose={vi.fn()} groupId="g1" prefill={prefill} />,
      { wrapper: createWrapper() },
    );

    // Antes de personalizar: la selección coincide con el prellenado, así que no
    // hay resumen de chips — la fila "who can" solo muestra avatares (sin nombres),
    // así que ningún nombre debería estar visible todavía.
    expect(screen.queryByText('Álvaro')).not.toBeInTheDocument();
    expect(screen.queryByText('Sara')).not.toBeInTheDocument();

    // Expandir el selector manual y añadir a Sara (no marcó disponibilidad ese día)
    fireEvent.click(screen.getByText('plans.create.selectAttendees'));
    fireEvent.click(screen.getByText('Sara'));

    // Colapsar el selector
    fireEvent.click(screen.getByText('plans.create.selectAttendees'));

    // La selección ya no coincide con el prellenado: el resumen de chips aparece
    // y refleja la selección real (Álvaro, Misa y ahora también Sara).
    expect(screen.getByText('Álvaro')).toBeInTheDocument();
    expect(screen.getByText('Misa')).toBeInTheDocument();
    expect(screen.getByText('Sara')).toBeInTheDocument();
  });
});
