import { describe, it, expect, vi } from 'vitest';
import { runWithErrorToast } from './mutation-utils';

describe('runWithErrorToast', () => {
  it('calls onSuccess with the result and never onError when the action resolves', async () => {
    const onError = vi.fn();
    const onSuccess = vi.fn();

    await runWithErrorToast(() => Promise.resolve('ok'), onError, { onSuccess });

    expect(onSuccess).toHaveBeenCalledWith('ok');
    expect(onError).not.toHaveBeenCalled();
  });

  it('calls onError with the provided errorKey and never onSuccess when the action rejects', async () => {
    const onError = vi.fn();
    const onSuccess = vi.fn();

    await runWithErrorToast(() => Promise.reject(new Error('boom')), onError, {
      onSuccess,
      errorKey: 'errors.createEventFailed',
    });

    expect(onError).toHaveBeenCalledWith('errors.createEventFailed');
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('falls back to errors.generic when no errorKey is given', async () => {
    const onError = vi.fn();

    await runWithErrorToast(() => Promise.reject(new Error('x')), onError);

    expect(onError).toHaveBeenCalledWith('errors.generic');
  });

  it('does not reject even when the action returns a rejected promise', async () => {
    await expect(
      runWithErrorToast(() => Promise.reject(new Error('x')), vi.fn()),
    ).resolves.toBeUndefined();
  });

  it('does not reject and calls onError with errors.generic even when the action throws synchronously', async () => {
    const onError = vi.fn();
    const throwingAction = (): Promise<string> => {
      throw new Error('x');
    };

    await expect(runWithErrorToast(throwingAction, onError)).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith('errors.generic');
  });
});
