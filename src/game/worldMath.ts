import { BIOMES } from './catalog';
import type { BiomeId } from './types';

export const WORLD_RADIUS = 138;
export const WATER_LEVEL = -1.35;

export interface FloatingIslandDef {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  thickness: number;
  hasTemple?: boolean;
}

export const FLOATING_ISLANDS: FloatingIslandDef[] = [
  { id: 'island_sanctum', x: 0, y: 14.5, z: -78, radius: 13, thickness: 9, hasTemple: true },
  { id: 'island_west', x: -24, y: 18.0, z: -92, radius: 8.5, thickness: 6.5 },
  { id: 'island_east', x: 25, y: 16.5, z: -90, radius: 9.0, thickness: 7.0 },
  { id: 'island_zenith', x: 0, y: 24.0, z: -108, radius: 11.5, thickness: 8.5, hasTemple: true },
];

/**
 * Smooth deterministic 2D noise helper using layered trigonometric harmonics.
 */
function fbm(x: number, z: number): number {
  const n1 = Math.sin(x * 0.042) * Math.cos(z * 0.042);
  const n2 = Math.sin(x * 0.11 + 1.3) * Math.sin(z * 0.095 - 0.7) * 0.45;
  const n3 = Math.cos((x + z) * 0.21) * 0.18;
  return n1 + n2 + n3;
}

export function getBiomeAt(x: number, z: number): BiomeId {
  // Celestial zone in the north sky / northern terrace
  if (z < -68 && Math.abs(x) < 42) {
    return 'celestial';
  }
  // Abyssal frontier in the south
  if (z > 52) {
    return 'abyssal';
  }
  // Frostfall northwest
  if (x < -34 && z < 24) {
    return 'frostfall';
  }
  // Ember northeast
  if (x > 34 && z < 24) {
    return 'ember';
  }
  return 'verdant';
}

/**
 * Returns deterministic terrain elevation at world (x, z).
 * Ensures the central Verdant Village plaza (radius 22 around origin) is gently flat
 * and elevated above water so NPCs, buildings, and spawn sit cleanly on level ground.
 */
export function groundHeightAt(x: number, z: number): number {
  const distOrigin = Math.hypot(x, z);

  // Base rolling terrain
  let h = fbm(x, z) * 2.2;

  // River channel curving between Verdant Kingdom and outer wilds
  const riverCenterZ = 28 + Math.sin(x * 0.06) * 8;
  const distRiver = Math.abs(z - riverCenterZ);
  // Keep a natural stone bridge / shallow ford along x in [-8, 8]
  const bridgeBlend = Math.max(0, 1 - Math.abs(x) / 9.5);
  if (distRiver < 9) {
    const t = 1 - distRiver / 9;
    const riverCarve = -3.4 * (t * t) * (1 - bridgeBlend * 0.85);
    h += riverCarve;
  }

  // Flatten Verdant Village Sanctum clearing around (0, 0)
  if (distOrigin < 26) {
    const flatBlend = Math.max(0, Math.min(1, (26 - distOrigin) / 10));
    const targetVillageY = 1.2;
    h = h * (1 - flatBlend) + targetVillageY * flatBlend;
  }

  // Frostfall mountain rise in NW
  const dFrost = Math.hypot(x - BIOMES.frostfall.center.x, z - BIOMES.frostfall.center.z);
  if (dFrost < 56) {
    const f = Math.max(0, 1 - dFrost / 56);
    h += f * f * 8.5 + Math.abs(Math.sin(x * 0.14) * Math.cos(z * 0.14)) * f * 3.0;
    // Frozen lake basin near (-72, -52)
    const dLake = Math.hypot(x + 74, z + 52);
    if (dLake < 14) {
      const lf = 1 - dLake / 14;
      h -= lf * 6.0;
    }
  }

  // Ember Wastes volcanic rim & caldera in NE
  const dEmber = Math.hypot(x - BIOMES.ember.center.x, z - BIOMES.ember.center.z);
  if (dEmber < 54) {
    const e = Math.max(0, 1 - dEmber / 54);
    const ring = Math.exp(-Math.pow((dEmber - 20) / 8, 2));
    h += e * 3.2 + ring * 7.5;
    if (dEmber < 12) {
      h -= (1 - dEmber / 12) * 3.5;
    }
  }

  // Abyssal Frontier crater & colossus arena in South
  const dAbyss = Math.hypot(x - BIOMES.abyssal.center.x, z - BIOMES.abyssal.center.z);
  if (dAbyss < 48) {
    const a = Math.max(0, 1 - dAbyss / 48);
    if (dAbyss < 20) {
      // Flat boss arena floor
      const arenaBlend = Math.min(1, (20 - dAbyss) / 6);
      h = h * (1 - arenaBlend) + 0.6 * arenaBlend;
    } else {
      const ridge = Math.exp(-Math.pow((dAbyss - 30) / 7, 2));
      h += ridge * 6.5 - a * 1.4;
    }
  }

  // Natural perimeter mountain ridge at WORLD_RADIUS so outdoor world never ends in an abrupt drop
  if (distOrigin > WORLD_RADIUS - 18) {
    const rim = (distOrigin - (WORLD_RADIUS - 18)) / 18;
    h += rim * rim * 16.0;
  }

  return h;
}

/**
 * Checks whether the player or an entity is standing above a floating Celestial Island
 * and returns the island surface height if within horizontal bounds and near/above it.
 */
export function getSupportHeightAt(x: number, y: number, z: number): number {
  let best = groundHeightAt(x, z);
  for (const isl of FLOATING_ISLANDS) {
    const d = Math.hypot(x - isl.x, z - isl.z);
    if (d <= isl.radius && y >= isl.y - 2.2) {
      if (isl.y > best) best = isl.y;
    }
  }
  return best;
}

export interface LandmarkPoint {
  id: string;
  name: string;
  biome: BiomeId;
  x: number;
  z: number;
}

export const LANDMARKS: LandmarkPoint[] = [
  { id: 'lm_sanctum', name: 'Verdant Sanctum Plaza', biome: 'verdant', x: 0, z: 0 },
  { id: 'lm_frost_spire', name: 'Frostfall Mirror Shrine', biome: 'frostfall', x: -74, z: -52 },
  { id: 'lm_ember_caldera', name: 'Ember Caldera Forge', biome: 'ember', x: 78, z: -55 },
  { id: 'lm_celestial_gate', name: 'Celestial Ascent Arch', biome: 'celestial', x: 0, z: -78 },
  { id: 'lm_abyss_arena', name: 'Tombguard Colossus Arena', biome: 'abyssal', x: 0, z: 90 },
];

export interface TerrainCalculusSample {
  elevation: number;
  slopeX: number;
  slopeZ: number;
  gradientMagnitude: number;
  slopeDegrees: number;
  radialDistance: number;
  goldenHarmonic: number;
}

/**
 * Computes numerical terrain partial derivatives (dh/dx, dh/dz), slope angle,
 * and golden-angle spiral harmonic for any (x, z) point in Aetheria.
 */
export function sampleTerrainCalculus(x: number, z: number): TerrainCalculusSample {
  const eps = 0.5;
  const elevation = groundHeightAt(x, z);
  const hx1 = groundHeightAt(x + eps, z);
  const hx0 = groundHeightAt(x - eps, z);
  const hz1 = groundHeightAt(x, z + eps);
  const hz0 = groundHeightAt(x, z - eps);
  const slopeX = (hx1 - hx0) / (2 * eps);
  const slopeZ = (hz1 - hz0) / (2 * eps);
  const gradientMagnitude = Math.hypot(slopeX, slopeZ);
  const slopeDegrees = (Math.atan(gradientMagnitude) * 180) / Math.PI;
  const radialDistance = Math.hypot(x, z);
  const goldenAngleRad = (137.507764 * Math.PI) / 180;
  const theta = Math.atan2(z, x);
  const goldenHarmonic = Number((0.5 + 0.5 * Math.cos(theta - goldenAngleRad * Math.round(radialDistance / 12))).toFixed(3));
  return {
    elevation: Number(elevation.toFixed(2)),
    slopeX: Number(slopeX.toFixed(3)),
    slopeZ: Number(slopeZ.toFixed(3)),
    gradientMagnitude: Number(gradientMagnitude.toFixed(3)),
    slopeDegrees: Number(slopeDegrees.toFixed(1)),
    radialDistance: Number(radialDistance.toFixed(1)),
    goldenHarmonic,
  };
}

