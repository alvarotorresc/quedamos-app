import { useIonToast } from '@ionic/react';
import { useTranslation } from 'react-i18next';

export function useToast() {
  const [present] = useIonToast();
  const { t } = useTranslation();

  const showError = (messageKey: string) => {
    present({
      message: t(messageKey),
      duration: 3000,
      position: 'top',
      color: 'danger',
    });
  };

  const showSuccess = (messageKey: string) => {
    present({
      message: t(messageKey),
      duration: 3000,
      position: 'top',
      color: 'success',
    });
  };

  // Neutral — for messages that are neither an error nor a success confirmation (e.g. "your
  // poll stayed silent today" or "that question isn't pending anymore").
  const showInfo = (messageKey: string) => {
    present({
      message: t(messageKey),
      duration: 3000,
      position: 'top',
      color: 'medium',
    });
  };

  return { showError, showSuccess, showInfo };
}
