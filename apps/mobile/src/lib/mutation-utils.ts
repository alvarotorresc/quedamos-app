/**
 * Runs an async mutation and routes failures to a toast instead of an
 * unhandled promise rejection. Never rethrows: callers stay declarative.
 */
export async function runWithErrorToast<T>(
  action: () => Promise<T>,
  onError: (messageKey: string) => void,
  options?: { onSuccess?: (result: T) => void; errorKey?: string },
): Promise<void> {
  try {
    const result = await action();
    options?.onSuccess?.(result);
  } catch {
    onError(options?.errorKey ?? 'errors.generic');
  }
}
