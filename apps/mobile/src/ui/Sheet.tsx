import { IonModal } from '@ionic/react';
import type { ReactNode } from 'react';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Título de 17 px; el subtítulo va debajo en 12 px. */
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Lo que acompaña al título por la derecha (badge, iconos). */
  headerEnd?: ReactNode;
  /** Acciones al pie: quedan fijas mientras el cuerpo hace scroll. */
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Hoja inferior del prototipo: anclada abajo, alto = contenido (máximo 90 % con
 * scroll interno), esquinas 20 px y backdrop velado. Va sobre IonModal sin
 * breakpoints para conservar foco, botón atrás y teclado de Ionic; el alto
 * automático lo pone `ion-modal.sheet` en index.css.
 */
export function Sheet({
  isOpen,
  onClose,
  title,
  subtitle,
  headerEnd,
  footer,
  className = '',
  children,
}: SheetProps) {
  const hasHeader = title !== undefined || subtitle !== undefined || headerEnd !== undefined;

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} className={`sheet ${className}`.trim()}>
      <div className="sheet-panel flex flex-col min-h-0 bg-bg-light px-5 pt-5 pb-[calc(36px+var(--ion-safe-area-bottom,0px))]">
        <div className="w-8 h-[3px] rounded-sm bg-toggle-off mx-auto mb-3.5 shrink-0" aria-hidden="true" />

        {hasHeader && (
          <div className="flex items-start justify-between gap-2 mb-3.5 shrink-0">
            <div className="min-w-0 flex-1">
              {title !== undefined && <h3 className="text-[17px] font-bold text-text">{title}</h3>}
              {subtitle !== undefined && <p className="text-xs text-text-dark mt-0.5">{subtitle}</p>}
            </div>
            {headerEnd}
          </div>
        )}

        <div className="min-h-0 overflow-y-auto no-scrollbar">{children}</div>

        {footer !== undefined && <div className="shrink-0 pt-4">{footer}</div>}
      </div>
    </IonModal>
  );
}

export default Sheet;
