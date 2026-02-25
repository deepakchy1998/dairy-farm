import { useState, useEffect } from 'react';
import { FiWifiOff } from 'react-icons/fi';

export default function NetworkStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => { setOnline(true); setTimeout(() => setShowBanner(false), 3000); };
    const handleOffline = () => { setOnline(false); setShowBanner(true); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!online) setShowBanner(true);
  }, [online]);

  if (!showBanner) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-[100] text-center py-2 text-sm font-medium transition-all duration-300 ${
      online
        ? 'bg-emerald-500 text-white'
        : 'bg-red-500 text-white'
    }`}>
      {online ? (
        '✅ Back online!'
      ) : (
        <span className="flex items-center justify-center gap-2">
          <FiWifiOff size={16} />
          You're offline. Some features may not work.
        </span>
      )}
    </div>
  );
}
