import { ITEM_TEMPLATES, NPCS, VENDOR_META } from './catalog';
import { addItemToInventory } from './rules';
import type {
  BuildingPieceKind,
  Currencies,
  FarmCropKind,
  FarmPlotState,
  InventoryItem,
  LivingWorldState,
  NpcAgentState,
  NpcChatterEntry,
  NpcCraftedListing,
  PlacedBuilding,
  VendorRole,
} from './types';
import { groundHeightAt } from './worldMath';

export const CROP_META: Record<
  FarmCropKind,
  { name: string; color: string; outputTemplateId: string; growRate: number }
> = {
  golden_wheat: {
    name: 'Golden Wheat',
    color: '#eab308',
    outputTemplateId: 'golden_bread',
    growRate: 5.5,
  },
  sunberry: {
    name: 'Sunberry Vines',
    color: '#f97316',
    outputTemplateId: 'sunberry_ration',
    growRate: 4.8,
  },
  aether_herb: {
    name: 'Aether Herbs',
    color: '#34d399',
    outputTemplateId: 'aether_salad',
    growRate: 4.2,
  },
  spirit_rice: {
    name: 'Spirit Rice',
    color: '#fde047',
    outputTemplateId: 'roasted_feast',
    growRate: 5.0,
  },
};

const NPC_BUILD_BLUEPRINTS: { kind: BuildingPieceKind; x: number; z: number; rot: number }[] = [
  { kind: 'wood_floor', x: 26, z: -18, rot: 0 },
  { kind: 'wood_wall', x: 26, z: -19.6, rot: 0 },
  { kind: 'doorway', x: 26, z: -16.4, rot: 0 },
  { kind: 'slate_roof', x: 26, z: -18, rot: 0 },
  { kind: 'watchtower', x: -30, z: -23, rot: 0.3 },
  { kind: 'campfire', x: -27, z: -12, rot: 0 },
  { kind: 'storage_chest', x: 28, z: -18, rot: 1.57 },
  { kind: 'glass_wall', x: 24.4, z: -18, rot: 1.57 },
  { kind: 'aether_beacon', x: -36, z: -15, rot: 0 },
];

const CRAFT_RECIPES_BY_ROLE: Partial<
  Record<
    string,
    { templateId: string; vendor: VendorRole; currency: keyof Currencies; basePrice: number; speech: string }[]
  >
> = {
  Blacksmith: [
    { templateId: 'sovereign_katana_mk2', vendor: 'blacksmith', currency: 'gold', basePrice: 460, speech: 'Just quenched a Masterwork Katana at the forge!' },
    { templateId: 'twin_crescent', vendor: 'blacksmith', currency: 'gold', basePrice: 285, speech: 'Balanced twin blades ready for the market.' },
    { templateId: 'dagger_shadowfang', vendor: 'blacksmith', currency: 'gold', basePrice: 210, speech: 'Honed an off-hand Shadowfang dirk for trade.' },
  ],
  Armorer: [
    { templateId: 'mithril_bastion_plate', vendor: 'armorer', currency: 'gold', basePrice: 390, speech: 'Riveted a Frostfire Mithril cuirass for sale!' },
    { templateId: 'shield_bulwark', vendor: 'armorer', currency: 'gold', basePrice: 225, speech: 'Aegis Sky Shield is ready at my guild stall.' },
    { templateId: 'helm_warden', vendor: 'armorer', currency: 'gold', basePrice: 195, speech: 'Tempered a Starsteel Warden Helm.' },
  ],
  Fletcher: [
    { templateId: 'bow_starfall', vendor: 'fletcher', currency: 'gold', basePrice: 275, speech: 'Strung a fresh Starfall Longbow with wind-sinew!' },
    { templateId: 'quiver_piercing', vendor: 'fletcher', currency: 'gold', basePrice: 175, speech: 'Crafted piercing quivers for ranged adventurers.' },
  ],
  Gunsmith: [
    { templateId: 'pistol_twin_pulse', vendor: 'gunsmith', currency: 'gold', basePrice: 265, speech: 'Calibrated an Omega Arc Revolver with crystal coils!' },
    { templateId: 'aether_carbine', vendor: 'gunsmith', currency: 'diamonds', basePrice: 22, speech: 'Pulse Rifle chamber pressure verified—listed!' },
  ],
  Chemist: [
    { templateId: 'frostfire_tonic', vendor: 'chemist', currency: 'gold', basePrice: 88, speech: 'Distilled Frostfire Tonics from Rowan’s herbs!' },
    { templateId: 'health_elixir', vendor: 'chemist', currency: 'gold', basePrice: 32, speech: 'Restocked fresh Crimson Vitality Elixirs.' },
  ],
  Toolsmith: [
    { templateId: 'tool_pickaxe', vendor: 'toolsmith', currency: 'gold', basePrice: 105, speech: 'Forged a high-yield Starsteel Pickaxe!' },
    { templateId: 'torch_astral', vendor: 'toolsmith', currency: 'gold', basePrice: 145, speech: 'Built an Astral Lantern for Frostfall nights.' },
  ],
  Weaver: [
    { templateId: 'armor_warden', vendor: 'armorer', currency: 'gold', basePrice: 300, speech: 'Wove astral silk into Celestial Warden Plate.' },
  ],
};

const PAIR_DIALOGUE_TEMPLATES: {
  lineA: (nameA: string, nameB: string, food: number, ore: number) => string;
  category: NpcChatterEntry['category'];
}[] = [
  {
    lineA: (_a, b, food) =>
      `${b}, our granaries hold ${food} rations—shall we send fresh wheat loaves to Market Stall?`,
    category: 'farm',
  },
  {
    lineA: (_a, b, _f, ore) =>
      `Hey ${b}, we have ${ore} ingots of Starsteel left. Let's forge new blades and armor for travelers!`,
    category: 'forge',
  },
  {
    lineA: (_a, b) =>
      `${b}, I spotted Mason Cedric expanding the eastern sanctuary housing. The town feels safer already.`,
    category: 'build',
  },
  {
    lineA: (_a, b) =>
      `${b}, demand for Elytra repairs and Pulse Rifles is rising today—check the guild ledger!`,
    category: 'market',
  },
  {
    lineA: (_a, b) =>
      `Good work today, ${b}. If we keep our farms and forges humming, even the Tombguard won't rattle Verdant.`,
    category: 'chat',
  },
  {
    lineA: (_a, b) =>
      `${b}, Farmer Rowan's Spirit Rice harvest smelled incredible—it boosted morale across the plaza!`,
    category: 'farm',
  },
  {
    lineA: (_a, b, _f, ore) =>
      `${b}, the astral bellows are roaring hot (${ore} Starsteel bars queued). Next Masterwork batch is nearly quenched.`,
    category: 'forge',
  },
  {
    lineA: (_a, b) =>
      `${b}, watch the ridge winds tonight—travelers using Aether Elytra wings love launching from our watchtowers.`,
    category: 'chat',
  },
  {
    lineA: (_a, b) =>
      `${b}, Aether Shard exchange rates look favorable today. Let's list our finest wares before dusk!`,
    category: 'market',
  },
];

function pushChatter(
  log: NpcChatterEntry[],
  entry: Omit<NpcChatterEntry, 'id' | 'timestamp'>,
): NpcChatterEntry[] {
  const next: NpcChatterEntry = {
    ...entry,
    id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
  };
  return [next, ...log].slice(0, 24);
}

function upsertMarketListing(
  listings: NpcCraftedListing[],
  item: {
    templateId: string;
    crafterId: string;
    crafterName: string;
    vendor: VendorRole;
    currency: keyof Currencies;
    price: number;
    quality: NpcCraftedListing['quality'];
  },
): NpcCraftedListing[] {
  const next = [...listings];
  const existingIdx = next.findIndex(
    (l) => l.templateId === item.templateId && l.crafterId === item.crafterId,
  );
  if (existingIdx >= 0) {
    next[existingIdx] = {
      ...next[existingIdx],
      stock: Math.min(12, next[existingIdx].stock + 1),
      price: item.price,
      quality: item.quality,
      createdAt: Date.now(),
    };
    return next;
  }
  next.unshift({
    id: `lst_${item.templateId}_${Date.now().toString(36).slice(-4)}`,
    templateId: item.templateId,
    crafterId: item.crafterId,
    crafterName: item.crafterName,
    vendor: item.vendor,
    currency: item.currency,
    price: item.price,
    stock: 1,
    quality: item.quality,
    createdAt: Date.now(),
  });
  return next.slice(0, 18);
}

export function tickLivingWorldSimulation(
  world: LivingWorldState,
  dt: number,
  seedStep = 0,
): LivingWorldState {
  let villageFoodSupply = world.villageFoodSupply;
  let villageOreSupply = Math.min(80, world.villageOreSupply + dt * 0.18);
  let marketListings = [...world.marketListings];
  let npcBuildings = [...world.npcBuildings];
  let chatterLog = [...world.chatterLog];

  // 1. Advance crop growth across all farm plots
  const farms: FarmPlotState[] = world.farms.map((plot) => {
    if (!plot.crop) return plot;
    const meta = CROP_META[plot.crop];
    const waterDrain = dt * 0.4;
    const nextWater = Math.max(0, plot.water - waterDrain);
    const hydrationMult = nextWater > 20 ? 1.25 : 0.45;
    const nextGrowth = Math.min(100, plot.growthProgress + meta.growRate * hydrationMult * dt);
    const stage: FarmPlotState['stage'] =
      nextGrowth >= 98 ? 3 : nextGrowth >= 55 ? 2 : nextGrowth >= 18 ? 1 : 0;
    return {
      ...plot,
      water: nextWater,
      growthProgress: nextGrowth,
      stage,
    };
  });

  // 2. Autonomous NPC agent decisions & work ticks
  const npcAgents: Record<string, NpcAgentState> = {};
  const cropKeys: FarmCropKind[] = ['golden_wheat', 'sunberry', 'aether_herb', 'spirit_rice'];

  NPCS.forEach((npc, idx) => {
    if (npc.biome !== 'verdant') return;
    const prev = world.npcAgents[npc.id] ?? {
      npcId: npc.id,
      task: 'patrolling',
      targetX: npc.x,
      targetZ: npc.z,
      progress: 0,
      speechBubble: '',
      speechTtl: 0,
      foodHeld: 2,
      craftCount: 0,
    };

    const agent: NpcAgentState = {
      ...prev,
      speechTtl: Math.max(0, prev.speechTtl - dt),
    };
    if (agent.speechTtl <= 0) {
      agent.speechBubble = '';
      agent.speechPartnerId = undefined;
    }

    agent.progress += dt * (npc.role === 'Farmer' ? 14 : npc.role === 'Mason' ? 9 : 11);

    if (agent.progress >= 100) {
      agent.progress = 0;

      // Role-driven autonomous action execution
      if (npc.role === 'Farmer' || (npc.role === 'Merchant' && villageFoodSupply < 25)) {
        const ripeIdx = farms.findIndex((f) => f.crop && f.stage === 3);
        const emptyIdx = farms.findIndex((f) => !f.crop);
        const dryIdx = farms.findIndex((f) => f.crop && f.water < 50);

        if (ripeIdx >= 0) {
          const plot = farms[ripeIdx];
          const cropMeta = CROP_META[plot.crop!];
          farms[ripeIdx] = {
            ...plot,
            crop: cropKeys[(ripeIdx + seedStep) % cropKeys.length],
            stage: 0,
            growthProgress: 5,
            water: 90,
            tendedBy: npc.name,
          };
          villageFoodSupply = Math.min(120, villageFoodSupply + 4);
          agent.foodHeld += 2;
          agent.task = 'harvesting';
          agent.targetX = plot.x;
          agent.targetZ = plot.z;
          agent.speechBubble = `Harvested ${cropMeta.name} & replanted!`;
          agent.speechTtl = 6;
          marketListings = upsertMarketListing(marketListings, {
            templateId: cropMeta.outputTemplateId,
            crafterId: npc.id,
            crafterName: npc.name,
            vendor: 'chemist',
            currency: 'gold',
            price: cropMeta.outputTemplateId === 'aether_salad' ? 38 : 22,
            quality: 'Fine',
          });
          chatterLog = pushChatter(chatterLog, {
            speakerName: npc.name,
            line: `Harvested ${cropMeta.name} from plot ${ripeIdx + 1} and stocked fresh rations in the market.`,
            category: 'farm',
          });
        } else if (emptyIdx >= 0) {
          const plot = farms[emptyIdx];
          const chosen = cropKeys[(emptyIdx + idx + seedStep) % cropKeys.length];
          farms[emptyIdx] = {
            ...plot,
            crop: chosen,
            stage: 1,
            growthProgress: 20,
            water: 95,
            tendedBy: npc.name,
          };
          agent.task = 'farming';
          agent.targetX = plot.x;
          agent.targetZ = plot.z;
          agent.speechBubble = `Planted ${CROP_META[chosen].name}!`;
          agent.speechTtl = 5;
        } else if (dryIdx >= 0) {
          const plot = farms[dryIdx];
          farms[dryIdx] = { ...plot, water: 100, tendedBy: npc.name };
          agent.task = 'farming';
          agent.targetX = plot.x;
          agent.targetZ = plot.z;
          agent.speechBubble = 'Watering village crops...';
          agent.speechTtl = 5;
        }
      } else if (npc.role === 'Mason') {
        const nextBp = NPC_BUILD_BLUEPRINTS.find(
          (bp) => !npcBuildings.some((b) => Math.hypot(b.x - bp.x, b.z - bp.z) < 0.8),
        );
        if (nextBp && villageOreSupply >= 4) {
          villageOreSupply -= 4;
          const bld: PlacedBuilding = {
            id: `npc_bld_${Date.now()}_${npcBuildings.length}`,
            kind: nextBp.kind,
            x: nextBp.x,
            y: groundHeightAt(nextBp.x, nextBp.z),
            z: nextBp.z,
            rotationY: nextBp.rot,
            tier: 1,
            ownerName: npc.name,
          };
          npcBuildings.push(bld);
          agent.task = 'building';
          agent.targetX = nextBp.x;
          agent.targetZ = nextBp.z;
          agent.craftCount += 1;
          agent.speechBubble = `Built village ${nextBp.kind.replace('_', ' ')}!`;
          agent.speechTtl = 7;
          chatterLog = pushChatter(chatterLog, {
            speakerName: npc.name,
            line: `Constructed a new ${nextBp.kind.replace('_', ' ')} for Verdant Sanctuary.`,
            category: 'build',
          });
        } else if (npcBuildings.length > 0) {
          const upgradeable = npcBuildings.find((b) => (b.tier ?? 1) < 3);
          if (upgradeable && villageOreSupply >= 6) {
            villageOreSupply -= 6;
            npcBuildings = npcBuildings.map((b) =>
              b.id === upgradeable.id ? { ...b, tier: ((b.tier ?? 1) + 1) as 2 | 3 } : b,
            );
            agent.task = 'building';
            agent.targetX = upgradeable.x;
            agent.targetZ = upgradeable.z;
            agent.speechBubble = `Upgraded town structure to Tier ${(upgradeable.tier ?? 1) + 1}!`;
            agent.speechTtl = 6;
          }
        }
      } else if (CRAFT_RECIPES_BY_ROLE[npc.role] && villageOreSupply >= 3) {
        const pool = CRAFT_RECIPES_BY_ROLE[npc.role]!;
        const pick = pool[(agent.craftCount + seedStep) % pool.length];
        villageOreSupply -= 3;
        agent.craftCount += 1;
        agent.task =
          npc.role === 'Armorer' || npc.role === 'Weaver'
            ? 'forging_armor'
            : npc.role === 'Chemist'
            ? 'brewing'
            : 'forging_weapon';
        agent.targetX = npc.x;
        agent.targetZ = npc.z;
        const isMasterwork = agent.craftCount % 3 === 0;
        const price = isMasterwork ? Math.round(pick.basePrice * 1.12) : pick.basePrice;
        marketListings = upsertMarketListing(marketListings, {
          templateId: pick.templateId,
          crafterId: npc.id,
          crafterName: npc.name,
          vendor: pick.vendor,
          currency: pick.currency,
          price,
          quality: isMasterwork ? 'Masterwork' : 'Fine',
        });
        agent.speechBubble = pick.speech;
        agent.speechTtl = 6.5;
        chatterLog = pushChatter(chatterLog, {
          speakerName: npc.name,
          line: pick.speech,
          category: 'forge',
        });
      } else {
        // Trigger AI-style NPC-to-NPC conversation!
        const verdantPeers = NPCS.filter((p) => p.biome === 'verdant' && p.id !== npc.id);
        const partner = verdantPeers[(idx + seedStep + Math.floor(villageFoodSupply)) % verdantPeers.length];
        const tpl = PAIR_DIALOGUE_TEMPLATES[(idx + seedStep) % PAIR_DIALOGUE_TEMPLATES.length];
        const line = tpl.lineA(npc.name, partner.name, Math.round(villageFoodSupply), Math.round(villageOreSupply));
        agent.task = 'conversing';
        agent.targetX = partner.x * 0.65 + npc.x * 0.35;
        agent.targetZ = partner.z * 0.65 + npc.z * 0.35;
        agent.speechPartnerId = partner.id;
        agent.speechBubble = line;
        agent.speechTtl = 7;
        chatterLog = pushChatter(chatterLog, {
          speakerName: npc.name,
          partnerName: partner.name,
          line,
          category: tpl.category,
        });
      }
    }

    npcAgents[npc.id] = agent;
  });

  return {
    ...world,
    farms,
    npcAgents,
    npcBuildings,
    marketListings,
    chatterLog,
    villageFoodSupply,
    villageOreSupply,
  };
}

export function interactWithFarmPlot(
  world: LivingWorldState,
  inventory: (InventoryItem | null)[],
  plotId: string,
  fortuneRank = 0,
): {
  world: LivingWorldState;
  inventory: (InventoryItem | null)[];
  message: string;
  harvestedFood?: string;
} {
  const idx = world.farms.findIndex((f) => f.id === plotId);
  if (idx === -1) return { world, inventory, message: 'Farm plot not found.' };
  const plot = world.farms[idx];
  const nextFarms = [...world.farms];

  if (plot.crop && plot.stage === 3) {
    const meta = CROP_META[plot.crop];
    const bonusQty = fortuneRank >= 3 ? 2 : 1;
    const added = addItemToInventory(inventory, meta.outputTemplateId, bonusQty);
    nextFarms[idx] = {
      ...plot,
      crop: null,
      stage: 0,
      growthProgress: 0,
      water: 75,
      tendedBy: 'Traveler',
    };
    return {
      world: {
        ...world,
        farms: nextFarms,
        villageFoodSupply: world.villageFoodSupply + 2,
        chatterLog: pushChatter(world.chatterLog, {
          speakerName: 'Verdant Farmstead',
          line: `Traveler harvested ${bonusQty}x ${ITEM_TEMPLATES[meta.outputTemplateId]?.name ?? meta.name}!`,
          category: 'farm',
        }),
      },
      inventory: added.slots,
      message: `Harvested ${bonusQty}x ${ITEM_TEMPLATES[meta.outputTemplateId]?.name ?? meta.name}!`,
      harvestedFood: meta.outputTemplateId,
    };
  }

  if (!plot.crop) {
    const crops: FarmCropKind[] = ['golden_wheat', 'sunberry', 'aether_herb', 'spirit_rice'];
    const chosen = crops[idx % crops.length];
    nextFarms[idx] = {
      ...plot,
      crop: chosen,
      stage: 1,
      growthProgress: 25,
      water: 100,
      tendedBy: 'Traveler',
    };
    return {
      world: { ...world, farms: nextFarms },
      inventory,
      message: `Planted & watered ${CROP_META[chosen].name}!`,
    };
  }

  nextFarms[idx] = {
    ...plot,
    water: 100,
    growthProgress: Math.min(100, plot.growthProgress + 28),
    stage: plot.growthProgress + 28 >= 98 ? 3 : plot.growthProgress + 28 >= 55 ? 2 : 1,
    tendedBy: 'Traveler',
  };
  return {
    world: { ...world, farms: nextFarms },
    inventory,
    message: `Watered ${CROP_META[plot.crop].name} — growth surged!`,
  };
}

export function purchaseNpcListing(
  world: LivingWorldState,
  inventory: (InventoryItem | null)[],
  currencies: Currencies,
  listingId: string,
  reputation = 1,
): {
  success: boolean;
  reason?: string;
  world: LivingWorldState;
  inventory: (InventoryItem | null)[];
  currencies: Currencies;
} {
  const idx = world.marketListings.findIndex((l) => l.id === listingId);
  if (idx === -1) return { success: false, reason: 'Listing sold out.', world, inventory, currencies };
  const listing = world.marketListings[idx];
  if (listing.stock <= 0) return { success: false, reason: 'Out of stock.', world, inventory, currencies };

  const discount = Math.min(0.25, Math.max(0, (reputation - 1) * 0.03));
  const finalPrice = Math.max(1, Math.round(listing.price * (1 - discount)));
  if (currencies[listing.currency] < finalPrice) {
    return {
      success: false,
      reason: `Need ${finalPrice} ${listing.currency}.`,
      world,
      inventory,
      currencies,
    };
  }

  const added = addItemToInventory(inventory, listing.templateId, 1);
  if (added.added <= 0) {
    return { success: false, reason: 'Backpack is full.', world, inventory, currencies };
  }

  const nextListings = world.marketListings
    .map((l, i) => (i === idx ? { ...l, stock: l.stock - 1 } : l))
    .filter((l) => l.stock > 0);

  return {
    success: true,
    world: {
      ...world,
      marketListings: nextListings,
      chatterLog: pushChatter(world.chatterLog, {
        speakerName: listing.crafterName,
        line: `Sold ${ITEM_TEMPLATES[listing.templateId]?.name ?? listing.templateId} (${listing.quality}) to Traveler for ${finalPrice} ${listing.currency}!`,
        category: 'market',
      }),
    },
    inventory: added.slots,
    currencies: {
      ...currencies,
      [listing.currency]: currencies[listing.currency] - finalPrice,
    },
  };
}

export function commissionNpcCraft(
  world: LivingWorldState,
  currencies: Currencies,
  vendor: VendorRole,
): {
  success: boolean;
  reason?: string;
  world: LivingWorldState;
  currencies: Currencies;
} {
  if (currencies.gold < 75) {
    return { success: false, reason: 'Commission requires 75 Gold.', world, currencies };
  }
  const meta = VENDOR_META[vendor];
  const tplPool: Record<VendorRole, string> = {
    blacksmith: 'sovereign_katana_mk2',
    armorer: 'mithril_bastion_plate',
    fletcher: 'bow_gale',
    gunsmith: 'pistol_twin_pulse',
    chemist: 'frostfire_tonic',
    toolsmith: 'torch_astral',
  };
  const tplId = tplPool[vendor];
  const tpl = ITEM_TEMPLATES[tplId];
  const nextListings = upsertMarketListing(world.marketListings, {
    templateId: tplId,
    crafterId: `commission_${vendor}`,
    crafterName: meta.keeper,
    vendor,
    currency: 'gold',
    price: Math.max(60, Math.round((tpl?.stats?.sellValue ?? 120) * 1.4)),
    quality: 'Masterwork',
  });

  return {
    success: true,
    currencies: { ...currencies, gold: currencies.gold - 75 },
    world: {
      ...world,
      marketListings: nextListings,
      chatterLog: pushChatter(world.chatterLog, {
        speakerName: meta.keeper,
        line: `Commission accepted! Crafted Masterwork ${tpl?.name ?? tplId} and placed it in stock.`,
        category: 'market',
      }),
    },
  };
}

export function exchangeCurrency(
  currencies: Currencies,
  from: keyof Currencies,
  to: keyof Currencies,
  spendAmount: number,
): { success: boolean; reason?: string; currencies: Currencies; received: number } {
  if (from === to || spendAmount <= 0) {
    return { success: false, reason: 'Invalid exchange.', currencies, received: 0 };
  }
  if (currencies[from] < spendAmount) {
    return { success: false, reason: `Insufficient ${from}.`, currencies, received: 0 };
  }
  // Base gold value per unit
  const goldRate: Record<keyof Currencies, number> = {
    gold: 1,
    aetherShards: 15,
    emeralds: 45,
    diamonds: 25,
    ancientCoins: 80,
  };
  const goldValue = spendAmount * goldRate[from];
  const received = Math.floor((goldValue * 0.92) / goldRate[to]);
  if (received <= 0) {
    return { success: false, reason: 'Amount too small for conversion.', currencies, received: 0 };
  }
  return {
    success: true,
    received,
    currencies: {
      ...currencies,
      [from]: currencies[from] - spendAmount,
      [to]: currencies[to] + received,
    },
  };
}
