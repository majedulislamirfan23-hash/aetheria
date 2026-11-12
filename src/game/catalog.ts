import type {
  AchievementState,
  AscensionPowerId,
  BiomeId,
  BuildingPieceKind,
  CultivationRealmId,
  ElementId,
  FarmPlotState,
  HudLayoutProfile,
  InventoryItem,
  LivingWorldState,
  MailMessage,
  MountVehicleType,
  NpcAgentState,
  NpcCraftedListing,
  NpcDefinition,
  PetType,
  QuestDefinition,
  SaveDataV1,
  SkillUpgrades,
  VendorRole,
  WeaponType,
} from './types';

export interface BiomeMeta {
  id: BiomeId;
  name: string;
  subtitle: string;
  ambientTemp: number;
  skyTint: string;
  fogColor: string;
  center: { x: number; z: number };
  radius: number;
  description: string;
}

export const BIOMES: Record<BiomeId, BiomeMeta> = {
  verdant: {
    id: 'verdant',
    name: 'Verdant Kingdom',
    subtitle: 'Heartland of Ancient Rivers',
    ambientTemp: 21,
    skyTint: '#2563eb',
    fogColor: '#1b2b3a',
    center: { x: 0, z: 0 },
    radius: 58,
    description: 'Lush emerald forests, gentle riverbanks, and the Sanctum Village where Scholar Orin and Weaver Clara reside.',
  },
  frostfall: {
    id: 'frostfall',
    name: 'Frostfall Dominion',
    subtitle: 'Glacial Peaks & Frozen Mirrors',
    ambientTemp: -8,
    skyTint: '#38bdf8',
    fogColor: '#1a2736',
    center: { x: -78, z: -58 },
    radius: 50,
    description: 'Crystalline mountain ridges and frozen lakes where frost chargers patrol ancient ice shrines.',
  },
  ember: {
    id: 'ember',
    name: 'Ember Wastes',
    subtitle: 'Volcanic Calderas & Ash Plains',
    ambientTemp: 41,
    skyTint: '#ea580c',
    fogColor: '#2a1814',
    center: { x: 78, z: -55 },
    radius: 50,
    description: 'Obsidian ridges, molten vents, and blazing ember acolytes guarding rare Sunfire Crystals.',
  },
  celestial: {
    id: 'celestial',
    name: 'Celestial Islands',
    subtitle: 'Skyward Ruins & Astral Temples',
    ambientTemp: 17,
    skyTint: '#6366f1',
    fogColor: '#1b213b',
    center: { x: 0, z: -96 },
    radius: 44,
    description: 'Skybound stone archipelagos suspended above the clouds, accessible via Spirit Bridges or Flying Swords.',
  },
  abyssal: {
    id: 'abyssal',
    name: 'Abyssal Frontier',
    subtitle: 'Corrupted Rift & Tombguard Spire',
    ambientTemp: 6,
    skyTint: '#4c1d95',
    fogColor: '#120d1d',
    center: { x: 0, z: 90 },
    radius: 52,
    description: 'A fractured obsidian chasm pulsing with Omega energy where colossi and the Void Emperor awaken.',
  },
};

export interface CultivationRealmMeta {
  id: CultivationRealmId;
  name: string;
  title: string;
  qiRequired: number;
  coresRequired: number;
  hpBonus: number;
  manaBonus: number;
  atkMultiplier: number;
  unlockNote: string;
  auraColor: string;
}

export const CULTIVATION_REALMS: CultivationRealmMeta[] = [
  { id: 0, name: 'Mortal Foundation', title: 'Initiate of Qi', qiRequired: 100, coresRequired: 0, hpBonus: 0, manaBonus: 0, atkMultiplier: 1.0, unlockNote: 'Base dual-element resonance & chakra sprint', auraColor: '#94a3b8' },
  { id: 1, name: 'Spirit Awakening', title: 'Awakened Vessel', qiRequired: 220, coresRequired: 1, hpBonus: 60, manaBonus: 40, atkMultiplier: 1.25, unlockNote: '+25% Skill Damage · Unlocks 3rd Element Slot', auraColor: '#38bdf8' },
  { id: 2, name: 'Core Formation', title: 'Astral Forger', qiRequired: 420, coresRequired: 2, hpBonus: 140, manaBonus: 90, atkMultiplier: 1.55, unlockNote: '+55% Power · Unlocks Elemental Fusion Blast', auraColor: '#22d3ee' },
  { id: 3, name: 'Soul Transformation', title: 'Phantom Sovereign', qiRequired: 720, coresRequired: 4, hpBonus: 260, manaBonus: 160, atkMultiplier: 1.9, unlockNote: 'Awakening Mode Duration +5s · Reduced Stamina Cost', auraColor: '#a78bfa' },
  { id: 4, name: 'Heavenly Ascension', title: 'Skyborne Adept', qiRequired: 1100, coresRequired: 6, hpBonus: 420, manaBonus: 250, atkMultiplier: 2.35, unlockNote: 'Aerial Glide Boost · Unlocks 4th Element Slot', auraColor: '#fbbf24' },
  { id: 5, name: 'Celestial Immortal', title: 'Immortal Starweaver', qiRequired: 1650, coresRequired: 9, hpBonus: 650, manaBonus: 380, atkMultiplier: 2.9, unlockNote: 'Passive Qi Regeneration & Critical Resonance', auraColor: '#f59e0b' },
  { id: 6, name: 'Divine Sovereign', title: 'Ruler of Realms', qiRequired: 2400, coresRequired: 13, hpBonus: 950, manaBonus: 540, atkMultiplier: 3.6, unlockNote: 'Omega Cataclysm Damage +45%', auraColor: '#f43f5e' },
  { id: 7, name: 'Eternal Transcendence', title: 'Omega Incarnate', qiRequired: 3500, coresRequired: 18, hpBonus: 1400, manaBonus: 800, atkMultiplier: 4.5, unlockNote: 'All 8 Elements Harmonized · Transcendent Aura', auraColor: '#fde047' },
];

export interface ElementMeta {
  id: ElementId;
  name: string;
  color: string;
  abilityName: string;
  abilityDesc: string;
  manaCost: number;
  cooldown: number;
  power: number;
  radius: number;
}

export const ELEMENTS: Record<ElementId, ElementMeta> = {
  fire: {
    id: 'fire',
    name: 'Ember Flame',
    color: '#f97316',
    abilityName: 'Solar Flare Tempest',
    abilityDesc: 'Unleashes an expanding ring of searing crimson flame that ignites nearby foes.',
    manaCost: 24,
    cooldown: 4.5,
    power: 58,
    radius: 7.5,
  },
  water: {
    id: 'water',
    name: 'Tidal Azure',
    color: '#0ea5e9',
    abilityName: 'Azure Water Dragon',
    abilityDesc: 'Surges forward with a spiral tidal dragon that damages enemies and cools overheating.',
    manaCost: 22,
    cooldown: 4.0,
    power: 52,
    radius: 8.5,
  },
  wind: {
    id: 'wind',
    name: 'Tempest Gale',
    color: '#34d399',
    abilityName: 'Cyclone Wind Blades',
    abilityDesc: 'Launches slicing emerald gale crescents in a wide arc, knocking enemies back.',
    manaCost: 18,
    cooldown: 3.2,
    power: 46,
    radius: 9.0,
  },
  earth: {
    id: 'earth',
    name: 'Terra Bastion',
    color: '#ca8a04',
    abilityName: 'Monolith Earth Shatter',
    abilityDesc: 'Slams the ground to erect stone pillars, shattering armor and granting brief guard.',
    manaCost: 26,
    cooldown: 5.5,
    power: 64,
    radius: 6.5,
  },
  lightning: {
    id: 'lightning',
    name: 'Storm Arc',
    color: '#38bdf8',
    abilityName: 'Thunder Fang Surge',
    abilityDesc: 'Channels crackling high-voltage lightning through your hand for a piercing dash strike.',
    manaCost: 28,
    cooldown: 5.0,
    power: 72,
    radius: 6.0,
  },
  chakra: {
    id: 'chakra',
    name: 'Astral Chakra',
    color: '#60a5fa',
    abilityName: 'Astral Vortex Sphere',
    abilityDesc: 'Compresses spinning celestial energy into a dense vortex orb that detonates on impact.',
    manaCost: 30,
    cooldown: 5.5,
    power: 78,
    radius: 7.0,
  },
  light: {
    id: 'light',
    name: 'Solar Radiance',
    color: '#fde047',
    abilityName: 'Dawn Halo Judgement',
    abilityDesc: 'Calls down a radiant beam that purges abyssal corruption and restores vitality.',
    manaCost: 34,
    cooldown: 7.0,
    power: 68,
    radius: 8.0,
  },
  darkness: {
    id: 'darkness',
    name: 'Void Eclipse',
    color: '#a855f7',
    abilityName: 'Abyssal Singularity',
    abilityDesc: 'Tears open a gravitational rift that pulls nearby foes inward before collapsing.',
    manaCost: 36,
    cooldown: 7.5,
    power: 84,
    radius: 8.5,
  },
};

export interface WeaponMeta {
  id: WeaponType;
  name: string;
  style: string;
  baseDamage: number;
  speed: number;
  range: number;
  staminaCost: number;
  isRanged?: boolean;
}

export const WEAPONS: Record<WeaponType, WeaponMeta> = {
  katana: { id: 'katana', name: 'Astral Katana', style: 'Swift Precision Slashes', baseDamage: 26, speed: 1.15, range: 3.6, staminaCost: 8 },
  dual_blades: { id: 'dual_blades', name: 'Twin Crescent Blades', style: 'Rapid Flurry Combos', baseDamage: 20, speed: 1.45, range: 3.0, staminaCost: 6 },
  greatsword: { id: 'greatsword', name: 'Colossus Claymore', style: 'Heavy Cleave & Guard Break', baseDamage: 42, speed: 0.78, range: 4.3, staminaCost: 14 },
  spear: { id: 'spear', name: 'Skybreaker Halberd', style: 'Long-Reach Thrusts', baseDamage: 30, speed: 1.0, range: 4.9, staminaCost: 10 },
  bow: { id: 'bow', name: 'Starfall Longbow', style: 'Piercing Energy Arrows', baseDamage: 25, speed: 1.1, range: 18, staminaCost: 7, isRanged: true },
  dagger: { id: 'dagger', name: 'Shadowfang Dirk', style: 'High-Crit Backstabs', baseDamage: 18, speed: 1.6, range: 2.6, staminaCost: 5 },
  staff: { id: 'staff', name: 'Sovereign Conduit Staff', style: 'Arcane Bolt Volley', baseDamage: 28, speed: 1.05, range: 16, staminaCost: 8, isRanged: true },
  aether_rifle: { id: 'aether_rifle', name: 'Omega Pulse Carbine', style: 'Aether Rounds & Bursts', baseDamage: 32, speed: 1.2, range: 22, staminaCost: 9, isRanged: true },
};

export const ITEM_TEMPLATES: Record<string, Omit<InventoryItem, 'id' | 'quantity'>> = {
  wood: { templateId: 'wood', name: 'Heartwood Timber', category: 'resource', rarity: 'common', maxStack: 99, description: 'Sturdy timber harvested from Verdant groves.', stats: { sellValue: 4 } },
  stone: { templateId: 'stone', name: 'Basalt Stone', category: 'resource', rarity: 'common', maxStack: 99, description: 'Dense carved stone for foundations and tools.', stats: { sellValue: 5 } },
  iron: { templateId: 'iron', name: 'Starsteel Iron', category: 'resource', rarity: 'uncommon', maxStack: 99, description: 'Refined iron ore veined with pale shimmer.', stats: { sellValue: 14 } },
  gold_ore: { templateId: 'gold_ore', name: 'Sun-Gold Ore', category: 'resource', rarity: 'rare', maxStack: 99, description: 'Conductive auric mineral prized by smiths.', stats: { sellValue: 26 } },
  crystal: { templateId: 'crystal', name: 'Aether Crystal', category: 'material', rarity: 'rare', maxStack: 99, description: 'Crystallized mana harvested from ley outcrops.', stats: { sellValue: 22 } },
  rare_mineral: { templateId: 'rare_mineral', name: 'Frostfire Mithril', category: 'material', rarity: 'epic', maxStack: 50, description: 'Dual-natured mineral forged between ice and magma.', stats: { sellValue: 48 } },
  ancient_material: { templateId: 'ancient_material', name: 'Relic Core Shard', category: 'material', rarity: 'epic', maxStack: 50, description: 'Fragment of an extinct Omega civilization construct.', stats: { sellValue: 55 } },
  astral_fragment: { templateId: 'astral_fragment', name: 'Astral Fragment', category: 'core', rarity: 'mythic', maxStack: 50, description: 'Condensed starlight used to refine Astral Cores.', stats: { sellValue: 80 } },
  astral_core: { templateId: 'astral_core', name: 'Astral Core', category: 'core', rarity: 'celestial', maxStack: 20, description: 'Pure crystallized cultivation core required for realm breakthroughs.', stats: { qiGain: 120, sellValue: 180 } },

  // Chemist Potions & Brews
  health_elixir: { templateId: 'health_elixir', name: 'Crimson Vitality Elixir', category: 'consumable', rarity: 'uncommon', maxStack: 20, description: 'Restores 120 HP instantly.', stats: { healHp: 120, sellValue: 14 } },
  mana_draught: { templateId: 'mana_draught', name: 'Azure Spirit Draught', category: 'consumable', rarity: 'uncommon', maxStack: 20, description: 'Restores 90 Mana & 35 Qi.', stats: { healMana: 90, qiGain: 35, sellValue: 16 } },
  roasted_feast: { templateId: 'roasted_feast', name: 'Spiced Herb Feast', category: 'consumable', rarity: 'common', maxStack: 20, description: 'Hearty meal restoring 45 Hunger, 25 Thirst, and 40 HP.', stats: { healHunger: 45, healThirst: 25, healHp: 40, sellValue: 10 } },
  spring_flask: { templateId: 'spring_flask', name: 'Glacial Spring Flask', category: 'consumable', rarity: 'common', maxStack: 20, description: 'Pure mountain water restoring 55 Thirst.', stats: { healThirst: 55, sellValue: 8 } },
  frostfire_tonic: { templateId: 'frostfire_tonic', name: 'Frostfire Alchemist Tonic', category: 'consumable', rarity: 'rare', maxStack: 16, description: 'Chemist brew restoring 180 HP, 110 Mana, and stabilizing temperature.', stats: { healHp: 180, healMana: 110, qiGain: 45, sellValue: 38 } },
  berserker_serum: { templateId: 'berserker_serum', name: 'Omega Surge Serum', category: 'consumable', rarity: 'epic', maxStack: 10, description: 'Potent combat serum restoring 100% stamina and +75 Qi.', stats: { healHp: 90, qiGain: 75, sellValue: 52 } },
  golden_bread: { templateId: 'golden_bread', name: 'Village Hearth Loaf', category: 'consumable', rarity: 'common', maxStack: 25, description: 'Freshly baked wheat bread harvested by Verdant farmers (+55 Hunger, +35 HP).', stats: { healHunger: 55, healHp: 35, sellValue: 12 } },
  sunberry_ration: { templateId: 'sunberry_ration', name: 'Sunberry Vitality Tart', category: 'consumable', rarity: 'uncommon', maxStack: 20, description: 'Sweet orchard ration restoring 40 Hunger, 40 Thirst, and +65 HP.', stats: { healHunger: 40, healThirst: 40, healHp: 65, sellValue: 18 } },
  aether_salad: { templateId: 'aether_salad', name: 'Aether Herb Infusion', category: 'consumable', rarity: 'rare', maxStack: 20, description: 'Cultivated spirit-herb meal restoring 50 Mana, 35 Hunger, and +25 Qi.', stats: { healHunger: 35, healMana: 50, qiGain: 25, sellValue: 26 } },

  // Blacksmith Weapons
  blade_starfall: { templateId: 'blade_starfall', name: 'Starfall Demon Katana', category: 'weapon', rarity: 'epic', maxStack: 1, description: 'Forged with astral fragments to channel lightning and chakra.', stats: { attack: 48, weaponType: 'katana', element: 'lightning', sellValue: 140 } },
  claymore_omega: { templateId: 'claymore_omega', name: 'Omega Breaker Greatsword', category: 'weapon', rarity: 'mythic', maxStack: 1, description: 'Colossal edge capable of cleaving tombguard plating.', stats: { attack: 74, weaponType: 'greatsword', element: 'darkness', sellValue: 260 } },
  twin_crescent: { templateId: 'twin_crescent', name: 'Crimson Crescent Blades', category: 'weapon', rarity: 'rare', maxStack: 1, description: 'Dual-balanced blades built for relentless off-hand & main-hand combos.', stats: { attack: 42, weaponType: 'dual_blades', element: 'fire', critBonus: 0.08, sellValue: 120 } },
  spear_skybreaker: { templateId: 'spear_skybreaker', name: 'Skybreaker Halberd', category: 'weapon', rarity: 'epic', maxStack: 1, description: 'Long-reach polearm forged for cavalry and aerial thrusts.', stats: { attack: 56, weaponType: 'spear', element: 'wind', sellValue: 165 } },
  dagger_shadowfang: { templateId: 'dagger_shadowfang', name: 'Shadowfang Off-Hand Dirk', category: 'weapon', rarity: 'rare', maxStack: 1, description: 'Razor-light blade ideal for dual-wielding in the Off-Hand.', stats: { attack: 34, weaponType: 'dagger', element: 'darkness', critBonus: 0.14, sellValue: 95 } },
  sovereign_katana_mk2: { templateId: 'sovereign_katana_mk2', name: 'Kael Masterwork Katana', category: 'weapon', rarity: 'mythic', maxStack: 1, description: 'Hand-forged by Verdant smiths from Starsteel and Astral ore (+66 ATK).', stats: { attack: 66, weaponType: 'katana', element: 'lightning', critBonus: 0.1, sellValue: 245 } },

  // Fletcher Bows & Quivers
  bow_starfall: { templateId: 'bow_starfall', name: 'Starfall Longbow', category: 'weapon', rarity: 'rare', maxStack: 1, description: 'Fletcher masterwork firing concentrated starlight arrows.', stats: { attack: 44, weaponType: 'bow', element: 'wind', sellValue: 130 } },
  bow_gale: { templateId: 'bow_gale', name: 'Tempest Gale Recurve', category: 'weapon', rarity: 'epic', maxStack: 1, description: 'High-velocity compound bow crafted with astral sinew.', stats: { attack: 58, weaponType: 'bow', element: 'lightning', critBonus: 0.1, sellValue: 190 } },
  quiver_piercing: { templateId: 'quiver_piercing', name: 'Astral Piercing Quiver', category: 'ammo', rarity: 'rare', maxStack: 1, description: 'Accessory quiver boosting ranged attack & critical precision (+12 ATK, +8% Crit).', stats: { attack: 12, critBonus: 0.08, sellValue: 85 } },

  // Gunsmith Firearms
  aether_carbine: { templateId: 'aether_carbine', name: 'Celestial Pulse Rifle', category: 'weapon', rarity: 'epic', maxStack: 1, description: 'Precision crystal-chambered firearm firing concentrated mana bolts.', stats: { attack: 54, weaponType: 'aether_rifle', element: 'light', sellValue: 175 } },
  pistol_twin_pulse: { templateId: 'pistol_twin_pulse', name: 'Omega Arc Revolver', category: 'weapon', rarity: 'rare', maxStack: 1, description: 'Compact energy sidearm usable in Main Hand or Off-Hand.', stats: { attack: 40, weaponType: 'aether_rifle', element: 'lightning', sellValue: 125 } },
  railgun_celestial: { templateId: 'railgun_celestial', name: 'Sovereign Rail Cannon', category: 'weapon', rarity: 'mythic', maxStack: 1, description: 'Heavy experimental firearm delivering devastating astral slugs.', stats: { attack: 82, weaponType: 'aether_rifle', element: 'chakra', sellValue: 320 } },

  // Toolsmith Gear & Off-hand Tools
  tool_pickaxe: { templateId: 'tool_pickaxe', name: 'Starsteel Pickaxe', category: 'tool', rarity: 'uncommon', maxStack: 1, description: 'Doubles mineral and crystal mining yield when held in either hand.', stats: { attack: 18, sellValue: 55 } },
  tool_greataxe: { templateId: 'tool_greataxe', name: 'Heartwood Harvester Axe', category: 'tool', rarity: 'uncommon', maxStack: 1, description: 'Fells ancient timber and carves wood quickly.', stats: { attack: 24, sellValue: 55 } },
  torch_astral: { templateId: 'torch_astral', name: 'Astral Beacon Lantern', category: 'tool', rarity: 'rare', maxStack: 1, description: 'Off-hand relic radiating warmth in Frostfall and illuminating caves.', stats: { attack: 8, defense: 6, sellValue: 70 } },

  // Armorer Armor Set, Shields & Elytra Wings
  helm_warden: { templateId: 'helm_warden', name: 'Starsteel Warden Helm', category: 'armor', rarity: 'rare', maxStack: 1, description: 'Forged helm protecting against lethal blows (+14 DEF).', stats: { defense: 14, armorSlot: 'helmet', sellValue: 90 } },
  armor_warden: { templateId: 'armor_warden', name: 'Celestial Warden Plate', category: 'armor', rarity: 'rare', maxStack: 1, description: 'Layered astral silk and starsteel chestplate (+24 DEF).', stats: { defense: 24, armorSlot: 'armor', sellValue: 130 } },
  legs_warden: { templateId: 'legs_warden', name: 'Vanguard Greaves', category: 'armor', rarity: 'rare', maxStack: 1, description: 'Articulated leg armor enhancing balance (+16 DEF).', stats: { defense: 16, armorSlot: 'leggings', sellValue: 95 } },
  boots_warden: { templateId: 'boots_warden', name: 'Astral Strider Boots', category: 'armor', rarity: 'rare', maxStack: 1, description: 'Shock-absorbing boots for cliff landings (+12 DEF).', stats: { defense: 12, armorSlot: 'boots', sellValue: 85 } },
  armor_sovereign: { templateId: 'armor_sovereign', name: 'Omega Sovereign Vestment', category: 'armor', rarity: 'mythic', maxStack: 1, description: 'Woven by Weaver Clara from astral threads (+46 DEF).', stats: { defense: 46, armorSlot: 'armor', sellValue: 280 } },
  mithril_bastion_plate: { templateId: 'mithril_bastion_plate', name: 'Garrick Mithril Cuirass', category: 'armor', rarity: 'epic', maxStack: 1, description: 'NPC-forged heavy chestplate tempered with Frostfire Mithril (+36 DEF).', stats: { defense: 36, armorSlot: 'armor', sellValue: 210 } },
  shield_bulwark: { templateId: 'shield_bulwark', name: 'Aegis Sky Shield', category: 'shield', rarity: 'rare', maxStack: 1, description: 'Equip in Off-Hand to block incoming boss strikes (+20 DEF).', stats: { defense: 20, sellValue: 110 } },
  elytra_aether: { templateId: 'elytra_aether', name: 'Aether Wing Elytra', category: 'elytra', rarity: 'epic', maxStack: 1, description: 'Equip in the Elytra Wing slot to glide across canyons & islands.', stats: { defense: 8, glideSpeed: 22, sellValue: 190 } },
  elytra_celestial: { templateId: 'elytra_celestial', name: 'Celestial Phoenix Elytra', category: 'elytra', rarity: 'celestial', maxStack: 1, description: 'Mythic winged mantle granting ultra-fast soaring glide & fire aura.', stats: { defense: 18, glideSpeed: 30, sellValue: 420 } },

  // Building Kits
  kit_wall: { templateId: 'kit_wall', name: 'Timber Wall Kit', category: 'building', rarity: 'common', maxStack: 30, description: 'Placeable defensive timber wall.', buildKind: 'wood_wall', stats: { sellValue: 6 } },
  kit_stone_wall: { templateId: 'kit_stone_wall', name: 'Bastion Stone Wall', category: 'building', rarity: 'uncommon', maxStack: 30, description: 'Reinforced stone fortress wall.', buildKind: 'stone_wall', stats: { sellValue: 10 } },
  kit_glass_wall: { templateId: 'kit_glass_wall', name: 'Crystal Window Wall', category: 'building', rarity: 'uncommon', maxStack: 30, description: 'Luminous window wall for houses.', buildKind: 'glass_wall', stats: { sellValue: 12 } },
  kit_doorway: { templateId: 'kit_doorway', name: 'Sanctuary Arch Doorway', category: 'building', rarity: 'uncommon', maxStack: 20, description: 'Arched entrance frame for your homestead.', buildKind: 'doorway', stats: { sellValue: 12 } },
  kit_floor: { templateId: 'kit_floor', name: 'Timber Floor Deck', category: 'building', rarity: 'common', maxStack: 30, description: 'Elevated wooden floor platform.', buildKind: 'wood_floor', stats: { sellValue: 6 } },
  kit_roof: { templateId: 'kit_roof', name: 'Sloped Sanctuary Roof', category: 'building', rarity: 'common', maxStack: 30, description: 'Angled roof sheltering against storms.', buildKind: 'slate_roof', stats: { sellValue: 8 } },
  kit_watchtower: { templateId: 'kit_watchtower', name: 'Bastion Pillar', category: 'building', rarity: 'uncommon', maxStack: 20, description: 'Tall defensive support column.', buildKind: 'watchtower', stats: { sellValue: 14 } },
  kit_stairs: { templateId: 'kit_stairs', name: 'Carved Stone Stairs', category: 'building', rarity: 'common', maxStack: 30, description: 'Ascendable multi-floor staircase.', buildKind: 'stone_stairs', stats: { sellValue: 9 } },
  kit_campfire: { templateId: 'kit_campfire', name: 'Astral Hearth Campfire', category: 'building', rarity: 'uncommon', maxStack: 10, description: 'Warms nearby allies and enables cooking.', buildKind: 'campfire', stats: { sellValue: 15 } },
  kit_chest: { templateId: 'kit_chest', name: 'Storage Strongbox', category: 'building', rarity: 'uncommon', maxStack: 10, description: 'Expandable storage chest for your homestead.', buildKind: 'storage_chest', stats: { sellValue: 20 } },
  kit_beacon: { templateId: 'kit_beacon', name: 'Aether Sanctuary Beacon', category: 'building', rarity: 'epic', maxStack: 5, description: 'Projects a regenerative Qi aura around your homestead.', buildKind: 'aether_beacon', stats: { sellValue: 65 } },
};

export interface CraftingRecipe {
  id: string;
  outputTemplateId: string;
  outputQty: number;
  category: 'Potions & Food' | 'Weapons & Armor' | 'Cultivation' | 'Building';
  ingredients: { templateId: string; qty: number }[];
}

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  { id: 'rec_elixir', outputTemplateId: 'health_elixir', outputQty: 2, category: 'Potions & Food', ingredients: [{ templateId: 'crystal', qty: 1 }, { templateId: 'wood', qty: 1 }] },
  { id: 'rec_mana', outputTemplateId: 'mana_draught', outputQty: 2, category: 'Potions & Food', ingredients: [{ templateId: 'crystal', qty: 2 }] },
  { id: 'rec_tonic', outputTemplateId: 'frostfire_tonic', outputQty: 1, category: 'Potions & Food', ingredients: [{ templateId: 'crystal', qty: 2 }, { templateId: 'rare_mineral', qty: 1 }] },
  { id: 'rec_feast', outputTemplateId: 'roasted_feast', outputQty: 2, category: 'Potions & Food', ingredients: [{ templateId: 'wood', qty: 2 }] },
  { id: 'rec_flask', outputTemplateId: 'spring_flask', outputQty: 2, category: 'Potions & Food', ingredients: [{ templateId: 'stone', qty: 1 }, { templateId: 'crystal', qty: 1 }] },
  { id: 'rec_core', outputTemplateId: 'astral_core', outputQty: 1, category: 'Cultivation', ingredients: [{ templateId: 'astral_fragment', qty: 2 }, { templateId: 'crystal', qty: 3 }] },
  { id: 'rec_katana', outputTemplateId: 'blade_starfall', outputQty: 1, category: 'Weapons & Armor', ingredients: [{ templateId: 'iron', qty: 4 }, { templateId: 'crystal', qty: 3 }] },
  { id: 'rec_bow', outputTemplateId: 'bow_starfall', outputQty: 1, category: 'Weapons & Armor', ingredients: [{ templateId: 'wood', qty: 4 }, { templateId: 'crystal', qty: 2 }] },
  { id: 'rec_carbine', outputTemplateId: 'aether_carbine', outputQty: 1, category: 'Weapons & Armor', ingredients: [{ templateId: 'iron', qty: 4 }, { templateId: 'gold_ore', qty: 2 }, { templateId: 'crystal', qty: 3 }] },
  { id: 'rec_claymore', outputTemplateId: 'claymore_omega', outputQty: 1, category: 'Weapons & Armor', ingredients: [{ templateId: 'rare_mineral', qty: 3 }, { templateId: 'ancient_material', qty: 2 }, { templateId: 'astral_fragment', qty: 2 }] },
  { id: 'rec_helm', outputTemplateId: 'helm_warden', outputQty: 1, category: 'Weapons & Armor', ingredients: [{ templateId: 'iron', qty: 3 }, { templateId: 'stone', qty: 2 }] },
  { id: 'rec_armor1', outputTemplateId: 'armor_warden', outputQty: 1, category: 'Weapons & Armor', ingredients: [{ templateId: 'iron', qty: 5 }, { templateId: 'stone', qty: 3 }] },
  { id: 'rec_legs', outputTemplateId: 'legs_warden', outputQty: 1, category: 'Weapons & Armor', ingredients: [{ templateId: 'iron', qty: 4 }, { templateId: 'wood', qty: 2 }] },
  { id: 'rec_boots', outputTemplateId: 'boots_warden', outputQty: 1, category: 'Weapons & Armor', ingredients: [{ templateId: 'iron', qty: 3 }, { templateId: 'wood', qty: 2 }] },
  { id: 'rec_shield', outputTemplateId: 'shield_bulwark', outputQty: 1, category: 'Weapons & Armor', ingredients: [{ templateId: 'iron', qty: 4 }, { templateId: 'wood', qty: 3 }] },
  { id: 'rec_elytra', outputTemplateId: 'elytra_aether', outputQty: 1, category: 'Weapons & Armor', ingredients: [{ templateId: 'crystal', qty: 4 }, { templateId: 'astral_fragment', qty: 2 }] },
  { id: 'rec_armor2', outputTemplateId: 'armor_sovereign', outputQty: 1, category: 'Weapons & Armor', ingredients: [{ templateId: 'rare_mineral', qty: 3 }, { templateId: 'astral_fragment', qty: 3 }] },
  { id: 'rec_wall', outputTemplateId: 'kit_wall', outputQty: 3, category: 'Building', ingredients: [{ templateId: 'wood', qty: 3 }] },
  { id: 'rec_swall', outputTemplateId: 'kit_stone_wall', outputQty: 3, category: 'Building', ingredients: [{ templateId: 'stone', qty: 4 }] },
  { id: 'rec_gwall', outputTemplateId: 'kit_glass_wall', outputQty: 2, category: 'Building', ingredients: [{ templateId: 'wood', qty: 2 }, { templateId: 'crystal', qty: 1 }] },
  { id: 'rec_door', outputTemplateId: 'kit_doorway', outputQty: 2, category: 'Building', ingredients: [{ templateId: 'wood', qty: 3 }, { templateId: 'stone', qty: 2 }] },
  { id: 'rec_floor', outputTemplateId: 'kit_floor', outputQty: 3, category: 'Building', ingredients: [{ templateId: 'wood', qty: 2 }] },
  { id: 'rec_roof', outputTemplateId: 'kit_roof', outputQty: 2, category: 'Building', ingredients: [{ templateId: 'wood', qty: 2 }, { templateId: 'stone', qty: 1 }] },
  { id: 'rec_stairs', outputTemplateId: 'kit_stairs', outputQty: 2, category: 'Building', ingredients: [{ templateId: 'stone', qty: 3 }] },
  { id: 'rec_camp', outputTemplateId: 'kit_campfire', outputQty: 1, category: 'Building', ingredients: [{ templateId: 'wood', qty: 3 }, { templateId: 'stone', qty: 3 }] },
  { id: 'rec_chest', outputTemplateId: 'kit_chest', outputQty: 1, category: 'Building', ingredients: [{ templateId: 'wood', qty: 4 }, { templateId: 'iron', qty: 1 }] },
  { id: 'rec_beacon', outputTemplateId: 'kit_beacon', outputQty: 1, category: 'Building', ingredients: [{ templateId: 'crystal', qty: 3 }, { templateId: 'astral_fragment', qty: 1 }] },
];

export interface ShopOffer {
  id: string;
  templateId: string;
  vendor: VendorRole;
  currency: 'gold' | 'diamonds' | 'emeralds' | 'ancientCoins';
  price: number;
}

export const VENDOR_META: Record<VendorRole, { label: string; title: string; keeper: string; accent: string }> = {
  chemist: { label: 'Chemist', title: 'Alchemical Apothecary', keeper: 'Chemist Vesper', accent: '#34d399' },
  armorer: { label: 'Armorer', title: 'Bastion Armor & Elytra Guild', keeper: 'Armorer Garrick', accent: '#60a5fa' },
  fletcher: { label: 'Fletcher', title: 'Gale-Wing Bowyer & Quivers', keeper: 'Fletcher Sylvan', accent: '#a3e635' },
  gunsmith: { label: 'Gunsmith', title: 'Omega Aether Ballistics', keeper: 'Gunsmith Vance', accent: '#f472b6' },
  blacksmith: { label: 'Blacksmith', title: 'Starsteel Blade Forge', keeper: 'Blacksmith Kael', accent: '#fb923c' },
  toolsmith: { label: 'Toolsmith', title: 'Architect & Harvester Works', keeper: 'Toolsmith Orson', accent: '#facc15' },
};

export const SHOP_OFFERS: ShopOffer[] = [
  // Chemist
  { id: 'shop_elixir', templateId: 'health_elixir', vendor: 'chemist', currency: 'gold', price: 35 },
  { id: 'shop_mana', templateId: 'mana_draught', vendor: 'chemist', currency: 'gold', price: 40 },
  { id: 'shop_feast', templateId: 'roasted_feast', vendor: 'chemist', currency: 'gold', price: 25 },
  { id: 'shop_flask', templateId: 'spring_flask', vendor: 'chemist', currency: 'gold', price: 20 },
  { id: 'shop_tonic', templateId: 'frostfire_tonic', vendor: 'chemist', currency: 'gold', price: 95 },
  { id: 'shop_serum', templateId: 'berserker_serum', vendor: 'chemist', currency: 'emeralds', price: 3 },
  { id: 'shop_crystal', templateId: 'crystal', vendor: 'chemist', currency: 'gold', price: 65 },
  // Armorer
  { id: 'shop_helm', templateId: 'helm_warden', vendor: 'armorer', currency: 'gold', price: 210 },
  { id: 'shop_armor', templateId: 'armor_warden', vendor: 'armorer', currency: 'gold', price: 320 },
  { id: 'shop_legs', templateId: 'legs_warden', vendor: 'armorer', currency: 'gold', price: 230 },
  { id: 'shop_boots', templateId: 'boots_warden', vendor: 'armorer', currency: 'gold', price: 195 },
  { id: 'shop_shield', templateId: 'shield_bulwark', vendor: 'armorer', currency: 'gold', price: 240 },
  { id: 'shop_elytra', templateId: 'elytra_aether', vendor: 'armorer', currency: 'gold', price: 460 },
  { id: 'shop_elytra_cel', templateId: 'elytra_celestial', vendor: 'armorer', currency: 'diamonds', price: 42 },
  { id: 'shop_sovereign', templateId: 'armor_sovereign', vendor: 'armorer', currency: 'ancientCoins', price: 14 },
  // Fletcher
  { id: 'shop_bow_star', templateId: 'bow_starfall', vendor: 'fletcher', currency: 'gold', price: 290 },
  { id: 'shop_bow_gale', templateId: 'bow_gale', vendor: 'fletcher', currency: 'emeralds', price: 6 },
  { id: 'shop_quiver', templateId: 'quiver_piercing', vendor: 'fletcher', currency: 'gold', price: 185 },
  // Gunsmith
  { id: 'shop_pistol', templateId: 'pistol_twin_pulse', vendor: 'gunsmith', currency: 'gold', price: 280 },
  { id: 'shop_carbine', templateId: 'aether_carbine', vendor: 'gunsmith', currency: 'diamonds', price: 25 },
  { id: 'shop_railgun', templateId: 'railgun_celestial', vendor: 'gunsmith', currency: 'ancientCoins', price: 16 },
  // Blacksmith
  { id: 'shop_katana', templateId: 'blade_starfall', vendor: 'blacksmith', currency: 'gold', price: 380 },
  { id: 'shop_crescent', templateId: 'twin_crescent', vendor: 'blacksmith', currency: 'gold', price: 300 },
  { id: 'shop_dirk', templateId: 'dagger_shadowfang', vendor: 'blacksmith', currency: 'gold', price: 220 },
  { id: 'shop_spear', templateId: 'spear_skybreaker', vendor: 'blacksmith', currency: 'emeralds', price: 7 },
  { id: 'shop_claymore', templateId: 'claymore_omega', vendor: 'blacksmith', currency: 'ancientCoins', price: 12 },
  // Toolsmith
  { id: 'shop_pickaxe', templateId: 'tool_pickaxe', vendor: 'toolsmith', currency: 'gold', price: 110 },
  { id: 'shop_greataxe', templateId: 'tool_greataxe', vendor: 'toolsmith', currency: 'gold', price: 115 },
  { id: 'shop_lantern', templateId: 'torch_astral', vendor: 'toolsmith', currency: 'gold', price: 160 },
  { id: 'shop_fragment', templateId: 'astral_fragment', vendor: 'toolsmith', currency: 'emeralds', price: 4 },
  { id: 'shop_core', templateId: 'astral_core', vendor: 'toolsmith', currency: 'ancientCoins', price: 5 },
  { id: 'shop_kit_beacon', templateId: 'kit_beacon', vendor: 'toolsmith', currency: 'gold', price: 180 },
];

export const NPCS: NpcDefinition[] = [
  {
    id: 'scholar_orin',
    name: 'Scholar Orin',
    role: 'Scholar',
    biome: 'verdant',
    x: -7,
    z: -10,
    patrolRadius: 3.5,
    robeColor: '#1e3a8a',
    accentColor: '#38bdf8',
    greeting: 'The Omega Fracture ripples across all five realms. Ask me about the ancient civilizations or your bloodline.',
    questId: 'q_main_1',
  },
  {
    id: 'weaver_clara',
    name: 'Weaver Clara',
    role: 'Weaver',
    biome: 'verdant',
    x: 8,
    z: -9,
    patrolRadius: 3.0,
    robeColor: '#6d28d9',
    accentColor: '#e8c468',
    greeting: 'Astral silk binds memory to form. Bring me materials and I shall weave vestments worthy of a Sovereign.',
    questId: 'q_side_clara',
  },
  {
    id: 'smith_kael',
    name: 'Blacksmith Kael',
    role: 'Blacksmith',
    vendorTab: 'blacksmith',
    biome: 'verdant',
    x: 13,
    z: 6,
    patrolRadius: 2.0,
    robeColor: '#7c2d12',
    accentColor: '#fb923c',
    greeting: 'Every blade sings when tempered with Starsteel and Aether Crystal. Browse my blade forge anytime.',
    questId: 'q_side_forge',
  },
  {
    id: 'merchant_lyra',
    name: 'Merchant Lyra',
    role: 'Merchant',
    vendorTab: 'chemist',
    biome: 'verdant',
    x: -13,
    z: 5,
    patrolRadius: 2.5,
    robeColor: '#065f46',
    accentColor: '#fde047',
    greeting: 'Finest elixirs, building kits, and rare relics from across the Dominion!',
  },
  {
    id: 'chemist_vesper',
    name: 'Chemist Vesper',
    role: 'Chemist',
    vendorTab: 'chemist',
    biome: 'verdant',
    x: -20,
    z: -3,
    patrolRadius: 2.0,
    robeColor: '#047857',
    accentColor: '#34d399',
    greeting: 'Brewing restorative elixirs, Frostfire tonics, and Omega surge serums for dangerous expeditions.',
  },
  {
    id: 'armorer_garrick',
    name: 'Armorer Garrick',
    role: 'Armorer',
    vendorTab: 'armorer',
    biome: 'verdant',
    x: 20,
    z: -3,
    patrolRadius: 2.0,
    robeColor: '#1d4ed8',
    accentColor: '#93c5fd',
    greeting: 'Full plate sets, Sky Shields, and gliding Aether Elytra wings—step up and outfit both hands and back.',
  },
  {
    id: 'fletcher_sylvan',
    name: 'Fletcher Sylvan',
    role: 'Fletcher',
    vendorTab: 'fletcher',
    biome: 'verdant',
    x: -22,
    z: 12,
    patrolRadius: 2.2,
    robeColor: '#3f6212',
    accentColor: '#a3e635',
    greeting: 'Precision longbows, Gale recurves, and piercing quivers tuned for aerial wind currents.',
  },
  {
    id: 'gunsmith_vance',
    name: 'Gunsmith Vance',
    role: 'Gunsmith',
    vendorTab: 'gunsmith',
    biome: 'verdant',
    x: 22,
    z: 12,
    patrolRadius: 2.2,
    robeColor: '#831843',
    accentColor: '#f472b6',
    greeting: 'Crystal-chambered Pulse Rifles, Omega Revolvers, and Sovereign Rail Cannons built for modern cultivators.',
  },
  {
    id: 'toolsmith_orson',
    name: 'Toolsmith Orson',
    role: 'Toolsmith',
    vendorTab: 'toolsmith',
    biome: 'verdant',
    x: 10,
    z: 16,
    patrolRadius: 2.2,
    robeColor: '#854d0e',
    accentColor: '#facc15',
    greeting: 'Starsteel Pickaxes, Greataxes, Astral Lanterns, and Sanctuary Beacons to expand your homestead.',
  },
  {
    id: 'healer_aria',
    name: 'Healer Aria',
    role: 'Healer',
    biome: 'verdant',
    x: 0,
    z: -17,
    patrolRadius: 2.5,
    robeColor: '#f8fafc',
    accentColor: '#34d399',
    greeting: 'Rest near the Sanctum Shrine, traveler. Let the gentle Qi mend your spirit.',
  },
  {
    id: 'guard_thorne',
    name: 'Captain Thorne',
    role: 'Guard',
    biome: 'verdant',
    x: 0,
    z: 18,
    patrolRadius: 7.0,
    robeColor: '#334155',
    accentColor: '#eab308',
    greeting: 'The southern road leads toward the Abyssal Frontier. Stay sharp—Wezaemon stirs.',
    questId: 'q_main_2',
  },
  {
    id: 'frost_sage',
    name: 'Elder Seris',
    role: 'QuestGiver',
    biome: 'frostfall',
    x: -74,
    z: -52,
    patrolRadius: 3.0,
    robeColor: '#0c4a6e',
    accentColor: '#7dd3fc',
    greeting: 'Cold preserves ancient truth. Seek the Glacial Mirror if you wish to awaken your core.',
    questId: 'q_hidden_frost',
  },
  {
    id: 'farmer_rowan',
    name: 'Farmer Rowan',
    role: 'Farmer',
    vendorTab: 'chemist',
    biome: 'verdant',
    x: -26,
    z: -14,
    patrolRadius: 5.5,
    robeColor: '#3f6212',
    accentColor: '#facc15',
    greeting: 'Our irrigated plots feed the whole village! We plant wheat, sunberries, and spirit herbs daily and send surplus straight to market.',
  },
  {
    id: 'mason_cedric',
    name: 'Mason Cedric',
    role: 'Mason',
    vendorTab: 'toolsmith',
    biome: 'verdant',
    x: 26,
    z: -16,
    patrolRadius: 5.0,
    robeColor: '#475569',
    accentColor: '#38bdf8',
    greeting: 'Stone, timber, and beacon spires—we NPC builders expand Verdant Kingdom on our own schedule as supplies grow.',
  },
];

export const QUESTS: QuestDefinition[] = [
  {
    id: 'q_main_1',
    chapter: 1,
    type: 'main',
    title: 'Echoes of the Omega Fracture',
    giver: 'Scholar Orin',
    description: 'Investigate the anomalous ley-energy surges outside Verdant Village and defeat corrupted Void Stalkers.',
    objectiveLabel: 'Defeat corrupted enemies',
    targetCount: 4,
    rewardGold: 180,
    rewardXp: 120,
    rewardQi: 80,
    rewardSkillPoints: 2,
    rewardItemTemplateId: 'astral_fragment',
    choicePrompt: 'Orin asks how you wish to channel the stabilized Omega resonance:',
    choices: [
      { id: 'preserve', label: 'Seal the Fracture for the Kingdom', outcome: 'Sanctum Harmony (+Emeralds & Light Resonance)' },
      { id: 'absorb', label: 'Absorb the Omega Surge Yourself', outcome: 'Sovereign Ambition (+Bonus Qi & Astral Core)' },
    ],
  },
  {
    id: 'q_side_clara',
    chapter: 1,
    type: 'side',
    title: 'Threads of Starlight',
    giver: 'Weaver Clara',
    description: 'Gather Aether Crystals from glowing outcrops so Clara can repair the celestial loom.',
    objectiveLabel: 'Harvest resources or crystals',
    targetCount: 5,
    rewardGold: 150,
    rewardXp: 90,
    rewardQi: 60,
    rewardSkillPoints: 1,
    rewardItemTemplateId: 'health_elixir',
  },
  {
    id: 'q_side_forge',
    chapter: 2,
    type: 'side',
    title: 'Tempering the Sovereign Edge',
    giver: 'Blacksmith Kael',
    description: 'Craft or refine an item at your forge to prove your mastery of mortal and astral smithing.',
    objectiveLabel: 'Craft items or refine cores',
    targetCount: 2,
    rewardGold: 220,
    rewardXp: 130,
    rewardQi: 75,
    rewardSkillPoints: 2,
    rewardItemTemplateId: 'iron',
  },
  {
    id: 'q_main_2',
    chapter: 2,
    type: 'main',
    title: 'Tombguard of the Abyss',
    giver: 'Captain Thorne',
    description: 'Journey south to the Abyssal Frontier and challenge Wezaemon: Tombguard Colossus.',
    objectiveLabel: 'Defeat a World Boss',
    targetCount: 1,
    rewardGold: 600,
    rewardXp: 450,
    rewardQi: 250,
    rewardSkillPoints: 4,
    rewardItemTemplateId: 'astral_core',
  },
  {
    id: 'q_hidden_frost',
    chapter: 3,
    type: 'hidden',
    title: 'Whispers Beneath Frostfall',
    giver: 'Elder Seris',
    description: 'Explore all regions of Aetheria to uncover the fractured boundary stones.',
    objectiveLabel: 'Discover realms across Aetheria',
    targetCount: 4,
    rewardGold: 450,
    rewardXp: 300,
    rewardQi: 200,
    rewardSkillPoints: 3,
    rewardItemTemplateId: 'rare_mineral',
  },
];

export const MOUNTS_CATALOG: { id: MountVehicleType; name: string; kind: string; speedMult: number; canFly: boolean; desc: string }[] = [
  { id: 'none', name: 'On Foot', kind: 'Martial Stride', speedMult: 1.0, canFly: false, desc: 'Full agility combat and dodge responsiveness.' },
  { id: 'horse', name: 'Verdant Warhorse', kind: 'Mount', speedMult: 1.75, canFly: false, desc: 'Swift armored steed suited for kingdom roads and plains.' },
  { id: 'flying_sword', name: 'Celestial Flying Sword', kind: 'Cultivation Flight', speedMult: 2.25, canFly: true, desc: 'Ride your spirit-infused blade effortlessly through the clouds.' },
  { id: 'dragon', name: 'Azure Sky Dragon', kind: 'Mythic Mount', speedMult: 2.55, canFly: true, desc: 'Winged dragon mount granting high-altitude soaring.' },
  { id: 'omega_m4_coupe', name: 'Omega GT-M4 Coupe', kind: 'Sports Vehicle', speedMult: 2.8, canFly: false, desc: 'Original widebody twin-turbo celestial grand tourer with reactive spoilers.' },
  { id: 'astral_skiff', name: 'Aether Wave Skiff', kind: 'Naval Boat', speedMult: 2.0, canFly: false, desc: 'Sleek hydro-glide boat engineered for crossing rivers and frozen channels.' },
  { id: 'sky_galleon', name: 'Astral Dreadnought Airship', kind: 'Fantasy Aircraft', speedMult: 2.4, canFly: true, desc: 'Crystal-turbine sky vessel capable of hovering over the Celestial Islands.' },
];

export const PETS_CATALOG: { id: PetType; name: string; bonus: string }[] = [
  { id: 'none', name: 'No Companion', bonus: 'None' },
  { id: 'spirit_fox', name: 'Nine-Tail Spirit Fox', bonus: '+15% Qi Absorption & Mana Regen' },
  { id: 'ember_drake', name: 'Ember Hatchling', bonus: '+12% Attack Power & Cold Resistance' },
  { id: 'celestial_owl', name: 'Astral Star Owl', bonus: '+20% Loot Discovery & Crit Chance' },
];

export const BUILDING_PIECES: { kind: BuildingPieceKind; name: string; templateId: string; desc: string }[] = [
  { kind: 'wood_wall', name: 'Timber Wall', templateId: 'kit_wall', desc: 'Sturdy defensive wall' },
  { kind: 'stone_wall', name: 'Bastion Wall', templateId: 'kit_stone_wall', desc: 'Heavy stone barrier' },
  { kind: 'glass_wall', name: 'Window Wall', templateId: 'kit_glass_wall', desc: 'Luminous crystal window wall' },
  { kind: 'doorway', name: 'Arch Doorway', templateId: 'kit_doorway', desc: 'Walkable house entrance frame' },
  { kind: 'wood_floor', name: 'Timber Floor', templateId: 'kit_floor', desc: 'Raised foundation deck' },
  { kind: 'slate_roof', name: 'Sanctuary Roof', templateId: 'kit_roof', desc: 'Angled storm shelter' },
  { kind: 'watchtower', name: 'Watchtower Pillar', templateId: 'kit_watchtower', desc: 'Reinforced corner support column' },
  { kind: 'stone_stairs', name: 'Stone Stairs', templateId: 'kit_stairs', desc: 'Multi-floor access steps' },
  { kind: 'campfire', name: 'Astral Campfire', templateId: 'kit_campfire', desc: 'Warmth & HP recovery' },
  { kind: 'storage_chest', name: 'Strongbox', templateId: 'kit_chest', desc: 'Homestead vault' },
  { kind: 'aether_beacon', name: 'Aether Beacon', templateId: 'kit_beacon', desc: 'Sanctuary Qi aura pillar' },
];

export const BUILDING_UPGRADE_COSTS: Record<1 | 2, { gold: number; stone: number; label: string }> = {
  1: { gold: 45, stone: 2, label: 'Tier II Reinforced Stone & Iron' },
  2: { gold: 110, stone: 4, label: 'Tier III Gilded Celestial Omega' },
};

export const SKILL_UPGRADE_META: {
  key: keyof SkillUpgrades;
  name: string;
  desc: string;
  perRank: string;
  maxRank: number;
}[] = [
  { key: 'martial', name: 'Martial Might', desc: 'Enhances light, heavy, aerial, and dual-hand weapon strikes.', perRank: '+8% Weapon Damage', maxRank: 10 },
  { key: 'arcane', name: 'Astral Potency', desc: 'Amplifies elemental skills, combos, and Qi resonance bursts.', perRank: '+10% Skill Damage', maxRank: 10 },
  { key: 'vitality', name: 'Iron Vessel', desc: 'Reinforces physical constitution and max health reserves.', perRank: '+45 Max HP & +3 DEF', maxRank: 10 },
  { key: 'agility', name: 'Tempest Agility', desc: 'Boosts sprinting, stamina pool, and Elytra glide lift.', perRank: '+15 Max Stamina & +5% Speed', maxRank: 10 },
  { key: 'fortune', name: 'Guild Fortune', desc: 'Improves vendor trade margins, harvest yields, and crit rate.', perRank: '+2% Crit & +3% Trade Value', maxRank: 10 },
  { key: 'lifesteal', name: 'Sovereign Vampirism', desc: 'Drains enemy essence on every hit to restore Health & Mana.', perRank: '+3 HP & +2 Mana on Hit', maxRank: 10 },
  { key: 'chronos', name: 'Chronos Haste', desc: 'Compresses skill cooldowns and accelerates passive Mana flow.', perRank: '-3.5% Skill Cooldowns', maxRank: 10 },
  { key: 'sovereign', name: 'Omega Overdrive', desc: 'Amplifies Boss damage and extends Awakening Mode duration.', perRank: '+7% Boss DMG & +1.2s Awakening', maxRank: 10 },
];

export interface AscensionPowerMeta {
  id: AscensionPowerId;
  name: string;
  hotkey: string;
  manaCost: number;
  cooldown: number;
  desc: string;
  scalingNote: string;
  color: string;
  maxRank: number;
}

export const ASCENSION_POWERS_META: AscensionPowerMeta[] = [
  {
    id: 'blink_step',
    name: 'Aether Blink Surge',
    hotkey: 'Shift / Dash',
    manaCost: 14,
    cooldown: 3.5,
    desc: 'Phase-step instantaneously forward leaving an electrified shockwave behind.',
    scalingNote: '+35 Shockwave Damage & +1.5m Dash Range per Rank',
    color: '#38bdf8',
    maxRank: 5,
  },
  {
    id: 'meteor_nova',
    name: 'Celestial Meteor Nova',
    hotkey: 'Power [R] Burst',
    manaCost: 34,
    cooldown: 9,
    desc: 'Detonates a 360° astral shockwave that blasts every nearby enemy.',
    scalingNote: '+22% Nova Radius & +45 Base Power per Rank',
    color: '#f97316',
    maxRank: 5,
  },
  {
    id: 'aegis_dome',
    name: 'Titan Aegis Dome',
    hotkey: 'Guard / Off-Hand',
    manaCost: 26,
    cooldown: 11,
    desc: 'Projects a golden invulnerability dome reflecting 65% damage for 3–5 seconds.',
    scalingNote: '+0.6s Dome Duration & +20 Shield Heal per Rank',
    color: '#eab308',
    maxRank: 5,
  },
  {
    id: 'omega_overdrive',
    name: 'Sovereign Awakening',
    hotkey: '[R] Overdrive',
    manaCost: 40,
    cooldown: 18,
    desc: 'Ignites golden Omega aura for 12s: +45% Attack, +25% Speed, and rapid Qi pulses.',
    scalingNote: '+2s Aura Duration & +12 Qi Regen/sec per Rank',
    color: '#a855f7',
    maxRank: 5,
  },
];

export function createDefaultLivingWorld(): LivingWorldState {
  const now = Date.now();
  const farms: FarmPlotState[] = [
    { id: 'farm_1', x: -29, z: -15, crop: 'golden_wheat', stage: 2, water: 82, growthProgress: 74, tendedBy: 'Farmer Rowan' },
    { id: 'farm_2', x: -24, z: -15, crop: 'sunberry', stage: 3, water: 76, growthProgress: 100, tendedBy: 'Farmer Rowan' },
    { id: 'farm_3', x: -29, z: -20, crop: 'aether_herb', stage: 1, water: 88, growthProgress: 38, tendedBy: 'Healer Aria' },
    { id: 'farm_4', x: -24, z: -20, crop: 'spirit_rice', stage: 2, water: 70, growthProgress: 65, tendedBy: 'Farmer Rowan' },
    { id: 'farm_5', x: -34, z: -17.5, crop: 'golden_wheat', stage: 3, water: 90, growthProgress: 100, tendedBy: 'Merchant Lyra' },
    { id: 'farm_6', x: -34, z: -12.5, crop: null, stage: 0, water: 65, growthProgress: 0 },
  ];

  const npcAgents: Record<string, NpcAgentState> = {};
  NPCS.forEach((npc, i) => {
    const task =
      npc.role === 'Farmer'
        ? 'farming'
        : npc.role === 'Mason'
        ? 'building'
        : npc.role === 'Blacksmith' || npc.role === 'Gunsmith' || npc.role === 'Fletcher'
        ? 'forging_weapon'
        : npc.role === 'Armorer' || npc.role === 'Weaver'
        ? 'forging_armor'
        : npc.role === 'Chemist' || npc.role === 'Healer'
        ? 'brewing'
        : npc.role === 'Merchant'
        ? 'selling'
        : 'patrolling';
    npcAgents[npc.id] = {
      npcId: npc.id,
      task,
      targetX: npc.x,
      targetZ: npc.z,
      progress: (i * 19) % 85,
      speechBubble:
        task === 'farming'
          ? 'Checking irrigation & golden wheat!'
          : task === 'forging_weapon'
          ? 'Tempering a fresh blade for the market.'
          : task === 'forging_armor'
          ? 'Hammering Starsteel armor plates.'
          : task === 'building'
          ? 'Laying timber & stone foundations.'
          : '',
      speechTtl: 6,
      foodHeld: 3,
      craftCount: 1,
    };
  });

  const marketListings: NpcCraftedListing[] = [
    { id: 'lst_bread', templateId: 'golden_bread', crafterId: 'farmer_rowan', crafterName: 'Farmer Rowan', vendor: 'chemist', currency: 'gold', price: 22, stock: 6, quality: 'Fine', createdAt: now - 120000 },
    { id: 'lst_sunberry', templateId: 'sunberry_ration', crafterId: 'farmer_rowan', crafterName: 'Farmer Rowan', vendor: 'chemist', currency: 'gold', price: 32, stock: 4, quality: 'Fine', createdAt: now - 90000 },
    { id: 'lst_kael_blade', templateId: 'sovereign_katana_mk2', crafterId: 'smith_kael', crafterName: 'Blacksmith Kael', vendor: 'blacksmith', currency: 'gold', price: 490, stock: 1, quality: 'Masterwork', createdAt: now - 60000 },
    { id: 'lst_garrick_plate', templateId: 'mithril_bastion_plate', crafterId: 'armorer_garrick', crafterName: 'Armorer Garrick', vendor: 'armorer', currency: 'gold', price: 410, stock: 1, quality: 'Fine', createdAt: now - 45000 },
  ];

  return {
    farms,
    npcAgents,
    npcBuildings: [
      { id: 'npc_bld_granary', kind: 'storage_chest', x: -25, y: 1.2, z: -11, rotationY: 0.4, tier: 2, ownerName: 'Mason Cedric' },
      { id: 'npc_bld_forge_hearth', kind: 'campfire', x: 18, y: 1.2, z: 9, rotationY: 0, tier: 1, ownerName: 'Blacksmith Kael' },
      { id: 'npc_bld_beacon', kind: 'aether_beacon', x: 27, y: 1.2, z: -14, rotationY: 0, tier: 2, ownerName: 'Mason Cedric' },
    ],
    marketListings,
    chatterLog: [
      {
        id: 'chat_init_1',
        speakerName: 'Farmer Rowan',
        partnerName: 'Merchant Lyra',
        line: 'Fresh golden wheat & sunberries are ripe—sending 6 loaves to your market stall!',
        category: 'farm',
        timestamp: now - 45000,
      },
      {
        id: 'chat_init_2',
        speakerName: 'Blacksmith Kael',
        partnerName: 'Armorer Garrick',
        line: 'My Masterwork Katana is tempered. How goes the Frostfire Mithril cuirass?',
        category: 'forge',
        timestamp: now - 20000,
      },
      {
        id: 'chat_init_3',
        speakerName: 'Mason Cedric',
        line: 'Added a Tier II Granary near the farmstead. Village supplies are thriving!',
        category: 'build',
        timestamp: now - 10000,
      },
    ],
    villageFoodSupply: 34,
    villageOreSupply: 26,
    dayCycleCount: 1,
  };
}

export function createItemFromTemplate(templateId: string, quantity = 1): InventoryItem {
  const tpl = ITEM_TEMPLATES[templateId] ?? ITEM_TEMPLATES.wood;
  return {
    ...tpl,
    id: `${templateId}_${Math.random().toString(36).slice(2, 9)}`,
    quantity: Math.min(quantity, tpl.maxStack),
  };
}

export function createDefaultHudProfile(): HudLayoutProfile {
  return {
    name: 'Celestial Default',
    items: {
      vitals: { id: 'vitals', label: 'Vitals & Cultivation', xOffset: 0, yOffset: 0, scale: 1, opacity: 1 },
      minimap: { id: 'minimap', label: 'Minimap & Region', xOffset: 0, yOffset: 0, scale: 1, opacity: 1 },
      skills: { id: 'skills', label: 'Combat & Skill Dock', xOffset: 0, yOffset: 0, scale: 1, opacity: 1 },
    },
  };
}

export function createDefaultAchievements(): AchievementState[] {
  return [
    { id: 'ach_first_blood', title: 'First Resonance', description: 'Defeat your first corrupted foe in Aetheria.', unlocked: false, rewardDiamonds: 15 },
    { id: 'ach_breakthrough', title: 'Awakened Vessel', description: 'Reach Spirit Awakening cultivation realm.', unlocked: false, rewardDiamonds: 25 },
    { id: 'ach_explorer', title: 'Realm Walker', description: 'Discover 4 distinct regions across the continent.', unlocked: false, rewardDiamonds: 35 },
    { id: 'ach_architect', title: 'Sanctuary Builder', description: 'Construct 3 structures in the world.', unlocked: false, rewardDiamonds: 20 },
    { id: 'ach_colossus', title: 'Tombguard Breaker', description: 'Defeat a World Boss encounter.', unlocked: false, rewardDiamonds: 60 },
  ];
}

export function createDefaultMailbox(): MailMessage[] {
  const now = Date.now();
  return [
    {
      id: 'mail_welcome_council',
      sender: 'Sanctum Council',
      senderRole: 'Verdant Guild Dispatch',
      subject: 'Welcome Package: Elytra Wings & Dual-Wield Arsenal',
      body: 'Traveler, your Aether Wing Elytra is ready! Equip it in your Minecraft-style Inventory Wing slot to glide from cliffs or Celestial Islands, and equip shields, daggers, or pistols in your Off-Hand. Claim this council dispatch to strengthen your journey.',
      sentAt: now - 3600 * 1000,
      read: false,
      claimed: false,
      rewards: { gold: 180, diamonds: 10, skillPoints: 2, itemTemplateId: 'frostfire_tonic', itemQty: 2 },
    },
    {
      id: 'mail_orin_lore',
      sender: 'Scholar Orin',
      senderRole: 'Verdant Historian',
      subject: 'Field Notes: Six Merchant Guilds & Homestead Tiers',
      body: 'The Verdant Market District now hosts Chemist Vesper, Armorer Garrick, Fletcher Sylvan, Gunsmith Vance, Blacksmith Kael, and Toolsmith Orson. You can also place houses anywhere in Build Mode and upgrade structures up to Tier III!',
      sentAt: now - 1800 * 1000,
      read: false,
      claimed: false,
      rewards: { gold: 120, emeralds: 3, itemTemplateId: 'kit_glass_wall', itemQty: 4 },
    },
    {
      id: 'mail_clara_gift',
      sender: 'Weaver Clara',
      senderRole: 'Astral Loom Master',
      subject: 'Astral Threads & Sanctuary Beacon Blueprint',
      body: 'May these materials help you build a sanctuary worthy of your lineage. Press [I] anytime to inspect your armor, off-hand, and Elytra slots.',
      sentAt: now - 600 * 1000,
      read: false,
      claimed: false,
      rewards: { ancientCoins: 2, skillPoints: 1, itemTemplateId: 'kit_beacon', itemQty: 1 },
    },
  ];
}

export function createDefaultSave(): SaveDataV1 {
  const inventory: (InventoryItem | null)[] = Array(30).fill(null);
  // Slots 0..8 serve as the 9-Slot Quick Hotbar
  inventory[0] = createItemFromTemplate('health_elixir', 4);
  inventory[1] = createItemFromTemplate('mana_draught', 3);
  inventory[2] = createItemFromTemplate('roasted_feast', 3);
  inventory[3] = createItemFromTemplate('spring_flask', 3);
  inventory[4] = createItemFromTemplate('tool_pickaxe', 1);
  inventory[5] = createItemFromTemplate('bow_starfall', 1);
  inventory[6] = createItemFromTemplate('kit_wall', 4);
  inventory[7] = createItemFromTemplate('kit_floor', 4);
  inventory[8] = createItemFromTemplate('kit_campfire', 1);
  // Backpack slots 9..29
  inventory[9] = createItemFromTemplate('wood', 10);
  inventory[10] = createItemFromTemplate('stone', 8);
  inventory[11] = createItemFromTemplate('crystal', 4);
  inventory[12] = createItemFromTemplate('astral_fragment', 2);
  inventory[13] = createItemFromTemplate('dagger_shadowfang', 1);
  inventory[14] = createItemFromTemplate('helm_warden', 1);

  const storage: (InventoryItem | null)[] = Array(30).fill(null);
  storage[0] = createItemFromTemplate('iron', 4);
  storage[1] = createItemFromTemplate('kit_doorway', 2);
  storage[2] = createItemFromTemplate('kit_roof', 4);

  return {
    version: 1,
    savedAt: Date.now(),
    character: {
      name: 'Kaelen Vance',
      title: 'Omega Wanderer',
      gender: 'male',
      bodyPreset: 'athletic',
      hairStyle: 'spiky',
      hairColor: '#1e293b',
      skinTone: '#f1c7a5',
      eyeColor: '#38bdf8',
      outfitStyle: 'shinobi_cloak',
      outfitColor: '#1e293b',
      capeEnabled: true,
      capeColor: '#991b1b',
      weaponType: 'katana',
      primaryElement: 'chakra',
      secondaryElement: 'lightning',
    },
    vitals: {
      hp: 240,
      maxHp: 240,
      stamina: 120,
      maxStamina: 120,
      mana: 140,
      maxMana: 140,
      hunger: 92,
      thirst: 92,
      temperature: 21,
      level: 1,
      xp: 0,
      nextXp: 120,
      cultivationRealm: 0,
      qi: 35,
      qiRequired: 100,
      astralCores: 1,
      bloodlineAwakened: false,
      unlockedElements: ['chakra', 'lightning'],
      activeSkillBar: ['chakra', 'lightning', 'chakra'],
      awakeningActive: false,
      awakeningTimer: 0,
      aegisShieldTimer: 0,
      skillPoints: 4,
      skillUpgrades: {
        martial: 0,
        arcane: 0,
        vitality: 0,
        agility: 0,
        fortune: 0,
        lifesteal: 0,
        chronos: 0,
        sovereign: 0,
      },
      elementRanks: {
        fire: 1,
        water: 1,
        wind: 1,
        earth: 1,
        lightning: 1,
        chakra: 1,
        light: 1,
        darkness: 1,
      },
      powerRanks: {
        blink_step: 1,
        meteor_nova: 1,
        aegis_dome: 1,
        omega_overdrive: 1,
      },
    },
    currencies: {
      gold: 350,
      diamonds: 35,
      emeralds: 8,
      ancientCoins: 5,
      aetherShards: 12,
    },
    inventory,
    storage,
    equipped: {
      weapon: createItemFromTemplate('blade_starfall', 1),
      offHand: createItemFromTemplate('shield_bulwark', 1),
      helmet: null,
      armor: createItemFromTemplate('armor_warden', 1),
      leggings: null,
      boots: null,
      elytra: createItemFromTemplate('elytra_aether', 1),
      accessory: null,
    },
    hotbarIndex: 0,
    position: { x: 0, y: 1.5, z: 4, yaw: Math.PI },
    quests: {
      q_main_1: { questId: 'q_main_1', status: 'active', progress: 0 },
      q_side_clara: { questId: 'q_side_clara', status: 'available', progress: 0 },
      q_side_forge: { questId: 'q_side_forge', status: 'available', progress: 0 },
      q_main_2: { questId: 'q_main_2', status: 'available', progress: 0 },
      q_hidden_frost: { questId: 'q_hidden_frost', status: 'available', progress: 0 },
    },
    discoveredRegions: ['verdant'],
    buildings: [],
    livingWorld: createDefaultLivingWorld(),
    unlockedMounts: ['none', 'horse', 'flying_sword', 'omega_m4_coupe', 'dragon', 'astral_skiff', 'sky_galleon'],
    activeMount: 'none',
    unlockedPets: ['none', 'spirit_fox', 'ember_drake', 'celestial_owl'],
    activePet: 'spirit_fox',
    petLevel: 1,
    defeatedBosses: [],
    killCount: 0,
    playTimeSeconds: 0,
    settings: {
      graphicsPreset: 'high',
      resolutionScale: 1,
      shadowsEnabled: true,
      viewDistance: 150,
      weatherEnabled: true,
      fpsTarget: 60,
      exposure: 1.1,
      cameraMode: 'free_orbit',
      cameraDistance: 8.5,
      cameraSensitivity: 1.0,
      cameraSmoothness: 1.0,
      musicVolume: 0.45,
      soundVolume: 0.7,
      muted: false,
      joystickSize: 1.0,
      keybinds: {
        attack: 'KeyJ',
        heavy: 'KeyK',
        dodge: 'ShiftLeft',
        interact: 'KeyE',
        mount: 'KeyV',
        meditate: 'KeyX',
      },
    },
    hudProfiles: [createDefaultHudProfile()],
    activeHudProfileIndex: 0,
    achievements: createDefaultAchievements(),
    mailbox: createDefaultMailbox(),
    merchantReputation: 1,
    dailyRewardDay: 1,
    lastDailyClaimAt: 0,
  };
}
