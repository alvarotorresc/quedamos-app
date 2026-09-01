import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Logo } from '../../ui/Logo';

export const GITHUB_URL = 'https://github.com/alvarotorresc/quedamos-app';

/**
 * Flecha diagonal del CTA (↗), compartida por NavIsla, HeroPregunta y Cierre:
 * los tres repiten el mismo botón «Abrir Quedamos» del lienzo.
 */
export function CtaArrow({ size = 32 }: { size?: number }): JSX.Element {
  return (
    <span
      className="flex items-center justify-center rounded-pill shrink-0"
      // Tailwind can't slice an opacity modifier out of a CSS-var color (verified
      // against the built CSS: `bg-on-primary/16` generates no rule at all), so
      // the tint is inline via color-mix on the same --app-on-primary token. The
      // artboards use 16% in day and 12% in night for this bubble; one alpha
      // uniformly across both themes reads close enough not to special-case it.
      style={{
        width: size,
        height: size,
        backgroundColor: 'color-mix(in srgb, var(--app-on-primary) 16%, transparent)',
      }}
      aria-hidden="true"
    >
      <svg width={size * 0.4} height={size * 0.4} viewBox="0 0 14 14" fill="none">
        <path
          d="M 2 12 L 12 2 M 5 2 L 12 2 L 12 9"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/**
 * Nav isla flotante (spec lienzo, zona 1). El icono de marca del artboard es
 * en realidad un aro de 6 arcos on (no la C del logo: dasharray 9.46/91.08,
 * rotate -106.93... = aroArc(6, i, 16), no 71.72/556.60 de Logo). Desviación
 * consciente: se usa `Logo` (identidad canónica de Task 1, interfaz que esta
 * task consume explícitamente) en su lugar, junto al wordmark que le da el
 * nombre accesible; Logo ya es aria-hidden, así que no hace falta envolverlo.
 */
export function NavIsla(): JSX.Element {
  const { t } = useTranslation();
  return (
    <nav className="fixed top-7 inset-x-0 z-30 flex justify-center px-4">
      <div className="flex items-center gap-7 h-[60px] pl-6 pr-2.5 rounded-pill bg-bg-light border border-subtle">
        <div className="flex items-center gap-2.5">
          <Logo size={24} variant="color" />
          <span className="font-extrabold text-base tracking-tight text-text">
            {t('landing2.nav.brand')}
          </span>
        </div>
        <div
          className="w-px h-[22px]"
          style={{ backgroundColor: 'var(--app-border)' }}
          aria-hidden="true"
        />
        <span className="text-sm text-text-muted">{t('landing2.nav.codeOpen')}</span>
        <Link
          to="/login"
          className="flex items-center gap-2.5 h-11 pl-5 pr-1.5 rounded-pill bg-primary text-on-primary font-bold text-sm"
        >
          <span>{t('landing2.cta')}</span>
          <CtaArrow size={32} />
        </Link>
      </div>
    </nav>
  );
}
