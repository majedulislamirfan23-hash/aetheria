import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CharacterStudioModal } from './components/CharacterStudioModal';
import { CultivationQuestsModal } from './components/CultivationQuestsModal';
import { GameHud } from './components/GameHud';
import { InventoryCraftingModal } from './components/InventoryCraftingModal';
import { OracleChatModal } from './components/OracleChatModal';
import { OfflineIndicator } from './components/PWAInstallControls';
import { TitleOverlay } from './components/TitleOverlay';
import { WorldHubTab, WorldSystemsModal } from './components/WorldSystemsModal';
import { gameAudio } from './game/audio';
import {
  BIOMES,
  BUILDING_PIECES,
  CULTIVATION_REALMS,
  NPCS,
  QUESTS,
  createDefaultHudProfile,
  createDefaultSave,
} from './game/catalog';
import { AetheriaEngine, HudSnapshot } from './game/engine';
import {
  commissionNpcCraft,
  exchangeCurrency,
  interactWithFarmPlot,
  purchaseNpcListing,
  tickLivingWorldSimulation,
} from './game/npcSimulation';
import {
  addItemToInventory,
  attemptCultivationBreakthrough,
  claimMailReward,
  computeTotalDefense,
  craftRecipe,
  equipItemToSlot,
  purchaseShopOffer,
  sellInventoryItem,
  setActiveSkillBar,
  sortInventorySlots,
  swapInventorySlots,
  swapMainAndOffHand,
  tickSurvivalVitals,
  upgradeAscensionPower,
  upgradeBuildingPiece,
  upgradeElementRank,
  upgradeSkillStat,
  validateAndRecoverSave,
} from './game/rules';
import type {
  AscensionPowerId,
  BiomeId,
  BuildingPieceKind,
  CharacterCustomization,
  Currencies,
  ElementId,
  EquipmentSlot,
  GameSettings,
  GameState,
  HudLayoutProfile,
  MountVehicleType,
  NpcDefinition,
  PetType,
  PlacedBuilding,
  SaveDataV1,
  SkillUpgrades,
  VendorRole,
} from './game/types';

const SAVE_KEY = 'aetheria_omega_save_v1';

type ActiveModal =
  | null
  | 'studio'
  | 'inventory'
  | 'cultivation'
  | 'oracle'
  | 'world_hub';

function loadInitialSave(): { save: SaveDataV1; hasExisting: boolean } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { save: createDefaultSave(), hasExisting: false };
    const parsed = JSON.parse(raw);
    const { data, recovered } = validateAndRecoverSave(parsed);
    return { save: data, hasExisting: !recovered };
  } catch {
    return { save: createDefaultSave(), hasExisting: false };
  }
}

export default function App() {
  const initialRef = useRef<{ save: SaveDataV1; hasExisting: boolean } | null>(null);
  if (!initialRef.current) {
    initialRef.current = loadInitialSave();
  }

  const [save, setSave] = useState<SaveDataV1>(initialRef.current.save);
  const [hasExistingSave, setHasExistingSave] = useState(initialRef.current.hasExisting);
  const [gameState, setGameState] = useState<GameState>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') === '1' ? 'playing' : 'title';
  });
  const [isVictory, setIsVictory] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [worldHubTab, setWorldHubTab] = useState<WorldHubTab>('map');
  const [vendorFilter, setVendorFilter] = useState<VendorRole | 'all'>('all');
  const [oraclePersona, setOraclePersona] = useState<string>('omega_oracle');
  const [oracleNpcMeta, setOracleNpcMeta] = useState<{ id: string; name: string; role: string } | null>(null);
  const [activeNpc, setActiveNpc] = useState<NpcDefinition | null>(null);
  const [selectedBuildKind, setSelectedBuildKind] = useState<BuildingPieceKind | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(() => ({
    biome: 'verdant',
    weather: 'clear',
    timeOfDay: 10.5,
    hp: initialRef.current!.save.vitals.hp,
    maxHp: initialRef.current!.save.vitals.maxHp,
    stamina: initialRef.current!.save.vitals.stamina,
    maxStamina: initialRef.current!.save.vitals.maxStamina,
    mana: initialRef.current!.save.vitals.mana,
    maxMana: initialRef.current!.save.vitals.maxMana,
    hunger: initialRef.current!.save.vitals.hunger,
    thirst: initialRef.current!.save.vitals.thirst,
    temperature: initialRef.current!.save.vitals.temperature,
    qi: initialRef.current!.save.vitals.qi,
    qiRequired: initialRef.current!.save.vitals.qiRequired,
    speed: 0,
    isMeditating: false,
    isGliding: false,
    hasElytra: Boolean(initialRef.current!.save.equipped.elytra),
    isMounted: initialRef.current!.save.activeMount,
    nearbyPrompt: null,
    nearbyBuilding: null,
    lockedBoss: null,
    cooldowns: [0, 0, 0, 0],
    powerCooldowns: { blink_step: 0, meteor_nova: 0, aegis_dome: 0, omega_overdrive: 0 },
    awakeningActive: false,
    aegisActive: false,
    popups: [],
    npcBubbles: [],
    playerX: initialRef.current!.save.position.x,
    playerY: initialRef.current!.save.position.y,
    playerZ: initialRef.current!.save.position.z,
    playerYaw: initialRef.current!.save.position.yaw,
    criticalPulse: 0,
    combatAudioMode: 'calm',
  }));

  const canvasMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<AetheriaEngine | null>(null);
  const saveRef = useRef(save);
  const gameStateRef = useRef(gameState);
  const hudRef = useRef(hud);

  saveRef.current = save;
  gameStateRef.current = gameState;
  hudRef.current = hud;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const persistSave = useCallback((nextSave: SaveDataV1) => {
    try {
      const pos = engineRef.current?.getPosition() ?? nextSave.position;
      const payload: SaveDataV1 = {
        ...nextSave,
        position: pos,
        savedAt: Date.now(),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      setHasExistingSave(true);
    } catch {
      // Ignore storage quota issues
    }
  }, []);

  // Sync body state attribute
  useEffect(() => {
    document.body.dataset.state = gameState;
    engineRef.current?.setGameState(activeModal ? 'paused' : gameState);
  }, [gameState, activeModal]);

  // Sync studio mode camera
  useEffect(() => {
    engineRef.current?.setStudioMode(activeModal === 'studio');
  }, [activeModal]);

  // Initialize Three.js engine once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;
    const s = saveRef.current;

    const engine = new AetheriaEngine(
      mount,
      s.character,
      s.vitals,
      s.settings,
      s.position,
      s.buildings,
      {
        onHudUpdate: (snap) => setHud(snap),
        onGatherResource: (templateId, qty) => {
          setSave((prev) => {
            const added = addItemToInventory(prev.inventory, templateId, qty);
            const nextQuests = { ...prev.quests };
            if (nextQuests.q_side_clara && nextQuests.q_side_clara.status !== 'completed') {
              nextQuests.q_side_clara = {
                ...nextQuests.q_side_clara,
                status: 'active',
                progress: nextQuests.q_side_clara.progress + qty,
              };
            }
            return { ...prev, inventory: added.slots, quests: nextQuests };
          });
        },
        onEnemyKilled: (_archetype, isBoss, bossId) => {
          setSave((prev) => {
            const xpGain = isBoss ? 220 : 42;
            const qiGain = isBoss ? 140 : 24;
            const goldGain = isBoss ? 320 : 35;
            let nextXp = prev.vitals.xp + xpGain;
            let nextLv = prev.vitals.level;
            let nextNeed = prev.vitals.nextXp;
            let maxHp = prev.vitals.maxHp;
            let spGain = isBoss ? 2 : 0;
            while (nextXp >= nextNeed) {
              nextXp -= nextNeed;
              nextLv += 1;
              nextNeed = Math.round(nextNeed * 1.28);
              maxHp += 24;
              spGain += 1;
            }
            const nextBosses =
              isBoss && bossId && !prev.defeatedBosses.includes(bossId)
                ? [...prev.defeatedBosses, bossId]
                : prev.defeatedBosses;
            const addedInv = isBoss
              ? addItemToInventory(prev.inventory, 'astral_core', 1)
              : addItemToInventory(prev.inventory, 'crystal', 1);

            const nextQuests = { ...prev.quests };
            if (nextQuests.q_main_1 && nextQuests.q_main_1.status !== 'completed') {
              nextQuests.q_main_1 = {
                ...nextQuests.q_main_1,
                progress: nextQuests.q_main_1.progress + 1,
              };
            }
            if (isBoss && nextQuests.q_main_2 && nextQuests.q_main_2.status !== 'completed') {
              nextQuests.q_main_2 = {
                ...nextQuests.q_main_2,
                progress: nextQuests.q_main_2.progress + 1,
              };
            }

            let diamondsBonus = 0;
            const nextAchievements = prev.achievements.map((a) => {
              if (!a.unlocked && a.id === 'ach_first_blood') {
                diamondsBonus += a.rewardDiamonds;
                return { ...a, unlocked: true };
              }
              if (!a.unlocked && isBoss && a.id === 'ach_colossus') {
                diamondsBonus += a.rewardDiamonds;
                return { ...a, unlocked: true };
              }
              return a;
            });

            const updated: SaveDataV1 = {
              ...prev,
              killCount: prev.killCount + 1,
              defeatedBosses: nextBosses,
              inventory: addedInv.slots,
              quests: nextQuests,
              achievements: nextAchievements,
              currencies: {
                ...prev.currencies,
                gold: prev.currencies.gold + goldGain,
                diamonds: prev.currencies.diamonds + diamondsBonus,
                aetherShards: (prev.currencies.aetherShards ?? 0) + (isBoss ? 5 : 1),
              },
              vitals: {
                ...prev.vitals,
                level: nextLv,
                xp: nextXp,
                nextXp: nextNeed,
                maxHp,
                hp: Math.min(maxHp, prev.vitals.hp + (isBoss ? 120 : 12)),
                qi: prev.vitals.qi + qiGain,
                astralCores: prev.vitals.astralCores + (isBoss ? 1 : 0),
                skillPoints: (prev.vitals.skillPoints ?? 0) + spGain,
              },
            };
            engineRef.current?.updateVitals(updated.vitals);
            return updated;
          });
          if (isBoss) {
            setIsVictory(true);
            setGameState('gameover');
          }
        },
        onPlayerDamaged: (amount) => {
          setSave((prev) => {
            const totalDef = computeTotalDefense(
              prev.equipped,
              prev.vitals.skillUpgrades?.vitality ?? 0,
            );
            const aegisMult = (prev.vitals.aegisShieldTimer ?? 0) > 0 ? 0.35 : 1.0;
            const dmg = Math.max(2, Math.round((amount - Math.round(totalDef * 0.4)) * aegisMult));
            const nextHp = Math.max(0, prev.vitals.hp - dmg);
            const nextVitals = { ...prev.vitals, hp: nextHp };
            engineRef.current?.updateVitals(nextVitals);
            if (nextHp <= 0) {
              setIsVictory(false);
              setGameState('gameover');
            }
            return { ...prev, vitals: nextVitals };
          });
        },
        onPlayerDied: () => {
          setIsVictory(false);
          setGameState('gameover');
        },
        onNpcInteract: (npcId) => {
          const npc = NPCS.find((n) => n.id === npcId) ?? null;
          if (npc) {
            setActiveNpc(npc);
          }
        },
        onInteractFarm: (plotId) => {
          setSave((prev) => {
            const res = interactWithFarmPlot(
              prev.livingWorld,
              prev.inventory,
              plotId,
              prev.vitals.skillUpgrades?.fortune ?? 0,
            );
            engineRef.current?.syncLivingWorld(res.world);
            showToast(res.message);
            const updated = { ...prev, livingWorld: res.world, inventory: res.inventory };
            persistSave(updated);
            return updated;
          });
        },
        onLifestealGain: (hpGain, manaGain) => {
          setSave((prev) => {
            const nextVitals = {
              ...prev.vitals,
              hp: Math.min(prev.vitals.maxHp, prev.vitals.hp + hpGain),
              mana: Math.min(prev.vitals.maxMana, prev.vitals.mana + manaGain),
            };
            engineRef.current?.updateVitals(nextVitals);
            return { ...prev, vitals: nextVitals };
          });
        },
        onPowerStateChanged: (patch) => {
          setSave((prev) => {
            const nextVitals = {
              ...prev.vitals,
              awakeningActive: patch.awakeningActive ?? prev.vitals.awakeningActive,
              awakeningTimer: patch.awakeningTimer ?? prev.vitals.awakeningTimer,
              aegisShieldTimer: patch.aegisShieldTimer ?? prev.vitals.aegisShieldTimer,
              hp: patch.healHp
                ? Math.min(prev.vitals.maxHp, prev.vitals.hp + patch.healHp)
                : prev.vitals.hp,
            };
            engineRef.current?.updateVitals(nextVitals);
            return { ...prev, vitals: nextVitals };
          });
        },
        onConsumeMana: (cost) => {
          if (saveRef.current.vitals.mana < cost) {
            showToast('Insufficient Mana.');
            return false;
          }
          setSave((prev) => {
            const v = { ...prev.vitals, mana: Math.max(0, prev.vitals.mana - cost) };
            engineRef.current?.updateVitals(v);
            return { ...prev, vitals: v };
          });
          return true;
        },
        onConsumeStamina: (cost) => {
          if (saveRef.current.vitals.stamina < cost) return false;
          setSave((prev) => {
            const v = { ...prev.vitals, stamina: Math.max(0, prev.vitals.stamina - cost) };
            engineRef.current?.updateVitals(v);
            return { ...prev, vitals: v };
          });
          return true;
        },
        onBiomeDiscovered: (biome: BiomeId) => {
          if (!saveRef.current.discoveredRegions.includes(biome)) {
            setSave((prev) => {
              if (prev.discoveredRegions.includes(biome)) return prev;
              const regions = [...prev.discoveredRegions, biome];
              const nextQuests = { ...prev.quests };
              if (nextQuests.q_hidden_frost) {
                nextQuests.q_hidden_frost = {
                  ...nextQuests.q_hidden_frost,
                  progress: regions.length,
                };
              }
              let bonusDiamonds = 0;
              const nextAch = prev.achievements.map((a) => {
                if (!a.unlocked && a.id === 'ach_explorer' && regions.length >= 4) {
                  bonusDiamonds += a.rewardDiamonds;
                  return { ...a, unlocked: true };
                }
                return a;
              });
              return {
                ...prev,
                discoveredRegions: regions,
                quests: nextQuests,
                achievements: nextAch,
                currencies: { ...prev.currencies, diamonds: prev.currencies.diamonds + bonusDiamonds },
              };
            });
            showToast(`Discovered ${BIOMES[biome].name}!`);
          }
        },
        onPlaceBuilding: (piece: PlacedBuilding) => {
          setSave((prev) => {
            const withTier: PlacedBuilding = { ...piece, tier: piece.tier ?? 1 };
            const nextBuildings = [...prev.buildings, withTier];
            let bonusDiamonds = 0;
            const nextAch = prev.achievements.map((a) => {
              if (!a.unlocked && a.id === 'ach_architect' && nextBuildings.length >= 3) {
                bonusDiamonds += a.rewardDiamonds;
                return { ...a, unlocked: true };
              }
              return a;
            });
            const updated = {
              ...prev,
              buildings: nextBuildings,
              achievements: nextAch,
              currencies: { ...prev.currencies, diamonds: prev.currencies.diamonds + bonusDiamonds },
            };
            persistSave(updated);
            return updated;
          });
          showToast('Structure constructed! Walk close and press [U] to upgrade tiers.');
        },
        onUseOffHandConsumable: () => {
          setSave((prev) => {
            const item = prev.equipped.offHand;
            if (!item || (item.category !== 'consumable' && item.category !== 'core')) return prev;
            const nextVitals = { ...prev.vitals };
            if (item.stats?.healHp) nextVitals.hp = Math.min(nextVitals.maxHp, nextVitals.hp + item.stats.healHp);
            if (item.stats?.healMana) nextVitals.mana = Math.min(nextVitals.maxMana, nextVitals.mana + item.stats.healMana);
            if (item.stats?.healHunger) nextVitals.hunger = Math.min(100, nextVitals.hunger + item.stats.healHunger);
            if (item.stats?.healThirst) nextVitals.thirst = Math.min(100, nextVitals.thirst + item.stats.healThirst);
            if (item.stats?.qiGain) nextVitals.qi += item.stats.qiGain;
            const nextEq = {
              ...prev.equipped,
              offHand: item.quantity > 1 ? { ...item, quantity: item.quantity - 1 } : null,
            };
            gameAudio.playPickup();
            engineRef.current?.updateVitals(nextVitals);
            engineRef.current?.updateEquipment(nextEq);
            showToast(`Used Off-Hand ${item.name}`);
            return { ...prev, vitals: nextVitals, equipped: nextEq };
          });
        },
      },
      s.equipped,
    );

    engine.setMount(s.activeMount);
    engine.setPet(s.activePet);
    engine.syncLivingWorld(s.livingWorld);
    engine.setGameState(gameStateRef.current);
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [persistSave, showToast]);

  // Autonomous Living World NPC AI Simulation (runs every 2 seconds in playing mode)
  useEffect(() => {
    let simStep = 1;
    const id = window.setInterval(() => {
      if (gameStateRef.current !== 'playing') return;
      simStep += 1;
      setSave((prev) => {
        const nextLiving = tickLivingWorldSimulation(prev.livingWorld, 2.0, simStep);
        engineRef.current?.syncLivingWorld(nextLiving);
        return { ...prev, livingWorld: nextLiving };
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  // Survival tick (1Hz) + Auto-save (every 20s)
  useEffect(() => {
    let saveTick = 0;
    const id = window.setInterval(() => {
      if (gameStateRef.current !== 'playing' || activeModal) return;
      saveTick++;
      setSave((prev) => {
        const currentHud = hudRef.current;
        const nearCampfire = prev.buildings.some(
          (b) =>
            (b.kind === 'campfire' || b.kind === 'aether_beacon') &&
            Math.hypot(b.x - currentHud.playerX, b.z - currentHud.playerZ) < 7,
        );
        const nextVitals = tickSurvivalVitals(prev.vitals, currentHud.biome, 1, {
          isSprinting: false,
          isMeditating: currentHud.isMeditating,
          nearCampfire,
        });
        engineRef.current?.updateVitals(nextVitals);
        const updated = {
          ...prev,
          vitals: nextVitals,
          playTimeSeconds: prev.playTimeSeconds + 1,
        };
        if (saveTick % 20 === 0) {
          persistSave(updated);
        }
        return updated;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [activeModal, persistSave]);

  const startGame = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setActiveModal(null);
    setGameState('playing');
    document.body.dataset.state = 'playing';
  }, []);

  const handleSwapHands = useCallback(() => {
    setSave((prev) => {
      const nextEq = swapMainAndOffHand(prev.equipped);
      const nextChar = { ...prev.character };
      if (nextEq.weapon?.stats?.weaponType) {
        nextChar.weaponType = nextEq.weapon.stats.weaponType;
        engineRef.current?.updateCharacter(nextChar);
      }
      engineRef.current?.updateEquipment(nextEq);
      gameAudio.playEquipGear('weapon');
      const updated = { ...prev, character: nextChar, equipped: nextEq };
      persistSave(updated);
      return updated;
    });
    showToast('Swapped Main Hand & Off-Hand!');
  }, [persistSave, showToast]);

  const handleUpgradeBuilding = useCallback(
    (buildingId: string) => {
      setSave((prev) => {
        const idx = prev.buildings.findIndex((b) => b.id === buildingId);
        if (idx === -1) return prev;
        const res = upgradeBuildingPiece(prev.buildings[idx], prev.currencies, prev.inventory);
        if (!res.success) {
          showToast(res.reason || 'Upgrade failed.');
          return prev;
        }
        const nextBuildings = [...prev.buildings];
        nextBuildings[idx] = res.building;
        engineRef.current?.syncBuildings(nextBuildings);
        gameAudio.playBreakthrough();
        const meta = BUILDING_PIECES.find((p) => p.kind === res.building.kind);
        showToast(`${meta?.name ?? 'Structure'} upgraded to Tier ${res.building.tier}!`);
        const updated = {
          ...prev,
          buildings: nextBuildings,
          currencies: res.currencies,
          inventory: res.inventory,
        };
        persistSave(updated);
        return updated;
      });
    },
    [persistSave, showToast],
  );

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;

      if (gameStateRef.current === 'title' && (e.code === 'Enter' || e.code === 'Space') && !activeModal) {
        e.preventDefault();
        startGame();
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (activeNpc) {
          setActiveNpc(null);
        } else if (activeModal) {
          setActiveModal(null);
        } else if (gameStateRef.current === 'playing') {
          setGameState('paused');
        } else if (gameStateRef.current === 'paused') {
          setGameState('playing');
        }
        return;
      }

      if (gameStateRef.current !== 'playing') return;

      if (e.code === 'KeyI' || e.code === 'KeyB') {
        setActiveModal((m) => (m === 'inventory' ? null : 'inventory'));
      } else if (e.code === 'KeyC') {
        setActiveModal((m) => (m === 'cultivation' ? null : 'cultivation'));
      } else if (e.code === 'KeyM') {
        setWorldHubTab('map');
        setActiveModal((m) => (m === 'world_hub' ? null : 'world_hub'));
      } else if (e.code === 'KeyO') {
        setActiveModal((m) => (m === 'oracle' ? null : 'oracle'));
      } else if (e.code === 'KeyH') {
        setWorldHubTab('building');
        setActiveModal((m) => (m === 'world_hub' ? null : 'world_hub'));
      } else if (e.code === 'KeyF') {
        handleSwapHands();
      } else if (e.code === 'KeyU' && hudRef.current.nearbyBuilding) {
        handleUpgradeBuilding(hudRef.current.nearbyBuilding.id);
      } else if (e.code === 'KeyV') {
        setSave((prev) => {
          const nextMount: MountVehicleType = prev.activeMount === 'none' ? 'omega_m4_coupe' : 'none';
          engineRef.current?.setMount(nextMount);
          return { ...prev, activeMount: nextMount };
        });
      } else if (e.code === 'KeyX') {
        engineRef.current?.triggerAction('meditate');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeModal, activeNpc, startGame, handleSwapHands, handleUpgradeBuilding]);

  const handleCharacterChange = (nextChar: CharacterCustomization) => {
    setSave((prev) => {
      const unlocked = Array.from(
        new Set([...prev.vitals.unlockedElements, nextChar.primaryElement, nextChar.secondaryElement]),
      );
      const updated: SaveDataV1 = {
        ...prev,
        character: nextChar,
        vitals: { ...prev.vitals, unlockedElements: unlocked },
      };
      engineRef.current?.updateCharacter(nextChar);
      engineRef.current?.updateVitals(updated.vitals);
      persistSave(updated);
      return updated;
    });
  };

  const handleUseOrEquip = (slotIdx: number) => {
    setSave((prev) => {
      const item = prev.inventory[slotIdx];
      if (!item) return prev;
      let nextInv = [...prev.inventory];
      let nextVitals = { ...prev.vitals };
      let nextEquipped = { ...prev.equipped };
      const nextChar = { ...prev.character };

      if (item.category === 'consumable' || item.category === 'core') {
        if (item.stats?.healHp) nextVitals.hp = Math.min(nextVitals.maxHp, nextVitals.hp + item.stats.healHp);
        if (item.stats?.healMana) nextVitals.mana = Math.min(nextVitals.maxMana, nextVitals.mana + item.stats.healMana);
        if (item.stats?.healHunger) nextVitals.hunger = Math.min(100, nextVitals.hunger + item.stats.healHunger);
        if (item.stats?.healThirst) nextVitals.thirst = Math.min(100, nextVitals.thirst + item.stats.healThirst);
        if (item.stats?.qiGain) nextVitals.qi += item.stats.qiGain;
        if (item.templateId === 'astral_core') nextVitals.astralCores += 1;

        if (item.quantity > 1) {
          nextInv[slotIdx] = { ...item, quantity: item.quantity - 1 };
        } else {
          nextInv[slotIdx] = null;
        }
        gameAudio.playPickup();
        showToast(`Used ${item.name}`);
      } else if (item.category === 'building' && item.buildKind) {
        setSelectedBuildKind(item.buildKind);
        engineRef.current?.setSelectedBuildKind(item.buildKind);
        setActiveModal(null);
        showToast(`Ready to build ${item.name} — Left-Click to place`);
      } else {
        const res = equipItemToSlot(prev.inventory, prev.equipped, slotIdx);
        if (!res.success) {
          showToast(res.reason || 'Cannot equip item.');
          return prev;
        }
        nextInv = res.slots;
        nextEquipped = res.equipped;
        if (res.slot === 'weapon' && item.stats?.weaponType) {
          nextChar.weaponType = item.stats.weaponType;
          engineRef.current?.updateCharacter(nextChar);
        }
        engineRef.current?.updateEquipment(nextEquipped);
        gameAudio.playEquipGear(res.slot);
        showToast(`Equipped ${item.name} (${res.slot})`);
      }

      engineRef.current?.updateVitals(nextVitals);
      const updated = {
        ...prev,
        character: nextChar,
        vitals: nextVitals,
        inventory: nextInv,
        equipped: nextEquipped,
        hotbarIndex: slotIdx < 9 ? slotIdx : prev.hotbarIndex,
      };
      persistSave(updated);
      return updated;
    });
  };

  const handleEquipToSlot = (slotIdx: number, targetSlot: EquipmentSlot) => {
    setSave((prev) => {
      const item = prev.inventory[slotIdx];
      if (!item) return prev;
      const res = equipItemToSlot(prev.inventory, prev.equipped, slotIdx, targetSlot);
      if (!res.success) {
        showToast(res.reason || 'Incompatible equipment slot.');
        return prev;
      }
      const nextChar = { ...prev.character };
      if (targetSlot === 'weapon' && item.stats?.weaponType) {
        nextChar.weaponType = item.stats.weaponType;
        engineRef.current?.updateCharacter(nextChar);
      }
      engineRef.current?.updateEquipment(res.equipped);
      gameAudio.playEquipGear(targetSlot);
      showToast(`Equipped ${item.name} → ${targetSlot}`);
      const updated = {
        ...prev,
        character: nextChar,
        inventory: res.slots,
        equipped: res.equipped,
      };
      persistSave(updated);
      return updated;
    });
  };

  const handleBreakthrough = () => {
    setSave((prev) => {
      const res = attemptCultivationBreakthrough(prev.vitals);
      if (!res.success) {
        showToast(res.reason || 'Breakthrough requirements not met.');
        return prev;
      }
      gameAudio.playBreakthrough();
      engineRef.current?.updateVitals(res.vitals);
      const realmName = CULTIVATION_REALMS[res.vitals.cultivationRealm].name;
      showToast(`Breakthrough! Ascended to ${realmName} (+3 Skill Points)!`);

      let bonusDiamonds = 0;
      const nextAch = prev.achievements.map((a) => {
        if (!a.unlocked && a.id === 'ach_breakthrough' && res.vitals.cultivationRealm >= 1) {
          bonusDiamonds += a.rewardDiamonds;
          return { ...a, unlocked: true };
        }
        return a;
      });
      const updated = {
        ...prev,
        vitals: res.vitals,
        achievements: nextAch,
        currencies: { ...prev.currencies, diamonds: prev.currencies.diamonds + bonusDiamonds },
      };
      persistSave(updated);
      return updated;
    });
  };

  const currentRealmMeta = CULTIVATION_REALMS[save.vitals.cultivationRealm] ?? CULTIVATION_REALMS[0];
  const activeHudProfile = save.hudProfiles[save.activeHudProfileIndex] ?? save.hudProfiles[0];
  const canClaimDaily = Date.now() - save.lastDailyClaimAt > 20 * 3600 * 1000;
  const unreadMailCount = save.mailbox.filter((m) => !m.read || (!m.claimed && m.rewards)).length;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#07090f]">
      <OfflineIndicator />

      {/* Isolated WebGL Viewport Container */}
      <div
        ref={canvasMountRef}
        data-testid="game-canvas-mount"
        className="fixed inset-0 w-full h-full"
      />

      {/* Playing HUD */}
      {gameState === 'playing' && !activeModal && (
        <GameHud
          hud={hud}
          character={save.character}
          vitals={save.vitals}
          currencies={save.currencies}
          inventory={save.inventory}
          equipped={save.equipped}
          hotbarIndex={save.hotbarIndex}
          unreadMailCount={unreadMailCount}
          hudProfile={activeHudProfile}
          muted={save.settings.muted}
          buildActive={selectedBuildKind !== null}
          cameraMode={save.settings.cameraMode}
          onAction={(act) => engineRef.current?.triggerAction(act)}
          onUseHotbarSlot={(idx) => {
            setSave((prev) => ({ ...prev, hotbarIndex: idx }));
            handleUseOrEquip(idx);
          }}
          onSwapHands={handleSwapHands}
          onUpgradeNearbyBuilding={handleUpgradeBuilding}
          onToggleMount={() => {
            setSave((prev) => {
              const nextMount: MountVehicleType =
                prev.activeMount === 'none' ? 'omega_m4_coupe' : 'none';
              engineRef.current?.setMount(nextMount);
              return { ...prev, activeMount: nextMount };
            });
          }}
          onCycleCameraMode={() => {
            setSave((prev) => {
              const order: GameSettings['cameraMode'][] = ['free_orbit', 'third_person', 'first_person'];
              const idx = order.indexOf(prev.settings.cameraMode);
              const nextMode = order[(idx + 1) % order.length];
              const nextSettings = { ...prev.settings, cameraMode: nextMode };
              engineRef.current?.updateSettings(nextSettings);
              showToast(
                nextMode === 'free_orbit'
                  ? 'Camera: 360° Free Orbit'
                  : nextMode === 'third_person'
                  ? 'Camera: Third-Person Orbit'
                  : 'Camera: First-Person',
              );
              return { ...prev, settings: nextSettings };
            });
          }}
          onMobileMove={(x, y) => engineRef.current?.setMobileMove(x, y)}
          onMobileCameraDrag={(dx, dy) => engineRef.current?.rotateCameraBy(dx, dy)}
          onOpenBag={() => setActiveModal('inventory')}
          onOpenCultivation={() => setActiveModal('cultivation')}
          onOpenMap={() => {
            setWorldHubTab('map');
            setActiveModal('world_hub');
          }}
          onOpenVillage={() => {
            setWorldHubTab('village');
            setActiveModal('world_hub');
          }}
          onOpenShop={() => {
            setVendorFilter('all');
            setWorldHubTab('shop');
            setActiveModal('world_hub');
          }}
          onOpenMailbox={() => {
            setWorldHubTab('mailbox');
            setActiveModal('world_hub');
          }}
          onOpenSettings={() => {
            setWorldHubTab('settings');
            setActiveModal('world_hub');
          }}
          onOpenOracle={() => {
            setOraclePersona('omega_oracle');
            setOracleNpcMeta(null);
            setActiveModal('oracle');
          }}
          onOpenBuilding={() => {
            setWorldHubTab('building');
            setActiveModal('world_hub');
          }}
          onToggleMute={() => {
            setSave((prev) => {
              const nextSettings = { ...prev.settings, muted: !prev.settings.muted };
              engineRef.current?.updateSettings(nextSettings);
              return { ...prev, settings: nextSettings };
            });
          }}
          onPause={() => setGameState('paused')}
        />
      )}

      {/* Title / Pause / GameOver / Victory Overlay */}
      {!activeModal && (
        <TitleOverlay
          gameState={gameState}
          hasExistingSave={hasExistingSave}
          playerName={save.character.name}
          realmName={currentRealmMeta.name}
          level={save.vitals.level}
          killCount={save.killCount}
          bossesDefeated={save.defeatedBosses.length}
          isVictory={isVictory}
          onStartGame={startGame}
          onOpenStudio={() => setActiveModal('studio')}
          onOpenSettings={() => {
            setWorldHubTab('settings');
            setActiveModal('world_hub');
          }}
          onResume={() => setGameState('playing')}
          onReturnTitle={() => {
            persistSave(save);
            setGameState('title');
          }}
          onRestartRun={() => {
            setSave((prev) => {
              const revived = {
                ...prev,
                vitals: {
                  ...prev.vitals,
                  hp: prev.vitals.maxHp,
                  mana: prev.vitals.maxMana,
                  stamina: prev.vitals.maxStamina,
                },
              };
              engineRef.current?.updateVitals(revived.vitals);
              if (!isVictory) {
                engineRef.current?.teleportTo(0, 4);
              }
              return revived;
            });
            setGameState('playing');
          }}
          onNotify={showToast}
        />
      )}

      {/* NPC Interaction Dialogue Banner */}
      {activeNpc && !activeModal && (
        <div className="fixed inset-0 z-30 flex items-end justify-center p-4 md:p-8 bg-black/45">
          <div className="celestial-panel rounded-xl w-full max-w-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-[#e8c468]">{activeNpc.name}</h3>
                <span className="text-xs text-[#38bdf8]">{activeNpc.role}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveNpc(null)}
                className="px-3 py-1 rounded bg-slate-800 text-xs text-slate-200 cursor-pointer"
              >
                Leave
              </button>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">{activeNpc.greeting}</p>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setOraclePersona(activeNpc.id);
                  setOracleNpcMeta({ id: activeNpc.id, name: activeNpc.name, role: activeNpc.role });
                  setActiveNpc(null);
                  setActiveModal('oracle');
                }}
                className="px-4 py-2 rounded-lg bg-[#38bdf8] text-[#07090f] text-xs font-bold cursor-pointer"
              >
                AI Chat with {activeNpc.name}
              </button>
              {(activeNpc.role === 'Farmer' || activeNpc.role === 'Mason') && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveNpc(null);
                    setWorldHubTab('village');
                    setActiveModal('world_hub');
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-[#07090f] text-xs font-bold cursor-pointer"
                >
                  Open Village AI & Farms
                </button>
              )}
              {activeNpc.vendorTab && (
                <button
                  type="button"
                  onClick={() => {
                    const vt = activeNpc.vendorTab!;
                    setActiveNpc(null);
                    setVendorFilter(vt);
                    setWorldHubTab('shop');
                    setActiveModal('world_hub');
                  }}
                  className="px-4 py-2 rounded-lg bg-[#e8c468] text-[#07090f] text-xs font-bold cursor-pointer"
                >
                  Open {activeNpc.role} Guild Shop
                </button>
              )}
              {activeNpc.role === 'Blacksmith' && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveNpc(null);
                    setActiveModal('inventory');
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 text-xs font-bold cursor-pointer"
                >
                  Open Forge & Crafting
                </button>
              )}
              {activeNpc.role === 'Healer' && (
                <button
                  type="button"
                  onClick={() => {
                    setSave((prev) => {
                      const healed = {
                        ...prev,
                        vitals: {
                          ...prev.vitals,
                          hp: prev.vitals.maxHp,
                          mana: prev.vitals.maxMana,
                          hunger: 100,
                          thirst: 100,
                        },
                      };
                      engineRef.current?.updateVitals(healed.vitals);
                      return healed;
                    });
                    gameAudio.playBreakthrough();
                    showToast('Restored full HP, Mana, and Vitality!');
                    setActiveNpc(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-[#07090f] text-xs font-bold cursor-pointer"
                >
                  Receive Shrine Healing
                </button>
              )}
              {activeNpc.questId && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveNpc(null);
                    setActiveModal('cultivation');
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-xs text-slate-100 cursor-pointer"
                >
                  View Quest Journal
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {activeModal === 'studio' && (
        <CharacterStudioModal
          character={save.character}
          onChange={handleCharacterChange}
          onStudioCameraControl={(opts) => engineRef.current?.setStudioCameraControl(opts) ?? false}
          onClose={() => setActiveModal(null)}
          onEnterWorld={startGame}
        />
      )}

      {activeModal === 'inventory' && (
        <InventoryCraftingModal
          inventory={save.inventory}
          storage={save.storage}
          equipped={save.equipped}
          vitalityRank={save.vitals.skillUpgrades?.vitality ?? 0}
          martialRank={save.vitals.skillUpgrades?.martial ?? 0}
          fortuneRank={save.vitals.skillUpgrades?.fortune ?? 0}
          onSwapSlots={(a, b) =>
            setSave((prev) => ({ ...prev, inventory: swapInventorySlots(prev.inventory, a, b) }))
          }
          onSortInventory={() =>
            setSave((prev) => ({ ...prev, inventory: sortInventorySlots(prev.inventory) }))
          }
          onUseOrEquip={handleUseOrEquip}
          onEquipToSlot={handleEquipToSlot}
          onSwapHands={handleSwapHands}
          onTransferToStorage={(idx) => {
            setSave((prev) => {
              const item = prev.inventory[idx];
              if (!item) return prev;
              const emptyIdx = prev.storage.findIndex((s) => s === null);
              if (emptyIdx === -1) {
                showToast('Storage chest is full.');
                return prev;
              }
              const nextInv = [...prev.inventory];
              const nextStg = [...prev.storage];
              nextStg[emptyIdx] = item;
              nextInv[idx] = null;
              return { ...prev, inventory: nextInv, storage: nextStg };
            });
          }}
          onRetrieveFromStorage={(stgIdx) => {
            setSave((prev) => {
              const item = prev.storage[stgIdx];
              if (!item) return prev;
              const emptyIdx = prev.inventory.findIndex((s) => s === null);
              if (emptyIdx === -1) {
                showToast('Backpack is full.');
                return prev;
              }
              const nextInv = [...prev.inventory];
              const nextStg = [...prev.storage];
              nextInv[emptyIdx] = item;
              nextStg[stgIdx] = null;
              return { ...prev, inventory: nextInv, storage: nextStg };
            });
          }}
          onUnequip={(slot: EquipmentSlot) => {
            setSave((prev) => {
              const item = prev.equipped[slot];
              if (!item) return prev;
              const emptyIdx = prev.inventory.findIndex((s) => s === null);
              if (emptyIdx === -1) {
                showToast('Backpack is full.');
                return prev;
              }
              const nextInv = [...prev.inventory];
              nextInv[emptyIdx] = item;
              const nextEq = { ...prev.equipped, [slot]: null };
              engineRef.current?.updateEquipment(nextEq);
              gameAudio.playEquipGear(slot);
              const updated = { ...prev, inventory: nextInv, equipped: nextEq };
              persistSave(updated);
              return updated;
            });
          }}
          onCraft={(recipeId) => {
            setSave((prev) => {
              const res = craftRecipe(prev.inventory, recipeId);
              if (!res.success) {
                showToast(res.reason || 'Cannot craft item.');
                return prev;
              }
              gameAudio.playAlchemySynth();
              showToast('Crafted successfully!');
              const nextQuests = { ...prev.quests };
              if (nextQuests.q_side_forge && nextQuests.q_side_forge.status !== 'completed') {
                nextQuests.q_side_forge = {
                  ...nextQuests.q_side_forge,
                  status: 'active',
                  progress: nextQuests.q_side_forge.progress + 1,
                };
              }
              const nextVitals =
                res.outputTemplateId === 'astral_core'
                  ? { ...prev.vitals, astralCores: prev.vitals.astralCores + 1 }
                  : prev.vitals;
              const updated = {
                ...prev,
                inventory: res.slots,
                quests: nextQuests,
                vitals: nextVitals,
              };
              persistSave(updated);
              return updated;
            });
          }}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'cultivation' && (
        <CultivationQuestsModal
          vitals={save.vitals}
          quests={save.quests}
          achievements={save.achievements}
          onMeditateTick={() => {
            setSave((prev) => {
              const nextVitals = { ...prev.vitals, qi: prev.vitals.qi + 25 };
              engineRef.current?.updateVitals(nextVitals);
              return { ...prev, vitals: nextVitals };
            });
            gameAudio.playPickup();
          }}
          onBreakthrough={handleBreakthrough}
          onUnlockElement={(el: ElementId) => {
            setSave((prev) => {
              if (prev.vitals.unlockedElements.includes(el)) return prev;
              if (prev.vitals.astralCores < 1) {
                showToast('Requires 1 Astral Core to harmonize a new element.');
                return prev;
              }
              const nextVitals = {
                ...prev.vitals,
                astralCores: prev.vitals.astralCores - 1,
                unlockedElements: [...prev.vitals.unlockedElements, el],
              };
              engineRef.current?.updateVitals(nextVitals);
              showToast(`Harmonized ${el.toUpperCase()} element!`);
              return { ...prev, vitals: nextVitals };
            });
          }}
          onUpgradeSkill={(key: keyof SkillUpgrades) => {
            setSave((prev) => {
              const res = upgradeSkillStat(prev.vitals, key);
              if (!res.success) {
                showToast(res.reason || 'Upgrade failed.');
                return prev;
              }
              engineRef.current?.updateVitals(res.vitals);
              gameAudio.playBreakthrough();
              showToast(`Upgraded ${key} power!`);
              const updated = { ...prev, vitals: res.vitals };
              persistSave(updated);
              return updated;
            });
          }}
          onUpgradeElement={(el: ElementId) => {
            setSave((prev) => {
              const res = upgradeElementRank(prev.vitals, el);
              if (!res.success) {
                showToast(res.reason || 'Cannot empower element.');
                return prev;
              }
              engineRef.current?.updateVitals(res.vitals);
              gameAudio.playBreakthrough();
              showToast(`Empowered ${el.toUpperCase()} art!`);
              const updated = { ...prev, vitals: res.vitals };
              persistSave(updated);
              return updated;
            });
          }}
          onUpgradePower={(powerId: AscensionPowerId) => {
            setSave((prev) => {
              const res = upgradeAscensionPower(prev.vitals, powerId);
              if (!res.success) {
                showToast(res.reason || 'Cannot upgrade power.');
                return prev;
              }
              engineRef.current?.updateVitals(res.vitals);
              gameAudio.playBreakthrough();
              showToast(`Upgraded Ascension Power!`);
              const updated = { ...prev, vitals: res.vitals };
              persistSave(updated);
              return updated;
            });
          }}
          onSetActiveSkillBar={(slotIdx, el) => {
            setSave((prev) => {
              const res = setActiveSkillBar(prev.vitals, slotIdx, el);
              if (!res.success) return prev;
              engineRef.current?.updateVitals(res.vitals);
              const updated = { ...prev, vitals: res.vitals };
              persistSave(updated);
              return updated;
            });
            showToast(`Bound ${el.toUpperCase()} to Hotkey [${slotIdx + 1}]`);
          }}
          onCastPower={(powerId: AscensionPowerId) => {
            if (gameStateRef.current === 'playing') {
              engineRef.current?.activateAscensionPower(powerId);
            }
          }}
          onSelectQuestChoice={(questId, choiceId) => {
            const q = QUESTS.find((item) => item.id === questId);
            const ch = q?.choices?.find((c) => c.id === choiceId);
            if (!ch) return;
            setSave((prev) => ({
              ...prev,
              quests: {
                ...prev.quests,
                [questId]: {
                  ...(prev.quests[questId] ?? { questId, status: 'active', progress: 0 }),
                  chosenOutcome: ch.outcome,
                },
              },
            }));
          }}
          onClaimQuest={(questId) => {
            const q = QUESTS.find((item) => item.id === questId);
            if (!q) return;
            setSave((prev) => {
              const inv = q.rewardItemTemplateId
                ? addItemToInventory(prev.inventory, q.rewardItemTemplateId, 1).slots
                : prev.inventory;
              const nextVitals = {
                ...prev.vitals,
                xp: prev.vitals.xp + q.rewardXp,
                qi: prev.vitals.qi + q.rewardQi,
                skillPoints: (prev.vitals.skillPoints ?? 0) + (q.rewardSkillPoints ?? 0),
              };
              engineRef.current?.updateVitals(nextVitals);
              const updated = {
                ...prev,
                inventory: inv,
                vitals: nextVitals,
                currencies: { ...prev.currencies, gold: prev.currencies.gold + q.rewardGold },
                quests: {
                  ...prev.quests,
                  [questId]: {
                    ...(prev.quests[questId] ?? { questId, progress: q.targetCount }),
                    status: 'completed' as const,
                  },
                },
              };
              persistSave(updated);
              return updated;
            });
            gameAudio.playBreakthrough();
            showToast(`Quest Completed: ${q.title}!`);
          }}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'oracle' && (
        <OracleChatModal
          initialPersona={oraclePersona}
          customPersonaMeta={oracleNpcMeta}
          playerContext={{
            name: save.character.name,
            level: save.vitals.level,
            cultivationRealm: currentRealmMeta.name,
            biome: BIOMES[hud.biome].name,
            primaryElement: save.character.primaryElement,
            secondaryElement: save.character.secondaryElement,
            weapon: save.character.weaponType,
            bossesDefeated: save.defeatedBosses.length,
          }}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'world_hub' && (
        <WorldSystemsModal
          initialTab={worldHubTab}
          initialVendor={vendorFilter}
          currencies={save.currencies}
          inventory={save.inventory}
          mailbox={save.mailbox}
          discoveredRegions={save.discoveredRegions}
          activeMount={save.activeMount}
          activePet={save.activePet}
          petLevel={save.petLevel}
          selectedBuildKind={selectedBuildKind}
          buildings={save.buildings}
          settings={save.settings}
          hudProfiles={save.hudProfiles}
          activeHudProfileIndex={save.activeHudProfileIndex}
          dailyRewardDay={save.dailyRewardDay}
          canClaimDaily={canClaimDaily}
          playerName={save.character.name}
          realmName={currentRealmMeta.name}
          level={save.vitals.level}
          bossesDefeated={save.defeatedBosses.length}
          fortuneRank={save.vitals.skillUpgrades?.fortune ?? 0}
          livingWorld={save.livingWorld}
          hud={hud}
          character={save.character}
          vitals={save.vitals}
          onFastTravel={(x, z, skyY) => {
            engineRef.current?.teleportTo(x, z, skyY);
            showToast('Astral Waystone teleportation complete.');
          }}
          onSelectMount={(m: MountVehicleType) => {
            setSave((prev) => ({ ...prev, activeMount: m }));
            engineRef.current?.setMount(m);
            if (m !== 'none') gameAudio.playEquipGear(m === 'dragon' ? 'elytra' : 'weapon');
          }}
          onSelectPet={(p: PetType) => {
            setSave((prev) => ({ ...prev, activePet: p }));
            engineRef.current?.setPet(p);
          }}
          onEvolvePet={() => {
            setSave((prev) => {
              if (prev.currencies.gold < 120) {
                showToast('Need 120 Gold to evolve companion.');
                return prev;
              }
              gameAudio.playBreakthrough();
              showToast(`Companion evolved to Lv ${prev.petLevel + 1}!`);
              return {
                ...prev,
                petLevel: prev.petLevel + 1,
                currencies: { ...prev.currencies, gold: prev.currencies.gold - 120 },
              };
            });
          }}
          onSelectBuildKind={(kind) => {
            setSelectedBuildKind(kind);
            engineRef.current?.setSelectedBuildKind(kind);
          }}
          onRotateBuild={() => engineRef.current?.rotateBuildPreview()}
          onUpgradeBuilding={handleUpgradeBuilding}
          onDemolishBuilding={(buildingId) => {
            setSave((prev) => {
              const nextBuildings = prev.buildings.filter((b) => b.id !== buildingId);
              engineRef.current?.syncBuildings(nextBuildings);
              const updated = {
                ...prev,
                buildings: nextBuildings,
                currencies: { ...prev.currencies, gold: prev.currencies.gold + 15 },
              };
              persistSave(updated);
              return updated;
            });
            showToast('Structure removed (+15 Gold salvaged).');
          }}
          onBuyOffer={(offerId, qty = 1) => {
            setSave((prev) => {
              const res = purchaseShopOffer(prev.inventory, prev.currencies, offerId, qty);
              if (!res.success) {
                showToast(res.reason || 'Purchase failed.');
                return prev;
              }
              gameAudio.playPickup();
              showToast(`Purchased x${qty}!`);
              const updated = { ...prev, inventory: res.slots, currencies: res.currencies };
              persistSave(updated);
              return updated;
            });
          }}
          onSellItem={(slotIdx) => {
            setSave((prev) => {
              const res = sellInventoryItem(
                prev.inventory,
                prev.currencies,
                slotIdx,
                prev.vitals.skillUpgrades?.fortune ?? 0,
              );
              if (!res.success) return prev;
              gameAudio.playPickup();
              showToast(`Sold item for +${res.earnedGold} Gold!`);
              const updated = { ...prev, inventory: res.slots, currencies: res.currencies };
              persistSave(updated);
              return updated;
            });
          }}
          onInteractFarm={(plotId) => {
            setSave((prev) => {
              const res = interactWithFarmPlot(
                prev.livingWorld,
                prev.inventory,
                plotId,
                prev.vitals.skillUpgrades?.fortune ?? 0,
              );
              engineRef.current?.syncLivingWorld(res.world);
              gameAudio.playPickup();
              showToast(res.message);
              const updated = { ...prev, livingWorld: res.world, inventory: res.inventory };
              persistSave(updated);
              return updated;
            });
          }}
          onSparkNpcConversation={() => {
            const verdant = NPCS.filter((n) => n.biome === 'verdant');
            const a = verdant[Math.floor(Math.random() * verdant.length)];
            const poolB = verdant.filter((n) => n.id !== a.id);
            const b = poolB[Math.floor(Math.random() * poolB.length)];

            setSave((prev) => {
              const nextLiving = tickLivingWorldSimulation(prev.livingWorld, 9.5, Date.now() % 97);
              engineRef.current?.syncLivingWorld(nextLiving);
              return { ...prev, livingWorld: nextLiving };
            });

            fetch('/api/npc/converse', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                npcA: { name: a.name, role: a.role },
                npcB: { name: b.name, role: b.role },
                topic: 'village farms, forged gear prices, and building plans',
              }),
            })
              .then((r) => (r.ok ? r.json() : null))
              .then((data: { lines?: { speaker: string; text: string }[] } | null) => {
                if (!data?.lines || data.lines.length === 0) return;
                setSave((prev) => {
                  const entries = data.lines!.map((ln, idx) => ({
                    id: `ai_chat_${Date.now()}_${idx}`,
                    speakerName: ln.speaker,
                    partnerName: ln.speaker === a.name ? b.name : a.name,
                    line: ln.text,
                    category: 'chat' as const,
                    timestamp: Date.now() + idx,
                  }));
                  const nextLiving = {
                    ...prev.livingWorld,
                    chatterLog: [...entries, ...prev.livingWorld.chatterLog].slice(0, 24),
                  };
                  engineRef.current?.syncLivingWorld(nextLiving);
                  return { ...prev, livingWorld: nextLiving };
                });
              })
              .catch(() => {});
            showToast(`${a.name} & ${b.name} started a village conversation!`);
          }}
          onBuyNpcListing={(listingId) => {
            setSave((prev) => {
              const res = purchaseNpcListing(
                prev.livingWorld,
                prev.inventory,
                prev.currencies,
                listingId,
              );
              if (!res.success) {
                showToast(res.reason || 'Purchase failed.');
                return prev;
              }
              engineRef.current?.syncLivingWorld(res.world);
              gameAudio.playPickup();
              showToast('Purchased villager-crafted merchandise!');
              const updated = {
                ...prev,
                livingWorld: res.world,
                inventory: res.inventory,
                currencies: res.currencies,
              };
              persistSave(updated);
              return updated;
            });
          }}
          onCommissionCraft={(vendor: VendorRole) => {
            setSave((prev) => {
              const res = commissionNpcCraft(prev.livingWorld, prev.currencies, vendor);
              if (!res.success) {
                showToast(res.reason || 'Commission failed.');
                return prev;
              }
              engineRef.current?.syncLivingWorld(res.world);
              gameAudio.playBreakthrough();
              showToast(`Commissioned Masterwork gear from ${vendor}!`);
              const updated = {
                ...prev,
                livingWorld: res.world,
                currencies: res.currencies,
              };
              persistSave(updated);
              return updated;
            });
          }}
          onExchangeCurrency={(from: keyof Currencies, to: keyof Currencies, amount: number) => {
            setSave((prev) => {
              const res = exchangeCurrency(prev.currencies, from, to, amount);
              if (!res.success) {
                showToast(res.reason || 'Exchange failed.');
                return prev;
              }
              gameAudio.playPickup();
              showToast(`Exchanged ${amount} ${from} → +${res.received} ${to}!`);
              const updated = { ...prev, currencies: res.currencies };
              persistSave(updated);
              return updated;
            });
          }}
          onOpenNpcChat={(npcId, npcName, npcRole) => {
            setOraclePersona(npcId);
            setOracleNpcMeta({ id: npcId, name: npcName, role: npcRole });
            setActiveModal('oracle');
          }}
          onClaimDaily={() => {
            setSave((prev) => {
              const updated = {
                ...prev,
                dailyRewardDay: prev.dailyRewardDay + 1,
                lastDailyClaimAt: Date.now(),
                currencies: {
                  ...prev.currencies,
                  gold: prev.currencies.gold + 150,
                  diamonds: prev.currencies.diamonds + 12,
                  emeralds: prev.currencies.emeralds + 2,
                },
              };
              persistSave(updated);
              return updated;
            });
            gameAudio.playBreakthrough();
            showToast('Daily Blessing claimed (+150 Gold, +12 Diamonds, +2 Emeralds)!');
          }}
          onMarkMailRead={(mailId) => {
            setSave((prev) => ({
              ...prev,
              mailbox: prev.mailbox.map((m) => (m.id === mailId ? { ...m, read: true } : m)),
            }));
          }}
          onClaimMail={(mailId) => {
            setSave((prev) => {
              const res = claimMailReward(prev, mailId);
              if (!res.success) {
                showToast(res.reason || 'Cannot claim mail reward.');
                return prev;
              }
              engineRef.current?.updateVitals(res.save.vitals);
              gameAudio.playBreakthrough();
              showToast('Mailbox rewards claimed!');
              persistSave(res.save);
              return res.save;
            });
          }}
          onClaimAllMail={() => {
            setSave((prev) => {
              let cur = prev;
              let claimedAny = false;
              for (const m of prev.mailbox) {
                if (!m.claimed && m.rewards) {
                  const res = claimMailReward(cur, m.id);
                  if (res.success) {
                    cur = res.save;
                    claimedAny = true;
                  }
                }
              }
              if (!claimedAny) {
                showToast('No unclaimed mailbox rewards.');
                return prev;
              }
              engineRef.current?.updateVitals(cur.vitals);
              gameAudio.playBreakthrough();
              showToast('All mailbox rewards claimed!');
              persistSave(cur);
              return cur;
            });
          }}
          onDeleteReadMail={() => {
            setSave((prev) => {
              const updated = {
                ...prev,
                mailbox: prev.mailbox.filter((m) => !m.claimed),
              };
              persistSave(updated);
              return updated;
            });
            showToast('Cleared claimed mail dispatches.');
          }}
          onUpdateSettings={(next: GameSettings) => {
            setSave((prev) => {
              const updated = { ...prev, settings: next };
              engineRef.current?.updateSettings(next);
              persistSave(updated);
              return updated;
            });
          }}
          onUpdateHudProfile={(profile: HudLayoutProfile) => {
            setSave((prev) => {
              const profiles = [...prev.hudProfiles];
              profiles[prev.activeHudProfileIndex] = profile;
              return { ...prev, hudProfiles: profiles };
            });
          }}
          onResetHudLayout={() => {
            setSave((prev) => {
              const profiles = [...prev.hudProfiles];
              profiles[prev.activeHudProfileIndex] = createDefaultHudProfile();
              return { ...prev, hudProfiles: profiles };
            });
          }}
          onManualSave={() => {
            persistSave(save);
            showToast('Progress saved locally.');
          }}
          onExportSaveJson={() => {
            const pos = engineRef.current?.getPosition() ?? save.position;
            const payload = JSON.stringify({ ...save, position: pos, savedAt: Date.now() }, null, 2);
            const blob = new Blob([payload], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `aetheria-save-${save.character.name.toLowerCase().replace(/\s+/g, '-')}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            showToast('Exported save backup (.json)!');
          }}
          onImportSaveJson={(raw) => {
            try {
              const parsed = JSON.parse(raw);
              const { data, recovered } = validateAndRecoverSave(parsed);
              if (recovered) {
                showToast('Invalid save file format.');
                return;
              }
              setSave(data);
              persistSave(data);
              engineRef.current?.updateCharacter(data.character);
              engineRef.current?.updateVitals(data.vitals);
              engineRef.current?.updateEquipment(data.equipped);
              engineRef.current?.updateSettings(data.settings);
              engineRef.current?.syncBuildings(data.buildings);
              engineRef.current?.syncLivingWorld(data.livingWorld);
              engineRef.current?.setMount(data.activeMount);
              engineRef.current?.setPet(data.activePet);
              engineRef.current?.teleportTo(data.position.x, data.position.z);
              showToast('Save imported successfully!');
            } catch {
              showToast('Could not parse save JSON file.');
            }
          }}
          onResetSave={() => {
            const fresh = createDefaultSave();
            localStorage.removeItem(SAVE_KEY);
            setSave(fresh);
            setHasExistingSave(false);
            engineRef.current?.updateCharacter(fresh.character);
            engineRef.current?.updateVitals(fresh.vitals);
            engineRef.current?.updateEquipment(fresh.equipped);
            engineRef.current?.setMount(fresh.activeMount);
            engineRef.current?.setPet(fresh.activePet);
            engineRef.current?.syncBuildings(fresh.buildings);
            engineRef.current?.syncLivingWorld(fresh.livingWorld);
            engineRef.current?.teleportTo(fresh.position.x, fresh.position.z);
            showToast('Save data reset.');
          }}
          onNotify={showToast}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Non-blocking Toast */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-lg bg-[#0b101d] border border-[#e8c468] text-xs font-semibold text-[#e8c468] shadow-2xl pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  );
}
