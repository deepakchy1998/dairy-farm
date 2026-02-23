import { useState, useEffect } from 'react';
import { FiDownload } from 'react-icons/fi';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Capture the install prompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Detect if app gets installed
    window.addEventListener('appinstalled', () => setIsInstalled(true));

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      // Native install (Chrome/Edge/Android)
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') setIsInstalled(true);
      setDeferredPrompt(null);
    } else {
      // Manual instructions for Safari/Firefox
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
      if (isIOS) {
        alert('To install DairyPro:\n\n1. Tap the Share button (📤) at bottom\n2. Scroll down\n3. Tap "Add to Home Screen"\n4. Tap "Add"');
      } else {
        alert('To install DairyPro:\n\n1. Tap the ⋮ menu (top right)\n2. Tap "Install App" or "Add to Home Screen"');
      }
    }
  };

  // Hide if installed
  if (isInstalled) return null;

  return (
    <button
      onClick={handleInstall}
      className="fixed bottom-6 left-6 z-50 flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-full shadow-lg hover:shadow-xl transition-all active:scale-95"
    >
      <FiDownload size={16} />
      Install App
    </button>
  );
}
