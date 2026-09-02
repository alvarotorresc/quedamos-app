import { HiCheck } from 'react-icons/hi2';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Nombre accesible del switch. */
  label: string;
  /** Color de la pista encendida; por defecto, el primario. */
  color?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Interruptor del design system: pista 44×26 que se llena de color al encender y
 * botón con marca de check, para que el estado se lea a simple vista en ambos temas.
 */
export function Toggle({
  checked,
  onChange,
  label,
  color = 'var(--app-primary)',
  disabled = false,
  className = '',
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-[26px] shrink-0 rounded-pill border transition-colors disabled:opacity-40 disabled:pointer-events-none ${
        checked ? 'border-transparent' : 'bg-toggle-off border-subtle'
      } ${className}`}
      style={checked ? { background: color } : undefined}
    >
      <span
        className={`absolute top-[2px] flex items-center justify-center w-5 h-5 rounded-pill transition-all ${
          checked ? 'left-[22px] bg-bg-light' : 'left-[2px] bg-text-dark'
        }`}
      >
        {checked && <HiCheck className="w-3 h-3 text-[#33302A]" strokeWidth={1.5} aria-hidden="true" />}
      </span>
    </button>
  );
}

export default Toggle;
