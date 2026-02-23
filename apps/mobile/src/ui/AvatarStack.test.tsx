import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AvatarStack } from './AvatarStack';

const mockMembers = [
  { name: 'Alice Blue', color: '#60A5FA' },
  { name: 'Bob Orange', color: '#F59E0B' },
  { name: 'Carol Pink', color: '#F472B6' },
  { name: 'Dave Green', color: '#34D399' },
  { name: 'Eve Purple', color: '#A78BFA' },
];

describe('AvatarStack', () => {
  it('renders all members when count is under max', () => {
    render(<AvatarStack members={mockMembers} />);
    expect(screen.getByText('AB')).toBeInTheDocument();
    expect(screen.getByText('BO')).toBeInTheDocument();
    expect(screen.getByText('CP')).toBeInTheDocument();
    expect(screen.getByText('DG')).toBeInTheDocument();
    expect(screen.getByText('EP')).toBeInTheDocument();
  });

  it('truncates members when count exceeds max', () => {
    render(<AvatarStack members={mockMembers} max={3} />);
    expect(screen.getByText('AB')).toBeInTheDocument();
    expect(screen.getByText('BO')).toBeInTheDocument();
    expect(screen.getByText('CP')).toBeInTheDocument();
    expect(screen.queryByText('DG')).not.toBeInTheDocument();
    expect(screen.queryByText('EP')).not.toBeInTheDocument();
  });

  it('renders exactly max members when there are more', () => {
    const manyMembers = [
      ...mockMembers,
      { name: 'Frank Red', color: '#FB7185' },
      { name: 'Grace Lime', color: '#34D399' },
      { name: 'Hank Teal', color: '#60A5FA' },
    ];
    render(<AvatarStack members={manyMembers} max={4} />);
    const avatars = screen.getAllByText(/^[A-Z]{2}$/);
    expect(avatars).toHaveLength(4);
  });

  it('handles empty members array', () => {
    const { container } = render(<AvatarStack members={[]} />);
    const wrapper = container.querySelector('.flex');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper?.children).toHaveLength(0);
  });

  it('handles single member', () => {
    render(<AvatarStack members={[mockMembers[0]]} />);
    expect(screen.getByText('AB')).toBeInTheDocument();
  });

  it('applies small gap between avatars instead of overlap', () => {
    const { container } = render(<AvatarStack members={mockMembers.slice(0, 3)} />);
    const wrapper = container.querySelector('.flex');
    // gap = round(24 * 0.08) = 2
    expect(wrapper).toHaveStyle({ gap: '2px' });
  });

  it('uses default max of 6', () => {
    const sevenMembers = [
      ...mockMembers,
      { name: 'Frank Red', color: '#FB7185' },
      { name: 'Grace Lime', color: '#34D399' },
    ];
    render(<AvatarStack members={sevenMembers} />);
    const avatars = screen.getAllByText(/^[A-Z]{2}$/);
    expect(avatars).toHaveLength(6);
  });

  it('uses default size of 24 for avatars', () => {
    render(<AvatarStack members={[mockMembers[0]]} />);
    const avatar = screen.getByText('AB');
    expect(avatar).toHaveStyle({ width: '24px', height: '24px' });
  });

  it('respects custom size prop', () => {
    render(<AvatarStack members={[mockMembers[0]]} size={40} />);
    const avatar = screen.getByText('AB');
    expect(avatar).toHaveStyle({ width: '40px', height: '40px' });
  });
});
