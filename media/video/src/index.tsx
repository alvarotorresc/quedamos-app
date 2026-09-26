import React from 'react';
import { Composition, Still, registerRoot } from 'remotion';
import { QuedamosPromo } from './QuedamosPromo';
import { FeatureGraphic, Promo } from './stills';
import { ALTO, ANCHO, DURACION_TOTAL, FPS } from './timing';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="QuedamosPromo-es" component={QuedamosPromo} durationInFrames={DURACION_TOTAL} fps={FPS} width={ANCHO} height={ALTO} defaultProps={{ lang: 'es' as const }} />
    <Composition id="QuedamosPromo-en" component={QuedamosPromo} durationInFrames={DURACION_TOTAL} fps={FPS} width={ANCHO} height={ALTO} defaultProps={{ lang: 'en' as const }} />
    <Still id="Promo" component={Promo} width={1920} height={1080} defaultProps={{ lang: 'es' as const }} />
    <Still id="FeatureGraphic" component={FeatureGraphic} width={1024} height={500} defaultProps={{ lang: 'es' as const }} />
  </>
);

registerRoot(RemotionRoot);
