// Rótulos del guion: docs/superpowers/specs/2026-09-26-video-flujo-design.md.
export const es = {
  'intro.golpe1': 'Tu grupo quiere verse.',
  'intro.golpe2': 'Nadie sabe cuándo.',
  'escenario.marta': 'organiza',
  'escenario.hugo': 'del grupo',
  'calendario.rotulo': 'Todos marcan cuándo pueden',
  'proponer.rotulo': 'Marta propone el viernes',
  'responder.aviso': 'Nueva quedada',
  'responder.rotulo': 'A todos les llega. Un toque para responder',
  'respuestas.leo': 'Leo · No voy',
  'respuestas.rotulo': 'Se ve quién va y quién no',
  'fijada.rotulo': 'Y queda fijada',
  'cierre.plataformas': 'Android y web',
} as const;

export type CopyKey = keyof typeof es;
