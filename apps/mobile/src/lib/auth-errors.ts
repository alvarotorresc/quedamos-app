const ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': 'Email o contraseña incorrectos',
  'Email not confirmed': 'Debes confirmar tu email antes de iniciar sesión',
  'User already registered': 'Este email ya está registrado',
  'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres',
  'Unable to validate email address: invalid format': 'El formato del email no es válido',
  'Signup requires a valid password': 'Debes introducir una contraseña',
  'To signup, please provide your email': 'Debes introducir un email',
  'User not found': 'No se encontró ninguna cuenta con ese email',
  'For security purposes, you can only request this once every 60 seconds': 'Por seguridad, solo puedes hacer esto una vez cada 60 segundos',
  'Email rate limit exceeded': 'Demasiados intentos. Espera unos minutos',
};

export function translateAuthError(error: unknown): string {
  if (!(error instanceof Error)) return 'Ha ocurrido un error inesperado';
  const msg = error.message;
  return ERROR_MAP[msg] ?? msg;
}
