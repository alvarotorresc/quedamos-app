const FIRMA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Lee la cabecera IHDR y la lista de chunks de un PNG. */
export const leerPng = (buf) => {
  if (buf.length < 33 || !buf.subarray(0, 8).equals(FIRMA)) throw new Error('no es un PNG');
  const chunks = [];
  let o = 8;
  while (o + 8 <= buf.length) {
    const largo = buf.readUInt32BE(o);
    const tipo = buf.toString('latin1', o + 4, o + 8);
    chunks.push(tipo);
    o += 12 + largo;
    if (tipo === 'IEND') break;
  }
  return { ancho: buf.readUInt32BE(16), alto: buf.readUInt32BE(20), profundidad: buf[24], tipoColor: buf[25], chunks };
};

/** Devuelve la lista de problemas del PNG frente a la regla; vacía si cumple. `sinAlfa` exige RGB 24 bits sin tRNS. */
export const comprobarPng = (buf, { ancho, alto, sinAlfa = false }) => {
  let png;
  try {
    png = leerPng(buf);
  } catch (e) {
    return [e.message];
  }
  const errores = [];
  if (png.ancho !== ancho || png.alto !== alto) errores.push(`mide ${png.ancho}×${png.alto}, se esperaba ${ancho}×${alto}`);
  if (sinAlfa) {
    if (png.profundidad !== 8 || png.tipoColor !== 2) errores.push(`tipo de color ${png.tipoColor} a ${png.profundidad} bits, se esperaba RGB 24 bits sin alfa`);
    if (png.chunks.includes('tRNS')) errores.push('lleva un chunk tRNS (transparencia)');
  }
  return errores;
};
