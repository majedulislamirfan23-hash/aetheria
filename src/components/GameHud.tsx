import React, { useEffect, useRef, useState } from 'react';
import { BIOMES, CULTIVATION_REALMS, ELEMENTS, NPCS } from '../game/catalog';
import type { HudSnapshot } from '../game/engine';
import type {
  CharacterCustomization,
  Currencies,
  HudLayoutProfile,
  InventoryItem,
  PlayerVitals,
  SaveDataV1,
} from '../game/types';
import { LANDMARKS, WORLD_RADIUS } from '../game/worldMath';

interface GameHudProps {
  hud: HudSnapshot;
  character: CharacterCustomization;
  vitals: PlayerVitals;
  currencies: Currencies;
  inventory: (InventoryItem | null)[];
  equipped: SaveDataV1['equipped'];
  hotbarIndex: number;
  unreadMailCount: number;
  hudProfile: HudLayoutProfile;
  muted: boolean;
  buildActive: boolean;
  cameraMode: 'third_person' | 'free_orbit' | 'first_person';
  onAction: (
    action:
      | 'attack'
      | 'heavy'
      | 'offhand'
      | 'jump'
      | 'dodge'
      | 'skill1'
      | 'skill2'
      | 'skill3'
      | 'ultimate'
      | 'power'
      | 'interact'
      | 'meditate',
  ) => void;
  onUseHotbarSlot: (idx: number) => void;
  onSwapHands: () => void;
  onUpgradeNearbyBuilding: (buildingId: string) => void;
  onToggleMount: () => void;
  onCycleCameraMode: () => void;
  onMobileMove: (x: number, y: number) => void;
  onMobileCameraDrag: (dx: number, dy: number) => void;
  onOpenBag: () => void;
  onOpenCultivation: () => void;
  onOpenMap: () => void;
  onOpenVillage: () => void;
  onOpenShop: () => void;
  onOpenMailbox: () => void;
  onOpenSettings: () => void;
  onOpenOracle: () => void;
  onOpenBuilding: () => void;
  onToggleMute: () => void;
  onPause: () => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  character,
  vitals,
  currencies,
  inventory,
  equipped,
  hotbarIndex,
  unreadMailCount,
  hudProfile,
  muted,
  buildActive,
  cameraMode,
  onAction,
  onUseHotbarSlot,
  onSwapHands,
  onUpgradeNearbyBuilding,
  onToggleMount,
  onCycleCameraMode,
  onMobileMove,
  onMobileCameraDrag,
  onOpenBag,
  onOpenCultivation,
  onOpenMap,
  onOpenVillage,
  onOpenShop,
  onOpenMailbox,
  onOpenSettings,
  onOpenOracle,
  onOpenBuilding,
  onToggleMute,
  onPause,
}) => {
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const [ghostHp, setGhostHp] = useState(hud.hp);
  const [showTouchPad, setShowTouchPad] = useState(false);
  const joyOrigin = useRef<{ x: number; y: number } | null>(null);
  const camOrigin = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setShowTouchPad(isTouch);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setGhostHp(hud.hp), 220);
    return () => clearTimeout(t);
  }, [hud.hp]);

  // Draw live minimap projection
  useEffect(() => {
    const canvas = minimapRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 112;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, size, size);

    const toMap = (wx: number, wz: number) => {
      const scale = (size * 0.45) / WORLD_RADIUS;
      return {
        x: size / 2 + wx * scale,
        y: size / 2 + wz * scale,
      };
    };

    ctx.strokeStyle = 'rgba(232, 196, 104, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#e8c468';
    for (const lm of LANDMARKS) {
      const pt = toMap(lm.x, lm.z);
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
    }

    ctx.fillStyle = '#34d399';
    for (const npc of NPCS) {
      const pt = toMap(npc.x, npc.z);
      ctx.fillRect(pt.x - 1.5, pt.y - 1.5, 3, 3);
    }

    const p = toMap(hud.playerX, hud.playerZ);
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.sin(hud.playerYaw) * 8, p.y + Math.cos(hud.playerYaw) * 8);
    ctx.stroke();
  }, [hud.playerX, hud.playerZ, hud.playerYaw]);

  const realm = CULTIVATION_REALMS[vitals.cultivationRealm] ?? CULTIVATION_REALMS[0];
  const biomeMeta = BIOMES[hud.biome];
  const hpPct = Math.max(0, Math.min(100, (hud.hp / Math.max(1, hud.maxHp)) * 100));
  const ghostPct = Math.max(hpPct, Math.min(100, (ghostHp / Math.max(1, hud.maxHp)) * 100));
  const stamPct = Math.max(0, Math.min(100, (hud.stamina / Math.max(1, hud.maxStamina)) * 100));
  const manaPct = Math.max(0, Math.min(100, (hud.mana / Math.max(1, hud.maxMana)) * 100));

  const vitalsStyle = hudProfile.items.vitals;
  const minimapStyle = hudProfile.items.minimap;
  const skillsStyle = hudProfile.items.skills;

  const skillBar = vitals.activeSkillBar ?? [
    character.primaryElement,
    character.secondaryElement,
    vitals.unlockedElements[2] ?? character.primaryElement,
  ];
  const skill1 = ELEMENTS[skillBar[0] ?? character.primaryElement];
  const skill2 = ELEMENTS[skillBar[1] ?? character.secondaryElement];
  const skill3 = ELEMENTS[skillBar[2] ?? character.primaryElement];
  const hourStr = `${String(Math.floor(hud.timeOfDay)).padStart(2, '0')}:00`;
  const camBadge = cameraMode === 'first_person' ? '1st' : cameraMode === 'third_person' ? '3rd' : '360°';

  const inCriticalVignette = hpPct < 34 || hud.combatAudioMode === 'critical';
  const vignetteAlpha = inCriticalVignette
    ? 0.26 + Math.max(0, hud.criticalPulse ?? 0) * 0.44
    : 0;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none">
      {/* Beat-synchronized Critical Combat / Low-HP peripheral vignette */}
      {inCriticalVignette && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: `inset 0 0 110px rgba(220, 38, 38, ${vignetteAlpha.toFixed(2)})`,
          }}
        />
      )}

      {/* Projected 3D Autonomous NPC Overhead Speech Bubbles */}
      {hud.npcBubbles
        ?.filter((b) => b.y >= 145)
        .map((b) => (
          <div
            key={b.id}
            className="fixed pointer-events-none max-w-[165px] rounded-lg bg-[#080c16]/85 border border-[#38bdf8]/45 px-2.5 py-1 text-[10px] leading-tight text-slate-100 shadow-lg"
            style={{
              left: `${b.x}px`,
              top: `${b.y}px`,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="font-semibold text-[#e8c468] truncate">{b.name}</div>
            <div className="line-clamp-2 text-slate-200">{b.text}</div>
          </div>
        ))}

      {/* Floating 3D-projected damage popups */}
      {hud.popups.map((p) => (
        <div
          key={p.id}
          className="fixed pointer-events-none font-mono-num font-bold hud-text-stroke"
          style={{
            left: `${p.x}px`,
            top: `${p.y}px`,
            transform: 'translate(-50%, -50%)',
            color: p.label ? '#38bdf8' : p.isCrit ? '#fde047' : '#f8fafc',
            fontSize: p.isCrit ? '18px' : '14px',
          }}
        >
          {p.label ? p.label : p.isCrit ? `${p.amount}!` : p.amount}
        </div>
      ))}

      {/* TOP BAR CLUSTERS */}
      <div className="fixed top-2 sm:top-4 inset-x-2 sm:inset-x-4 flex items-start justify-between gap-2 pointer-events-none">
        {/* TOP-LEFT: Vitals, Survival & Active Dual-Hand/Elytra Readout */}
        <div
          className="pointer-events-auto bg-[#080c16]/90 border border-[#e8c468]/25 rounded-xl p-2 sm:p-3 w-[176px] sm:w-64 shadow-lg shrink-0"
          style={{
            transform: `scale(${vitalsStyle?.scale ?? 1})`,
            transformOrigin: 'top left',
            opacity: vitalsStyle?.opacity ?? 1,
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="truncate text-[11px] sm:text-xs">
              <span className="font-semibold text-slate-100">{character.name}</span>
              <span className="hidden sm:inline ml-1.5" style={{ color: realm.auraColor }}>
                · {realm.name}
              </span>
            </div>
            <span className="font-mono-num text-[10px] sm:text-[11px] font-bold text-[#e8c468] shrink-0 ml-1">
              Lv {vitals.level}
            </span>
          </div>

          <div className="relative h-2 sm:h-2.5 rounded-full bg-slate-900 overflow-hidden mb-1">
            <div
              className="absolute inset-y-0 left-0 bg-amber-300/70 transition-all duration-300"
              style={{ width: `${ghostPct}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-rose-500"
              style={{ width: `${hpPct}%` }}
            />
          </div>
          <div className="flex justify-between font-mono-num text-[9px] sm:text-[10px] text-slate-300 mb-1">
            <span>HP {hud.hp}/{hud.maxHp}</span>
            <span>Qi {hud.qi}/{hud.qiRequired}</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 mb-1.5">
            <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden">
              <div className="h-full bg-[#38bdf8]" style={{ width: `${manaPct}%` }} />
            </div>
            <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden">
              <div className="h-full bg-emerald-400" style={{ width: `${stamPct}%` }} />
            </div>
          </div>

          <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono-num text-slate-300 border-t border-slate-800 pt-1">
            <span>F {hud.hunger}%</span>
            <span>W {hud.thirst}%</span>
            <span className="hidden sm:inline">{hud.temperature}°C</span>
            <span className="text-[#e8c468]">{currencies.gold}g</span>
            <span className="hidden sm:inline text-violet-300">{currencies.aetherShards ?? 0}s</span>
          </div>

          {/* Active Power Buff & Battle State Badges */}
          {(hud.awakeningActive || hud.aegisActive || hud.combatAudioMode !== 'calm') && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {hud.combatAudioMode === 'critical' && (
                <span
                  className="px-1.5 py-0.5 rounded bg-rose-600/30 border border-rose-400 text-[9px] font-bold text-rose-200"
                  style={{ opacity: 0.72 + (hud.criticalPulse ?? 0) * 0.28 }}
                >
                  CRITICAL
                </span>
              )}
              {hud.combatAudioMode === 'combat' && (
                <span className="px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-400/50 text-[9px] font-bold text-sky-200">
                  COMBAT
                </span>
              )}
              {hud.awakeningActive && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-[9px] font-bold text-amber-300">
                  OMEGA AURA
                </span>
              )}
              {hud.aegisActive && (
                <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 border border-yellow-400/50 text-[9px] font-bold text-yellow-200">
                  AEGIS DOME
                </span>
              )}
            </div>
          )}

          <div className="hidden sm:flex items-center justify-between gap-1 mt-1.5 pt-1 border-t border-slate-800/80 text-[10px] text-slate-300">
            <span className="truncate max-w-[95px]">
              R: {equipped.weapon?.name.split(' ')[0] ?? 'Fists'}
            </span>
            <span className="truncate max-w-[95px] text-sky-300">
              L: {equipped.offHand?.name.split(' ')[0] ?? 'None'}
            </span>
            {hud.hasElytra && (
              <span className={`font-semibold ${hud.isGliding ? 'text-cyan-300' : 'text-slate-400'}`}>
                {hud.isGliding ? 'GLIDE' : 'Wing'}
              </span>
            )}
          </div>
        </div>

        {/* TOP-RIGHT: Minimap & Utility Nexus Buttons */}
        <div
          className="pointer-events-auto flex flex-col items-end gap-2 shrink-0"
          style={{
            transform: `scale(${minimapStyle?.scale ?? 1})`,
            transformOrigin: 'top right',
            opacity: minimapStyle?.opacity ?? 1,
          }}
        >
          <div className="bg-[#080c16]/90 border border-[#e8c468]/25 rounded-xl p-1.5 sm:p-2 flex items-center gap-2.5 shadow-lg">
            <canvas
              ref={minimapRef}
              width={112}
              height={112}
              className="rounded-lg border border-slate-700/70 w-24 h-24 hidden sm:block"
            />
            <div className="flex flex-col justify-between gap-1 sm:gap-1.5 min-w-[118px] sm:min-w-[138px]">
              <div>
                <div className="text-[11px] sm:text-xs font-semibold text-[#e8c468] truncate max-w-[136px]">
                  {biomeMeta.name}
                </div>
                <div className="font-mono-num text-[10px] sm:text-[11px] text-slate-400">
                  {hourStr} · {hud.weather}
                </div>
                {(hud.isMounted !== 'none' || hud.isGliding) && (
                  <div className="font-mono-num text-[10px] sm:text-[11px] text-[#38bdf8]">
                    {hud.isGliding ? 'Elytra ' : ''}{hud.speed} km/h
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Open Backpack"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenBag();
                  }}
                  className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-100 cursor-pointer"
                >
                  Bag
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Open Cultivation and Skills"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenCultivation();
                  }}
                  className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-[#38bdf8] cursor-pointer"
                >
                  {vitals.skillPoints > 0 ? `Qi+${vitals.skillPoints}` : 'Qi'}
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Open Shop"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenShop();
                  }}
                  className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-[#e8c468] cursor-pointer"
                >
                  Shop
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Open World Map"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenMap();
                  }}
                  className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200 cursor-pointer"
                >
                  Map
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Open Mailbox"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenMailbox();
                  }}
                  className={`px-1.5 py-1 rounded text-[10px] cursor-pointer ${
                    unreadMailCount > 0
                      ? 'bg-[#e8c468] text-[#07090f] font-bold'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  {unreadMailCount > 0 ? `Mail(${unreadMailCount})` : 'Mail'}
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Open Village AI and Farms"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenVillage();
                  }}
                  className="px-1.5 py-1 rounded bg-emerald-900/70 hover:bg-emerald-800 text-[10px] text-emerald-200 cursor-pointer"
                >
                  Town
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Toggle 360 Camera Mode"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onCycleCameraMode();
                  }}
                  className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-[#38bdf8] cursor-pointer"
                >
                  {camBadge}
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Open Settings"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenSettings();
                  }}
                  className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200 cursor-pointer"
                >
                  Gear
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Open Oracle"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenOracle();
                  }}
                  className="px-1.5 py-1 rounded bg-sky-900/70 hover:bg-sky-800 text-[10px] text-sky-200 cursor-pointer"
                >
                  Oracle
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onToggleMute();
                  }}
                  className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200 cursor-pointer"
                >
                  {muted ? 'Off' : 'Snd'}
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Pause Menu"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onPause();
                  }}
                  className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200 cursor-pointer"
                >
                  Menu
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TOP-CENTER: Conditional World Boss Health Bar */}
      {hud.lockedBoss && (
        <div
          className="fixed top-24 sm:top-4 left-1/2 -translate-x-1/2 bg-[#080c16]/92 border rounded-xl px-5 py-2.5 w-[min(420px,88vw)]"
          style={{
            borderColor:
              hud.combatAudioMode === 'critical'
                ? `rgba(244, 63, 94, ${(0.5 + (hud.criticalPulse ?? 0) * 0.48).toFixed(2)})`
                : 'rgba(244, 63, 94, 0.45)',
          }}
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-display font-bold text-rose-300">
              {hud.lockedBoss.name}
              {hud.combatAudioMode === 'critical' ? ' · CRITICAL CLASH' : ''}
            </span>
            <span className="font-mono-num text-slate-300">
              Phase {hud.lockedBoss.phase} · {Math.round(hud.lockedBoss.hp)}/{hud.lockedBoss.maxHp}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-950 overflow-hidden">
            <div
              className="h-full bg-rose-500 transition-all duration-150"
              style={{ width: `${(hud.lockedBoss.hp / hud.lockedBoss.maxHp) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* BOTTOM-CENTER: Contextual Prompts + 9-Slot Quick Hotbar + Combat & Skill Dock */}
      <div
        className="fixed bottom-3 left-1/2 -translate-x-1/2 pointer-events-auto flex flex-col items-center gap-1.5 max-w-[96vw]"
        style={{
          transform: `scale(${skillsStyle?.scale ?? 1})`,
          transformOrigin: 'bottom center',
          opacity: skillsStyle?.opacity ?? 1,
        }}
      >
        <div className="flex flex-wrap items-center justify-center gap-2">
          {hud.nearbyPrompt && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onAction('interact');
              }}
              className="px-4 py-1.5 rounded-lg bg-[#e8c468] text-[#07090f] font-bold text-xs shadow-lg cursor-pointer"
            >
              [E] {hud.nearbyPrompt.label}
            </button>
          )}
          {hud.nearbyBuilding && hud.nearbyBuilding.tier < 3 && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onUpgradeNearbyBuilding(hud.nearbyBuilding!.id);
              }}
              className="px-3.5 py-1.5 rounded-lg bg-sky-500 text-[#07090f] font-bold text-xs shadow-lg cursor-pointer"
            >
              [U] Upgrade Structure → Tier {hud.nearbyBuilding.tier + 1}
            </button>
          )}
        </div>

        {/* 9-Slot Quick Hotbar Strip (Desktop / Tablet) */}
        <div className="hidden sm:flex items-center gap-1 bg-[#080c16]/90 border border-slate-700/70 rounded-xl px-2 py-1 shadow-lg">
          {inventory.slice(0, 9).map((item, idx) => (
            <button
              key={idx}
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onUseHotbarSlot(idx);
              }}
              className={`w-14 h-10 rounded-lg border px-1 py-0.5 text-left flex flex-col justify-between cursor-pointer transition-colors ${
                hotbarIndex === idx
                  ? 'border-[#e8c468] bg-[#1b160d]'
                  : 'border-slate-800 bg-[#0b101d] hover:border-slate-600'
              }`}
              title={item ? `${item.name} (x${item.quantity})` : `Hotbar Slot ${idx + 1}`}
            >
              <div className="flex items-center justify-between text-[9px] font-mono-num">
                <span className="text-[#e8c468]">{idx + 1}</span>
                {item && <span className="text-slate-400">x{item.quantity}</span>}
              </div>
              <div className="text-[9px] text-slate-200 truncate">
                {item ? item.name.split(' ')[0] : '—'}
              </div>
            </button>
          ))}
        </div>

        {/* Combat & Skill Dock */}
        <div className="bg-[#080c16]/90 border border-[#e8c468]/25 rounded-xl px-1.5 sm:px-3 py-1 sm:py-1.5 flex flex-nowrap overflow-x-auto items-center justify-start sm:justify-center gap-1 sm:gap-1.5 shadow-xl w-max max-w-[calc(100vw-16px)]">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onAction('attack');
            }}
            className="px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-left cursor-pointer border border-slate-600/60 shrink-0"
          >
            <div className="text-[9px] sm:text-[10px] font-mono-num text-[#e8c468]">J</div>
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-100">Main</div>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onAction('offhand');
            }}
            className="px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-left cursor-pointer border border-sky-500/40 shrink-0"
          >
            <div className="text-[9px] sm:text-[10px] font-mono-num text-[#38bdf8]">G</div>
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-100">
              <span className="sm:hidden">Off</span>
              <span className="hidden sm:inline">Off-Hand</span>
            </div>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onSwapHands();
            }}
            className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-left cursor-pointer border border-slate-700 hidden md:block shrink-0"
          >
            <div className="text-[9px] font-mono-num text-slate-400">F</div>
            <div className="text-[10px] font-medium text-slate-200">Swap</div>
          </button>

          {[
            { key: '1', act: 'skill1' as const, el: skill1, cd: hud.cooldowns[0] },
            { key: '2', act: 'skill2' as const, el: skill2, cd: hud.cooldowns[1] },
            { key: '3', act: 'skill3' as const, el: skill3, cd: hud.cooldowns[2] },
          ].map((s) => (
            <button
              key={s.key}
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onAction(s.act);
              }}
              className="px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-[#0d1424] hover:bg-slate-800 text-left cursor-pointer border border-slate-700 min-w-[44px] sm:min-w-[70px] shrink-0"
            >
              <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono-num gap-0.5">
                <span style={{ color: s.el.color }}>[{s.key}]</span>
                <span className="text-slate-400">
                  {s.cd > 0 ? `${s.cd.toFixed(1)}s` : `${s.el.manaCost}m`}
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] font-medium text-slate-100 truncate max-w-[46px] sm:max-w-[74px]">
                {s.el.abilityName.split(' ')[0]}
              </div>
            </button>
          ))}

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onAction('ultimate');
            }}
            className="px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-violet-950/80 hover:bg-violet-900 text-left cursor-pointer border border-violet-500/40 shrink-0"
          >
            <div className="flex justify-between text-[9px] sm:text-[10px] font-mono-num text-violet-300 gap-1">
              <span>[4]</span>
              <span>{hud.cooldowns[3] > 0 ? `${hud.cooldowns[3].toFixed(1)}s` : '50m'}</span>
            </div>
            <div className="text-[10px] sm:text-[11px] font-semibold text-white">Omega</div>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onAction('power');
            }}
            className={`px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-left cursor-pointer border shrink-0 ${
              hud.awakeningActive
                ? 'bg-amber-600/90 border-amber-300 text-[#07090f]'
                : 'bg-amber-950/80 hover:bg-amber-900 border-amber-500/40 text-amber-200'
            }`}
          >
            <div className="text-[9px] sm:text-[10px] font-mono-num">[R]</div>
            <div className="text-[10px] sm:text-[11px] font-semibold">Power</div>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onAction('meditate');
            }}
            className={`px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-left cursor-pointer border shrink-0 ${
              hud.isMeditating
                ? 'bg-sky-700 border-sky-400 text-white'
                : 'bg-slate-800/80 border-slate-700 text-slate-200'
            }`}
          >
            <div className="text-[9px] sm:text-[10px] font-mono-num text-[#38bdf8]">[X]</div>
            <div className="text-[10px] sm:text-[11px] font-medium">Qi</div>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMount();
            }}
            className={`px-2 py-1.5 rounded-lg text-left cursor-pointer border hidden sm:block shrink-0 ${
              hud.isMounted !== 'none'
                ? 'bg-[#e8c468] border-[#e8c468] text-[#07090f]'
                : 'bg-slate-800/80 border-slate-700 text-slate-200'
            }`}
          >
            <div className="text-[9px] font-mono-num">[V]</div>
            <div className="text-[10px] font-medium">Mount</div>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenBuilding();
            }}
            className={`px-2 py-1.5 rounded-lg text-left cursor-pointer border hidden sm:block shrink-0 ${
              buildActive
                ? 'bg-emerald-600 border-emerald-400 text-white'
                : 'bg-slate-800/80 border-slate-700 text-slate-200'
            }`}
          >
            <div className="text-[9px] font-mono-num">[H]</div>
            <div className="text-[10px] font-medium">Build</div>
          </button>
        </div>
      </div>

      {/* MOBILE / TOUCH VIRTUAL CONTROLS */}
      {showTouchPad && (
        <>
          <div
            className="fixed bottom-20 left-4 w-24 h-24 rounded-full bg-slate-900/55 border border-slate-500/40 pointer-events-auto touch-none flex items-center justify-center"
            onTouchStart={(e) => {
              const t = e.touches[0];
              joyOrigin.current = { x: t.clientX, y: t.clientY };
            }}
            onTouchMove={(e) => {
              if (!joyOrigin.current) return;
              const t = e.touches[0];
              const dx = Math.max(-40, Math.min(40, t.clientX - joyOrigin.current.x));
              const dy = Math.max(-40, Math.min(40, t.clientY - joyOrigin.current.y));
              onMobileMove(dx / 40, dy / 40);
            }}
            onTouchEnd={() => {
              joyOrigin.current = null;
              onMobileMove(0, 0);
            }}
          >
            <div className="w-9 h-9 rounded-full bg-[#e8c468]/75" />
          </div>

          <div
            className="fixed bottom-20 right-4 pointer-events-auto flex flex-col gap-1.5 items-end"
            onTouchStart={(e) => {
              const t = e.touches[0];
              camOrigin.current = { x: t.clientX, y: t.clientY };
            }}
            onTouchMove={(e) => {
              if (!camOrigin.current) return;
              const t = e.touches[0];
              onMobileCameraDrag(t.clientX - camOrigin.current.x, t.clientY - camOrigin.current.y);
              camOrigin.current = { x: t.clientX, y: t.clientY };
            }}
            onTouchEnd={() => {
              camOrigin.current = null;
            }}
          >
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => onAction('dodge')}
                className="w-11 h-11 rounded-full bg-slate-800/85 border border-slate-500 text-[11px] font-bold text-slate-100"
              >
                Dash
              </button>
              <button
                type="button"
                onClick={() => onAction('jump')}
                className="w-11 h-11 rounded-full bg-slate-800/85 border border-slate-500 text-[11px] font-bold text-slate-100"
              >
                {hud.hasElytra ? 'Glide' : 'Jump'}
              </button>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => onAction('offhand')}
                className="w-12 h-12 rounded-full bg-sky-600 text-white text-[11px] font-bold shadow-lg"
              >
                Off
              </button>
              <button
                type="button"
                onClick={() => onAction('attack')}
                className="w-14 h-14 rounded-full bg-[#e8c468] text-[#07090f] text-xs font-extrabold shadow-lg"
              >
                Hit
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
