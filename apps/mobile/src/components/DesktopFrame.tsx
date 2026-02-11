import type { ReactNode } from 'react';
import logo from '../assets/logo.svg';

interface DesktopFrameProps {
  children: ReactNode;
}

export default function DesktopFrame({ children }: DesktopFrameProps) {
  return (
    <div className="desktop-frame-root">
      {/* Branding — only visible on wide desktop (≥1024px via CSS) */}
      <div className="desktop-frame-branding">
        <img src={logo} alt="¿Quedamos?" className="w-14 h-14 mb-4" />
        <h1 className="text-3xl font-extrabold tracking-tight text-text">
          ¿Quedamos?
        </h1>
        <p className="text-text-muted text-sm mt-2 max-w-[220px] leading-relaxed">
          El momento perfecto para quedar con tu grupo.
        </p>
      </div>

      {/* Phone frame — on mobile these wrappers are invisible (display:contents) */}
      <div className="desktop-frame-phone">
        <div className="desktop-frame-screen">
          {children}
        </div>
      </div>
    </div>
  );
}
