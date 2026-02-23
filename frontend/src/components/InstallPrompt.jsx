import { useState, useEffect } from 'react';
import { FiDownload } from 'react-icons/fi';
import useDraggable from '../hooks/useDraggable';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const { ref, style, handlers, hasMoved } = useDraggable({ x: null, y: null });

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setIsInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleClick = async () => {
    if (hasMoved.current) { hasMoved.current = false; return; } // Was a drag, not click
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') setIsInstalled(true);
      setDeferredPrompt(null);
    } else {
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
      alert(isIOS
        ? 'To install DairyPro:\n\n1. Tap the Share button (📤) at bottom\n2. Tap "Add to Home Screen"\n3. Tap "Add"'
        : 'To install DairyPro:\n\n1. Tap the ⋮ menu (top right)\n2. Tap "Install App" or "Add to Home Screen"');
    }
  };

  if (isInstalled) return null;

  return (
    <div
      ref={ref}
      {...handlers}
      onClick={handleClick}
      style={{ ...style, zIndex: 9998, touchAction: 'none', cursor: 'grab' }}
      className={`fixed bottom-6 left-6 flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-full shadow-lg hover:shadow-xl transition-colors active:cursor-grabbing select-none`}
    >
      <FiDownload size={16} />
      Install App
    </div>
  );
}
