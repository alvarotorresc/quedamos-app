import type { ReactNode } from 'react';

interface TileProps {
  /** Etiqueta mono en mayúsculas de la cabecera. */
  label: string;
  icon?: ReactNode;
  /** Columnas que ocupa en la rejilla de dos. */
  span?: 1 | 2;
  /** Con onClick la ficha entera es un botón. */
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}

const base =
  'bg-bg-light border border-subtle rounded-lg p-3.5 min-h-[96px] flex flex-col justify-between gap-2 text-left';

/** Ficha del mosaico de ajustes: cabecera con icono y etiqueta, contenido debajo. */
export function Tile({ label, icon, span = 1, onClick, className = '', children }: TileProps) {
  const spanClass = span === 2 ? 'col-span-2' : 'col-span-1';
  const header = (
    <div className="flex items-center gap-2 text-text-muted">
      {icon}
      <span className="font-mono text-[10px] tracking-[0.14em] uppercase">{label}</span>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${base} ${spanClass} ${className}`}>
        {header}
        {children}
      </button>
    );
  }
  return (
    <div className={`${base} ${spanClass} ${className}`}>
      {header}
      {children}
    </div>
  );
}

export default Tile;
