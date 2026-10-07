import { useState } from 'react';
import { Download, X, Share, PlusSquare, Smartphone, Check, Sparkles } from 'lucide-react';
import { usePwa } from '../context/PwaContext';

export const InstallPwaBanner = () => {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    showInstallModal,
    setShowInstallModal,
    promptInstall,
  } = usePwa();

  const [isBannerDismissed, setIsBannerDismissed] = useState(() => {
    return sessionStorage.getItem('pixelthread_pwa_banner_dismissed') === 'true';
  });

  const handleDismissBanner = () => {
    setIsBannerDismissed(true);
    sessionStorage.setItem('pixelthread_pwa_banner_dismissed', 'true');
  };

  // If app is already running in standalone/installed mode, don't show prompt banner
  if (isInstalled) return null;

  return (
    <>
      {/* 1. Floating Banner (Shown if installable and not dismissed) */}
      {!isBannerDismissed && (
        <div
          className="pwa-floating-banner"
          style={{
            position: 'fixed',
            bottom: '76px',
            right: '1.25rem',
            zIndex: 8900,
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '0.85rem 1.15rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            boxShadow: 'var(--shadow-md)',
            maxWidth: '360px',
            animation: 'slideUp 0.3s ease-out',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(136, 111, 71, 0.25)',
            }}
          >
            <Download size={18} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Download PixelThread
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
              Add to Home Screen for fast mobile access
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
            <button
              type="button"
              onClick={promptInstall}
              className="btn btn-sm"
              style={{
                fontSize: '0.76rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '9999px',
                fontWeight: 650,
              }}
            >
              Install
            </button>
            <button
              type="button"
              onClick={handleDismissBanner}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
              }}
              title="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* 2. Interactive Install & Add to Home Screen Modal Guide */}
      {showInstallModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowInstallModal(false)}
          style={{ zIndex: 10000 }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '440px',
              width: '100%',
              padding: '1.75rem',
              borderRadius: '20px',
              position: 'relative',
              textAlign: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => setShowInstallModal(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={20} />
            </button>

            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '16px',
                backgroundColor: 'var(--accent-glow)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
                margin: '0 auto 1rem',
              }}
            >
              <Smartphone size={28} />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 750, margin: '0 0 0.35rem 0' }}>
              Install PixelThread
            </h3>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: '0 0 1.5rem 0', lineHeight: 1.5 }}>
              Install the app directly on your phone or desktop for an ultra-fast, full-screen native experience.
            </p>

            {isIOS ? (
              /* iOS Step-by-Step Instructions */
              <div
                style={{
                  textAlign: 'left',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '14px',
                  padding: '1rem 1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  marginBottom: '1.25rem',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-card)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      color: 'var(--accent-primary)',
                      flexShrink: 0,
                    }}
                  >
                    1
                  </div>
                  <div>
                    Tap the <strong>Share</strong> button <Share size={14} style={{ verticalAlign: 'middle', margin: '0 2px' }} /> at the bottom of Safari.
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-card)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      color: 'var(--accent-primary)',
                      flexShrink: 0,
                    }}
                  >
                    2
                  </div>
                  <div>
                    Scroll down and select <strong>Add to Home Screen</strong> <PlusSquare size={14} style={{ verticalAlign: 'middle', margin: '0 2px' }} />.
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-card)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      color: 'var(--accent-primary)',
                      flexShrink: 0,
                    }}
                  >
                    3
                  </div>
                  <div>
                    Tap <strong>Add</strong> in the top-right corner to finish.
                  </div>
                </div>
              </div>
            ) : (
              /* Android / Chrome / Edge Action */
              <div style={{ marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  onClick={promptInstall}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <Download size={18} /> Add to Home Screen
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowInstallModal(false)}
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', borderRadius: '12px' }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};
