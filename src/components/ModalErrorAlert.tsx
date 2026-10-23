import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import { cleanErrorMessage } from '../utils/error-handler';

interface ModalErrorAlertProps {
  error: string | null;
  onDismiss?: () => void;
  className?: string;
  title?: string;
}

export const ModalErrorAlert: React.FC<ModalErrorAlertProps> = ({
  error,
  onDismiss,
  className = '',
  title = 'Aksi Gagal Diproses',
}) => {
  if (!error) return null;

  const displayMessage = cleanErrorMessage(error);

  return (
    <div
      role="alert"
      className={`rounded-xl border border-rose-200 bg-rose-50/95 p-3.5 flex items-start gap-3 text-xs text-rose-800 shadow-sm animate-in fade-in duration-200 ${className}`}
    >
      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
      <div className="flex-1 space-y-0.5">
        <span className="font-bold text-rose-900 block">{title}</span>
        <p className="text-rose-700 leading-relaxed font-medium">{displayMessage}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-rose-400 hover:text-rose-700 p-0.5 rounded-md hover:bg-rose-100 transition-colors"
          title="Tutup pesan error"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
