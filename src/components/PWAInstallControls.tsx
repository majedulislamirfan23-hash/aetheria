import React, { useState } from 'react';
import { Download, MonitorSmartphone, WifiOff } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{
  compact?: boolean;
  onFeedback?: (msg: string) => void;
}> = ({ compact = false, onFeedback }) => {
  const { canInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  const handleClick = async () => {
    if (canInstall) {
      const ok = await promptInstall();
      onFeedback?.(ok ? 'Aetheria installed as an app!' : 'App install cancelled.');
    } else if (isInstalled) {
      onFeedback?.('Aetheria is already running as an installed app.');
    } else {
      setShowGuide((v) => !v);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        className={`flex items-center justify-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-950/70 hover:bg-sky-900/80 text-sky-200 font-medium transition-colors cursor-pointer ${
          compact ? 'px-3 py-2 text-xs w-full' : 'px-3.5 py-2.5 text-xs w-full'
        }`}
      >
        <MonitorSmartphone className="w-3.5 h-3.5 shrink-0" />
        <span>{isInstalled ? 'App Installed' : canInstall ? 'Install App (PWA)' : 'Install App'}</span>
      </button>

      {showGuide && !isInstalled && (
        <div className="mt-2 rounded-lg bg-[#0b101d] border border-sky-500/40 p-2.5 text-[11px] text-slate-300 text-left">
          {isIOS ? (
            <span>
              In Safari, tap <strong>Share</strong> then <strong>Add to Home Screen</strong> to install Aetheria.
            </span>
          ) : (
            <span>
              Use your browser&apos;s address bar <strong>Install App</strong> icon (or menu → Install Aetheria) to install for offline launch.
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export const DownloadHtml5Button: React.FC<{
  compact?: boolean;
  onFeedback?: (msg: string) => void;
}> = ({ compact = false, onFeedback }) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    onFeedback?.('Preparing standalone HTML5 bundle...');
    try {
      const res = await fetch('/api/download/html5');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Aetheria-Project-Omega-HTML5.html';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onFeedback?.('Downloaded Aetheria-Project-Omega-HTML5.html!');
    } catch {
      onFeedback?.('HTML5 export unavailable offline — connect to server to generate the bundle.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      type="button"
      disabled={downloading}
      onClick={handleDownload}
      className={`flex items-center justify-center gap-1.5 rounded-lg border border-[#e8c468]/45 bg-[#1b160d] hover:bg-[#2a2112] text-[#e8c468] font-medium transition-colors cursor-pointer disabled:opacity-60 ${
        compact ? 'px-3 py-2 text-xs w-full' : 'px-3.5 py-2.5 text-xs w-full'
      }`}
    >
      <Download className="w-3.5 h-3.5 shrink-0" />
      <span>{downloading ? 'Bundling HTML5...' : 'Download HTML5 (.html)'}</span>
    </button>
  );
};

export const OfflineIndicator: React.FC = () => {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg bg-amber-950/95 border border-amber-500/60 px-3.5 py-1.5 text-[11px] font-medium text-amber-200 shadow-lg pointer-events-none">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline Mode — Local Save & 3D World Active</span>
    </div>
  );
};
