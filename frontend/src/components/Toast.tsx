import React from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export function ToastContainer() {
  const { toasts, removeToast } = useAppStore();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto animate-slide-up flex items-start gap-3 bg-navy-800 border border-navy-600 rounded-xl px-4 py-3 shadow-2xl max-w-sm min-w-64"
        >
          <span className="mt-0.5 shrink-0">
            {toast.type === 'success' && <CheckCircle size={16} className="text-green-edge" />}
            {toast.type === 'error' && <XCircle size={16} className="text-red-edge" />}
            {toast.type === 'info' && <Info size={16} className="text-blue-400" />}
            {toast.type === 'warning' && <AlertTriangle size={16} className="text-amber-edge" />}
          </span>
          <span className="text-sm text-gray-200 flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 text-gray-600 hover:text-gray-300 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
