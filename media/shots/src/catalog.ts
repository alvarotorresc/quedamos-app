import type { PngSize } from './guards.ts';

export type Theme = 'dark' | 'light';
export type Lang = 'es' | 'en';
export type Device = 'mobile' | 'desktop';
export type Scene = 'calendar' | 'ask' | 'proposals' | 'plans' | 'group' | 'profile';

export const LANGS: readonly Lang[] = ['es', 'en'];

export interface Viewport {
  width: number;
  height: number;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
}

export const VIEWPORTS: Record<Device, Viewport> = {
  mobile: { width: 360, height: 780, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  desktop: { width: 1600, height: 1000, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
};

export const SIZES: Record<Device, PngSize> = {
  mobile: { width: 1080, height: 2340 },
  desktop: { width: 1600, height: 1000 },
};

export const ICON_SIZE: PngSize = { width: 1024, height: 1024 };

type Texts = Record<Lang, string>;

interface BaseShot {
  key: string;
  scene: Scene;
  device: Device;
  theme: Theme;
  /** También va a media/out/video-src/ (siempre en oscuro). */
  video: boolean;
  alt: Texts;
  caption: Texts;
}

const BASE_SHOTS: readonly BaseShot[] = [
  {
    key: 'cover', scene: 'calendar', device: 'desktop', theme: 'dark', video: false,
    alt: {
      es: 'Calendario semanal de Quedamos con la disponibilidad de un grupo de cinco amigos',
      en: "Quedamos weekly calendar showing a five-friend group's availability",
    },
    caption: { es: 'Todo el grupo en un calendario.', en: 'The whole group on one calendar.' },
  },
  {
    key: 'cover-mobile', scene: 'calendar', device: 'mobile', theme: 'dark', video: false,
    alt: {
      es: 'Calendario de Quedamos en el móvil con la semana del grupo',
      en: "Quedamos calendar on a phone showing the group's week",
    },
    caption: { es: 'Todo el grupo en un calendario.', en: 'The whole group on one calendar.' },
  },
  {
    key: 'shot-01-calendario', scene: 'calendar', device: 'mobile', theme: 'dark', video: true,
    alt: {
      es: 'Semana del grupo con la disponibilidad de cada miembro en su color',
      en: "The group's week with each member's availability in their own colour",
    },
    caption: { es: 'Cada uno marca cuándo puede.', en: "Everyone marks when they're free." },
  },
  {
    key: 'shot-02-proponer', scene: 'ask', device: 'mobile', theme: 'light', video: true,
    alt: {
      es: 'Hoja para preguntar al grupo por un día y una franja',
      en: 'Sheet for asking the group about a day and a time slot',
    },
    caption: { es: 'Propón un día al grupo.', en: 'Suggest a day to the group.' },
  },
  {
    key: 'shot-03-respuestas', scene: 'proposals', device: 'mobile', theme: 'dark', video: true,
    alt: {
      es: 'Propuestas del grupo con quién ha dicho que sí y quién que no',
      en: 'Group proposals showing who said yes and who said no',
    },
    caption: { es: 'Las respuestas, a la vista.', en: 'Every answer at a glance.' },
  },
  {
    key: 'shot-04-quedada', scene: 'plans', device: 'mobile', theme: 'light', video: true,
    alt: {
      es: 'Lista de quedadas con la próxima ya fijada y sus asistentes',
      en: "Plans list with the next plan set and who's going",
    },
    caption: { es: 'La quedada, fijada.', en: 'The plan, locked in.' },
  },
  {
    key: 'shot-05-grupo', scene: 'group', device: 'mobile', theme: 'dark', video: true,
    alt: {
      es: 'Pantalla del grupo con sus cinco miembros alrededor del aro',
      en: 'Group screen with its five members around the ring',
    },
    caption: { es: 'El aro del grupo.', en: "The group's ring." },
  },
  {
    key: 'shot-06-perfil', scene: 'profile', device: 'mobile', theme: 'light', video: true,
    alt: {
      es: 'Perfil con idioma, tema y notificaciones',
      en: 'Profile with language, theme and notifications',
    },
    caption: { es: 'Idioma, tema y avisos.', en: 'Language, theme and alerts.' },
  },
];

const ICON_LABEL = {
  alt: {
    es: 'Logo de Quedamos: un aro de colores con un hueco y un punto',
    en: 'Quedamos logo: a coloured ring with a gap and a dot',
  },
  caption: { es: 'Quedamos', en: 'Quedamos' },
};

export interface Shot {
  /** Lo que acepta --only, p. ej. «web/shot-02-proponer-es» o «video-src/shot-01-calendario-en». */
  id: string;
  key: string;
  scene: Scene;
  device: Device;
  theme: Theme;
  lang: Lang;
  /** Relativo a media/out. */
  out: string;
  size: PngSize;
}

export function buildCatalog(): Shot[] {
  const shots: Shot[] = [];
  for (const base of BASE_SHOTS) {
    for (const lang of LANGS) {
      shots.push({
        id: `web/${base.key}-${lang}`,
        key: base.key,
        scene: base.scene,
        device: base.device,
        theme: base.theme,
        lang,
        out: `web/${base.key}-${lang}.png`,
        size: SIZES[base.device],
      });
    }
  }
  for (const base of BASE_SHOTS.filter((b) => b.video)) {
    for (const lang of LANGS) {
      shots.push({
        id: `video-src/${base.key}-${lang}`,
        key: base.key,
        scene: base.scene,
        device: 'mobile',
        theme: 'dark',
        lang,
        out: `video-src/${base.key}-${lang}.png`,
        size: SIZES.mobile,
      });
    }
  }
  return shots;
}

export function selectShots(catalog: Shot[], only: string | null): Shot[] {
  if (only === null) return catalog;
  const picked = catalog.filter((s) => s.id === only);
  if (picked.length === 0) {
    throw new Error(`--only «${only}» no existe. Ids válidos:\nicon\n${catalog.map((s) => s.id).join('\n')}`);
  }
  return picked;
}

export interface Label {
  files: Texts;
  alt: Texts;
  caption: Texts;
}

export function buildLabels(): Record<string, Label> {
  const labels: Record<string, Label> = {};
  for (const base of BASE_SHOTS) {
    labels[base.key] = {
      files: { es: `${base.key}-es.png`, en: `${base.key}-en.png` },
      alt: base.alt,
      caption: base.caption,
    };
  }
  labels.icon = { files: { es: 'icon.png', en: 'icon.png' }, ...ICON_LABEL };
  return labels;
}
