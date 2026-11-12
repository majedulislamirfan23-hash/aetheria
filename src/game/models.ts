import * as THREE from 'three';
import type { ProceduralTextureSet } from './textures';
import type {
  BuildingPieceKind,
  CharacterCustomization,
  EnemyArchetype,
  FarmPlotState,
  MountVehicleType,
  NpcDefinition,
  PetType,
  WeaponType,
} from './types';

export interface HeroRig {
  root: THREE.Group;
  bodyScale: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  cape: THREE.Mesh | null;
  elytraGroup: THREE.Group;
  elytraLeft: THREE.Mesh;
  elytraRight: THREE.Mesh;
  weaponMount: THREE.Group;
  offHandMount: THREE.Group;
  auraRing: THREE.Mesh;
  shadowDisc: THREE.Mesh;
}

function makeContactShadow(shadowTex: THREE.Texture, radius = 0.85): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 20), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.025;
  return mesh;
}

export function buildWeaponMesh(
  weaponType: WeaponType,
  accentHex = '#38bdf8',
  textures?: ProceduralTextureSet,
): THREE.Group {
  const group = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    map: textures?.metalMap ?? null,
    bumpMap: textures?.metalBump ?? null,
    bumpScale: 0.03,
    metalness: 0.9,
    roughness: 0.18,
  });
  const hiltMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.35, roughness: 0.65 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 0.85,
    metalness: 0.4,
    roughness: 0.25,
  });

  if (weaponType === 'katana') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.075, 1.28, 0.036), steelMat);
    blade.position.y = 0.76;
    const edgeGlow = new THREE.Mesh(new THREE.BoxGeometry(0.025, 1.24, 0.04), glowMat);
    edgeGlow.position.set(0.03, 0.76, 0);
    const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.05, 12), glowMat);
    guard.position.y = 0.14;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 10), hiltMat);
    grip.position.y = 0.0;
    group.add(blade, edgeGlow, guard, grip);
  } else if (weaponType === 'greatsword') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.58, 0.065), steelMat);
    blade.position.y = 0.94;
    const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.24, 0.072), glowMat);
    fuller.position.y = 0.92;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.1, 0.11), hiltMat);
    guard.position.y = 0.16;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.38, 10), hiltMat);
    group.add(blade, fuller, guard, grip);
  } else if (weaponType === 'dual_blades' || weaponType === 'dagger') {
    const len = weaponType === 'dagger' ? 0.64 : 0.98;
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.065, len, 4), steelMat);
    blade.position.y = len * 0.5 + 0.1;
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.036, len * 0.68, 0.036), glowMat);
    core.position.y = len * 0.35 + 0.1;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 8), hiltMat);
    group.add(blade, core, grip);
  } else if (weaponType === 'spear') {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 2.05, 10), hiltMat);
    shaft.position.y = 0.7;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.105, 0.48, 6), steelMat);
    tip.position.y = 1.88;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.025, 8, 14), glowMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.6;
    group.add(shaft, tip, ring);
  } else if (weaponType === 'bow') {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.65, -0.15),
      new THREE.Vector3(0, -0.35, 0.18),
      new THREE.Vector3(0, 0, 0.28),
      new THREE.Vector3(0, 0.35, 0.18),
      new THREE.Vector3(0, 0.65, -0.15),
    ]);
    const limb = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.04, 8, false), glowMat);
    const stringMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.3, 6), steelMat);
    stringMesh.position.z = -0.15;
    group.add(limb, stringMesh);
  } else if (weaponType === 'staff') {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.044, 1.84, 10), hiltMat);
    shaft.position.y = 0.65;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 8, 18), glowMat);
    halo.position.y = 1.7;
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), glowMat);
    orb.position.y = 1.7;
    group.add(shaft, halo, orb);
  } else {
    // aether_rifle
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.18, 0.48), hiltMat);
    stock.position.set(0, 0.1, -0.1);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.052, 0.76, 10), steelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.14, 0.36);
    const coil = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.105, 0.36), glowMat);
    coil.position.set(0, 0.15, 0.24);
    group.add(stock, barrel, coil);
  }

  group.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
    }
  });
  return group;
}

export function buildHeroRig(
  char: CharacterCustomization,
  shadowTex: THREE.Texture,
  textures?: ProceduralTextureSet,
): HeroRig {
  const root = new THREE.Group();
  const bodyScale = new THREE.Group();
  root.add(bodyScale);

  const widthMult =
    char.bodyPreset === 'vanguard' ? 1.2 : char.bodyPreset === 'slender' ? 0.92 : 1.05;

  const skinMat = new THREE.MeshStandardMaterial({ color: char.skinTone, roughness: 0.6, metalness: 0.05 });
  const clothMat = new THREE.MeshStandardMaterial({
    color: char.outfitColor,
    map: textures?.fabricMap ?? null,
    bumpMap: textures?.fabricBump ?? null,
    bumpScale: 0.04,
    roughness: 0.68,
    metalness: 0.15,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: '#e8c468',
    map: textures?.metalMap ?? null,
    bumpMap: textures?.metalBump ?? null,
    bumpScale: 0.03,
    roughness: 0.24,
    metalness: 0.88,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: '#334155',
    map: textures?.metalMap ?? null,
    bumpMap: textures?.metalBump ?? null,
    bumpScale: 0.03,
    roughness: 0.32,
    metalness: 0.82,
  });
  const hairMat = new THREE.MeshStandardMaterial({ color: char.hairColor, roughness: 0.48, metalness: 0.18 });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: char.eyeColor,
    emissive: char.eyeColor,
    emissiveIntensity: 0.8,
    roughness: 0.2,
  });

  // Thicker sculpted Legs with knee greaves & armored boots (pivoted at hip y = 0.82)
  const makeLeg = (x: number) => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.82, 0);
    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.132 * widthMult, 0.108 * widthMult, 0.46, 12),
      clothMat,
    );
    thigh.position.y = -0.22;
    const kneePlate = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.14, 0.19), trimMat);
    kneePlate.position.set(0, -0.43, 0.03);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.4, 0.27), darkMetalMat);
    boot.position.set(0, -0.62, 0.035);
    const bootTrim = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.28), trimMat);
    bootTrim.position.set(0, -0.46, 0.035);
    leg.add(thigh, kneePlate, boot, bootTrim);
    return leg;
  };
  const leftLeg = makeLeg(-0.185 * widthMult);
  const rightLeg = makeLeg(0.185 * widthMult);
  bodyScale.add(leftLeg, rightLeg);

  // Thicker Torso with chestplate, gorget collar & waist sash (pivoted at waist y = 0.82)
  const torso = new THREE.Group();
  torso.position.y = 0.82;
  bodyScale.add(torso);

  const chestWidth = char.gender === 'female' ? 0.46 * widthMult : 0.54 * widthMult;
  const chest = new THREE.Mesh(new THREE.BoxGeometry(chestWidth, 0.64, 0.31), clothMat);
  chest.position.y = 0.35;
  const breastplate = new THREE.Mesh(new THREE.BoxGeometry(chestWidth * 0.94, 0.36, 0.34), darkMetalMat);
  breastplate.position.y = 0.43;
  const gorget = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 0.12, 12), trimMat);
  gorget.position.y = 0.69;
  const belt = new THREE.Mesh(new THREE.BoxGeometry(chestWidth + 0.06, 0.12, 0.34), trimMat);
  belt.position.y = 0.08;
  const buckle = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), eyeMat);
  buckle.position.set(0, 0.08, 0.18);

  // Layered armored Pauldrons (left & right)
  const makePauldron = (side: -1 | 1) => {
    const pg = new THREE.Group();
    pg.position.set(side * (chestWidth * 0.6), 0.58, 0);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.165, 12, 10), trimMat);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.28), darkMetalMat);
    guard.position.set(side * 0.04, -0.05, 0);
    guard.rotation.z = side * -0.28;
    pg.add(dome, guard);
    return pg;
  };
  torso.add(chest, breastplate, gorget, belt, buckle, makePauldron(-1), makePauldron(1));

  // Thicker Beveled Flowing Cape
  let cape: THREE.Mesh | null = null;
  if (char.capeEnabled) {
    const capeMat = new THREE.MeshStandardMaterial({
      color: char.capeColor,
      map: textures?.fabricMap ?? null,
      bumpMap: textures?.fabricBump ?? null,
      bumpScale: 0.04,
      roughness: 0.72,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });
    cape = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.94, 0.06), capeMat);
    cape.position.set(0, 0.2, -0.21);
    cape.rotation.x = 0.14;
    torso.add(cape);
  }

  // Sculpted Head + Neck
  const head = new THREE.Group();
  head.position.y = 0.74;
  torso.add(head);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.105, 0.14, 10), skinMat);
  neck.position.y = 0.05;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 14), skinMat);
  skull.position.y = 0.21;
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.036, 0.035), eyeMat);
  eyeL.position.set(-0.078, 0.215, 0.2);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.078;
  head.add(neck, skull, eyeL, eyeR);

  // Volumetric Hair Presets + Front Bangs
  const hairGroup = new THREE.Group();
  hairGroup.position.y = 0.24;
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.242, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.64), hairMat);
  const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.12), hairMat);
  bangs.position.set(0, 0.08, 0.18);
  hairGroup.add(crown, bangs);
  if (char.hairStyle === 'spiky') {
    for (let i = 0; i < 7; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.25, 6), hairMat);
      const a = (i / 7) * Math.PI * 2;
      spike.position.set(Math.cos(a) * 0.15, 0.16, Math.sin(a) * 0.15);
      spike.rotation.z = -Math.cos(a) * 0.55;
      spike.rotation.x = Math.sin(a) * 0.55;
      hairGroup.add(spike);
    }
  } else if (char.hairStyle === 'flowing') {
    const backMane = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.15), hairMat);
    backMane.position.set(0, -0.18, -0.18);
    hairGroup.add(backMane);
  } else if (char.hairStyle === 'ponytail') {
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.48, 8), hairMat);
    tail.position.set(0, -0.06, -0.26);
    tail.rotation.x = -0.45;
    hairGroup.add(tail);
  } else if (char.hairStyle === 'twin_tails') {
    const tailL = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.46, 8), hairMat);
    tailL.position.set(-0.24, -0.08, -0.1);
    tailL.rotation.z = 0.35;
    const tailR = tailL.clone();
    tailR.position.x = 0.24;
    tailR.rotation.z = -0.35;
    hairGroup.add(tailL, tailR);
  }
  head.add(hairGroup);

  // Thicker Arms with armored gauntlets
  const makeArm = (x: number) => {
    const arm = new THREE.Group();
    arm.position.set(x, 0.57, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.46, 12), clothMat);
    sleeve.position.y = -0.21;
    const bracer = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.092, 0.2, 10), trimMat);
    bracer.position.y = -0.34;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.082, 10, 10), skinMat);
    hand.position.y = -0.49;
    arm.add(sleeve, bracer, hand);
    return arm;
  };
  const leftArm = makeArm(-(chestWidth * 0.5 + 0.11));
  const rightArm = makeArm(chestWidth * 0.5 + 0.11);
  torso.add(leftArm, rightArm);

  // Weapon Mount in Right Hand
  const weaponMount = new THREE.Group();
  weaponMount.position.set(0, -0.49, 0.06);
  weaponMount.rotation.x = Math.PI * 0.38;
  weaponMount.add(buildWeaponMesh(char.weaponType, '#38bdf8', textures));
  rightArm.add(weaponMount);

  // Dual-Hand Off-Hand Mount in Left Hand
  const offHandMount = new THREE.Group();
  offHandMount.position.set(0, -0.49, 0.08);
  offHandMount.rotation.x = Math.PI * 0.38;
  leftArm.add(offHandMount);

  // Thicker Ribbed Elytra Wings on Back
  const elytraGroup = new THREE.Group();
  elytraGroup.position.set(0, 0.58, -0.22);
  elytraGroup.visible = false;
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.45,
    metalness: 0.55,
    roughness: 0.22,
    side: THREE.DoubleSide,
  });
  const wingGeo = new THREE.BoxGeometry(0.46, 1.02, 0.065);
  wingGeo.translate(0, -0.48, 0);
  const elytraLeft = new THREE.Mesh(wingGeo, wingMat);
  elytraLeft.position.set(-0.11, 0, 0);
  elytraLeft.rotation.z = -0.18;
  elytraLeft.rotation.x = 0.14;
  const spineL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.98, 0.085), trimMat);
  spineL.position.set(0.17, -0.46, 0);
  elytraLeft.add(spineL);

  const elytraRight = new THREE.Mesh(wingGeo, wingMat);
  elytraRight.position.set(0.11, 0, 0);
  elytraRight.rotation.z = 0.18;
  elytraRight.rotation.x = 0.14;
  const spineR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.98, 0.085), trimMat);
  spineR.position.set(-0.17, -0.46, 0);
  elytraRight.add(spineR);

  elytraGroup.add(elytraLeft, elytraRight);
  torso.add(elytraGroup);

  // Chakra Aura Ring at feet
  const auraMat = new THREE.MeshBasicMaterial({
    color: char.eyeColor,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const auraRing = new THREE.Mesh(new THREE.RingGeometry(0.58, 0.78, 32), auraMat);
  auraRing.rotation.x = -Math.PI / 2;
  auraRing.position.y = 0.04;
  root.add(auraRing);

  const shadowDisc = makeContactShadow(shadowTex, 0.85);
  root.add(shadowDisc);

  root.traverse((c) => {
    if ((c as THREE.Mesh).isMesh && c !== shadowDisc && c !== auraRing) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });

  return {
    root,
    bodyScale,
    torso,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    cape,
    elytraGroup,
    elytraLeft,
    elytraRight,
    weaponMount,
    offHandMount,
    auraRing,
    shadowDisc,
  };
}

export function buildNpcRig(
  npc: NpcDefinition,
  shadowTex: THREE.Texture,
  textures?: ProceduralTextureSet,
): THREE.Group {
  const g = new THREE.Group();
  const robeMat = new THREE.MeshStandardMaterial({
    color: npc.robeColor,
    map: textures?.fabricMap ?? null,
    bumpMap: textures?.fabricBump ?? null,
    bumpScale: 0.04,
    roughness: 0.72,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: npc.accentColor,
    emissive: npc.accentColor,
    emissiveIntensity: 0.35,
    map: textures?.metalMap ?? null,
    roughness: 0.32,
    metalness: 0.55,
  });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#ecc5a8', roughness: 0.62 });

  // Thicker Lower robe skirt + mantle
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.42, 0.86, 14), robeMat);
  skirt.position.y = 0.43;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.58, 14), robeMat);
  torso.position.y = 1.13;
  const shoulderMantle = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.14, 12), accentMat);
  shoulderMantle.position.y = 1.35;
  const sash = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.68, 0.38), accentMat);
  sash.position.set(0.08, 1.06, 0.02);

  // Arms
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.075, 0.48, 10), robeMat);
  armL.position.set(-0.31, 1.08, 0.04);
  armL.rotation.z = 0.16;
  const armR = armL.clone();
  armR.position.x = 0.31;
  armR.rotation.z = -0.16;

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.215, 14, 12), skinMat);
  head.position.y = 1.6;

  // Role props & headwear
  if (npc.role === 'Scholar' || npc.role === 'QuestGiver') {
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.3, 10), robeMat);
    hat.position.y = 1.84;
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), accentMat);
    orb.position.set(0.4, 1.48, 0.22);
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.55, 8), accentMat);
    staff.position.set(0.4, 0.78, 0.22);
    g.add(hat, orb, staff);
  } else if (npc.role === 'Guard' || npc.role === 'Armorer') {
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.26, 12), accentMat);
    helm.position.y = 1.68;
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.52), accentMat);
    shield.position.set(-0.38, 1.06, 0.16);
    g.add(helm, shield);
  } else if (npc.role === 'Blacksmith' || npc.role === 'Mason') {
    const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.18), accentMat);
    hammer.position.set(0.38, 1.05, 0.24);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8), robeMat);
    handle.position.set(0.38, 0.85, 0.24);
    g.add(hammer, handle);
  } else if (npc.role === 'Farmer') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.46, 0.06, 16), accentMat);
    brim.position.y = 1.77;
    const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.24, 0.18, 12), accentMat);
    hatTop.position.y = 1.86;
    const hoe = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.45, 8), accentMat);
    hoe.position.set(0.38, 0.75, 0.16);
    g.add(brim, hatTop, hoe);
  } else {
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 16), accentMat);
    crown.rotation.x = Math.PI / 2;
    crown.position.y = 1.75;
    g.add(crown);
  }

  // Quest/Interact Halo Floating Diamond
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), accentMat);
  marker.position.y = 2.42;
  marker.name = 'npc_marker';

  g.add(skirt, torso, shoulderMantle, sash, armL, armR, head, marker, makeContactShadow(shadowTex, 0.75));
  g.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh && m.geometry.type !== 'CircleGeometry') {
      m.castShadow = true;
    }
  });
  return g;
}

export function buildFarmPlotMesh(
  plot: FarmPlotState,
  soilTex?: THREE.Texture,
  woodTex?: THREE.Texture,
): THREE.Group {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x855e42,
    map: woodTex ?? null,
    roughness: 0.85,
  });
  const soilMat = new THREE.MeshStandardMaterial({
    color: plot.water > 45 ? 0x5c3a21 : 0x8b6f56,
    map: soilTex ?? null,
    roughness: 0.92,
  });

  // Raised wooden planter box + tilled soil
  const border = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.24, 3.1), frameMat);
  border.position.y = 0.12;
  const soil = new THREE.Mesh(new THREE.BoxGeometry(3.75, 0.28, 2.75), soilMat);
  soil.position.y = 0.13;
  g.add(border, soil);

  if (plot.crop) {
    const cropColor =
      plot.crop === 'golden_wheat'
        ? 0xeab308
        : plot.crop === 'sunberry'
        ? 0xf97316
        : plot.crop === 'aether_herb'
        ? 0x34d399
        : 0xfde047;
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.75 });
    const fruitMat = new THREE.MeshStandardMaterial({
      color: cropColor,
      emissive: plot.stage === 3 ? cropColor : 0x000000,
      emissiveIntensity: plot.stage === 3 ? 0.55 : 0,
      roughness: 0.45,
    });
    const height = plot.stage === 0 ? 0.18 : plot.stage === 1 ? 0.36 : plot.stage === 2 ? 0.62 : 0.92;
    for (let r = -1; r <= 1; r++) {
      for (let c = -1; c <= 1; c++) {
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, height, 6), stemMat);
        stalk.position.set(c * 1.05, 0.25 + height * 0.5, r * 0.8);
        g.add(stalk);
        if (plot.stage >= 2) {
          const head = new THREE.Mesh(new THREE.OctahedronGeometry(plot.stage === 3 ? 0.2 : 0.12, 0), fruitMat);
          head.position.set(c * 1.05, 0.28 + height, r * 0.8);
          g.add(head);
        }
      }
    }
  }

  g.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  return g;
}

export function buildEnemyRig(archetype: EnemyArchetype, shadowTex: THREE.Texture): {
  root: THREE.Group;
  body: THREE.Group;
  telegraphRing: THREE.Mesh;
  weakPoint: THREE.Mesh;
  isBoss: boolean;
} {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const isBoss = archetype.startsWith('boss_');
  const scale = isBoss ? 2.45 : archetype === 'abyssal_sentinel' ? 1.35 : 1.0;

  let mainColor = '#4c1d95';
  let glowColor = '#c084fc';
  if (archetype === 'ember_acolyte' || archetype === 'boss_abyssal_dragon') {
    mainColor = '#7c2d12';
    glowColor = '#fb923c';
  } else if (archetype === 'frost_charger') {
    mainColor = '#0c4a6e';
    glowColor = '#38bdf8';
  } else if (archetype === 'boss_forest_guardian') {
    mainColor = '#14532d';
    glowColor = '#4ade80';
  } else if (archetype === 'boss_celestial_devourer') {
    mainColor = '#1e1b4b';
    glowColor = '#fde047';
  }

  const hullMat = new THREE.MeshStandardMaterial({ color: mainColor, roughness: 0.55, metalness: 0.45 });
  const armorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.8 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: glowColor,
    emissive: glowColor,
    emissiveIntensity: 1.1,
    roughness: 0.2,
  });

  // Primary silhouette
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42 * scale, 0.3 * scale, 1.05 * scale, 8),
    hullMat,
  );
  torso.position.y = 0.85 * scale;
  body.add(torso);

  // Secondary shoulder/wing/plate silhouettes
  const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(0.32 * scale, 0.42 * scale, 0.36 * scale), armorMat);
  shoulderL.position.set(-0.52 * scale, 1.25 * scale, 0);
  shoulderL.rotation.z = 0.25;
  const shoulderR = shoulderL.clone();
  shoulderR.position.x = 0.52 * scale;
  shoulderR.rotation.z = -0.25;
  body.add(shoulderL, shoulderR);

  // Head / Helm
  const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.28 * scale, 0), armorMat);
  head.position.y = 1.62 * scale;
  const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.08 * scale, 0.42 * scale, 6), glowMat);
  hornL.position.set(-0.22 * scale, 1.85 * scale, 0);
  hornL.rotation.z = 0.35;
  const hornR = hornL.clone();
  hornR.position.x = 0.22 * scale;
  hornR.rotation.z = -0.35;
  body.add(head, hornL, hornR);

  // Glowing Weak Point Core
  const weakPoint = new THREE.Mesh(new THREE.OctahedronGeometry(0.18 * scale, 1), glowMat);
  weakPoint.position.set(0, 1.0 * scale, 0.38 * scale);
  body.add(weakPoint);

  // Archetype specific weaponry/silhouette
  if (isBoss || archetype === 'abyssal_sentinel') {
    const greatsword = buildWeaponMesh('greatsword', glowColor);
    greatsword.scale.setScalar(scale * 0.9);
    greatsword.position.set(0.65 * scale, 0.8 * scale, 0.35 * scale);
    greatsword.rotation.x = Math.PI * 0.42;
    body.add(greatsword);
  } else if (archetype === 'ember_acolyte') {
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 20), glowMat);
    halo.position.set(0, 1.5, -0.25);
    body.add(halo);
  }

  // Telegraph ring on ground (hidden until charging/boss AoE windup)
  const teleMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const telegraphRing = new THREE.Mesh(
    new THREE.RingGeometry(1.1 * scale, 1.45 * scale, 32),
    teleMat,
  );
  telegraphRing.rotation.x = -Math.PI / 2;
  telegraphRing.position.y = 0.04;
  root.add(telegraphRing);

  const shadow = makeContactShadow(shadowTex, 0.85 * scale);
  root.add(shadow);

  body.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) c.castShadow = true;
  });

  return { root, body, telegraphRing, weakPoint, isBoss };
}

export function buildMountVehicleRig(type: MountVehicleType, shadowTex: THREE.Texture): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
  });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xe8c468, metalness: 0.9, roughness: 0.2 });
  const glowCyan = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.2,
  });

  if (type === 'omega_m4_coupe') {
    // Original BMW M4-inspired Celestial Sports Coupe (zero unlicensed logos)
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.52, 4.1), bodyMat);
    chassis.position.y = 0.56;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.48, 0.44, 1.85),
      new THREE.MeshPhysicalMaterial({ color: 0x090d16, metalness: 0.2, roughness: 0.08, clearcoat: 1.0 }),
    );
    cabin.position.set(0, 1.0, -0.2);
    // Twin front celestial grilles + headlights
    const grilleL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.08), glowCyan);
    grilleL.position.set(-0.24, 0.56, 2.06);
    const grilleR = grilleL.clone();
    grilleR.position.x = 0.24;
    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.08), goldMat);
    headL.position.set(-0.68, 0.62, 2.05);
    const headR = headL.clone();
    headR.position.x = 0.68;
    // Rear GT wing spoiler
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.06, 0.34), goldMat);
    wing.position.set(0, 1.05, -1.92);
    g.add(chassis, cabin, grilleL, grilleR, headL, headR, wing);
    // 4 Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.24, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    const positions = [
      [-0.95, 0.36, 1.28],
      [0.95, 0.36, 1.28],
      [-0.95, 0.36, -1.28],
      [0.95, 0.36, -1.28],
    ];
    positions.forEach(([x, y, z]) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(x, y, z);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.26, 10).rotateZ(Math.PI / 2), goldMat);
      rim.position.set(x, y, z);
      g.add(w, rim);
    });
  } else if (type === 'flying_sword') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 3.2), glowCyan);
    blade.position.y = 0.55;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.14, 0.22), goldMat);
    guard.position.set(0, 0.56, -1.1);
    const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), goldMat);
    pommel.position.set(0, 0.56, -1.65);
    g.add(blade, guard, pommel);
  } else if (type === 'horse' || type === 'dragon') {
    const isDragon = type === 'dragon';
    const coat = new THREE.MeshStandardMaterial({ color: isDragon ? 0x1e3a8a : 0x78350f, roughness: 0.65 });
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.72, 1.9), coat);
    barrel.position.y = 1.05;
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.85, 0.42), coat);
    neck.position.set(0, 1.55, 0.85);
    neck.rotation.x = 0.35;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.65), isDragon ? goldMat : coat);
    head.position.set(0, 1.9, 1.18);
    g.add(barrel, neck, head);
    for (const [lx, lz] of [
      [-0.25, 0.65],
      [0.25, 0.65],
      [-0.25, -0.65],
      [0.25, -0.65],
    ]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.85, 8), coat);
      leg.position.set(lx, 0.42, lz);
      g.add(leg);
    }
    if (isDragon) {
      const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 0.95), glowCyan);
      wingL.position.set(-1.25, 1.45, 0.1);
      wingL.rotation.z = 0.22;
      const wingR = wingL.clone();
      wingR.position.x = 1.25;
      wingR.rotation.z = -0.22;
      g.add(wingL, wingR);
    }
  } else {
    // astral_skiff or sky_galleon
    const hull = new THREE.Mesh(new THREE.ConeGeometry(1.15, 4.0, 6).rotateX(Math.PI / 2), bodyMat);
    hull.scale.set(1, 0.45, 1);
    hull.position.y = 0.48;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 2.5), goldMat);
    deck.position.set(0, 0.75, -0.2);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 8), goldMat);
    mast.position.set(0, 1.8, 0.1);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.4), glowCyan);
    sail.material.side = THREE.DoubleSide;
    sail.position.set(0, 1.95, 0.14);
    g.add(hull, deck, mast, sail);
  }

  g.add(makeContactShadow(shadowTex, 1.45));
  return g;
}

export function buildPetMesh(pet: PetType): THREE.Group {
  const g = new THREE.Group();
  const color = pet === 'ember_drake' ? '#f97316' : pet === 'celestial_owl' ? '#e8c468' : '#38bdf8';
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.25 });
  const glowMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: color, emissiveIntensity: 0.9 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), bodyMat);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), bodyMat);
  head.position.set(0, 0.22, 0.18);
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 5), glowMat);
  earL.position.set(-0.1, 0.38, 0.18);
  const earR = earL.clone();
  earR.position.x = 0.1;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 7), glowMat);
  tail.position.set(0, 0.08, -0.28);
  tail.rotation.x = -0.8;
  g.add(body, head, earL, earR, tail);
  return g;
}

export function buildOffHandItemMesh(kind: 'shield' | 'blade' | 'lantern' | 'pistol' | 'tool'): THREE.Group {
  const g = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.22 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xe8c468, metalness: 0.85, roughness: 0.25 });
  const cyanMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.0,
    roughness: 0.2,
  });

  if (kind === 'shield') {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.72, 0.52), steelMat);
    const boss = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), cyanMat);
    boss.position.set(-0.07, 0, 0);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.76, 0.08), goldMat);
    g.add(plate, boss, rim);
  } else if (kind === 'lantern') {
    const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.28, 6), goldMat);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), cyanMat);
    g.add(frame, core);
  } else if (kind === 'pistol') {
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.45), steelMat);
    barrel.position.set(0, 0.08, 0.2);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.22), cyanMat);
    glow.position.set(0, 0.1, 0.22);
    g.add(barrel, glow);
  } else if (kind === 'tool') {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8), goldMat);
    handle.position.y = 0.35;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.08), steelMat);
    head.position.y = 0.72;
    g.add(handle, head);
  } else {
    return buildWeaponMesh('dagger', '#f472b6');
  }
  return g;
}

export function buildBuildingPiece(
  kind: BuildingPieceKind,
  woodTex: THREE.Texture,
  stoneTex: THREE.Texture,
  tier: 1 | 2 | 3 = 1,
): THREE.Group {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    color: tier === 2 ? 0xdbeafe : tier === 3 ? 0xfef3c7 : 0xffffff,
    roughness: tier === 3 ? 0.45 : 0.78,
    metalness: tier === 3 ? 0.35 : 0.05,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    color: tier === 2 ? 0x94a3b8 : tier === 3 ? 0xe2e8f0 : 0xffffff,
    roughness: tier === 3 ? 0.4 : 0.85,
    metalness: tier >= 2 ? 0.3 : 0.05,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: tier === 3 ? 0xfde047 : 0xe8c468,
    emissive: tier === 3 ? 0xd97706 : 0x000000,
    emissiveIntensity: tier === 3 ? 0.4 : 0,
    metalness: 0.82,
    roughness: 0.22,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.55,
    roughness: 0.1,
    metalness: 0.1,
  });

  if (kind === 'wood_wall' || kind === 'stone_wall') {
    const mat = kind === 'stone_wall' || tier >= 2 ? stoneMat : woodMat;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.8, 0.36), mat);
    panel.position.y = 1.4;
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 3.0, 0.48), tier === 3 ? goldMat : stoneMat);
    postL.position.set(-1.55, 1.5, 0);
    const postR = postL.clone();
    postR.position.x = 1.55;
    g.add(panel, postL, postR);
  } else if (kind === 'glass_wall') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.8, 0.36), tier >= 2 ? stoneMat : woodMat);
    base.position.y = 0.4;
    const pane = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.7, 0.12), glassMat);
    pane.position.y = 1.65;
    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.35, 0.38), tier === 3 ? goldMat : woodMat);
    topBeam.position.y = 2.68;
    g.add(base, pane, topBeam);
  } else if (kind === 'doorway') {
    const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.8, 0.4), tier >= 2 ? stoneMat : woodMat);
    leftPillar.position.set(-1.18, 1.4, 0);
    const rightPillar = leftPillar.clone();
    rightPillar.position.x = 1.18;
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.65, 0.42), tier === 3 ? goldMat : stoneMat);
    lintel.position.y = 2.55;
    g.add(leftPillar, rightPillar, lintel);
  } else if (kind === 'wood_floor') {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.24, 3.4), tier >= 2 ? stoneMat : woodMat);
    deck.position.y = 0.12;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.1, 3.5), tier === 3 ? goldMat : stoneMat);
    trim.position.y = 0.05;
    g.add(deck, trim);
  } else if (kind === 'slate_roof') {
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.45, 4), stoneMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 0.75;
    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), goldMat);
    cap.position.y = 1.55;
    g.add(roof, cap);
  } else if (kind === 'watchtower') {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, 3.6, 8), tier >= 2 ? stoneMat : woodMat);
    col.position.y = 1.8;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 1.1), tier === 3 ? goldMat : stoneMat);
    cap.position.y = 3.6;
    g.add(col, cap);
  } else if (kind === 'stone_stairs') {
    for (let s = 0; s < 4; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.35, 0.8), tier === 3 ? goldMat : stoneMat);
      step.position.set(0, 0.18 + s * 0.35, -1.0 + s * 0.68);
      g.add(step);
    }
  } else if (kind === 'campfire') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), stoneMat);
      stone.position.set(Math.cos(a) * 0.65, 0.14, Math.sin(a) * 0.65);
      g.add(stone);
    }
    const log1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 1.0, 8), woodMat);
    log1.rotation.z = Math.PI / 2;
    log1.position.y = 0.16;
    const log2 = log1.clone();
    log2.rotation.y = Math.PI / 2;
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 0.78, 7),
      new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xf97316, emissiveIntensity: 1.5 }),
    );
    flame.position.y = 0.48;
    g.add(log1, log2, flame);
  } else if (kind === 'aether_beacon') {
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.2, 6), stoneMat);
    ped.position.y = 0.6;
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45, 0),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 1.6 }),
    );
    gem.position.y = 1.9;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.06, 8, 20), goldMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.9;
    g.add(ped, gem, ring);
  } else {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.85, 0.85), tier >= 2 ? stoneMat : woodMat);
    box.position.y = 0.425;
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.16, 0.9), goldMat);
    band.position.y = 0.55;
    g.add(box, band);
  }

  if (tier >= 2) {
    const badge = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), goldMat);
    badge.position.set(0, 2.95, 0);
    g.add(badge);
  }

  g.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  return g;
}
