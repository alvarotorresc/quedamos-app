import { useState, useEffect, useRef } from 'react';
import { searchCities, type GeocodingResult } from '../services/weather';

interface LocationSearchProps {
  value: string;
  placeholder?: string;
  style?: React.CSSProperties;
  onChange: (text: string) => void;
  onSelect: (name: string, lat: number, lon: number) => void;
  onClear?: () => void;
}

export function LocationSearch({
  value,
  placeholder,
  style,
  onChange,
  onSelect,
  onClear,
}: LocationSearchProps) {
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef(false);

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const found = await searchCities(value);
      setResults(found);
      setShowDropdown(found.length > 0);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const handleSelect = (result: GeocodingResult) => {
    selectedRef.current = true;
    setShowDropdown(false);
    setResults([]);
    onSelect(result.name, result.latitude, result.longitude);
  };

  const handleChange = (text: string) => {
    onChange(text);
    if (text === '') {
      setResults([]);
      setShowDropdown(false);
      onClear?.();
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-dark"
        style={style}
        autoComplete="off"
      />
      {showDropdown && results.length > 0 && (
        <div
          className="absolute z-50 w-full mt-1 rounded-[10px] overflow-hidden"
          style={{
            background: 'var(--app-bg-card)',
            border: '1px solid var(--app-border)',
          }}
        >
          {results.map((r, i) => (
            <button
              key={`${r.name}-${r.latitude}-${i}`}
              onMouseDown={() => handleSelect(r)}
              className="w-full text-left px-3 py-2 text-sm text-text border-none"
              style={{
                background: 'transparent',
                borderBottom: i < results.length - 1 ? '1px solid var(--app-border)' : 'none',
              }}
            >
              {r.name}
              {r.admin1 ? `, ${r.admin1}` : ''} — {r.country}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
