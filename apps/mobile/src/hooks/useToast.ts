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

  return { showError };
}
