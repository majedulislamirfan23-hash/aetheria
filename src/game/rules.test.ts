import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultSave } from './catalog';
import {
  commissionNpcCraft,
  exchangeCurrency,
  interactWithFarmPlot,
  purchaseNpcListing,
  tickLivingWorldSimulation,
} from './npcSimulation';
import {
  addItemToInventory,
  attemptCultivationBreakthrough,
  calculateAerodynamicLift,
  calculateCombatDamage,
  calculateKineticMomentumBonus,
  claimMailReward,
  computeTotalDefense,
  craftRecipe,
  equipItemToSlot,
  evaluateElementalReaction,
  evaluateLandLogicRules,
  getBiomeBiologyProfile,
  getCooldownMultiplier,
  getLifestealGain,
  getTerrainTraction,
  purchaseShopOffer,
  sellInventoryItem,
  setActiveSkillBar,
  sortInventorySlots,
  swapInventorySlots,
  swapMainAndOffHand,
  tickSurvivalVitals,
  upgradeAscensionPower,
  upgradeBuildingPiece,
  upgradeSkillStat,
  validateAndRecoverSave,
} from './rules';
import { getBiomeAt, getSupportHeightAt, groundHeightAt, sampleTerrainCalculus } from './worldMath';

test('terrain heightfield keeps verdant plaza flat and classifies all 5 biomes', () => {
  const hCenter = groundHeightAt(0, 0);
  const hNear = groundHeightAt(4, -5);
  assert.ok(Math.abs(hCenter - 1.2) < 0.05);
  assert.ok(Math.abs(hNear - 1.2) < 0.05);

  assert.equal(getBiomeAt(0, 0), 'verdant');
  assert.equal(getBiomeAt(-78, -58), 'frostfall');
  assert.equal(getBiomeAt(78, -55), 'ember');
  assert.equal(getBiomeAt(0, -85), 'celestial');
  assert.equal(getBiomeAt(0, 90), 'abyssal');

  const skyHeight = getSupportHeightAt(0, 15, -78);
  assert.equal(skyHeight, 14.5);
});

test('combat damage scales with cultivation, heavy attacks, boss sovereign power, and elemental synergy', () => {
  const light = calculateCombatDamage({
    weaponType: 'katana',
    cultivationRealm: 0,
    level: 1,
    isHeavy: false,
    isAerial: false,
    comboStep: 0,
    awakeningActive: false,
    primaryElement: 'chakra',
    secondaryElement: 'lightning',
    randomRoll: 0.99,
  });
  const heavyCrit = calculateCombatDamage({
    weaponType: 'katana',
    cultivationRealm: 2,
    level: 5,
    sovereignRank: 5,
    isBossTarget: true,
    isHeavy: true,
    isAerial: true,
    comboStep: 2,
    awakeningActive: true,
    primaryElement: 'chakra',
    secondaryElement: 'lightning',
    randomRoll: 0.01,
  });
  assert.equal(light.isCrit, false);
  assert.equal(heavyCrit.isCrit, true);
  assert.ok(heavyCrit.damage > light.damage * 3);
});

test('cultivation breakthrough upgrades realm and consumes astral cores & qi', () => {
  const save = createDefaultSave();
  save.vitals.qi = 50;
  const failRes = attemptCultivationBreakthrough(save.vitals);
  assert.equal(failRes.success, false);

  save.vitals.qi = 120;
  save.vitals.astralCores = 1;
  const passRes = attemptCultivationBreakthrough(save.vitals);
  assert.equal(passRes.success, true);
  assert.equal(passRes.vitals.cultivationRealm, 1);
  assert.equal(passRes.vitals.astralCores, 0);
  assert.ok(passRes.vitals.maxHp > save.vitals.maxHp);
  assert.equal(passRes.vitals.skillPoints, save.vitals.skillPoints + 3);
});

test('30-slot inventory stacking, swapping, sorting, crafting, and shop work reliably', () => {
  const save = createDefaultSave();
  const initialWood = save.inventory.find((s) => s?.templateId === 'wood')?.quantity ?? 0;
  const added = addItemToInventory(save.inventory, 'wood', 10);
  assert.equal(added.added, 10);
  const woodSlot = added.slots.find((s) => s?.templateId === 'wood');
  assert.equal(woodSlot?.quantity, initialWood + 10);

  const swapped = swapInventorySlots(added.slots, 0, 29);
  assert.equal(swapped[0], null);
  assert.equal(swapped[29]?.templateId, 'health_elixir');

  const sorted = sortInventorySlots(swapped);
  assert.ok(sorted[0] !== null);

  const crafted = craftRecipe(added.slots, 'rec_elixir');
  assert.equal(crafted.success, true);

  const bought = purchaseShopOffer(crafted.slots, save.currencies, 'shop_feast');
  assert.equal(bought.success, true);
  assert.equal(bought.currencies.gold, save.currencies.gold - 25);

  const sold = sellInventoryItem(bought.slots, bought.currencies, 9);
  assert.equal(sold.success, true);
  assert.ok(sold.currencies.gold > bought.currencies.gold);
});

test('minecraft dual-hand equipment, elytra, skill upgrades, building tier, and mailbox work', () => {
  const save = createDefaultSave();
  // Equip dagger (slot 13) into Off-Hand
  const eqRes = equipItemToSlot(save.inventory, save.equipped, 13, 'offHand');
  assert.equal(eqRes.success, true);
  assert.equal(eqRes.equipped.offHand?.templateId, 'dagger_shadowfang');

  // Swap Main Hand and Off-Hand
  const swappedHands = swapMainAndOffHand(eqRes.equipped);
  assert.equal(swappedHands.weapon?.templateId, 'dagger_shadowfang');
  assert.equal(swappedHands.offHand?.templateId, 'blade_starfall');

  // Defense calculation includes armor + shield + elytra
  const baseDef = computeTotalDefense(save.equipped, 0);
  assert.ok(baseDef >= 50);

  // Skill point upgrade increases maxHp
  const upg = upgradeSkillStat(save.vitals, 'vitality');
  assert.equal(upg.success, true);
  assert.equal(upg.vitals.skillPoints, save.vitals.skillPoints - 1);
  assert.equal(upg.vitals.maxHp, save.vitals.maxHp + 45);

  // Building upgrade Tier 1 -> Tier 2
  const bld = { id: 'b1', kind: 'wood_wall' as const, x: 0, y: 1.2, z: 0, rotationY: 0, tier: 1 as const };
  const bUp = upgradeBuildingPiece(bld, save.currencies, save.inventory);
  assert.equal(bUp.success, true);
  assert.equal(bUp.building.tier, 2);

  // Mailbox claim grants rewards and marks claimed
  const mailId = save.mailbox[0].id;
  const claimed = claimMailReward(save, mailId);
  assert.equal(claimed.success, true);
  assert.equal(claimed.save.mailbox[0].claimed, true);
  assert.ok(claimed.save.currencies.gold > save.currencies.gold);
});

test('ascension powers, 3-slot skill bar, chronos haste, and lifesteal work reliably', () => {
  const save = createDefaultSave();
  const pwUp = upgradeAscensionPower(save.vitals, 'meteor_nova');
  assert.equal(pwUp.success, true);
  assert.equal(pwUp.vitals.powerRanks.meteor_nova, 2);
  assert.equal(pwUp.vitals.skillPoints, save.vitals.skillPoints - 1);

  const barRes = setActiveSkillBar(pwUp.vitals, 2, 'lightning');
  assert.equal(barRes.success, true);
  assert.equal(barRes.vitals.activeSkillBar[2], 'lightning');

  assert.ok(getCooldownMultiplier(5) < 0.85);
  assert.deepEqual(getLifestealGain(4), { hpGain: 12, manaGain: 8 });
});

test('autonomous NPC living world simulation, farming, crafting commissions, and multi-currency exchange', () => {
  const save = createDefaultSave();
  let world = save.livingWorld;
  const initChatter = world.chatterLog.length;

  // Simulate multiple autonomous steps
  for (let i = 0; i < 6; i++) {
    world = tickLivingWorldSimulation(world, 6.0, i + 1);
  }
  assert.ok(world.chatterLog.length > initChatter);
  assert.ok(world.npcBuildings.length >= save.livingWorld.npcBuildings.length);
  assert.ok(world.marketListings.length >= 1);

  // Interact with ripe farm plot #2 (farm_2 starts at stage 3)
  const farmRes = interactWithFarmPlot(world, save.inventory, 'farm_2', 3);
  assert.ok(farmRes.harvestedFood);

  // Purchase an NPC-crafted market listing
  const listingId = world.marketListings[0].id;
  const buyRes = purchaseNpcListing(world, farmRes.inventory, save.currencies, listingId);
  assert.equal(buyRes.success, true);
  assert.ok(buyRes.currencies.gold < save.currencies.gold);

  // Commission Masterwork forge craft
  const commRes = commissionNpcCraft(buyRes.world, save.currencies, 'blacksmith');
  assert.equal(commRes.success, true);
  assert.equal(commRes.currencies.gold, save.currencies.gold - 75);

  // Multi-currency exchange Gold -> Diamonds
  const exRes = exchangeCurrency(save.currencies, 'gold', 'diamonds', 100);
  assert.equal(exRes.success, true);
  assert.ok(exRes.received >= 3);
  assert.equal(exRes.currencies.gold, save.currencies.gold - 100);
});

test('survival vitals react to cold/heat and save recovery repairs corrupted payloads', () => {
  const save = createDefaultSave();
  const coldTick = tickSurvivalVitals(save.vitals, 'frostfall', 5, {
    isSprinting: false,
    isMeditating: false,
    nearCampfire: false,
  });
  assert.ok(coldTick.temperature < save.vitals.temperature);

  const recovered = validateAndRecoverSave({ broken: true });
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.data.inventory.length, 30);
  assert.ok(recovered.data.mailbox.length > 0);
  assert.ok(recovered.data.livingWorld.farms.length >= 6);
});

test('physics, biology, chemistry, terrain calculus, and boolean land logic evaluate deterministically', () => {
  // Physics: kinetic strike scales up with speed & ice traction drops in Frostfall mirror lake
  assert.equal(calculateKineticMomentumBonus(0), 1);
  assert.ok(calculateKineticMomentumBonus(24) > 1.15);
  const ice = getTerrainTraction('frostfall', -74, -52);
  const loam = getTerrainTraction('verdant', 0, 0);
  assert.ok(ice.traction < loam.traction);
  const emberLift = calculateAerodynamicLift('ember', 18, true);
  assert.ok(emberLift.thermalUpdraft > 1);
  assert.ok(emberLift.airDensity < 1);

  // Biology: homeostasis boosts stamina regen when well-fed & hydrated
  const save = createDefaultSave();
  save.vitals.stamina = 40;
  save.vitals.hunger = 90;
  save.vitals.thirst = 90;
  const wellFed = tickSurvivalVitals(save.vitals, 'verdant', 1, {
    isSprinting: false,
    isMeditating: false,
    nearCampfire: false,
  });
  assert.ok(wellFed.stamina > 53);
  const bio = getBiomeBiologyProfile('verdant', 90, 90);
  assert.equal(bio.metabolicEfficiency, 1.2);

  // Chemistry: elemental synergy & reaction equations
  const rx = evaluateElementalReaction('fire', 'water', 'ember');
  assert.equal(rx.reactionName, 'Thermal Vaporization');
  assert.ok(rx.multiplier > 1.2);

  // Mathematics: terrain partial derivatives & golden spiral harmonic
  const flatCalc = sampleTerrainCalculus(0, 0);
  const hillCalc = sampleTerrainCalculus(78, -55);
  assert.ok(flatCalc.slopeDegrees < 2);
  assert.ok(hillCalc.radialDistance > 90);
  assert.ok(hillCalc.goldenHarmonic >= 0 && hillCalc.goldenHarmonic <= 1);

  // Logic: boolean propositions trigger critical battle & frostfall cooling flags
  const rules = evaluateLandLogicRules({
    biome: 'frostfall',
    hpRatio: 0.25,
    temperature: 8,
    nearCampfire: false,
    isFlying: false,
    bossPhase2: false,
  });
  assert.equal(rules[0].result, true);
  assert.equal(rules[1].result, true);
  assert.equal(rules[2].result, false);
});

