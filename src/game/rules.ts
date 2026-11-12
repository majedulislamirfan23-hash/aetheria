import {
  ASCENSION_POWERS_META,
  BIOMES,
  BUILDING_UPGRADE_COSTS,
  CRAFTING_RECIPES,
  CULTIVATION_REALMS,
  ELEMENTS,
  SHOP_OFFERS,
  SKILL_UPGRADE_META,
  WEAPONS,
  createDefaultLivingWorld,
  createDefaultSave,
  createItemFromTemplate,
} from './catalog';
import type {
  AscensionPowerId,
  BiomeId,
  Currencies,
  ElementId,
  EquipmentSlot,
  InventoryItem,
  PlacedBuilding,
  PlayerVitals,
  SaveDataV1,
  SkillUpgrades,
  WeaponType,
} from './types';

export interface CombatDamageResult {
  damage: number;
  isCrit: boolean;
  resonanceBonus: number;
}

export function getCooldownMultiplier(chronosRank = 0): number {
  return Math.max(0.55, 1 - chronosRank * 0.035);
}

export function getLifestealGain(lifestealRank = 0): { hpGain: number; manaGain: number } {
  return {
    hpGain: Math.max(0, lifestealRank * 3),
    manaGain: Math.max(0, lifestealRank * 2),
  };
}

export function calculateCombatDamage(params: {
  weaponType: WeaponType;
  equippedWeaponAtk?: number;
  offHandAtk?: number;
  cultivationRealm: number;
  level: number;
  martialRank?: number;
  fortuneRank?: number;
  sovereignRank?: number;
  isBossTarget?: boolean;
  isHeavy: boolean;
  isAerial: boolean;
  comboStep: number;
  awakeningActive: boolean;
  primaryElement: ElementId;
  secondaryElement: ElementId;
  randomRoll?: number;
}): CombatDamageResult {
  const weapon = WEAPONS[params.weaponType] ?? WEAPONS.katana;
  const realm = CULTIVATION_REALMS[params.cultivationRealm] ?? CULTIVATION_REALMS[0];
  const base =
    weapon.baseDamage +
    (params.equippedWeaponAtk ?? 0) * 0.5 +
    (params.offHandAtk ?? 0) * 0.35 +
    params.level * 2.5;
  const martialMult = 1 + (params.martialRank ?? 0) * 0.08;
  const heavyMult = params.isHeavy ? 1.65 : 1.0;
  const aerialMult = params.isAerial ? 1.3 : 1.0;
  const comboMult = 1 + Math.min(params.comboStep, 3) * 0.14;
  const awakeningMult = params.awakeningActive ? 1.45 : 1.0;
  const bossMult = params.isBossTarget ? 1 + (params.sovereignRank ?? 0) * 0.07 : 1.0;

  // Elemental synergy pairs grant resonance bonus
  const synergyPairs: [ElementId, ElementId][] = [
    ['wind', 'fire'],
    ['water', 'lightning'],
    ['chakra', 'lightning'],
    ['light', 'darkness'],
    ['earth', 'fire'],
  ];
  const hasSynergy = synergyPairs.some(
    ([a, b]) =>
      (params.primaryElement === a && params.secondaryElement === b) ||
      (params.primaryElement === b && params.secondaryElement === a),
  );
  const resonanceBonus = hasSynergy ? 1.18 : 1.05;

  const roll = params.randomRoll ?? Math.random();
  const critChance = (params.weaponType === 'dagger' ? 0.34 : 0.18) + (params.fortuneRank ?? 0) * 0.02;
  const isCrit = roll < critChance;
  const critMult = isCrit ? 1.65 : 1.0;

  const damage = Math.max(
    1,
    Math.round(
      base *
        realm.atkMultiplier *
        martialMult *
        heavyMult *
        aerialMult *
        comboMult *
        awakeningMult *
        bossMult *
        resonanceBonus *
        critMult,
    ),
  );

  return { damage, isCrit, resonanceBonus };
}

export function calculateElementalSkillDamage(params: {
  elementId: ElementId;
  cultivationRealm: number;
  level: number;
  awakeningActive: boolean;
  arcaneRank?: number;
  elementRank?: number;
  sovereignRank?: number;
  isBossTarget?: boolean;
}): number {
  const el = ELEMENTS[params.elementId];
  const realm = CULTIVATION_REALMS[params.cultivationRealm] ?? CULTIVATION_REALMS[0];
  const rankMult = 1 + ((params.elementRank ?? 1) - 1) * 0.15 + (params.arcaneRank ?? 0) * 0.1;
  const bossMult = params.isBossTarget ? 1 + (params.sovereignRank ?? 0) * 0.07 : 1.0;
  const mult = realm.atkMultiplier * rankMult * bossMult * (params.awakeningActive ? 1.4 : 1.0);
  return Math.round((el.power + params.level * 4) * mult);
}

export function tickSurvivalVitals(
  vitals: PlayerVitals,
  biome: BiomeId,
  dt: number,
  options: { isSprinting: boolean; isMeditating: boolean; nearCampfire: boolean },
): PlayerVitals {
  const next = { ...vitals };
  const targetTemp = options.nearCampfire ? 24 : BIOMES[biome].ambientTemp;
  next.temperature += (targetTemp - next.temperature) * Math.min(1, dt * 0.45);

  // Hunger & Thirst gradual drain
  next.hunger = Math.max(0, next.hunger - dt * 0.16);
  const thirstRate = biome === 'ember' ? 0.36 : 0.2;
  next.thirst = Math.max(0, next.thirst - dt * thirstRate);

  // Stamina regeneration / drain (Biology homeostasis: well-nourished travelers recover +20% faster)
  const metabolicBonus = next.hunger >= 60 && next.thirst >= 60 ? 1.2 : 1.0;
  if (options.isSprinting) {
    next.stamina = Math.max(0, next.stamina - dt * 16);
  } else {
    next.stamina = Math.min(next.maxStamina, next.stamina + dt * 20 * metabolicBonus);
  }

  // Mana & Qi regeneration
  const chronosBonus = (next.skillUpgrades?.chronos ?? 0) * 0.8;
  const manaRegen = (options.isMeditating ? 26 : 6.5) + chronosBonus;
  next.mana = Math.min(next.maxMana, next.mana + dt * manaRegen);

  if (options.isMeditating) {
    next.qi = Math.min(next.qiRequired * 2, next.qi + dt * 22);
    next.hp = Math.min(next.maxHp, next.hp + dt * 12);
  }

  // Extreme cold/heat or starvation hazard damage
  let hazardDrain = 0;
  if (next.temperature < -2 && !options.nearCampfire) hazardDrain += 1.4;
  if (next.temperature > 37) hazardDrain += 1.4;
  if (next.hunger <= 0) hazardDrain += 1.2;
  if (next.thirst <= 0) hazardDrain += 1.5;

  if (hazardDrain > 0) {
    next.hp = Math.max(0, next.hp - hazardDrain * dt);
  }

  if (next.awakeningActive) {
    next.awakeningTimer = Math.max(0, next.awakeningTimer - dt);
    const qiPulse = (next.powerRanks?.omega_overdrive ?? 1) * 4;
    next.qi = Math.min(next.qiRequired * 2, next.qi + qiPulse * dt);
    if (next.awakeningTimer <= 0) {
      next.awakeningActive = false;
    }
  }

  if ((next.aegisShieldTimer ?? 0) > 0) {
    next.aegisShieldTimer = Math.max(0, (next.aegisShieldTimer ?? 0) - dt);
  }

  return next;
}

export function attemptCultivationBreakthrough(vitals: PlayerVitals): {
  success: boolean;
  reason?: string;
  vitals: PlayerVitals;
} {
  const currentRealm = vitals.cultivationRealm;
  if (currentRealm >= 7) {
    return { success: false, reason: 'Already reached Eternal Transcendence.', vitals };
  }
  const nextRealm = CULTIVATION_REALMS[currentRealm + 1];
  if (vitals.qi < vitals.qiRequired) {
    return {
      success: false,
      reason: `Need ${Math.ceil(vitals.qiRequired - vitals.qi)} more Qi (Meditate [X] or defeat foes).`,
      vitals,
    };
  }
  if (vitals.astralCores < nextRealm.coresRequired) {
    return {
      success: false,
      reason: `Requires ${nextRealm.coresRequired} Astral Cores (Refine Astral Fragments in Crafting).`,
      vitals,
    };
  }

  const prevMeta = CULTIVATION_REALMS[currentRealm];
  const hpDelta = nextRealm.hpBonus - prevMeta.hpBonus;
  const manaDelta = nextRealm.manaBonus - prevMeta.manaBonus;

  const updated: PlayerVitals = {
    ...vitals,
    cultivationRealm: nextRealm.id,
    qi: Math.max(0, vitals.qi - vitals.qiRequired),
    qiRequired: nextRealm.qiRequired,
    astralCores: vitals.astralCores - nextRealm.coresRequired,
    maxHp: vitals.maxHp + hpDelta,
    hp: vitals.maxHp + hpDelta,
    maxMana: vitals.maxMana + manaDelta,
    mana: vitals.maxMana + manaDelta,
    bloodlineAwakened: nextRealm.id >= 2 ? true : vitals.bloodlineAwakened,
    skillPoints: (vitals.skillPoints ?? 0) + 3,
  };

  return { success: true, vitals: updated };
}

export function addItemToInventory(
  slots: (InventoryItem | null)[],
  templateId: string,
  quantity: number,
): { slots: (InventoryItem | null)[]; added: number } {
  const next = slots.map((s) => (s ? { ...s } : null));
  let remaining = quantity;

  // Stack onto existing slots first
  for (let i = 0; i < next.length && remaining > 0; i++) {
    const slot = next[i];
    if (slot && slot.templateId === templateId && slot.quantity < slot.maxStack) {
      const space = slot.maxStack - slot.quantity;
      const take = Math.min(space, remaining);
      slot.quantity += take;
      remaining -= take;
    }
  }

  // Fill empty slots
  for (let i = 0; i < next.length && remaining > 0; i++) {
    if (!next[i]) {
      const item = createItemFromTemplate(templateId, remaining);
      const take = item.quantity;
      next[i] = item;
      remaining -= take;
    }
  }

  return { slots: next, added: quantity - remaining };
}

export function countTemplateInInventory(
  slots: (InventoryItem | null)[],
  templateId: string,
): number {
  let total = 0;
  for (const s of slots) {
    if (s && s.templateId === templateId) total += s.quantity;
  }
  return total;
}

export function removeTemplateFromInventory(
  slots: (InventoryItem | null)[],
  templateId: string,
  quantity: number,
): (InventoryItem | null)[] | null {
  if (countTemplateInInventory(slots, templateId) < quantity) return null;
  const next = slots.map((s) => (s ? { ...s } : null));
  let remaining = quantity;
  for (let i = 0; i < next.length && remaining > 0; i++) {
    const slot = next[i];
    if (slot && slot.templateId === templateId) {
      if (slot.quantity <= remaining) {
        remaining -= slot.quantity;
        next[i] = null;
      } else {
        slot.quantity -= remaining;
        remaining = 0;
      }
    }
  }
  return next;
}

export function swapInventorySlots(
  slots: (InventoryItem | null)[],
  fromIdx: number,
  toIdx: number,
): (InventoryItem | null)[] {
  if (
    fromIdx === toIdx ||
    fromIdx < 0 ||
    toIdx < 0 ||
    fromIdx >= slots.length ||
    toIdx >= slots.length
  ) {
    return slots;
  }
  const next = [...slots];
  const a = next[fromIdx];
  const b = next[toIdx];
  if (a && b && a.templateId === b.templateId && b.quantity < b.maxStack) {
    const space = b.maxStack - b.quantity;
    const move = Math.min(space, a.quantity);
    next[toIdx] = { ...b, quantity: b.quantity + move };
    next[fromIdx] = a.quantity - move > 0 ? { ...a, quantity: a.quantity - move } : null;
    return next;
  }
  next[fromIdx] = b;
  next[toIdx] = a;
  return next;
}

export function sortInventorySlots(slots: (InventoryItem | null)[]): (InventoryItem | null)[] {
  const rarityWeight: Record<string, number> = {
    celestial: 6,
    mythic: 5,
    epic: 4,
    rare: 3,
    uncommon: 2,
    common: 1,
  };
  const items = slots.filter((s): s is InventoryItem => s !== null);
  items.sort((a, b) => {
    const rw = (rarityWeight[b.rarity] ?? 0) - (rarityWeight[a.rarity] ?? 0);
    if (rw !== 0) return rw;
    return a.name.localeCompare(b.name);
  });
  const result: (InventoryItem | null)[] = Array(slots.length).fill(null);
  items.forEach((item, idx) => {
    if (idx < result.length) result[idx] = item;
  });
  return result;
}

export function craftRecipe(
  slots: (InventoryItem | null)[],
  recipeId: string,
): { success: boolean; reason?: string; slots: (InventoryItem | null)[]; outputTemplateId?: string } {
  const recipe = CRAFTING_RECIPES.find((r) => r.id === recipeId);
  if (!recipe) return { success: false, reason: 'Recipe not found.', slots };

  for (const ing of recipe.ingredients) {
    if (countTemplateInInventory(slots, ing.templateId) < ing.qty) {
      return { success: false, reason: 'Missing required materials.', slots };
    }
  }

  let updated: (InventoryItem | null)[] | null = slots;
  for (const ing of recipe.ingredients) {
    if (!updated) break;
    updated = removeTemplateFromInventory(updated, ing.templateId, ing.qty);
  }
  if (!updated) return { success: false, reason: 'Material deduction failed.', slots };

  const added = addItemToInventory(updated, recipe.outputTemplateId, recipe.outputQty);
  return {
    success: added.added > 0,
    reason: added.added > 0 ? undefined : 'Inventory full.',
    slots: added.added > 0 ? added.slots : slots,
    outputTemplateId: recipe.outputTemplateId,
  };
}

export function purchaseShopOffer(
  slots: (InventoryItem | null)[],
  currencies: Currencies,
  offerId: string,
  qty = 1,
): { success: boolean; reason?: string; slots: (InventoryItem | null)[]; currencies: Currencies } {
  const offer = SHOP_OFFERS.find((o) => o.id === offerId);
  if (!offer) return { success: false, reason: 'Offer unavailable.', slots, currencies };
  const totalCost = offer.price * qty;
  if (currencies[offer.currency] < totalCost) {
    return { success: false, reason: `Insufficient ${offer.currency}.`, slots, currencies };
  }
  const res = addItemToInventory(slots, offer.templateId, qty);
  if (res.added <= 0) {
    return { success: false, reason: 'Inventory is full.', slots, currencies };
  }
  return {
    success: true,
    slots: res.slots,
    currencies: {
      ...currencies,
      [offer.currency]: currencies[offer.currency] - offer.price * res.added,
    },
  };
}

export function sellInventoryItem(
  slots: (InventoryItem | null)[],
  currencies: Currencies,
  slotIdx: number,
  fortuneRank = 0,
): { success: boolean; earnedGold: number; slots: (InventoryItem | null)[]; currencies: Currencies } {
  const item = slots[slotIdx];
  if (!item) return { success: false, earnedGold: 0, slots, currencies };
  const unitVal = item.stats?.sellValue ?? 6;
  const mult = 1 + fortuneRank * 0.03;
  const earnedGold = Math.max(1, Math.round(unitVal * mult));
  const next = [...slots];
  if (item.quantity > 1) {
    next[slotIdx] = { ...item, quantity: item.quantity - 1 };
  } else {
    next[slotIdx] = null;
  }
  return {
    success: true,
    earnedGold,
    slots: next,
    currencies: { ...currencies, gold: currencies.gold + earnedGold },
  };
}

export function resolveAutoEquipmentSlot(item: InventoryItem): EquipmentSlot | null {
  if (item.category === 'elytra') return 'elytra';
  if (item.category === 'shield') return 'offHand';
  if (item.category === 'ammo') return 'accessory';
  if (item.category === 'weapon' || item.category === 'tool') return 'weapon';
  if (item.category === 'armor') {
    return item.stats?.armorSlot ?? 'armor';
  }
  return null;
}

export function equipItemToSlot(
  slots: (InventoryItem | null)[],
  equipped: SaveDataV1['equipped'],
  invIdx: number,
  explicitSlot?: EquipmentSlot,
): {
  success: boolean;
  reason?: string;
  slot?: EquipmentSlot;
  slots: (InventoryItem | null)[];
  equipped: SaveDataV1['equipped'];
} {
  const item = slots[invIdx];
  if (!item) return { success: false, reason: 'No item in slot.', slots, equipped };

  const targetSlot = explicitSlot ?? resolveAutoEquipmentSlot(item);
  if (!targetSlot) {
    return { success: false, reason: 'This item cannot be equipped.', slots, equipped };
  }

  // Validate compatibility with explicit slot
  if (targetSlot === 'elytra' && item.category !== 'elytra') {
    return { success: false, reason: 'Only Elytra wings fit in the Elytra slot.', slots, equipped };
  }
  if ((targetSlot === 'helmet' || targetSlot === 'armor' || targetSlot === 'leggings' || targetSlot === 'boots') && item.category !== 'armor') {
    return { success: false, reason: 'Only armor pieces fit in armor slots.', slots, equipped };
  }

  const nextSlots = [...slots];
  const prevEquipped = equipped[targetSlot];
  nextSlots[invIdx] = prevEquipped;

  return {
    success: true,
    slot: targetSlot,
    slots: nextSlots,
    equipped: {
      ...equipped,
      [targetSlot]: item,
    },
  };
}

export function swapMainAndOffHand(equipped: SaveDataV1['equipped']): SaveDataV1['equipped'] {
  return {
    ...equipped,
    weapon: equipped.offHand,
    offHand: equipped.weapon,
  };
}

export function computeTotalDefense(equipped: SaveDataV1['equipped'], vitalityRank = 0): number {
  const pieces = [
    equipped.helmet,
    equipped.armor,
    equipped.leggings,
    equipped.boots,
    equipped.offHand,
    equipped.elytra,
    equipped.accessory,
  ];
  let def = vitalityRank * 3;
  for (const p of pieces) {
    def += p?.stats?.defense ?? 0;
  }
  return def;
}

export function upgradeSkillStat(
  vitals: PlayerVitals,
  key: keyof SkillUpgrades,
): { success: boolean; reason?: string; vitals: PlayerVitals } {
  const meta = SKILL_UPGRADE_META.find((m) => m.key === key);
  if (!meta) return { success: false, reason: 'Unknown skill.', vitals };
  if ((vitals.skillPoints ?? 0) < 1) {
    return { success: false, reason: 'Not enough Skill Points.', vitals };
  }
  const currentRank = vitals.skillUpgrades?.[key] ?? 0;
  if (currentRank >= meta.maxRank) {
    return { success: false, reason: `${meta.name} is already max rank.`, vitals };
  }
  const nextUpgrades = { ...vitals.skillUpgrades, [key]: currentRank + 1 };
  let nextMaxHp = vitals.maxHp;
  let nextHp = vitals.hp;
  let nextMaxStam = vitals.maxStamina;
  let nextStam = vitals.stamina;

  if (key === 'vitality') {
    nextMaxHp += 45;
    nextHp += 45;
  } else if (key === 'agility') {
    nextMaxStam += 15;
    nextStam += 15;
  }

  return {
    success: true,
    vitals: {
      ...vitals,
      skillPoints: vitals.skillPoints - 1,
      skillUpgrades: nextUpgrades,
      maxHp: nextMaxHp,
      hp: nextHp,
      maxStamina: nextMaxStam,
      stamina: nextStam,
    },
  };
}

export function upgradeElementRank(
  vitals: PlayerVitals,
  elementId: ElementId,
): { success: boolean; reason?: string; vitals: PlayerVitals } {
  if (!vitals.unlockedElements.includes(elementId)) {
    return { success: false, reason: 'Harmonize this element first.', vitals };
  }
  if ((vitals.skillPoints ?? 0) < 1) {
    return { success: false, reason: 'Requires 1 Skill Point.', vitals };
  }
  const cur = vitals.elementRanks?.[elementId] ?? 1;
  if (cur >= 5) {
    return { success: false, reason: 'Element already at Master Rank V.', vitals };
  }
  return {
    success: true,
    vitals: {
      ...vitals,
      skillPoints: vitals.skillPoints - 1,
      elementRanks: {
        ...vitals.elementRanks,
        [elementId]: cur + 1,
      },
    },
  };
}

export function upgradeAscensionPower(
  vitals: PlayerVitals,
  powerId: AscensionPowerId,
): { success: boolean; reason?: string; vitals: PlayerVitals } {
  const meta = ASCENSION_POWERS_META.find((m) => m.id === powerId);
  if (!meta) return { success: false, reason: 'Unknown Ascension Power.', vitals };
  if ((vitals.skillPoints ?? 0) < 1) {
    return { success: false, reason: 'Requires 1 Skill Point.', vitals };
  }
  const cur = vitals.powerRanks?.[powerId] ?? 1;
  if (cur >= meta.maxRank) {
    return { success: false, reason: `${meta.name} is already Max Rank ${meta.maxRank}.`, vitals };
  }
  return {
    success: true,
    vitals: {
      ...vitals,
      skillPoints: vitals.skillPoints - 1,
      powerRanks: {
        ...vitals.powerRanks,
        [powerId]: cur + 1,
      },
    },
  };
}

export function setActiveSkillBar(
  vitals: PlayerVitals,
  slotIdx: 0 | 1 | 2,
  elementId: ElementId,
): { success: boolean; reason?: string; vitals: PlayerVitals } {
  if (!vitals.unlockedElements.includes(elementId)) {
    return { success: false, reason: 'Harmonize this element first.', vitals };
  }
  const bar: [ElementId, ElementId, ElementId] = [...(vitals.activeSkillBar ?? ['chakra', 'lightning', 'chakra'])] as [
    ElementId,
    ElementId,
    ElementId,
  ];
  bar[slotIdx] = elementId;
  return {
    success: true,
    vitals: {
      ...vitals,
      activeSkillBar: bar,
    },
  };
}

export function upgradeBuildingPiece(
  building: PlacedBuilding,
  currencies: Currencies,
  inventory: (InventoryItem | null)[],
): {
  success: boolean;
  reason?: string;
  building: PlacedBuilding;
  currencies: Currencies;
  inventory: (InventoryItem | null)[];
} {
  const curTier = building.tier ?? 1;
  if (curTier >= 3) {
    return { success: false, reason: 'Structure is already Tier III Celestial.', building, currencies, inventory };
  }
  const cost = BUILDING_UPGRADE_COSTS[curTier as 1 | 2];
  if (currencies.gold < cost.gold) {
    return { success: false, reason: `Requires ${cost.gold} Gold to upgrade.`, building, currencies, inventory };
  }
  if (countTemplateInInventory(inventory, 'stone') < cost.stone) {
    return { success: false, reason: `Requires ${cost.stone} Basalt Stone in bag.`, building, currencies, inventory };
  }
  const nextInv = removeTemplateFromInventory(inventory, 'stone', cost.stone);
  if (!nextInv) {
    return { success: false, reason: 'Missing stone.', building, currencies, inventory };
  }
  return {
    success: true,
    building: { ...building, tier: (curTier + 1) as 2 | 3 },
    currencies: { ...currencies, gold: currencies.gold - cost.gold },
    inventory: nextInv,
  };
}

export function claimMailReward(
  save: SaveDataV1,
  mailId: string,
): { success: boolean; reason?: string; save: SaveDataV1 } {
  const target = save.mailbox.find((m) => m.id === mailId);
  if (!target) return { success: false, reason: 'Message not found.', save };
  if (target.claimed) return { success: false, reason: 'Rewards already claimed.', save };

  const rw = target.rewards ?? {};
  let nextInv = save.inventory;
  if (rw.itemTemplateId) {
    const added = addItemToInventory(nextInv, rw.itemTemplateId, rw.itemQty ?? 1);
    if (added.added <= 0) {
      return { success: false, reason: 'Backpack is full — free a slot first.', save };
    }
    nextInv = added.slots;
  }

  return {
    success: true,
    save: {
      ...save,
      inventory: nextInv,
      currencies: {
        gold: save.currencies.gold + (rw.gold ?? 0),
        diamonds: save.currencies.diamonds + (rw.diamonds ?? 0),
        emeralds: save.currencies.emeralds + (rw.emeralds ?? 0),
        ancientCoins: save.currencies.ancientCoins + (rw.ancientCoins ?? 0),
        aetherShards: (save.currencies.aetherShards ?? 0) + (rw.aetherShards ?? 0),
      },
      vitals: {
        ...save.vitals,
        skillPoints: (save.vitals.skillPoints ?? 0) + (rw.skillPoints ?? 0),
      },
      mailbox: save.mailbox.map((m) =>
        m.id === mailId ? { ...m, read: true, claimed: true } : m,
      ),
    },
  };
}

export function validateAndRecoverSave(raw: unknown): {
  data: SaveDataV1;
  recovered: boolean;
} {
  const fallback = createDefaultSave();
  if (!raw || typeof raw !== 'object') {
    return { data: fallback, recovered: true };
  }
  const obj = raw as Partial<SaveDataV1>;
  if (obj.version !== 1 || !obj.character || !obj.vitals || !Array.isArray(obj.inventory)) {
    return { data: fallback, recovered: true };
  }
  const fixedInventory = Array.from({ length: 30 }, (_, i) => obj.inventory?.[i] ?? null);
  const fixedStorage = Array.from({ length: 30 }, (_, i) => obj.storage?.[i] ?? null);
  const defaultLiving = createDefaultLivingWorld();
  const rawLiving = obj.livingWorld;
  const livingWorld = rawLiving
    ? {
        ...defaultLiving,
        ...rawLiving,
        farms: Array.isArray(rawLiving.farms) && rawLiving.farms.length > 0 ? rawLiving.farms : defaultLiving.farms,
        npcAgents: { ...defaultLiving.npcAgents, ...(rawLiving.npcAgents ?? {}) },
        npcBuildings: Array.isArray(rawLiving.npcBuildings) ? rawLiving.npcBuildings : defaultLiving.npcBuildings,
        marketListings: Array.isArray(rawLiving.marketListings) ? rawLiving.marketListings : defaultLiving.marketListings,
        chatterLog: Array.isArray(rawLiving.chatterLog) ? rawLiving.chatterLog : defaultLiving.chatterLog,
      }
    : defaultLiving;

  return {
    recovered: false,
    data: {
      ...fallback,
      ...obj,
      character: { ...fallback.character, ...obj.character },
      vitals: {
        ...fallback.vitals,
        ...obj.vitals,
        activeSkillBar:
          Array.isArray(obj.vitals.activeSkillBar) && obj.vitals.activeSkillBar.length === 3
            ? (obj.vitals.activeSkillBar as [ElementId, ElementId, ElementId])
            : fallback.vitals.activeSkillBar,
        skillUpgrades: {
          ...fallback.vitals.skillUpgrades,
          ...(obj.vitals.skillUpgrades ?? {}),
        },
        elementRanks: {
          ...fallback.vitals.elementRanks,
          ...(obj.vitals.elementRanks ?? {}),
        },
        powerRanks: {
          ...fallback.vitals.powerRanks,
          ...(obj.vitals.powerRanks ?? {}),
        },
      },
      currencies: { ...fallback.currencies, ...(obj.currencies ?? {}) },
      equipped: {
        ...fallback.equipped,
        ...(obj.equipped ?? {}),
      },
      settings: {
        ...fallback.settings,
        ...(obj.settings ?? {}),
        keybinds: { ...fallback.settings.keybinds, ...(obj.settings?.keybinds ?? {}) },
      },
      inventory: fixedInventory,
      storage: fixedStorage,
      livingWorld,
      quests: { ...fallback.quests, ...(obj.quests ?? {}) },
      achievements: Array.isArray(obj.achievements) && obj.achievements.length > 0
        ? obj.achievements
        : fallback.achievements,
      mailbox: Array.isArray(obj.mailbox) && obj.mailbox.length > 0
        ? obj.mailbox
        : fallback.mailbox,
      hudProfiles: Array.isArray(obj.hudProfiles) && obj.hudProfiles.length > 0
        ? obj.hudProfiles
        : fallback.hudProfiles,
    },
  };
}

// ── WORLD SCIENCE & LAND LAWS (Physics · Biology · Chemistry · Logic) ──

/** Physics: Kinetic Momentum Strike Multiplier (1.00x at rest up to 1.28x at high velocity) */
export function calculateKineticMomentumBonus(speedMetersPerSec: number): number {
  const clamped = Math.max(0, Math.min(35, speedMetersPerSec));
  // Scaled kinetic term E_k ~ v^2 / (v^2 + k)
  const bonus = (clamped * clamped) / (clamped * clamped + 320);
  return Number((1 + bonus * 0.28).toFixed(3));
}

/** Physics: Surface traction coefficient across Aetheria biomes (low friction on Frostfall ice lake) */
export function getTerrainTraction(biome: BiomeId, x: number, z: number): {
  traction: number;
  surfaceName: string;
} {
  if (biome === 'frostfall') {
    const distLake = Math.hypot(x + 74, z + 52);
    if (distLake < 15) {
      return { traction: 0.42, surfaceName: 'Glacial Mirror Ice (Low Friction μ=0.14)' };
    }
    return { traction: 0.78, surfaceName: 'Packed Alpine Snow (μ=0.38)' };
  }
  if (biome === 'ember') {
    return { traction: 1.12, surfaceName: 'Basalt Ash & Obsidian (μ=0.82)' };
  }
  if (biome === 'celestial') {
    return { traction: 0.92, surfaceName: 'Aether Marble Stratum (μ=0.55)' };
  }
  if (biome === 'abyssal') {
    return { traction: 1.08, surfaceName: 'Crystalline Slate Floor (μ=0.74)' };
  }
  return { traction: 1.0, surfaceName: 'Verdant Loam Turf (μ=0.65)' };
}

/** Physics: Aerodynamic lift & thermal updrafts for Elytra gliding */
export function calculateAerodynamicLift(
  biome: BiomeId,
  altitudeY: number,
  hasElytra: boolean,
): { airDensity: number; thermalUpdraft: number; sinkAdjustment: number } {
  // Ideal gas air density falls gently with altitude, higher in cold Frostfall air
  const tempFactor = biome === 'frostfall' ? 1.12 : biome === 'ember' ? 0.9 : 1.0;
  const airDensity = Number((tempFactor * Math.exp(-Math.max(0, altitudeY) / 140)).toFixed(3));
  const thermalUpdraft = biome === 'ember' ? 1.55 : biome === 'celestial' ? 0.95 : 0;
  const sinkAdjustment = hasElytra ? thermalUpdraft + (airDensity - 1.0) * 1.4 : 0;
  return {
    airDensity,
    thermalUpdraft,
    sinkAdjustment: Number(sinkAdjustment.toFixed(2)),
  };
}

/** Biology: Ecosystem flora rate, metabolic hydration cost & homeostasis state */
export function getBiomeBiologyProfile(
  biome: BiomeId,
  hunger: number,
  thirst: number,
): {
  ecosystemName: string;
  photosynthesisRate: number;
  metabolicEfficiency: number;
  homeostasisLabel: string;
} {
  const photosynthesisRate =
    biome === 'verdant'
      ? 1.25
      : biome === 'celestial'
      ? 1.15
      : biome === 'ember'
      ? 0.75
      : biome === 'frostfall'
      ? 0.6
      : 0.5;
  const metabolicEfficiency = hunger >= 60 && thirst >= 60 ? 1.2 : hunger < 25 || thirst < 25 ? 0.75 : 1.0;
  const homeostasisLabel =
    hunger < 25 || thirst < 25
      ? 'Catabolic Deficit (-25% Stamina)'
      : hunger >= 60 && thirst >= 60
      ? 'Optimal Anabolic Flow (+20% Stamina Regen)'
      : 'Balanced Homeostasis';
  const ecosystemMap: Record<BiomeId, string> = {
    verdant: 'Temperate Broadleaf & Nitrogen-Rich Loam',
    frostfall: 'Cryo-Boreal Lichen & Permafrost Tundra',
    ember: 'Thermophilic Sulfur & Volcanic Flora',
    celestial: 'High-Altitude Astral Canopy',
    abyssal: 'Bioluminescent Subterranean Mycelium',
  };
  return {
    ecosystemName: ecosystemMap[biome],
    photosynthesisRate,
    metabolicEfficiency,
    homeostasisLabel,
  };
}

/** Chemistry: Elemental Reaction Matrix & Atmospheric Alchemy */
export function evaluateElementalReaction(
  primary: ElementId,
  secondary: ElementId,
  biome: BiomeId,
): {
  reactionName: string;
  formula: string;
  multiplier: number;
  atmosphericGas: string;
} {
  const pair = new Set<ElementId>([primary, secondary]);
  const gasMap: Record<BiomeId, string> = {
    verdant: '78% N₂ · 21% O₂ · 0.04% CO₂',
    frostfall: '77% N₂ · 21% O₂ · Cryo-Vapor',
    ember: '68% N₂ · 16% O₂ · SO₂ + CO₂',
    celestial: '72% O₂/N₂ · Ionized Aether Plasma',
    abyssal: '74% N₂ · CH₄ Trace · Void Ether',
  };

  if (pair.has('fire') && pair.has('water')) {
    return {
      reactionName: 'Thermal Vaporization',
      formula: 'H₂O(l) + ΔH → H₂O(g)↑',
      multiplier: 1.28,
      atmosphericGas: gasMap[biome],
    };
  }
  if (pair.has('water') && pair.has('lightning')) {
    return {
      reactionName: 'Electrolysis Arc',
      formula: '2H₂O + e⁻ → 2H₂ + O₂',
      multiplier: 1.32,
      atmosphericGas: gasMap[biome],
    };
  }
  if (pair.has('fire') && pair.has('wind')) {
    return {
      reactionName: 'Rapid Oxidation Flash',
      formula: 'CₓHᵧ + O₂ → CO₂ + Heat',
      multiplier: 1.25,
      atmosphericGas: gasMap[biome],
    };
  }
  if (pair.has('earth') && pair.has('fire')) {
    return {
      reactionName: 'Silicate Magma Smelt',
      formula: 'SiO₂ + FeO + Δ → Obsidian Alloy',
      multiplier: 1.24,
      atmosphericGas: gasMap[biome],
    };
  }
  if (pair.has('light') && pair.has('darkness')) {
    return {
      reactionName: 'Photonic Annihilation',
      formula: 'e⁻ + e⁺ → 2γ (511 keV)',
      multiplier: 1.35,
      atmosphericGas: gasMap[biome],
    };
  }
  if (pair.has('chakra') && pair.has('lightning')) {
    return {
      reactionName: 'Ionized Plasma Resonance',
      formula: 'Ar + e⁻ → Ar⁺ + 2e⁻',
      multiplier: 1.3,
      atmosphericGas: gasMap[biome],
    };
  }
  return {
    reactionName: 'Harmonic Catalyst Bond',
    formula: 'ΔG = ΔH − TΔS < 0',
    multiplier: 1.12,
    atmosphericGas: gasMap[biome],
  };
}

/** Logic: Deterministic Boolean Land Proposition Evaluator */
export function evaluateLandLogicRules(params: {
  biome: BiomeId;
  hpRatio: number;
  temperature: number;
  nearCampfire: boolean;
  isFlying: boolean;
  bossPhase2: boolean;
}): { proposition: string; result: boolean; consequence: string }[] {
  return [
    {
      proposition: '(HP ≤ 34%) ∨ (BossPhase == 2)',
      result: params.hpRatio <= 0.34 || params.bossPhase2,
      consequence: 'Activates Critical Battle Ostinato & Heartbeat Audio',
    },
    {
      proposition: '(Biome == Frostfall) ∧ ¬NearCampfire',
      result: params.biome === 'frostfall' && !params.nearCampfire,
      consequence: 'Newton Cooling drains thermal core (−1.4 HP/s below −2°C)',
    },
    {
      proposition: '(Biome == Ember) ∧ ElytraGliding',
      result: params.biome === 'ember' && params.isFlying,
      consequence: 'Volcanic thermal updraft grants +1.55 m/s vertical lift',
    },
    {
      proposition: '(Temperature > 37°C) ∨ (Thirst == 0)',
      result: params.temperature > 37,
      consequence: 'Hyperthermia acceleration doubles hydration loss',
    },
  ];
}

