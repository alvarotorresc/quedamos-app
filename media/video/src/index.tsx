import React from 'react';
import { Composition, Still, registerRoot } from 'remotion';
import { QuedamosPromo, cargarTaps, type VideoProps } from './QuedamosPromo';
import { FeatureGraphic, Promo } from './stills';
import { ALTO, ANCHO, DURACION_TOTAL, FPS } from './timing';

// Las cajas de los toques salen de public/rodaje/taps.json, que se lee una vez antes del render.
const conTaps = async ({ props }: { props: VideoProps }) => ({ props: { ...props, taps: await cargarTaps() } });

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="QuedamosPromo-es" component={QuedamosPromo} durationInFrames={DURACION_TOTAL} fps={FPS} width={ANCHO} height={ALTO} defaultProps={{ lang: 'es' } satisfies VideoProps} calculateMetadata={conTaps} />
    <Composition id="QuedamosPromo-en" component={QuedamosPromo} durationInFrames={DURACION_TOTAL} fps={FPS} width={ANCHO} height={ALTO} defaultProps={{ lang: 'en' } satisfies VideoProps} calculateMetadata={conTaps} />
    <Still id="Promo" component={Promo} width={1920} height={1080} defaultProps={{ lang: 'es' as const }} />
    <Still id="FeatureGraphic" component={FeatureGraphic} width={1024} height={500} defaultProps={{ lang: 'es' as const }} />
  </>
);

registerRoot(RemotionRoot);
