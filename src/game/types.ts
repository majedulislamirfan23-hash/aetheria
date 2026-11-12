export type GameState = 'title' | 'playing' | 'paused' | 'gameover';

export type BiomeId =
  | 'verdant'
  | 'frostfall'
  | 'ember'
  | 'celestial'
  | 'abyssal';

export type WeatherType =
  | 'clear'
  | 'rain'
  | 'snow'
  | 'thunderstorm'
  | 'aurora';

export type SeasonType = 'Spring' | 'Summer' | 'Autumn' | 'Winter';

export type ElementId =
  | 'fire'
  | 'water'
  | 'wind'
  | 'earth'
  | 'lightning'
  | 'chakra'
  | 'light'
  | 'darkness';

export type WeaponType =
  | 'katana'
  | 'dual_blades'
  | 'greatsword'
  | 'spear'
  | 'bow'
  | 'dagger'
  | 'staff'
  | 'aether_rifle';

export type CultivationRealmId =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7;

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'mythic' | 'celestial';

export type ItemCategory =
  | 'resource'
  | 'weapon'
  | 'armor'
  | 'elytra'
  | 'shield'
  | 'tool'
  | 'ammo'
  | 'consumable'
  | 'material'
  | 'building'
  | 'core';

export type EquipmentSlot =
  | 'weapon'
  | 'offHand'
  | 'helmet'
  | 'armor'
  | 'leggings'
  | 'boots'
  | 'elytra'
  | 'accessory';

export interface InventoryItem {
  id: string;
  templateId: string;
  name: string;
  category: ItemCategory;
  rarity: ItemRarity;
  quantity: number;
  maxStack: number;
  description: string;
  stats?: {
    attack?: number;
    defense?: number;
    healHp?: number;
    healMana?: number;
    healHunger?: number;
    healThirst?: number;
    qiGain?: number;
    weaponType?: WeaponType;
    element?: ElementId;
    armorSlot?: 'helmet' | 'armor' | 'leggings' | 'boots';
    glideSpeed?: number;
    critBonus?: number;
    sellValue?: number;
  };
  buildKind?: BuildingPieceKind;
}

export type GenderOption = 'male' | 'female';
export type BodyPreset = 'athletic' | 'slender' | 'vanguard';
export type HairStyle = 'spiky' | 'flowing' | 'ponytail' | 'twin_tails' | 'cropped';
export type OutfitStyle = 'shinobi_cloak' | 'celestial_robe' | 'vanguard_plate' | 'abyssal_coat';

export interface CharacterCustomization {
  name: string;
  title: string;
  gender: GenderOption;
  bodyPreset: BodyPreset;
  hairStyle: HairStyle;
  hairColor: string;
  skinTone: string;
  eyeColor: string;
  outfitStyle: OutfitStyle;
  outfitColor: string;
  capeEnabled: boolean;
  capeColor: string;
  weaponType: WeaponType;
  primaryElement: ElementId;
  secondaryElement: ElementId;
}

export interface SkillUpgrades {
  martial: number;
  arcane: number;
  vitality: number;
  agility: number;
  fortune: number;
  lifesteal: number;
  chronos: number;
  sovereign: number;
}

export type AscensionPowerId =
  | 'blink_step'
  | 'meteor_nova'
  | 'aegis_dome'
  | 'omega_overdrive';

export interface PlayerVitals {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  mana: number;
  maxMana: number;
  hunger: number;
  thirst: number;
  temperature: number; // Celsius, ideal ~22
  level: number;
  xp: number;
  nextXp: number;
  cultivationRealm: CultivationRealmId;
  qi: number;
  qiRequired: number;
  astralCores: number;
  bloodlineAwakened: boolean;
  unlockedElements: ElementId[];
  activeSkillBar: [ElementId, ElementId, ElementId];
  awakeningActive: boolean;
  awakeningTimer: number;
  aegisShieldTimer?: number;
  skillPoints: number;
  skillUpgrades: SkillUpgrades;
  elementRanks: Record<ElementId, number>;
  powerRanks: Record<AscensionPowerId, number>;
}

export interface Currencies {
  gold: number;
  diamonds: number;
  emeralds: number;
  ancientCoins: number;
  aetherShards: number;
}

export type MountVehicleType =
  | 'none'
  | 'horse'
  | 'flying_sword'
  | 'dragon'
  | 'omega_m4_coupe'
  | 'astral_skiff'
  | 'sky_galleon';

export type PetType = 'none' | 'spirit_fox' | 'ember_drake' | 'celestial_owl';

export type BuildingPieceKind =
  | 'wood_wall'
  | 'stone_wall'
  | 'glass_wall'
  | 'doorway'
  | 'wood_floor'
  | 'slate_roof'
  | 'watchtower'
  | 'stone_stairs'
  | 'campfire'
  | 'storage_chest'
  | 'crafting_forge'
  | 'aether_beacon';

export interface PlacedBuilding {
  id: string;
  kind: BuildingPieceKind;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  tier?: 1 | 2 | 3;
  ownerName?: string;
}

export type EnemyArchetype =
  | 'void_stalker'    // Chaser/Swarmer
  | 'ember_acolyte'   // Ranged Kiter
  | 'frost_charger'   // Line-of-sight Charger
  | 'abyssal_sentinel'// Shielded Area-Denial
  | 'boss_wezaemon'   // Tombguard Colossus
  | 'boss_abyssal_dragon'
  | 'boss_celestial_devourer'
  | 'boss_forest_guardian'
  | 'boss_void_emperor';

export type VendorRole =
  | 'chemist'
  | 'armorer'
  | 'fletcher'
  | 'gunsmith'
  | 'blacksmith'
  | 'toolsmith';

export interface NpcDefinition {
  id: string;
  name: string;
  role:
    | 'Scholar'
    | 'Weaver'
    | 'Blacksmith'
    | 'Merchant'
    | 'Healer'
    | 'Guard'
    | 'Villager'
    | 'QuestGiver'
    | 'Chemist'
    | 'Armorer'
    | 'Fletcher'
    | 'Gunsmith'
    | 'Toolsmith'
    | 'Farmer'
    | 'Mason';
  vendorTab?: VendorRole;
  biome: BiomeId;
  x: number;
  z: number;
  patrolRadius: number;
  robeColor: string;
  accentColor: string;
  greeting: string;
  questId?: string;
}

export type NpcTaskType =
  | 'farming'
  | 'harvesting'
  | 'forging_weapon'
  | 'forging_armor'
  | 'brewing'
  | 'building'
  | 'conversing'
  | 'selling'
  | 'patrolling';

export type FarmCropKind = 'golden_wheat' | 'aether_herb' | 'sunberry' | 'spirit_rice';

export interface FarmPlotState {
  id: string;
  x: number;
  z: number;
  crop: FarmCropKind | null;
  stage: 0 | 1 | 2 | 3; // 0 empty/seedling, 1 sprout, 2 growing, 3 ripe harvestable
  water: number; // 0..100
  growthProgress: number; // 0..100
  tendedBy?: string;
}

export interface NpcCraftedListing {
  id: string;
  templateId: string;
  crafterId: string;
  crafterName: string;
  vendor: VendorRole;
  currency: keyof Currencies;
  price: number;
  stock: number;
  quality: 'Standard' | 'Fine' | 'Masterwork';
  createdAt: number;
}

export interface NpcAgentState {
  npcId: string;
  task: NpcTaskType;
  targetX: number;
  targetZ: number;
  progress: number; // 0..100
  speechBubble: string;
  speechPartnerId?: string;
  speechTtl: number;
  foodHeld: number;
  craftCount: number;
}

export interface NpcChatterEntry {
  id: string;
  speakerName: string;
  partnerName?: string;
  line: string;
  category: 'farm' | 'forge' | 'build' | 'market' | 'chat';
  timestamp: number;
}

export interface LivingWorldState {
  farms: FarmPlotState[];
  npcAgents: Record<string, NpcAgentState>;
  npcBuildings: PlacedBuilding[];
  marketListings: NpcCraftedListing[];
  chatterLog: NpcChatterEntry[];
  villageFoodSupply: number;
  villageOreSupply: number;
  dayCycleCount: number;
}

export interface QuestDefinition {
  id: string;
  chapter: number;
  type: 'main' | 'side' | 'hidden';
  title: string;
  giver: string;
  description: string;
  objectiveLabel: string;
  targetCount: number;
  rewardGold: number;
  rewardXp: number;
  rewardQi: number;
  rewardSkillPoints?: number;
  rewardItemTemplateId?: string;
  choicePrompt?: string;
  choices?: { id: string; label: string; outcome: string }[];
}

export interface QuestProgress {
  questId: string;
  status: 'available' | 'active' | 'completed';
  progress: number;
  chosenOutcome?: string;
}

export type GraphicsPreset = 'low' | 'medium' | 'high' | 'ultra';

export interface GameSettings {
  graphicsPreset: GraphicsPreset;
  resolutionScale: number;
  shadowsEnabled: boolean;
  viewDistance: number;
  weatherEnabled: boolean;
  fpsTarget: 30 | 60 | 120;
  exposure?: number;
  cameraMode: 'third_person' | 'free_orbit' | 'first_person';
  cameraDistance: number;
  cameraSensitivity: number;
  cameraSmoothness?: number;
  musicVolume: number;
  soundVolume: number;
  muted: boolean;
  joystickSize: number;
  keybinds: {
    attack: string;
    heavy: string;
    dodge: string;
    interact: string;
    mount: string;
    meditate: string;
  };
}

export interface HudLayoutItem {
  id: string;
  label: string;
  xOffset: number;
  yOffset: number;
  scale: number;
  opacity: number;
}

export interface HudLayoutProfile {
  name: string;
  items: Record<string, HudLayoutItem>;
}

export interface AchievementState {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  rewardDiamonds: number;
}

export interface MailReward {
  gold?: number;
  diamonds?: number;
  emeralds?: number;
  ancientCoins?: number;
  aetherShards?: number;
  skillPoints?: number;
  itemTemplateId?: string;
  itemQty?: number;
}

export interface MailMessage {
  id: string;
  sender: string;
  senderRole: string;
  subject: string;
  body: string;
  sentAt: number;
  read: boolean;
  claimed: boolean;
  rewards?: MailReward;
}

export interface SaveDataV1 {
  version: 1;
  savedAt: number;
  character: CharacterCustomization;
  vitals: PlayerVitals;
  currencies: Currencies;
  inventory: (InventoryItem | null)[]; // 30 slots (0..8 serve as 9-slot Quick Hotbar)
  storage: (InventoryItem | null)[];   // expandable 30-slot chest storage
  equipped: {
    weapon: InventoryItem | null;
    offHand: InventoryItem | null;
    helmet: InventoryItem | null;
    armor: InventoryItem | null;
    leggings: InventoryItem | null;
    boots: InventoryItem | null;
    elytra: InventoryItem | null;
    accessory: InventoryItem | null;
  };
  hotbarIndex: number;
  position: { x: number; y: number; z: number; yaw: number };
  quests: Record<string, QuestProgress>;
  discoveredRegions: BiomeId[];
  buildings: PlacedBuilding[];
  livingWorld: LivingWorldState;
  unlockedMounts: MountVehicleType[];
  activeMount: MountVehicleType;
  unlockedPets: PetType[];
  activePet: PetType;
  petLevel: number;
  defeatedBosses: string[];
  killCount: number;
  playTimeSeconds: number;
  settings: GameSettings;
  hudProfiles: HudLayoutProfile[];
  activeHudProfileIndex: number;
  achievements: AchievementState[];
  mailbox: MailMessage[];
  merchantReputation: number;
  dailyRewardDay: number;
  lastDailyClaimAt: number;
}
