import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Share } from 'lucide-react';
import './InstallPrompt.css';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Already running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }

    // Check if dismissed recently (7 day cooldown)
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    const ua = navigator.userAgent;
    const ios =
      (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;
    const isSafari = ios && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);

    if (isSafari) {
      setIsIOS(true);
      timerRef.current = setTimeout(() => setVisible(true), 4000);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      timerRef.current = setTimeout(() => setVisible(true), 4000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => { setVisible(false); setInstalled(true); });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setVisible(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (installed) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="install-prompt"
          role="dialog"
          aria-label="Install app"
          initial={{ opacity: 0, x: '-50%', y: 60, scale: 0.9, filter: 'blur(8px)' }}
          animate={{ opacity: 1, x: '-50%', y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, x: '-50%', y: 40, scale: 0.94, filter: 'blur(6px)' }}
          transition={{ type: 'spring', damping: 22, stiffness: 280, duration: 0.5 }}
        >
          {/* Glow ring */}
          <div className="install-prompt__glow" aria-hidden="true" />

          {/* App icon */}
          <div className="install-prompt__icon" aria-hidden="true">
            <span>🎵</span>
          </div>

          {/* Text */}
          <div className="install-prompt__body">
            <p className="install-prompt__title">Install Ambient</p>
            {isIOS ? (
              <p className="install-prompt__desc">
                Tap <Share size={12} className="install-prompt__inline-icon" /> then
                {' '}<strong>Add to Home Screen</strong>
              </p>
            ) : (
              <p className="install-prompt__desc">
                One-tap access, works offline
              </p>
            )}
          </div>

          {/* CTA or iOS indicator */}
          {!isIOS && (
            <button className="install-prompt__cta" onClick={handleInstall} aria-label="Install app">
              <Download size={14} />
              <span>Install</span>
            </button>
          )}

          {isIOS && (
            <div className="install-prompt__ios-badge" aria-hidden="true">
              <Share size={13} />
              <span>Share</span>
            </div>
          )}

          {/* Dismiss */}
          <button className="install-prompt__close" onClick={handleDismiss} aria-label="Dismiss install prompt">
            <X size={13} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
