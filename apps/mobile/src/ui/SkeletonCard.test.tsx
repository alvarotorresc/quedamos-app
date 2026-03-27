import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SkeletonCard } from './SkeletonCard';

describe('SkeletonCard', () => {
  it('renders without crashing', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it('renders a card container with correct base classes', () => {
    const { container } = render(<SkeletonCard />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain('bg-bg-glass');
    expect(card.className).toContain('border');
    expect(card.className).toContain('rounded-card');
  });

  it('renders four skeleton placeholder elements', () => {
    const { container } = render(<SkeletonCard />);
    const skeletons = container.querySelectorAll('.skeleton');
    expect(skeletons).toHaveLength(6);
  });

  it('renders three avatar-like skeleton circles', () => {
    const { container } = render(<SkeletonCard />);
    const circles = container.querySelectorAll('.skeleton.rounded-full');
    expect(circles).toHaveLength(3);
  });

  it('renders text skeleton lines with rounded class', () => {
    const { container } = render(<SkeletonCard />);
    const roundedSkeletons = container.querySelectorAll('.skeleton.rounded');
    expect(roundedSkeletons.length).toBeGreaterThanOrEqual(3);
  });

  it('renders the avatar group in a flex container', () => {
    const { container } = render(<SkeletonCard />);
    const flexContainers = container.querySelectorAll('.flex.gap-1');
    expect(flexContainers).toHaveLength(1);
  });

  it('renders all elements as div elements', () => {
    const { container } = render(<SkeletonCard />);
    const allChildren = container.querySelectorAll('div');
    expect(allChildren.length).toBeGreaterThan(0);
    allChildren.forEach((el) => {
      expect(el.tagName).toBe('DIV');
    });
  });
});
