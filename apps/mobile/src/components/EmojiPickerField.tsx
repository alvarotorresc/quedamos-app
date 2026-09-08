import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

interface EmojiPickerFieldProps {
  value: string;
  onChange: (emoji: string) => void;
  /** Emoji que se enseña cuando aún no hay ninguno elegido. */
  placeholder?: string;
}

/**
 * Botón con el emoji elegido que despliega el picker de emoji-mart, con la misma
 * configuración y el mismo cierre al pulsar fuera que el formulario de crear
 * grupo. Nace para la hoja de editar grupo (B3); GroupPage sigue con el suyo
 * inline porque ese fichero es de otro lote y no toca reescribirlo aquí.
 */
export function EmojiPickerField({ value, onChange, placeholder = '👥' }: EmojiPickerFieldProps) {
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPicker]);

  return (
    <div className="relative">
      <label className="text-xs text-text-muted mb-1 block" htmlFor="emoji-picker-field">
        {t('group.emoji')}
      </label>
      <button
        id="emoji-picker-field"
        type="button"
        aria-label={t('group.emoji')}
        onClick={() => setShowPicker((v) => !v)}
        className="w-16 h-12 bg-bg-input border border-strong rounded-btn text-2xl flex items-center justify-center hover:border-primary transition-colors"
      >
        {value || placeholder}
      </button>
      {showPicker && (
        <div ref={pickerRef} className="absolute z-50 top-full mt-2 left-0">
          <Picker
            data={data}
            onEmojiSelect={(emojiData: { native: string }) => {
              onChange(emojiData.native);
              setShowPicker(false);
            }}
            theme="dark"
            previewPosition="none"
            skinTonePosition="search"
            maxFrequentRows={1}
          />
        </div>
      )}
    </div>
  );
}

export default EmojiPickerField;
