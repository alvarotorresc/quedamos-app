import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Loyalty Freak Music, «Go to the Picnic» (álbum POSITIVE ATTITUDE), dedicación CC0 1.0: dominio
// público, sin atribución obligatoria. Distinta artista y pista que la música de Bito (Komiku).
// Ficha: https://archive.org/details/LoyaltyFreakMusicPOSITIVEATTITUDE20170920175908839
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = join(raiz, 'public', 'audio', 'musica.mp3');
const ITEM = 'LoyaltyFreakMusicPOSITIVEATTITUDE20170920175908839';
const ARCHIVO = 'Loyalty_Freak_Music_-_01_-_Go_to_the_Picnic.mp3';
const SHA1 = '58e1e027c8eaf1836de044e7c8578163a5f0dd9e';
const CC0 = 'http://creativecommons.org/publicdomain/zero/1.0/';

const sha1 = (buf) => createHash('sha1').update(buf).digest('hex');

const yaEsta = async () => {
  try {
    return sha1(await readFile(DESTINO)) === SHA1;
  } catch {
    return false;
  }
};

if (await yaEsta()) {
  process.stdout.write('música lista (sha1 correcto, sin red)\n');
  process.exit(0);
}

const r = await fetch(`https://archive.org/metadata/${ITEM}`);
if (!r.ok) throw new Error(`archive.org respondió ${r.status} al pedir los metadatos de ${ITEM}; hace falta red la primera vez`);
const meta = await r.json();
if (meta.metadata?.licenseurl !== CC0) throw new Error(`Licencia inesperada en ${ITEM}: ${meta.metadata?.licenseurl}`);

let bajada = null;
for (const nodo of [meta.d1, meta.d2, meta.server].filter(Boolean)) {
  const f = await fetch(`https://${nodo}${meta.dir}/${encodeURIComponent(ARCHIVO)}`);
  if (f.ok) {
    bajada = Buffer.from(await f.arrayBuffer());
    break;
  }
}
if (!bajada) throw new Error(`Ningún nodo de archive.org sirvió ${ARCHIVO}`);
if (sha1(bajada) !== SHA1) throw new Error(`sha1 distinto en ${ARCHIVO}: ${sha1(bajada)}`);
await mkdir(dirname(DESTINO), { recursive: true });
await writeFile(DESTINO, bajada);
process.stdout.write(`música descargada y verificada: ${ARCHIVO} (CC0, sha1 ${SHA1})\n`);
