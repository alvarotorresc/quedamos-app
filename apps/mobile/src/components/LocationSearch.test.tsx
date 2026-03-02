import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocationSearch } from './LocationSearch';
import { searchCities } from '../services/weather';

vi.mock('../services/weather', () => ({
  searchCities: vi.fn(),
}));

const mockResults = [
  { name: 'Madrid', latitude: 40.41, longitude: -3.7, country: 'Spain', admin1: 'Madrid' },
  { name: 'Malaga', latitude: 36.72, longitude: -4.42, country: 'Spain', admin1: 'Andalusia' },
];

// Helper: advances timers and flushes all pending async operations
async function advanceAndFlush(ms = 300) {
  await act(async () => {
    await vi.runAllTimersAsync();
  });
}

describe('LocationSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders input with placeholder', () => {
    render(
      <LocationSearch
        value=""
        placeholder="Search location..."
        onChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText('Search location...')).toBeInTheDocument();
  });

  it('calls onChange when user types', () => {
    const onChange = vi.fn();
    render(<LocationSearch value="" onChange={onChange} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ma' } });
    expect(onChange).toHaveBeenCalledWith('Ma');
  });

  it('does not search when fewer than 2 chars', async () => {
    render(<LocationSearch value="M" onChange={vi.fn()} onSelect={vi.fn()} />);
    await advanceAndFlush();
    expect(searchCities).not.toHaveBeenCalled();
  });

  it('searches cities after debounce with 2+ chars', async () => {
    vi.mocked(searchCities).mockResolvedValue(mockResults);

    const { rerender } = render(<LocationSearch value="" onChange={vi.fn()} onSelect={vi.fn()} />);

    rerender(<LocationSearch value="Ma" onChange={vi.fn()} onSelect={vi.fn()} />);

    await advanceAndFlush();

    expect(searchCities).toHaveBeenCalledWith('Ma');
  });

  it('shows dropdown with results', async () => {
    vi.mocked(searchCities).mockResolvedValue(mockResults);

    const { rerender } = render(<LocationSearch value="" onChange={vi.fn()} onSelect={vi.fn()} />);
    rerender(<LocationSearch value="Madrid" onChange={vi.fn()} onSelect={vi.fn()} />);

    await advanceAndFlush();

    expect(screen.getByText('Madrid, Madrid — Spain')).toBeInTheDocument();
    expect(screen.getByText('Malaga, Andalusia — Spain')).toBeInTheDocument();
  });

  it('calls onSelect with lat/lon when user picks a result', async () => {
    vi.mocked(searchCities).mockResolvedValue(mockResults);
    const onSelect = vi.fn();

    const { rerender } = render(<LocationSearch value="" onChange={vi.fn()} onSelect={onSelect} />);
    rerender(<LocationSearch value="Madrid" onChange={vi.fn()} onSelect={onSelect} />);

    await advanceAndFlush();

    fireEvent.mouseDown(screen.getByText('Madrid, Madrid — Spain'));
    expect(onSelect).toHaveBeenCalledWith('Madrid', 40.41, -3.7);
  });

  it('hides dropdown after selection', async () => {
    vi.mocked(searchCities).mockResolvedValue(mockResults);
    const onSelect = vi.fn();

    const { rerender } = render(<LocationSearch value="" onChange={vi.fn()} onSelect={onSelect} />);
    rerender(<LocationSearch value="Madrid" onChange={vi.fn()} onSelect={onSelect} />);

    await advanceAndFlush();

    expect(screen.getByText('Madrid, Madrid — Spain')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText('Madrid, Madrid — Spain'));

    expect(screen.queryByText('Madrid, Madrid — Spain')).not.toBeInTheDocument();
  });

  it('calls onClear and resets dropdown when text is cleared', () => {
    const onChange = vi.fn();
    const onClear = vi.fn();

    render(
      <LocationSearch value="Madrid" onChange={onChange} onSelect={vi.fn()} onClear={onClear} />,
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('');
    expect(onClear).toHaveBeenCalled();
  });

  it('hides dropdown when no results found', async () => {
    vi.mocked(searchCities).mockResolvedValue([]);

    const { rerender } = render(<LocationSearch value="" onChange={vi.fn()} onSelect={vi.fn()} />);
    rerender(<LocationSearch value="Xyz" onChange={vi.fn()} onSelect={vi.fn()} />);

    await advanceAndFlush();

    expect(searchCities).toHaveBeenCalled();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not re-trigger search after selection (selectedRef guard)', async () => {
    vi.mocked(searchCities).mockResolvedValue(mockResults);
    const onSelect = vi.fn();

    const { rerender } = render(<LocationSearch value="" onChange={vi.fn()} onSelect={onSelect} />);
    rerender(<LocationSearch value="Mad" onChange={vi.fn()} onSelect={onSelect} />);

    await advanceAndFlush();

    expect(screen.getByText('Madrid, Madrid — Spain')).toBeInTheDocument();

    const callCountBefore = vi.mocked(searchCities).mock.calls.length;
    fireEvent.mouseDown(screen.getByText('Madrid, Madrid — Spain'));

    // Simulate parent updating value prop after selection
    rerender(<LocationSearch value="Madrid" onChange={vi.fn()} onSelect={onSelect} />);

    await advanceAndFlush(400);

    // searchCities should not have been called again
    expect(vi.mocked(searchCities).mock.calls.length).toBe(callCountBefore);
  });
});
