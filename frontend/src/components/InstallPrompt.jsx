import { useState, useEffect } from 'react';
import { FiDownload, FiX, FiSmartphone } from 'react-icons/fi';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed recently
    const lastDismissed = localStorage.getItem('pwa_install_dismissed');
    if (lastDismissed && Date.now() - parseInt(lastDismissed) < 7 * 86400000) return; // 7 days

    // Listen for the install prompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show after a delay so it doesn't interrupt
      setTimeout(() => setShowPrompt(true), 10000); // 10 seconds after page load
    };
    window.addEventListener('beforeinstallprompt', handler);

    // If no native prompt after 15s and not standalone, show manual instructions
    const timer = setTimeout(() => {
      if (!deferredPrompt && !window.matchMedia('(display-mode: standalone)').matches) {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) setShowManual(true);
      }
    }, 15000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    setShowPrompt(false);
    setShowManual(false);
    setDismissed(true);
    localStorage.setItem('pwa_install_dismissed', Date.now().toString());
  };

  // Don't show if already in standalone mode
  if (window.matchMedia('(display-mode: standalone)').matches) return null;
  if (dismissed) return null;

  // Native install prompt (Chrome/Edge/Android)
  if (showPrompt && deferredPrompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-50 animate-slideUp">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl shrink-0">
              <FiSmartphone className="text-emerald-600" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">Install DairyPro App</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Get quick access from your home screen. Works offline too!
              </p>
              <div className="flex gap-2 mt-3">
                <button onClick={handleInstall} className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5">
                  <FiDownload size={14} /> Install
                </button>
                <button onClick={dismiss} className="text-xs text-gray-400 hover:text-gray-600 px-2">
                  Not now
                </button>
              </div>
            </div>
            <button onClick={dismiss} className="text-gray-300 hover:text-gray-500 shrink-0">
              <FiX size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Manual install instructions (iOS Safari / unsupported browsers)
  if (showManual) {
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    return (
      <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-50 animate-slideUp">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl shrink-0">
              <FiSmartphone className="text-blue-600" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">Install DairyPro</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {isIOS ? (
                  <>Tap the <strong>Share</strong> button (📤) then <strong>"Add to Home Screen"</strong></>
                ) : (
                  <>Tap your browser <strong>⋮ menu</strong> → <strong>"Add to Home Screen"</strong> or <strong>"Install App"</strong></>
                )}
              </p>
            </div>
            <button onClick={dismiss} className="text-gray-300 hover:text-gray-500 shrink-0">
              <FiX size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
