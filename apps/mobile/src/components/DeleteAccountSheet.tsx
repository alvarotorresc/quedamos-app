import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { ApiError } from '../lib/api';

interface DeleteAccountSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Runs the deletion. A rejection is shown inside the sheet; on success the caller leaves the page. */
  onConfirm: () => Promise<void>;
}

const BULLETS = [
  'bulletProfile',
  'bulletSoloGroups',
  'bulletFoundedGroups',
  'bulletCreatedContent',
] as const;

/**
 * Última puerta antes de borrar la cuenta: explica qué se borra y qué pasa con los
 * grupos, y solo habilita el botón cuando el usuario escribe la palabra de
 * confirmación (localizada: ELIMINAR / DELETE).
 */
export function DeleteAccountSheet({ isOpen, onClose, onConfirm }: DeleteAccountSheetProps) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const word = t('profile.deleteAccount.confirmWord');
  const confirmed = typed.trim().toLocaleUpperCase() === word.toLocaleUpperCase();

  const handleClose = () => {
    setTyped('');
    setError('');
    onClose();
  };

  const handleConfirm = async () => {
    if (!confirmed || loading) return;
    setLoading(true);
    setError('');
    try {
      await onConfirm();
    } catch (err) {
      const unavailable = err instanceof ApiError && err.status === 503;
      setError(t(unavailable ? 'profile.deleteAccount.unavailable' : 'profile.deleteAccount.error'));
      setLoading(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={handleClose}
      title={t('profile.deleteAccount.title')}
      subtitle={t('profile.deleteAccount.subtitle')}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleClose} disabled={loading} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={!confirmed}
            loading={loading}
            className="flex-1"
          >
            {t('profile.deleteAccount.confirm')}
          </Button>
        </div>
      }
    >
      <p className="text-[13px] text-text mb-2">{t('profile.deleteAccount.intro')}</p>
      <ul className="flex flex-col gap-1.5 pl-4 mb-4 list-disc text-[13px] text-text-muted">
        {BULLETS.map((key) => (
          <li key={key}>{t(`profile.deleteAccount.${key}`)}</li>
        ))}
      </ul>
      <label htmlFor="delete-account-confirm" className="text-xs text-text-dark block mb-1.5">
        {t('profile.deleteAccount.typeToConfirm', { word })}
      </label>
      <input
        id="delete-account-confirm"
        type="text"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={word}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        className="w-full bg-bg-input border border-strong rounded-btn px-4 py-3 text-sm text-text placeholder-text-dark focus:border-primary"
      />
      {error && (
        <p role="alert" className="text-danger text-xs mt-2">
          {error}
        </p>
      )}
    </Sheet>
  );
}

export default DeleteAccountSheet;
