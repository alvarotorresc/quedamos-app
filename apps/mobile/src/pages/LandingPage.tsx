import { useScreenView } from '../hooks/useAnalytics';
import { NavIsla } from '../components/landing2/NavIsla';
import { HeroPregunta } from '../components/landing2/HeroPregunta';
import { BandaAro } from '../components/landing2/BandaAro';
import { Pantallas } from '../components/landing2/Pantallas';
import { Cuadrilla } from '../components/landing2/Cuadrilla';
import { Proceso } from '../components/landing2/Proceso';
import { Renuncias } from '../components/landing2/Renuncias';
import { Cierre } from '../components/landing2/Cierre';

/**
 * The App.tsx desktop+guest gate (App.tsx:113-121, out of scope here) still
 * calls this component with onLogin/onRegister history-push callbacks. The
 * new landing (lienzo v4) repeats a single CTA ("Abrir Quedamos" -> /login)
 * inside every section via <Link>, so neither callback is used anymore —
 * the props stay only to keep that call site typed.
 */
interface LandingPageProps {
  onLogin: () => void;
  onRegister: () => void;
}

export default function LandingPage(_props: LandingPageProps): JSX.Element {
  useScreenView('Landing');

  return (
    // Ionic's core CSS pins <body> (position: fixed; height: 100%; overflow:
    // hidden) globally, even on this route (App.tsx renders LandingPage
    // outside IonApp, but that stylesheet still applies to body). This div is
    // therefore the actual scroll container — NavIsla stays viewport-anchored
    // either way since nothing in the tree has a transform.
    <div className="h-screen overflow-y-auto overflow-x-hidden bg-bg text-text">
      <NavIsla />
      <HeroPregunta />
      <BandaAro />
      <Pantallas />
      <Cuadrilla />
      <Proceso />
      <Renuncias />
      <Cierre />
    </div>
  );
}
