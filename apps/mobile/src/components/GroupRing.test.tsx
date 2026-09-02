import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GroupRing } from './GroupRing';

const members = [
  { userId: 'a', joinedAt: '2026-01-01T00:00:00Z', role: 'admin', user: { id: 'a', name: 'Álvaro', avatarEmoji: '😊' } },
  { userId: 'b', joinedAt: '2026-01-02T00:00:00Z', role: 'member', user: { id: 'b', name: 'Misa', avatarEmoji: '😊' } },
];

describe('GroupRing', () => {
  it('un avatar por miembro, posicionado absoluto sobre el anillo', () => {
    const { container } = render(<GroupRing members={members} emoji="🏔️" />);
    expect(screen.getByText('ÁL')).toBeInTheDocument();
    expect(screen.getByText('MI')).toBeInTheDocument();
    const positioned = container.querySelectorAll('[style*="position: absolute"]');
    expect(positioned.length).toBeGreaterThanOrEqual(2);
  });
  it('el centro muestra el emoji del grupo', () => {
    render(<GroupRing members={members} emoji="🏔️" />);
    expect(screen.getByText('🏔️')).toBeInTheDocument();
  });
});
