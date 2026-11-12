import React, { useEffect, useRef, useState } from 'react';
import {
  BIOMES,
  BUILDING_PIECES,
  BUILDING_UPGRADE_COSTS,
  ELEMENTS,
  ITEM_TEMPLATES,
  MOUNTS_CATALOG,
  NPCS,
  PETS_CATALOG,
  SHOP_OFFERS,
  VENDOR_META,
} from '../game/catalog';
import type { HudSnapshot } from '../game/engine';
import { CROP_META } from '../game/npcSimulation';
import {
  calculateAerodynamicLift,
  calculateKineticMomentumBonus,
  countTemplateInInventory,
  evaluateElementalReaction,
  evaluateLandLogicRules,
  getBiomeBiologyProfile,
  getTerrainTraction,
} from '../game/rules';
import type {
  BuildingPieceKind,
  CharacterCustomization,
  Currencies,
  GameSettings,
  GraphicsPreset,
  HudLayoutProfile,
  InventoryItem,
  LivingWorldState,
  MailMessage,
  MountVehicleType,
  PetType,
  PlacedBuilding,
  PlayerVitals,
  VendorRole,
} from '../game/types';
import { LANDMARKS, sampleTerrainCalculus } from '../game/worldMath';
import { DownloadHtml5Button, PWAInstallButton } from './PWAInstallControls';

export type WorldHubTab =
  | 'map'
  | 'village'
  | 'mounts'
  | 'building'
  | 'shop'
  | 'science'
  | 'mailbox'
  | 'social'
  | 'hud'
  | 'settings';

interface LeaderboardRow {
  id: string;
  name: string;
  realm: string;
  level: number;
  bossesDefeated: number;
}

interface WorldSystemsModalProps {
  initialTab: WorldHubTab;
  initialVendor?: VendorRole | 'all';
  currencies: Currencies;
  inventory: (InventoryItem | null)[];
  mailbox: MailMessage[];
  discoveredRegions: string[];
  activeMount: MountVehicleType;
  activePet: PetType;
  petLevel: number;
  selectedBuildKind: BuildingPieceKind | null;
  buildings: PlacedBuilding[];
  settings: GameSettings;
  hudProfiles: HudLayoutProfile[];
  activeHudProfileIndex: number;
  dailyRewardDay: number;
  canClaimDaily: boolean;
  playerName: string;
  realmName: string;
  level: number;
  bossesDefeated: number;
  fortuneRank?: number;
  livingWorld: LivingWorldState;
  hud?: HudSnapshot;
  character?: CharacterCustomization;
  vitals?: PlayerVitals;
  onFastTravel: (x: number, z: number, skyY?: number) => void;
  onSelectMount: (m: MountVehicleType) => void;
  onSelectPet: (p: PetType) => void;
  onEvolvePet: () => void;
  onSelectBuildKind: (kind: BuildingPieceKind | null) => void;
  onRotateBuild: () => void;
  onUpgradeBuilding: (buildingId: string) => void;
  onDemolishBuilding: (buildingId: string) => void;
  onBuyOffer: (offerId: string, qty?: number) => void;
  onSellItem: (slotIdx: number) => void;
  onInteractFarm: (plotId: string) => void;
  onSparkNpcConversation: () => void;
  onBuyNpcListing: (listingId: string) => void;
  onCommissionCraft: (vendor: VendorRole) => void;
  onExchangeCurrency: (from: keyof Currencies, to: keyof Currencies, amount: number) => void;
  onOpenNpcChat?: (npcId: string, npcName: string, npcRole: string) => void;
  onClaimDaily: () => void;
  onMarkMailRead: (mailId: string) => void;
  onClaimMail: (mailId: string) => void;
  onClaimAllMail: () => void;
  onDeleteReadMail: () => void;
  onUpdateSettings: (next: GameSettings) => void;
  onUpdateHudProfile: (profile: HudLayoutProfile) => void;
  onResetHudLayout: () => void;
  onManualSave: () => void;
  onExportSaveJson: () => void;
  onImportSaveJson: (raw: string) => void;
  onResetSave: () => void;
  onNotify?: (msg: string) => void;
  onClose: () => void;
}

export const WorldSystemsModal: React.FC<WorldSystemsModalProps> = ({
  initialTab,
  initialVendor = 'all',
  currencies,
  inventory,
  mailbox,
  discoveredRegions,
  activeMount,
  activePet,
  petLevel,
  selectedBuildKind,
  buildings,
  settings,
  hudProfiles,
  activeHudProfileIndex,
  dailyRewardDay,
  canClaimDaily,
  playerName,
  realmName,
  level,
  bossesDefeated,
  fortuneRank = 0,
  livingWorld,
  hud,
  character,
  vitals,
  onFastTravel,
  onSelectMount,
  onSelectPet,
  onEvolvePet,
  onSelectBuildKind,
  onRotateBuild,
  onUpgradeBuilding,
  onDemolishBuilding,
  onBuyOffer,
  onSellItem,
  onInteractFarm,
  onSparkNpcConversation,
  onBuyNpcListing,
  onCommissionCraft,
  onExchangeCurrency,
  onOpenNpcChat,
  onClaimDaily,
  onMarkMailRead,
  onClaimMail,
  onClaimAllMail,
  onDeleteReadMail,
  onUpdateSettings,
  onUpdateHudProfile,
  onResetHudLayout,
  onManualSave,
  onExportSaveJson,
  onImportSaveJson,
  onResetSave,
  onNotify,
  onClose,
}) => {
  const [tab, setTab] = useState<WorldHubTab>(initialTab);
  const [vendorFilter, setVendorFilter] = useState<VendorRole | 'all'>(initialVendor);
  const [exFrom, setExFrom] = useState<keyof Currencies>('gold');
  const [exTo, setExTo] = useState<keyof Currencies>('diamonds');
  const [exAmt, setExAmt] = useState(50);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [chatLog, setChatLog] = useState<string[]>([
    '[System] Local World Server Prototype connected.',
    '[Scholar Orin] Remember to watch Wezaemon’s red telegraph rings in the Abyssal Frontier.',
  ]);
  const [socialInput, setSocialInput] = useState('');
  const [guildName, setGuildName] = useState('Astral Vanguard');
  const [guildJoined, setGuildJoined] = useState(true);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setVendorFilter(initialVendor);
  }, [initialVendor]);

  useEffect(() => {
    if (tab !== 'social') return;
    fetch('/api/social/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'local_player',
        name: playerName,
        realm: realmName,
        level,
        bossesDefeated,
      }),
    })
      .then(() => fetch('/api/social/state'))
      .then((r) => r.json())
      .then((d: { leaderboard?: LeaderboardRow[] }) => {
        if (d.leaderboard) setLeaderboard(d.leaderboard);
      })
      .catch(() => {});
  }, [tab, playerName, realmName, level, bossesDefeated]);

  const activeProfile = hudProfiles[activeHudProfileIndex] ?? hudProfiles[0];
  const unreadMailCount = mailbox.filter((m) => !m.read || (!m.claimed && m.rewards)).length;
  const stoneCount = countTemplateInInventory(inventory, 'stone');

  const filteredOffers =
    vendorFilter === 'all'
      ? SHOP_OFFERS
      : SHOP_OFFERS.filter((o) => o.vendor === vendorFilter);

  const applyPreset = (preset: GraphicsPreset) => {
    const patch: Partial<GameSettings> = { graphicsPreset: preset };
    if (preset === 'low') {
      patch.shadowsEnabled = false;
      patch.resolutionScale = 0.75;
      patch.viewDistance = 110;
      patch.fpsTarget = 30;
    } else if (preset === 'medium') {
      patch.shadowsEnabled = true;
      patch.resolutionScale = 0.85;
      patch.viewDistance = 135;
      patch.fpsTarget = 60;
    } else if (preset === 'high') {
      patch.shadowsEnabled = true;
      patch.resolutionScale = 1.0;
      patch.viewDistance = 160;
      patch.fpsTarget = 60;
    } else {
      patch.shadowsEnabled = true;
      patch.resolutionScale = 1.0;
      patch.viewDistance = 200;
      patch.fpsTarget = 120;
    }
    onUpdateSettings({ ...settings, ...patch });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3 sm:p-4">
      <div className="celestial-panel rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-5 py-3.5 border-b border-slate-700/60">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#e8c468]">
            Aetheria Command Nexus
          </h2>
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#0b101d] border border-slate-700/60">
            {(
              [
                ['map', 'World Map'],
                ['village', 'Village AI'],
                ['mounts', 'Mounts'],
                ['building', 'Housing'],
                ['shop', 'Marketplace'],
                ['science', 'Land & Sciences'],
                ['mailbox', unreadMailCount > 0 ? `Mail (${unreadMailCount})` : 'Mail'],
                ['social', 'Social'],
                ['hud', 'HUD'],
                ['settings', 'Settings'],
              ] as [WorldHubTab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap cursor-pointer ${
                  tab === id ? 'bg-[#e8c468] text-[#07090f]' : 'text-slate-300 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {tab === 'map' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="celestial-surface rounded-xl p-5 flex flex-col justify-between">
                <h3 className="font-semibold text-sm text-[#38bdf8] mb-3">
                  Five Interconnected Realms ({discoveredRegions.length}/5 Discovered)
                </h3>
                <div className="space-y-2.5">
                  {Object.values(BIOMES).map((b) => {
                    const disc = discoveredRegions.includes(b.id);
                    return (
                      <div key={b.id} className="p-3 rounded-lg bg-[#090d16] border border-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-slate-100">{b.name}</span>
                          <span className="text-xs text-slate-400">
                            {disc ? 'Explored' : 'Uncharted'} · {b.ambientTemp}°C
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{b.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="celestial-surface rounded-xl p-5 space-y-3">
                <h3 className="font-semibold text-sm text-[#e8c468]">Waystone Fast Travel</h3>
                <p className="text-xs text-slate-400">
                  Channel astral teleportation to any major landmark across Aetheria.
                </p>
                <div className="space-y-2.5">
                  {LANDMARKS.map((lm) => (
                    <div
                      key={lm.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-[#090d16] border border-slate-800"
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-100">{lm.name}</div>
                        <div className="text-xs text-slate-400">
                          {BIOMES[lm.biome].name} · ({lm.x}, {lm.z})
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onFastTravel(lm.x, lm.z, lm.biome === 'celestial' ? 15.2 : undefined);
                          onClose();
                        }}
                        className="px-4 py-1.5 rounded bg-[#38bdf8] hover:bg-sky-300 text-[#07090f] text-xs font-bold cursor-pointer"
                      >
                        Warp
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'village' && (
            <div className="space-y-5">
              {/* Village AI Reserves & Live Controls */}
              <div className="celestial-surface rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-sm text-[#e8c468]">
                    Autonomous Verdant Town AI & Homestead Farms
                  </h3>
                  <p className="text-xs text-slate-400">
                    NPCs independently farm crops, forage food, build town structures, forge Masterwork gear, stock the Marketplace, and converse with each other.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono-num">
                  <span className="px-2.5 py-1 rounded bg-[#090d16] border border-emerald-500/30 text-emerald-300">
                    Food Supply: {Math.round(livingWorld.villageFoodSupply)}
                  </span>
                  <span className="px-2.5 py-1 rounded bg-[#090d16] border border-sky-500/30 text-sky-300">
                    Ore Stock: {Math.round(livingWorld.villageOreSupply)}
                  </span>
                  <span className="px-2.5 py-1 rounded bg-[#090d16] border border-amber-500/30 text-amber-300">
                    Town Builds: {livingWorld.npcBuildings.length}
                  </span>
                  <button
                    type="button"
                    onClick={onSparkNpcConversation}
                    className="px-3.5 py-1.5 rounded-lg bg-[#38bdf8] hover:bg-sky-300 text-[#07090f] font-bold cursor-pointer font-sans"
                  >
                    Spark NPC Conversation
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Left: Autonomous Villagers */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-300">
                    Autonomous Town Citizens ({NPCS.filter((n) => n.biome === 'verdant').length})
                  </h4>
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {NPCS.filter((n) => n.biome === 'verdant').map((npc) => {
                      const ag = livingWorld.npcAgents[npc.id];
                      const taskLabel = ag?.task?.replace('_', ' ') ?? 'patrolling';
                      return (
                        <div
                          key={npc.id}
                          className="celestial-surface rounded-lg p-3 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <span className="font-semibold text-slate-100">{npc.name}</span>
                              <span className="text-[#38bdf8] ml-1.5">· {npc.role}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-[#e8c468] capitalize text-[10px]">
                                {taskLabel}
                              </span>
                              {onOpenNpcChat && (
                                <button
                                  type="button"
                                  onClick={() => onOpenNpcChat(npc.id, npc.name, npc.role)}
                                  className="px-2 py-0.5 rounded bg-sky-700 hover:bg-sky-600 text-white text-[10px] font-bold cursor-pointer"
                                >
                                  AI Chat
                                </button>
                              )}
                            </div>
                          </div>
                          {ag?.speechBubble && (
                            <div className="text-[11px] text-slate-300 italic bg-[#090d16] rounded px-2.5 py-1.5 border border-slate-800">
                              “{ag.speechBubble}”
                            </div>
                          )}
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono-num">
                            <span>Task Progress: {Math.round(ag?.progress ?? 0)}%</span>
                            <span>Crafted: {ag?.craftCount ?? 0} · Rations: {ag?.foodHeld ?? 2}</span>
                          </div>
                          <div className="h-1 rounded-full bg-slate-900 overflow-hidden">
                            <div
                              className="h-full bg-[#38bdf8]"
                              style={{ width: `${Math.min(100, ag?.progress ?? 0)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Live NPC-to-NPC Chatter + Interactive Farmstead Plots */}
                <div className="space-y-4">
                  <div className="celestial-surface rounded-lg p-3.5 space-y-2">
                    <h4 className="font-semibold text-xs uppercase tracking-wider text-[#38bdf8]">
                      Live NPC-to-NPC Conversation Feed
                    </h4>
                    <div className="h-36 overflow-y-auto space-y-1.5 pr-1 text-xs">
                      {livingWorld.chatterLog.map((c) => (
                        <div key={c.id} className="rounded bg-[#090d16] border border-slate-800 px-2.5 py-1.5">
                          <span className="font-semibold text-[#e8c468]">{c.speakerName}</span>
                          {c.partnerName && (
                            <span className="text-slate-400"> → {c.partnerName}</span>
                          )}
                          <span className="text-slate-300">: {c.line}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="celestial-surface rounded-lg p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-xs uppercase tracking-wider text-emerald-300">
                        Verdant Homestead Farm Plots (Or walk close & press [E])
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {livingWorld.farms.map((plot, idx) => {
                        const meta = plot.crop ? CROP_META[plot.crop] : null;
                        const btnLabel = !plot.crop
                          ? 'Plant Crop'
                          : plot.stage === 3
                          ? 'Harvest!'
                          : 'Water Crops';
                        return (
                          <div
                            key={plot.id}
                            className="rounded-lg bg-[#090d16] border border-slate-800 p-2.5 flex flex-col gap-2 text-xs"
                          >
                            <div>
                              <div className="font-semibold text-slate-100">
                                Plot #{idx + 1}: {meta ? meta.name : 'Fallow Soil'}
                              </div>
                              <div className="font-mono-num text-[10px] text-slate-400">
                                {plot.crop
                                  ? `Growth ${Math.round(plot.growthProgress)}% · Water ${Math.round(plot.water)}%`
                                  : 'Ready for seeds'}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => onInteractFarm(plot.id)}
                              className={`w-full px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                                plot.stage === 3
                                  ? 'bg-[#e8c468] text-[#07090f]'
                                  : 'bg-emerald-700 hover:bg-emerald-600 text-white'
                              }`}
                            >
                              {btnLabel}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'mounts' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-sm text-[#e8c468] mb-3">
                  Mounts, Flying Swords & Vehicles (Press V to Toggle)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {MOUNTS_CATALOG.map((m) => {
                    const active = activeMount === m.id;
                    return (
                      <div
                        key={m.id}
                        className={`celestial-surface rounded-lg p-4 flex flex-col justify-between gap-3 ${
                          active ? 'border-[#e8c468]' : ''
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm text-slate-100">{m.name}</span>
                            <span className="font-mono-num text-xs text-[#38bdf8]">{m.speedMult}x</span>
                          </div>
                          <div className="text-[11px] text-[#e8c468] mt-0.5">
                            {m.kind} {m.canFly ? '· Flight Capable' : ''}
                          </div>
                          <p className="text-xs text-slate-400 mt-2">{m.desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelectMount(m.id)}
                          className={`py-2 rounded text-xs font-bold cursor-pointer ${
                            active
                              ? 'bg-[#e8c468] text-[#07090f]'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                          }`}
                        >
                          {active ? 'Equipped' : 'Summon'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-700/60 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm text-[#38bdf8]">
                    Companion Pets (Evolution Lv {petLevel})
                  </h3>
                  <button
                    type="button"
                    onClick={onEvolvePet}
                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                  >
                    Evolve Pet (120 Gold)
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {PETS_CATALOG.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onSelectPet(p.id)}
                      className={`celestial-surface rounded-lg p-3.5 text-left cursor-pointer ${
                        activePet === p.id ? 'border-[#38bdf8]' : ''
                      }`}
                    >
                      <div className="font-semibold text-sm text-slate-100">{p.name}</div>
                      <div className="text-xs text-slate-400 mt-1">{p.bonus}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'building' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 celestial-surface rounded-lg p-4">
                <div>
                  <div className="text-sm font-semibold text-slate-100">
                    Free-Placement House Builder & Sanctuary Architect ({buildings.length} Built)
                  </div>
                  <div className="text-xs text-slate-400">
                    Pick any piece, close this window, aim anywhere in 3D, and Left-Click to place (Q rotates, U upgrades nearby structure).
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onRotateBuild}
                    className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
                  >
                    Rotate Piece [Q]
                  </button>
                  {selectedBuildKind && (
                    <button
                      type="button"
                      onClick={() => onSelectBuildKind(null)}
                      className="px-3 py-1.5 rounded bg-rose-900/70 text-xs text-rose-200 cursor-pointer"
                    >
                      Exit Build Mode
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {BUILDING_PIECES.map((bp) => {
                  const active = selectedBuildKind === bp.kind;
                  return (
                    <div
                      key={bp.kind}
                      className={`celestial-surface rounded-lg p-3.5 flex items-center justify-between gap-3 ${
                        active ? 'border-[#e8c468]' : ''
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-sm text-slate-100">{bp.name}</div>
                        <div className="text-xs text-slate-400">{bp.desc}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectBuildKind(active ? null : bp.kind);
                          if (!active) onClose();
                        }}
                        className={`px-3.5 py-2 rounded text-xs font-bold cursor-pointer ${
                          active ? 'bg-[#e8c468] text-[#07090f]' : 'bg-slate-800 text-slate-200'
                        }`}
                      >
                        {active ? 'Active' : 'Build'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Placed Structures Tier Upgrade Manager */}
              <div className="border-t border-slate-700/60 pt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm text-[#38bdf8]">
                    Placed Structures & Tier Upgrades (Tier I → Tier II → Tier III)
                  </h3>
                  <span className="font-mono-num text-xs text-slate-400">
                    Bag: {currencies.gold} Gold · {stoneCount} Stone
                  </span>
                </div>
                {buildings.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No structures placed yet. Choose a wall, floor, doorway, window, or roof above to start building anywhere in the world!
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {buildings.map((b, i) => {
                      const tier = (b.tier ?? 1) as 1 | 2 | 3;
                      const meta = BUILDING_PIECES.find((p) => p.kind === b.kind);
                      const cost =
                        tier === 1 || tier === 2 ? BUILDING_UPGRADE_COSTS[tier] : null;
                      const canUpgrade =
                        cost !== null && currencies.gold >= cost.gold && stoneCount >= cost.stone;
                      return (
                        <div
                          key={b.id}
                          className="celestial-surface rounded-lg p-3 flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="font-semibold text-slate-100">
                              #{i + 1} {meta?.name ?? b.kind}{' '}
                              <span className="text-[#e8c468]">· Tier {tier === 1 ? 'I' : tier === 2 ? 'II' : 'III'}</span>
                            </div>
                            <div className="font-mono-num text-[11px] text-slate-400">
                              ({Math.round(b.x)}, {Math.round(b.z)})
                              {cost ? ` · Next: ${cost.gold}g + ${cost.stone} Stone` : ' · Max Celestial Tier'}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {cost && (
                              <button
                                type="button"
                                disabled={!canUpgrade}
                                onClick={() => onUpgradeBuilding(b.id)}
                                className={`px-3 py-1.5 rounded font-bold cursor-pointer ${
                                  canUpgrade
                                    ? 'bg-[#e8c468] hover:bg-[#f3d482] text-[#07090f]'
                                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                }`}
                              >
                                Upgrade
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onDemolishBuilding(b.id)}
                              className="px-2.5 py-1.5 rounded bg-rose-950/80 border border-rose-800/60 text-rose-200 cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'shop' && (
            <div className="space-y-5">
              {/* Currency & Daily Blessing Bar */}
              <div className="celestial-surface rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono-num">
                  <span className="text-[#e8c468]">Gold: {currencies.gold}</span>
                  <span className="text-[#38bdf8]">Diamonds: {currencies.diamonds}</span>
                  <span className="text-emerald-400">Emeralds: {currencies.emeralds}</span>
                  <span className="text-amber-300">Coins: {currencies.ancientCoins}</span>
                  <span className="text-violet-300">Aether Shards: {currencies.aetherShards ?? 0}</span>
                </div>
                <button
                  type="button"
                  disabled={!canClaimDaily}
                  onClick={onClaimDaily}
                  className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                    canClaimDaily
                      ? 'bg-[#e8c468] hover:bg-[#f3d482] text-[#07090f]'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {canClaimDaily ? `Claim Day ${dailyRewardDay} Blessing` : `Day ${dailyRewardDay} Claimed`}
                </button>
              </div>

              {/* Live NPC-Crafted Marketplace Stock */}
              <div className="celestial-surface rounded-lg p-4 space-y-3 border border-emerald-500/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm text-emerald-300">
                      Live NPC-Crafted Goods & Farm Market ({livingWorld.marketListings.length} Listings)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Forged, brewed, and harvested autonomously by Verdant villagers.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['blacksmith', 'armorer', 'gunsmith', 'chemist'] as VendorRole[]).map((vr) => (
                      <button
                        key={vr}
                        type="button"
                        onClick={() => onCommissionCraft(vr)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-[#e8c468]/40 text-[11px] text-[#e8c468] cursor-pointer capitalize"
                      >
                        Commission {vr} (75g)
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {livingWorld.marketListings
                    .filter((l) => vendorFilter === 'all' || l.vendor === vendorFilter)
                    .map((listing) => {
                      const tpl = ITEM_TEMPLATES[listing.templateId];
                      const canAfford = currencies[listing.currency] >= listing.price;
                      return (
                        <div
                          key={listing.id}
                          className="rounded-lg bg-[#090d16] border border-slate-800 p-3 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-100 truncate">
                                {tpl?.name ?? listing.templateId}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  listing.quality === 'Masterwork'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-sky-500/20 text-sky-300'
                                }`}
                              >
                                {listing.quality}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              By {listing.crafterName} · Stock: {listing.stock}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={!canAfford}
                            onClick={() => onBuyNpcListing(listing.id)}
                            className={`px-3 py-1.5 rounded font-bold shrink-0 cursor-pointer ${
                              canAfford
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-[#07090f]'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            {listing.price} {listing.currency === 'ancientCoins' ? 'Coins' : listing.currency}
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Multi-Currency Exchange */}
              <div className="celestial-surface rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-[#38bdf8]">Guild Currency Exchange (8% Guild Fee)</span>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={exAmt}
                    onChange={(e) => setExAmt(Math.max(1, Number(e.target.value)))}
                    className="w-20 px-2 py-1 rounded bg-[#090d16] border border-slate-700 text-slate-100 font-mono-num"
                  />
                  <select
                    value={exFrom}
                    onChange={(e) => setExFrom(e.target.value as keyof Currencies)}
                    className="px-2 py-1 rounded bg-[#090d16] border border-slate-700 text-slate-100"
                  >
                    <option value="gold">Gold</option>
                    <option value="diamonds">Diamonds</option>
                    <option value="emeralds">Emeralds</option>
                    <option value="ancientCoins">Ancient Coins</option>
                    <option value="aetherShards">Aether Shards</option>
                  </select>
                  <span className="text-slate-400">→</span>
                  <select
                    value={exTo}
                    onChange={(e) => setExTo(e.target.value as keyof Currencies)}
                    className="px-2 py-1 rounded bg-[#090d16] border border-slate-700 text-slate-100"
                  >
                    <option value="diamonds">Diamonds</option>
                    <option value="gold">Gold</option>
                    <option value="emeralds">Emeralds</option>
                    <option value="ancientCoins">Ancient Coins</option>
                    <option value="aetherShards">Aether Shards</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => onExchangeCurrency(exFrom, exTo, exAmt)}
                    className="px-3 py-1.5 rounded bg-[#e8c468] hover:bg-[#f3d482] text-[#07090f] font-bold cursor-pointer"
                  >
                    Exchange
                  </button>
                </div>
              </div>

              {/* 6 Specialist Guild Filter Bar */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setVendorFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                      vendorFilter === 'all'
                        ? 'bg-[#e8c468] text-[#07090f] border-[#e8c468]'
                        : 'bg-[#0b101d] text-slate-300 border-slate-700'
                    }`}
                  >
                    All Guilds
                  </button>
                  {(Object.keys(VENDOR_META) as VendorRole[]).map((role) => {
                    const vm = VENDOR_META[role];
                    const active = vendorFilter === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setVendorFilter(role)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                          active
                            ? 'bg-[#38bdf8] text-[#07090f] border-[#38bdf8]'
                            : 'bg-[#0b101d] text-slate-300 border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        {vm.label}
                      </button>
                    );
                  })}
                </div>
                {vendorFilter !== 'all' && (
                  <div className="text-xs text-slate-300 px-1">
                    <span className="font-semibold" style={{ color: VENDOR_META[vendorFilter].accent }}>
                      {VENDOR_META[vendorFilter].keeper}
                    </span>{' '}
                    — {VENDOR_META[vendorFilter].title}
                  </div>
                )}
              </div>

              {/* Buy Offers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredOffers.map((offer) => {
                  const tpl = ITEM_TEMPLATES[offer.templateId];
                  const affordable1 = currencies[offer.currency] >= offer.price;
                  const affordable5 = currencies[offer.currency] >= offer.price * 5;
                  const unitLabel = offer.currency === 'ancientCoins' ? 'Coins' : offer.currency;
                  return (
                    <div
                      key={offer.id}
                      className="celestial-surface rounded-lg p-4 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-100 truncate">
                            {tpl.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 capitalize">
                            {offer.vendor}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{tpl.description}</div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={!affordable1}
                          onClick={() => onBuyOffer(offer.id, 1)}
                          className={`px-3 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                            affordable1
                              ? 'bg-[#38bdf8] hover:bg-sky-300 text-[#07090f]'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {offer.price} {unitLabel}
                        </button>
                        {tpl.maxStack > 1 && (
                          <button
                            type="button"
                            disabled={!affordable5}
                            onClick={() => onBuyOffer(offer.id, 5)}
                            className={`px-2.5 py-2 rounded-lg text-[11px] font-bold cursor-pointer ${
                              affordable5
                                ? 'bg-slate-800 hover:bg-slate-700 text-[#e8c468] border border-[#e8c468]/40'
                                : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                            }`}
                          >
                            x5
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sell Bag Items Panel */}
              <div className="border-t border-slate-700/60 pt-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-[#e8c468]">
                    Sell Bag Merchandise (Fortune Bonus: +{fortuneRank * 3}% Gold)
                  </h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {inventory.map((item, idx) => {
                    if (!item) return null;
                    const unitSell = Math.max(
                      1,
                      Math.round((item.stats?.sellValue ?? 6) * (1 + fortuneRank * 0.03)),
                    );
                    return (
                      <div
                        key={item.id}
                        className="rounded-lg bg-[#090d16] border border-slate-800 p-2.5 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-slate-100 truncate">
                            {item.name} <span className="text-slate-400">x{item.quantity}</span>
                          </div>
                          <div className="font-mono-num text-[10px] text-[#e8c468]">
                            +{unitSell} Gold each
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSellItem(idx)}
                          className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-[#07090f] font-bold text-[11px] shrink-0 cursor-pointer"
                        >
                          Sell 1
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'mailbox' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 celestial-surface rounded-lg p-4">
                <div>
                  <h3 className="font-semibold text-sm text-[#e8c468]">
                    Sanctum Couriers & Reward Inbox ({unreadMailCount} Unread / Unclaimed)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Receive guild dispatches, Skill Points, blueprints, and starter packages from Aetheria allies.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClaimAllMail}
                    className="px-3.5 py-1.5 rounded bg-[#e8c468] hover:bg-[#f3d482] text-[#07090f] text-xs font-bold cursor-pointer"
                  >
                    Claim All
                  </button>
                  <button
                    type="button"
                    onClick={onDeleteReadMail}
                    className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 cursor-pointer"
                  >
                    Clear Claimed
                  </button>
                </div>
              </div>

              {mailbox.length === 0 ? (
                <div className="celestial-surface rounded-lg p-8 text-center text-xs text-slate-500">
                  Your Sanctum Mailbox is empty. Complete quests and explore realms to receive new dispatches.
                </div>
              ) : (
                <div className="space-y-3">
                  {mailbox.map((mail) => {
                    const rw = mail.rewards;
                    return (
                      <div
                        key={mail.id}
                        onClick={() => !mail.read && onMarkMailRead(mail.id)}
                        className={`celestial-surface rounded-lg p-4 space-y-2.5 ${
                          !mail.claimed ? 'border-[#e8c468]/50' : 'opacity-80'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-slate-100">
                                {mail.subject}
                              </span>
                              {!mail.claimed && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#e8c468] text-[#07090f] font-bold">
                                  Reward Ready
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#38bdf8]">
                              From: {mail.sender} · {mail.senderRole}
                            </div>
                          </div>
                          {rw && (
                            <button
                              type="button"
                              disabled={mail.claimed}
                              onClick={(e) => {
                                e.stopPropagation();
                                onClaimMail(mail.id);
                              }}
                              className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                                mail.claimed
                                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                  : 'bg-[#e8c468] hover:bg-[#f3d482] text-[#07090f]'
                              }`}
                            >
                              {mail.claimed ? 'Claimed' : 'Claim Rewards'}
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{mail.body}</p>
                        {rw && (
                          <div className="flex flex-wrap gap-2 pt-1 font-mono-num text-[11px]">
                            {rw.gold ? <span className="px-2 py-0.5 rounded bg-[#090d16] text-[#e8c468]">+{rw.gold} Gold</span> : null}
                            {rw.diamonds ? <span className="px-2 py-0.5 rounded bg-[#090d16] text-[#38bdf8]">+{rw.diamonds} Diamonds</span> : null}
                            {rw.emeralds ? <span className="px-2 py-0.5 rounded bg-[#090d16] text-emerald-400">+{rw.emeralds} Emeralds</span> : null}
                            {rw.ancientCoins ? <span className="px-2 py-0.5 rounded bg-[#090d16] text-amber-300">+{rw.ancientCoins} Coins</span> : null}
                            {rw.skillPoints ? <span className="px-2 py-0.5 rounded bg-[#090d16] text-violet-300">+{rw.skillPoints} Skill Pts</span> : null}
                            {rw.itemTemplateId ? (
                              <span className="px-2 py-0.5 rounded bg-[#090d16] text-slate-200">
                                +{rw.itemQty ?? 1} {ITEM_TEMPLATES[rw.itemTemplateId]?.name ?? rw.itemTemplateId}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'social' && (
            <div className="space-y-5">
              <div className="rounded-lg bg-sky-950/40 border border-sky-500/30 px-4 py-3 text-xs text-sky-200">
                Offline Prototype & Local Server Integration Layer: Social leaderboard and guild records sync with your local Express server (`/api/social/state`). Cross-internet MMO matchmaking requires an external WebSocket relay or Firebase/Supabase backend.
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="celestial-surface rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-sm text-[#e8c468]">Global & Realm Leaderboard</h3>
                  <div className="space-y-2">
                    {leaderboard.map((row, idx) => (
                      <div
                        key={row.id}
                        className="flex items-center justify-between px-3 py-2 rounded bg-[#090d16] border border-slate-800 text-xs"
                      >
                        <div>
                          <span className="font-mono-num text-slate-400 mr-2">#{idx + 1}</span>
                          <span className="font-semibold text-slate-100">{row.name}</span>
                          <span className="text-slate-400 ml-2">· {row.realm}</span>
                        </div>
                        <div className="font-mono-num text-[#38bdf8]">
                          Lv {row.level} · {row.bossesDefeated} Bosses
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="celestial-surface rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-[#38bdf8]">
                      Guild & Party Channel ({guildJoined ? guildName : 'Solo'})
                    </h3>
                    <button
                      type="button"
                      onClick={() => setGuildJoined((v) => !v)}
                      className="px-2.5 py-1 rounded bg-slate-800 text-xs text-slate-200 cursor-pointer"
                    >
                      {guildJoined ? 'Leave Guild' : 'Join Guild'}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={guildName}
                      onChange={(e) => setGuildName(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded bg-[#090d16] border border-slate-700 text-xs text-slate-100"
                    />
                  </div>
                  <div className="h-36 overflow-y-auto rounded bg-[#090d16] border border-slate-800 p-2.5 space-y-1.5 text-xs text-slate-300">
                    {chatLog.map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!socialInput.trim()) return;
                      setChatLog((prev) => [...prev, `[${playerName}] ${socialInput.trim()}`]);
                      setSocialInput('');
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={socialInput}
                      onChange={(e) => setSocialInput(e.target.value)}
                      placeholder="Send message to local party channel..."
                      className="flex-1 px-3 py-1.5 rounded bg-[#090d16] border border-slate-700 text-xs text-slate-100"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded bg-[#e8c468] text-[#07090f] text-xs font-bold cursor-pointer"
                    >
                      Send
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {tab === 'hud' && activeProfile && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-[#e8c468]">Custom HUD Layout Editor</h3>
                  <p className="text-xs text-slate-400">
                    Adjust panel scale, opacity, and offsets in real time. Saved per profile.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onResetHudLayout}
                  className="px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
                >
                  Reset Layout
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.values(activeProfile.items).map((item) => (
                  <div key={item.id} className="celestial-surface rounded-lg p-4 space-y-3 text-xs">
                    <div className="font-semibold text-slate-100">{item.label}</div>
                    <label className="block">
                      <span className="text-slate-400">Scale ({item.scale.toFixed(2)}x)</span>
                      <input
                        type="range"
                        min={0.75}
                        max={1.25}
                        step={0.05}
                        value={item.scale}
                        onChange={(e) => {
                          const next = {
                            ...activeProfile,
                            items: {
                              ...activeProfile.items,
                              [item.id]: { ...item, scale: Number(e.target.value) },
                            },
                          };
                          onUpdateHudProfile(next);
                        }}
                        className="w-full mt-1"
                      />
                    </label>
                    <label className="block">
                      <span className="text-slate-400">Opacity ({Math.round(item.opacity * 100)}%)</span>
                      <input
                        type="range"
                        min={0.4}
                        max={1.0}
                        step={0.05}
                        value={item.opacity}
                        onChange={(e) => {
                          const next = {
                            ...activeProfile,
                            items: {
                              ...activeProfile.items,
                              [item.id]: { ...item, opacity: Number(e.target.value) },
                            },
                          };
                          onUpdateHudProfile(next);
                        }}
                        className="w-full mt-1"
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="celestial-surface rounded-lg p-4 space-y-4">
                <h3 className="font-semibold text-sm text-[#e8c468]">Graphics Quality & Display</h3>
                <div>
                  <span className="text-slate-400 block mb-1.5">Quality Preset (Instant Switch)</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['low', 'medium', 'high', 'ultra'] as GraphicsPreset[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => applyPreset(p)}
                        className={`py-2 rounded capitalize font-medium cursor-pointer border ${
                          settings.graphicsPreset === p
                            ? 'bg-[#e8c468] text-[#07090f] border-[#e8c468]'
                            : 'bg-[#090d16] text-slate-300 border-slate-700'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Target Framerate</span>
                  <div className="flex gap-1">
                    {([30, 60, 120] as const).map((fps) => (
                      <button
                        key={fps}
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, fpsTarget: fps })}
                        className={`px-2.5 py-1 rounded border cursor-pointer font-mono-num ${
                          settings.fpsTarget === fps
                            ? 'bg-[#38bdf8] text-[#07090f] border-[#38bdf8] font-bold'
                            : 'bg-[#090d16] text-slate-300 border-slate-700'
                        }`}
                      >
                        {fps}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center justify-between">
                  <span className="text-slate-300">Dynamic Shadows</span>
                  <input
                    type="checkbox"
                    checked={settings.shadowsEnabled}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, shadowsEnabled: e.target.checked })
                    }
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-slate-300">Dynamic Weather</span>
                  <input
                    type="checkbox"
                    checked={settings.weatherEnabled}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, weatherEnabled: e.target.checked })
                    }
                  />
                </label>
                <label className="block">
                  <span className="text-slate-400">View Distance ({settings.viewDistance}m)</span>
                  <input
                    type="range"
                    min={90}
                    max={220}
                    step={10}
                    value={settings.viewDistance}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, viewDistance: Number(e.target.value) })
                    }
                    className="w-full mt-1"
                  />
                </label>
                <label className="block">
                  <span className="text-slate-400">
                    Brightness / Exposure ({(settings.exposure ?? 1.1).toFixed(2)})
                  </span>
                  <input
                    type="range"
                    min={0.75}
                    max={1.5}
                    step={0.05}
                    value={settings.exposure ?? 1.1}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, exposure: Number(e.target.value) })
                    }
                    className="w-full mt-1"
                  />
                </label>
              </div>

              <div className="celestial-surface rounded-lg p-4 space-y-4">
                <h3 className="font-semibold text-sm text-[#38bdf8]">
                  Install, HTML5 Export, Camera & Save Data
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <PWAInstallButton compact onFeedback={onNotify} />
                  <DownloadHtml5Button compact onFeedback={onNotify} />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Camera Perspective</span>
                  <select
                    value={settings.cameraMode}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        cameraMode: e.target.value as GameSettings['cameraMode'],
                      })
                    }
                    className="px-2.5 py-1.5 rounded bg-[#090d16] border border-slate-700 text-slate-100"
                  >
                    <option value="free_orbit">360° Free Orbit (Recommended)</option>
                    <option value="third_person">Third-Person Orbit</option>
                    <option value="first_person">First-Person Immersion</option>
                  </select>
                </div>
                <label className="block">
                  <span className="text-slate-400">
                    Camera Sensitivity ({settings.cameraSensitivity.toFixed(1)}x)
                  </span>
                  <input
                    type="range"
                    min={0.4}
                    max={2.2}
                    step={0.1}
                    value={settings.cameraSensitivity}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        cameraSensitivity: Number(e.target.value),
                      })
                    }
                    className="w-full mt-1"
                  />
                </label>
                <label className="block">
                  <span className="text-slate-400">
                    360° Orbit Smoothness ({(settings.cameraSmoothness ?? 1.0).toFixed(1)}x)
                  </span>
                  <input
                    type="range"
                    min={0.4}
                    max={2.0}
                    step={0.1}
                    value={settings.cameraSmoothness ?? 1.0}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        cameraSmoothness: Number(e.target.value),
                      })
                    }
                    className="w-full mt-1"
                  />
                </label>
                <label className="block">
                  <span className="text-slate-400">
                    SFX Volume ({Math.round(settings.soundVolume * 100)}%)
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.soundVolume}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, soundVolume: Number(e.target.value) })
                    }
                    className="w-full mt-1"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/60">
                  <button
                    type="button"
                    onClick={onManualSave}
                    className="py-2 rounded bg-[#e8c468] text-[#07090f] font-bold cursor-pointer"
                  >
                    Save Progress
                  </button>
                  <button
                    type="button"
                    onClick={onExportSaveJson}
                    className="py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                  >
                    Export Save (.json)
                  </button>
                  <button
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                    className="py-2 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 cursor-pointer"
                  >
                    Import Save (.json)
                  </button>
                  <button
                    type="button"
                    onClick={onResetSave}
                    className="py-2 rounded bg-rose-950 border border-rose-700/60 text-rose-200 cursor-pointer"
                  >
                    Reset Save
                  </button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      file.text().then((txt) => onImportSaveJson(txt));
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {tab === 'science' && (() => {
            const biome = hud?.biome ?? 'verdant';
            const px = hud?.playerX ?? 0;
            const py = hud?.playerY ?? 1.2;
            const pz = hud?.playerZ ?? 0;
            const speedKmh = hud?.speed ?? 0;
            const speedMs = Number((speedKmh / 3.6).toFixed(2));
            const hasElytra = hud?.hasElytra ?? true;
            const isFlying = hud?.isGliding ?? false;
            const hpRatio = hud ? hud.hp / Math.max(1, hud.maxHp) : 1;
            const hunger = hud?.hunger ?? vitals?.hunger ?? 90;
            const thirst = hud?.thirst ?? vitals?.thirst ?? 90;
            const temp = hud?.temperature ?? vitals?.temperature ?? 21;
            const nearCampfire = buildings.some(
              (b) =>
                (b.kind === 'campfire' || b.kind === 'aether_beacon') &&
                Math.hypot(b.x - px, b.z - pz) < 7,
            );
            const primaryEl = character?.primaryElement ?? 'chakra';
            const secondaryEl = character?.secondaryElement ?? 'lightning';

            const momentumMult = calculateKineticMomentumBonus(speedMs);
            const traction = getTerrainTraction(biome, px, pz);
            const aero = calculateAerodynamicLift(biome, py, hasElytra);
            const biology = getBiomeBiologyProfile(biome, hunger, thirst);
            const chemistry = evaluateElementalReaction(primaryEl, secondaryEl, biome);
            const calculus = sampleTerrainCalculus(px, pz);
            const logicRules = evaluateLandLogicRules({
              biome,
              hpRatio,
              temperature: temp,
              nearCampfire,
              isFlying,
              bossPhase2: (hud?.lockedBoss?.phase ?? 1) === 2,
            });

            return (
              <div className="space-y-4">
                <div className="celestial-surface rounded-xl p-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm text-[#e8c468]">
                      Laws of Aetheria — Live Land Sciences Telemetry
                    </h3>
                    <p className="text-xs text-slate-400">
                      Real-time physics, biology, chemistry, differential terrain calculus, and deterministic logic governing the world at ({px.toFixed(1)}, {py.toFixed(1)}, {pz.toFixed(1)}).
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-[#090d16] border border-sky-500/40 font-mono-num text-xs text-sky-300">
                    Biome: {BIOMES[biome].name}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Physics */}
                  <div className="celestial-surface rounded-xl p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm text-sky-300">Physics · Kinematics & Aerodynamics</h4>
                      <span className="font-mono-num text-[#e8c468]">{momentumMult}x Strike</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-mono-num text-[11px] bg-[#090d16] p-2.5 rounded-lg border border-slate-800">
                      <div>Velocity: <span className="text-slate-100">{speedMs} m/s ({speedKmh} km/h)</span></div>
                      <div>Traction Factor: <span className="text-emerald-300">{traction.traction.toFixed(2)}</span></div>
                      <div>Air Density (ρ): <span className="text-sky-300">{aero.airDensity} kg/m³</span></div>
                      <div>Thermal Updraft: <span className="text-amber-300">+{aero.thermalUpdraft} m/s</span></div>
                    </div>
                    <div className="text-slate-300">Surface: <span className="text-slate-100">{traction.surfaceName}</span></div>
                    <div className="text-slate-400">
                      Kinetic Strike: <span className="font-mono-num text-slate-200">M = 1 + 0.28·v²/(v²+320)</span> · Elytra Lift Adj: <span className="font-mono-num text-cyan-300">{aero.sinkAdjustment >= 0 ? '+' : ''}{aero.sinkAdjustment} m/s</span>
                    </div>
                  </div>

                  {/* Biology */}
                  <div className="celestial-surface rounded-xl p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm text-emerald-300">Biology · Ecology & Homeostasis</h4>
                      <span className="font-mono-num text-emerald-300">{(biology.metabolicEfficiency * 100).toFixed(0)}% Stamina</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-mono-num text-[11px] bg-[#090d16] p-2.5 rounded-lg border border-slate-800">
                      <div>Photosynthesis: <span className="text-emerald-300">{biology.photosynthesisRate.toFixed(2)}x</span></div>
                      <div>Core Temp: <span className="text-amber-300">{temp}°C</span></div>
                      <div>Caloric Reserve: <span className="text-slate-100">{hunger}%</span></div>
                      <div>Hydration: <span className="text-sky-300">{thirst}%</span></div>
                    </div>
                    <div className="text-slate-300">Ecosystem: <span className="text-slate-100">{biology.ecosystemName}</span></div>
                    <div className="text-emerald-200/90">Homeostasis: {biology.homeostasisLabel}</div>
                  </div>

                  {/* Chemistry */}
                  <div className="celestial-surface rounded-xl p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm text-amber-300">Chemistry · Elemental & Atmospheric Alchemy</h4>
                      <span className="font-mono-num text-amber-300">{chemistry.multiplier.toFixed(2)}x Synergy</span>
                    </div>
                    <div className="bg-[#090d16] p-2.5 rounded-lg border border-slate-800 space-y-1">
                      <div className="font-semibold text-slate-100">{chemistry.reactionName}</div>
                      <div className="font-mono-num text-sky-300">{chemistry.formula}</div>
                    </div>
                    <div className="text-slate-300">
                      Elements: <span className="text-slate-100">{ELEMENTS[primaryEl].name}</span> + <span className="text-slate-100">{ELEMENTS[secondaryEl].name}</span>
                    </div>
                    <div className="text-slate-400">Atmosphere: <span className="font-mono-num text-slate-200">{chemistry.atmosphericGas}</span></div>
                  </div>

                  {/* Mathematics */}
                  <div className="celestial-surface rounded-xl p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm text-violet-300">Mathematics · Terrain Calculus & Golden Spiral</h4>
                      <span className="font-mono-num text-violet-300">θ = {calculus.slopeDegrees}°</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-mono-num text-[11px] bg-[#090d16] p-2.5 rounded-lg border border-slate-800">
                      <div>Elevation h(x,z): <span className="text-slate-100">{calculus.elevation} m</span></div>
                      <div>Gradient |∇h|: <span className="text-violet-300">{calculus.gradientMagnitude}</span></div>
                      <div>∂h/∂x: <span className="text-slate-200">{calculus.slopeX}</span></div>
                      <div>∂h/∂z: <span className="text-slate-200">{calculus.slopeZ}</span></div>
                      <div>Radial r: <span className="text-sky-300">{calculus.radialDistance} m</span></div>
                      <div>φ Harmonic (137.5°): <span className="text-[#e8c468]">{calculus.goldenHarmonic}</span></div>
                    </div>
                    <div className="text-slate-400">
                      Biome sectors follow five-fold radial symmetry around Verdant Sanctum (0, 0).
                    </div>
                  </div>
                </div>

                {/* Logic Propositions */}
                <div className="celestial-surface rounded-xl p-4">
                  <h4 className="font-semibold text-sm text-[#e8c468] mb-2.5">
                    Formal World Logic · Live Deterministic Rule Engine
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {logicRules.map((rule) => (
                      <div
                        key={rule.proposition}
                        className={`p-3 rounded-lg border text-xs ${
                          rule.result
                            ? 'bg-emerald-950/30 border-emerald-500/50'
                            : 'bg-[#090d16] border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono-num text-[11px] text-slate-100">{rule.proposition}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-mono-num text-[10px] font-bold ${
                              rule.result
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {rule.result ? 'TRUE' : 'FALSE'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">{rule.consequence}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
