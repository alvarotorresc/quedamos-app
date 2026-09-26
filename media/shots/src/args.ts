export interface CliArgs {
  only: string | null;
}

const ONLY_HELP = '--only necesita un id (p. ej. web/shot-02-proponer-es o icon)';

export function parseArgs(argv: string[]): CliArgs {
  let only: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (arg === '--only') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(ONLY_HELP);
      only = value;
      i++;
    } else if (arg.startsWith('--only=')) {
      const value = arg.slice('--only='.length);
      if (value === '') throw new Error(ONLY_HELP);
      only = value;
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }
  return { only };
}
