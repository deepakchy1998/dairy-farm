import { FiAlertTriangle, FiX } from 'react-icons/fi';

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title = 'Are you sure?', message = 'This action cannot be undone.', confirmText = 'Confirm', cancelText = 'Cancel', variant = 'danger' }) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: { btn: 'bg-red-600 hover:bg-red-700', icon: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
    warning: { btn: 'bg-orange-600 hover:bg-orange-700', icon: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    info: { btn: 'bg-blue-600 hover:bg-blue-700', icon: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  };
  const style = variantStyles[variant] || variantStyles.danger;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <FiX size={18} />
        </button>
        <div className={`w-12 h-12 rounded-full ${style.bg} flex items-center justify-center mb-4 mx-auto`}>
          <FiAlertTriangle className={style.icon} size={24} />
        </div>
        <h3 className="text-lg font-bold text-center text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition">
            {cancelText}
          </button>
          <button onClick={() => { onConfirm(); onClose(); }} className={`flex-1 py-2.5 px-4 rounded-xl text-white font-medium text-sm transition ${style.btn}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
