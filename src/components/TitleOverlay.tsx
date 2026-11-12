import React from 'react';
import type { GameState } from '../game/types';
import { DownloadHtml5Button, PWAInstallButton } from './PWAInstallControls';

interface TitleOverlayProps {
  gameState: GameState;
  hasExistingSave: boolean;
  playerName: string;
  realmName: string;
  level: number;
  killCount: number;
  bossesDefeated: number;
  isVictory: boolean;
  onStartGame: () => void;
  onOpenStudio: () => void;
  onOpenSettings: () => void;
  onResume: () => void;
  onReturnTitle: () => void;
  onRestartRun: () => void;
  onNotify?: (msg: string) => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  gameState,
  hasExistingSave,
  playerName,
  realmName,
  level,
  killCount,
  bossesDefeated,
  isVictory,
  onStartGame,
  onOpenStudio,
  onOpenSettings,
  onResume,
  onReturnTitle,
  onRestartRun,
  onNotify,
}) => {
  if (gameState === 'title') {
    return (
      <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-6 md:p-12">
        {/* Left-third asymmetric composition over calm dark gradient scrim */}
        <div className="max-w-lg my-auto pointer-events-auto bg-[#07090f]/82 border border-[#e8c468]/25 p-6 md:p-9 rounded-xl shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <svg viewBox="0 0 64 64" className="w-12 h-12 shrink-0" aria-hidden="true">
              <circle cx="32" cy="32" r="28" fill="#0b101d" stroke="#e8c468" strokeWidth="2.5" />
              <path
                d="M32 10 L46 32 L32 54 L18 32 Z"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.5"
              />
              <circle cx="32" cy="32" r="7" fill="#e8c468" />
              <path d="M16 42 Q32 22 48 42" fill="none" stroke="#e8c468" strokeWidth="2" />
            </svg>
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-bold tracking-wider text-[#f8fafc] leading-tight">
                AETHERIA
              </h1>
              <p className="text-xs tracking-[0.28em] uppercase text-[#e8c468] font-semibold">
                Project Omega
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed mb-5">
            Five fractured realms await. Forge your lineage, glide with Aether Elytra wings, wield dual-handed gear, build upgradeable sanctuaries, and confront the Tombguard Colossi.
          </p>

          {hasExistingSave && (
            <div className="mb-4 pb-3.5 border-b border-slate-700/60 flex items-center gap-3 text-xs text-slate-300">
              <span className="font-semibold text-[#38bdf8]">{playerName}</span>
              <span aria-hidden="true">·</span>
              <span>{realmName}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">Lv {level}</span>
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              data-start="true"
              onClick={onStartGame}
              className="w-full py-3.5 px-6 rounded-lg bg-[#e8c468] hover:bg-[#f3d482] text-[#07090f] font-bold text-sm tracking-wide transition-colors cursor-pointer"
            >
              {hasExistingSave ? 'Enter World' : 'Begin Journey'}
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onOpenStudio}
                className="py-2.5 px-4 rounded-lg bg-[#111827] hover:bg-[#1e293b] border border-slate-700 text-slate-100 text-sm font-medium transition-colors cursor-pointer"
              >
                Character Studio
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="py-2.5 px-4 rounded-lg bg-[#111827] hover:bg-[#1e293b] border border-slate-700 text-slate-100 text-sm font-medium transition-colors cursor-pointer"
              >
                Graphics & Settings
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <PWAInstallButton compact onFeedback={onNotify} />
              <DownloadHtml5Button compact onFeedback={onNotify} />
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-slate-300/90 tracking-wide hud-text-stroke hidden sm:block">
          WASD Move · Space Jump/Elytra Glide · Click Attack · G Off-Hand · F Swap Hands · 1-4 Skills · I Bag · H Build · Esc Pause
        </div>
      </div>
    );
  }

  if (gameState === 'paused') {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-4">
        <div className="celestial-panel rounded-xl w-full max-w-md p-7 text-center">
          <h2 className="font-display text-2xl font-bold text-[#e8c468] mb-2">Journey Paused</h2>
          <p className="text-xs text-slate-400 mb-6">
            {playerName} · {realmName} · Level {level}
          </p>
          <div className="grid grid-cols-3 gap-3 mb-6 text-left">
            <div className="celestial-surface rounded-lg p-3">
              <div className="text-[11px] text-slate-400">Level</div>
              <div className="font-mono-num text-lg font-bold text-slate-100">{level}</div>
            </div>
            <div className="celestial-surface rounded-lg p-3">
              <div className="text-[11px] text-slate-400">Foes Felled</div>
              <div className="font-mono-num text-lg font-bold text-[#38bdf8]">{killCount}</div>
            </div>
            <div className="celestial-surface rounded-lg p-3">
              <div className="text-[11px] text-slate-400">Colossi</div>
              <div className="font-mono-num text-lg font-bold text-[#e8c468]">{bossesDefeated}/5</div>
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onResume}
              className="w-full py-3 rounded-lg bg-[#e8c468] hover:bg-[#f3d482] text-[#07090f] font-bold text-sm cursor-pointer"
            >
              Resume World
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="w-full py-2.5 rounded-lg bg-[#111827] hover:bg-[#1e293b] border border-slate-700 text-slate-100 text-sm cursor-pointer"
            >
              Graphics, Settings & Controls
            </button>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <PWAInstallButton compact onFeedback={onNotify} />
              <DownloadHtml5Button compact onFeedback={onNotify} />
            </div>
            <button
              type="button"
              onClick={onReturnTitle}
              className="w-full py-2.5 rounded-lg bg-[#111827] hover:bg-[#1e293b] border border-slate-700 text-slate-300 text-sm cursor-pointer"
            >
              Return to Title
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'gameover') {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
        <div className="celestial-panel rounded-xl w-full max-w-md p-7 text-center">
          <h2 className={`font-display text-3xl font-bold mb-2 ${isVictory ? 'text-[#e8c468]' : 'text-rose-400'}`}>
            {isVictory ? 'Colossus Vanquished' : 'Vessel Shattered'}
          </h2>
          <p className="text-sm text-slate-300 mb-6">
            {isVictory
              ? 'Your cultivation resonance shattered the Abyssal guardian. Your legend grows across Aetheria.'
              : 'Your spirit retreats to the Verdant Sanctum Shrine to recover.'}
          </p>
          <div className="grid grid-cols-3 gap-3 mb-6 text-left">
            <div className="celestial-surface rounded-lg p-3">
              <div className="text-[11px] text-slate-400">Realm</div>
              <div className="text-xs font-semibold text-slate-100 truncate">{realmName}</div>
            </div>
            <div className="celestial-surface rounded-lg p-3">
              <div className="text-[11px] text-slate-400">Enemies</div>
              <div className="font-mono-num text-lg font-bold text-[#38bdf8]">{killCount}</div>
            </div>
            <div className="celestial-surface rounded-lg p-3">
              <div className="text-[11px] text-slate-400">Bosses</div>
              <div className="font-mono-num text-lg font-bold text-[#e8c468]">{bossesDefeated}/5</div>
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              data-start="true"
              onClick={onRestartRun}
              className="w-full py-3 rounded-lg bg-[#e8c468] hover:bg-[#f3d482] text-[#07090f] font-bold text-sm cursor-pointer"
            >
              {isVictory ? 'Continue Exploring' : 'Revive at Sanctum'}
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="w-full py-2.5 rounded-lg bg-[#111827] hover:bg-[#1e293b] border border-slate-700 text-slate-300 text-sm cursor-pointer"
            >
              Return to Title
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
