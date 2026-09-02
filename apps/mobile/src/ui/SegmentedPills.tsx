interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedPillsProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}

export function SegmentedPills<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: SegmentedPillsProps<T>) {
  return (
    <div
      role="tablist"
      className={`inline-flex border border-subtle rounded-pill p-0.5 gap-0.5 ${className}`}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={`px-3.5 py-1.5 rounded-pill text-xs transition-colors ${
            o.value === value
              ? 'bg-primary-solid text-on-primary font-bold'
              : 'text-text-muted font-semibold'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
