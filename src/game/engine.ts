import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  ASCENSION_POWERS_META,
  BIOMES,
  ELEMENTS,
  MOUNTS_CATALOG,
  NPCS,
  WEAPONS,
} from './catalog';
import { gameAudio, type CombatAudioMode } from './audio';
import {
  buildBuildingPiece,
  buildEnemyRig,
  buildFarmPlotMesh,
  buildHeroRig,
  buildMountVehicleRig,
  buildNpcRig,
  buildOffHandItemMesh,
  buildPetMesh,
  buildWeaponMesh,
  HeroRig,
} from './models';
import {
  calculateAerodynamicLift,
  calculateCombatDamage,
  calculateElementalSkillDamage,
  calculateKineticMomentumBonus,
  evaluateElementalReaction,
  getCooldownMultiplier,
  getLifestealGain,
  getTerrainTraction,
} from './rules';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import type {
  AscensionPowerId,
  BiomeId,
  BuildingPieceKind,
  CharacterCustomization,
  ElementId,
  EnemyArchetype,
  GameSettings,
  GameState,
  LivingWorldState,
  MountVehicleType,
  PetType,
  PlacedBuilding,
  PlayerVitals,
  SaveDataV1,
  WeatherType,
} from './types';
import {
  FLOATING_ISLANDS,
  getBiomeAt,
  getSupportHeightAt,
  groundHeightAt,
  WATER_LEVEL,
  WORLD_RADIUS,
} from './worldMath';

// Pre-allocated scratch math objects (zero GC in render loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();

export interface DamagePopup {
  id: number;
  x: number;
  y: number;
  amount: number;
  isCrit: boolean;
  label?: string;
}

export interface NpcBubbleHud {
  id: string;
  name: string;
  text: string;
  x: number;
  y: number;
}

export interface HudSnapshot {
  biome: BiomeId;
  weather: WeatherType;
  timeOfDay: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  mana: number;
  maxMana: number;
  hunger: number;
  thirst: number;
  temperature: number;
  qi: number;
  qiRequired: number;
  speed: number;
  isMeditating: boolean;
  isGliding: boolean;
  hasElytra: boolean;
  isMounted: MountVehicleType;
  nearbyPrompt: { kind: 'npc' | 'node' | 'boss' | 'farm'; id: string; label: string } | null;
  nearbyBuilding: { id: string; kind: BuildingPieceKind; tier: number } | null;
  lockedBoss: { name: string; hp: number; maxHp: number; phase: number } | null;
  cooldowns: [number, number, number, number];
  powerCooldowns: Record<AscensionPowerId, number>;
  awakeningActive: boolean;
  aegisActive: boolean;
  criticalPulse: number;
  combatAudioMode: CombatAudioMode;
  popups: DamagePopup[];
  npcBubbles: NpcBubbleHud[];
  playerX: number;
  playerY: number;
  playerZ: number;
  playerYaw: number;
}

export interface EngineCallbacks {
  onHudUpdate: (snap: HudSnapshot) => void;
  onGatherResource: (templateId: string, qty: number) => void;
  onEnemyKilled: (archetype: EnemyArchetype, isBoss: boolean, bossId?: string) => void;
  onPlayerDamaged: (amount: number) => void;
  onPlayerDied: () => void;
  onNpcInteract: (npcId: string) => void;
  onInteractFarm?: (plotId: string) => void;
  onLifestealGain?: (hpGain: number, manaGain: number) => void;
  onPowerStateChanged?: (patch: {
    awakeningActive?: boolean;
    awakeningTimer?: number;
    aegisShieldTimer?: number;
    healHp?: number;
  }) => void;
  onConsumeMana: (cost: number) => boolean;
  onConsumeStamina: (cost: number) => boolean;
  onBiomeDiscovered: (biome: BiomeId) => void;
  onPlaceBuilding: (piece: PlacedBuilding) => void;
  onUseOffHandConsumable?: () => void;
}

interface ResourceNode {
  id: string;
  kind: 'tree' | 'rock' | 'crystal' | 'ancient';
  templateId: string;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  respawnTimer: number;
  mesh: THREE.Group;
}

interface EnemyActor {
  id: string;
  name: string;
  archetype: EnemyArchetype;
  isBoss: boolean;
  homeX: number;
  homeZ: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  hp: number;
  maxHp: number;
  atk: number;
  speed: number;
  state: 'patrol' | 'chase' | 'windup' | 'attack' | 'recover' | 'ko';
  stateTimer: number;
  hitFlash: number;
  phase: number;
  rig: ReturnType<typeof buildEnemyRig>;
}

interface Projectile {
  active: boolean;
  fromPlayer: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  damage: number;
  color: string;
  mesh: THREE.Mesh;
}

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}

export class AetheriaEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private textures!: ProceduralTextureSet;
  private isSoftwareGl = false;

  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private waterMesh!: THREE.Mesh;
  private terrainMesh!: THREE.Mesh;

  private heroRig!: HeroRig;
  private mountGroup: THREE.Group | null = null;
  private petMesh: THREE.Group | null = null;
  private npcMeshes = new Map<string, { mesh: THREE.Group; baseX: number; baseZ: number; phase: number }>();
  private buildingMeshes = new Map<string, THREE.Group>();
  private buildingTiers = new Map<string, number>();
  private buildingsData: PlacedBuilding[] = [];
  private livingWorld: LivingWorldState | null = null;
  private farmMeshes = new Map<string, { mesh: THREE.Group; sig: string }>();
  private npcBuildingMeshes = new Map<string, { mesh: THREE.Group; tier: number }>();
  private resourceNodes: ResourceNode[] = [];
  private enemies: EnemyActor[] = [];
  private projectiles: Projectile[] = [];

  private particleMesh!: THREE.InstancedMesh;
  private particles: ParticleSlot[] = [];
  private particleCursor = 0;
  private impactRings: {
    active: boolean;
    x: number;
    y: number;
    z: number;
    life: number;
    maxLife: number;
    maxRadius: number;
    mesh: THREE.Mesh;
  }[] = [];
  private impactRingCursor = 0;

  private weatherMesh!: THREE.InstancedMesh;
  private weatherDrops: { x: number; y: number; z: number; vy: number }[] = [];

  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();

  // Simulation state
  private gameState: GameState = 'title';
  private studioMode = false;
  private studioYaw = 0;
  private studioYawVel = 0;
  private studioPitch = 0.14;
  private studioPitchVel = 0;
  private studioDist = 4.35;
  private studioAutoRotate = true;
  private character!: CharacterCustomization;
  private settings!: GameSettings;
  private vitals!: PlayerVitals;
  private equipped: SaveDataV1['equipped'] = {
    weapon: null,
    offHand: null,
    helmet: null,
    armor: null,
    leggings: null,
    boots: null,
    elytra: null,
    accessory: null,
  };
  private activeMount: MountVehicleType = 'none';
  private activePet: PetType = 'none';
  private selectedBuildKind: BuildingPieceKind | null = null;
  private buildRotation = 0;
  private buildGhost: THREE.Group | null = null;

  private px = 0;
  private py = 1.2;
  private pz = 4;
  private vx = 0;
  private vy = 0;
  private vz = 0;
  private playerYaw = Math.PI;
  private grounded = true;
  private isGliding = false;
  private coyoteTimer = 0;
  private jumpBuffer = 0;
  private attackBuffer = 0;
  private comboStep = 0;
  private attackTimer = 0;
  private attackCooldown = 0;
  private offHandTimer = 0;
  private offHandCooldown = 0;
  private dodgeTimer = 0;
  private dodgeCooldown = 0;
  private isBlocking = false;
  private isMeditating = false;
  private walkDistance = 0;
  private lastStrideHalfStep = 0;
  private squashY = 1;
  private hitstop = 0;
  private trauma = 0;
  private criticalBeatPulse = 0;
  private currentCombatMode: CombatAudioMode = 'calm';

  private camYaw = 0;
  private camPitch = 0.34;
  private camYawVel = 0;
  private camPitchVel = 0;
  private camPos = new THREE.Vector3(0, 7, 15);
  private camTarget = new THREE.Vector3(0, 2, 4);
  private timeOfDay = 10.5;
  private weather: WeatherType = 'clear';
  private weatherTimer = 0;
  private skillCooldowns: [number, number, number, number] = [0, 0, 0, 0];
  private powerCooldowns: Record<AscensionPowerId, number> = {
    blink_step: 0,
    meteor_nova: 0,
    aegis_dome: 0,
    omega_overdrive: 0,
  };
  private popupSeq = 1;
  private popups: (DamagePopup & { wx: number; wy: number; wz: number; ttl: number })[] = [];
  private hudEmitTimer = 0;
  private lockedEnemyId: string | null = null;

  // Input hub
  private heldKeys = new Set<string>();
  private justPressed = new Set<string>();
  private mobileMove = { x: 0, y: 0 };
  private isDraggingCamera = false;
  private dragButton = -1;
  private lastPointer = { x: 0, y: 0 };
  private pointerDownPos = { x: 0, y: 0 };
  private pointerMovedDist = 0;
  private resizeObserver: ResizeObserver | null = null;
  private raycaster = new THREE.Raycaster();
  private interactables: THREE.Object3D[] = [];

  constructor(
    container: HTMLElement,
    initialCharacter: CharacterCustomization,
    initialVitals: PlayerVitals,
    initialSettings: GameSettings,
    initialPosition: { x: number; y: number; z: number; yaw: number },
    initialBuildings: PlacedBuilding[],
    callbacks: EngineCallbacks,
    initialEquipped?: SaveDataV1['equipped'],
  ) {
    this.container = container;
    this.character = { ...initialCharacter };
    this.vitals = { ...initialVitals };
    this.settings = { ...initialSettings };
    if (initialEquipped) this.equipped = { ...initialEquipped };
    this.px = initialPosition.x;
    this.py = Math.max(groundHeightAt(initialPosition.x, initialPosition.z), initialPosition.y);
    this.pz = initialPosition.z;
    this.playerYaw = initialPosition.yaw;
    this.callbacks = callbacks;

    this.initRendererAndScene();
    this.buildWorldTerrainAndLandmarks();
    this.buildHero();
    this.buildNpcs();
    this.buildEnemies();
    this.syncBuildings(initialBuildings);
    this.initPools();
    this.bindEvents();
    this.applySettings(this.settings);
    this.startLoop();
  }

  private initRendererAndScene() {
    this.isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas');
        const gl = probe.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const width = Math.max(320, this.container.clientWidth || window.innerWidth);
    const height = Math.max(240, this.container.clientHeight || window.innerHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && this.settings.shadowsEnabled;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#132238');
    this.scene.fog = new THREE.FogExp2('#132238', 0.0068);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(58, width / height, 0.15, 360);

    // Warm/cool 3-point atmospheric lighting
    this.hemiLight = new THREE.HemisphereLight(0x8ecae6, 0x1e293b, 0.72);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 1.85);
    this.sunLight.position.set(45, 70, 35);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 160;
    const d = 42;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso);
  }

  private buildWorldTerrainAndLandmarks() {
    // 1. Procedural 5-Biome Terrain
    const size = WORLD_RADIUS * 2 + 24;
    const segs = 120;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cVerdant = new THREE.Color('#2f6e49');
    const cPath = new THREE.Color('#7c6e58');
    const cFrost = new THREE.Color('#dbeafe');
    const cEmber = new THREE.Color('#3f231c');
    const cCelestial = new THREE.Color('#475569');
    const cAbyss = new THREE.Color('#221836');

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = groundHeightAt(x, z);
      pos.setY(i, y);

      const biome = getBiomeAt(x, z);
      _color.copy(
        biome === 'frostfall'
          ? cFrost
          : biome === 'ember'
          ? cEmber
          : biome === 'celestial'
          ? cCelestial
          : biome === 'abyssal'
          ? cAbyss
          : cVerdant,
      );

      // Village plaza stone path ring & roads
      const distCenter = Math.hypot(x, z);
      if (distCenter < 16 || (Math.abs(x) < 3.6 && Math.abs(z) < 70) || (Math.abs(z) < 3.6 && Math.abs(x) < 50)) {
        _color.lerp(cPath, 0.72);
      }
      if (y < WATER_LEVEL + 0.35) {
        _color.lerp(cPath, 0.65);
      }
      // Subtle height shading
      const shade = THREE.MathUtils.clamp(0.88 + y * 0.025, 0.7, 1.22);
      _color.multiplyScalar(shade);

      colors[i * 3] = _color.r;
      colors[i * 3 + 1] = _color.g;
      colors[i * 3 + 2] = _color.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.04,
      bumpMap: this.textures.terrainBump,
      bumpScale: 0.22,
    });
    this.terrainMesh = new THREE.Mesh(geo, terrainMat);
    this.terrainMesh.receiveShadow = true;
    this.scene.add(this.terrainMesh);
    this.interactables.push(this.terrainMesh);

    // 2. Water Plane (Rivers & Frozen/Volcanic Channels) with ripple bump map
    const waterGeo = new THREE.PlaneGeometry(size, size, 32, 32);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x0e7490,
      bumpMap: this.textures.waterBump,
      bumpScale: 0.14,
      roughness: 0.12,
      metalness: 0.22,
      transparent: true,
      opacity: 0.8,
      clearcoat: 1.0,
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.position.y = WATER_LEVEL;
    this.scene.add(this.waterMesh);

    // 3. Tall Spawn Vista Landmark: Verdant Sanctum Obelisk & Village Pavilions
    const stoneMat = new THREE.MeshStandardMaterial({
      map: this.textures.stoneMap,
      bumpMap: this.textures.stoneBump,
      bumpScale: 0.15,
      color: 0xffffff,
      roughness: 0.8,
    });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xe8c468, metalness: 0.88, roughness: 0.22 });
    const cyanGlow = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.35,
    });

    // Central Omega Sanctum Obelisk (placed at z = -22 so player spawns at z=4 facing north -Z with majestic vista!)
    const obeliskGroup = new THREE.Group();
    const baseY = groundHeightAt(0, -22);
    obeliskGroup.position.set(0, baseY, -22);
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6.2, 0.7, 8), stoneMat);
    dais.position.y = 0.35;
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.55, 9.2, 6), stoneMat);
    spire.position.y = 4.95;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.14, 10, 32), goldMat);
    halo.position.y = 8.4;
    const coreCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.95, 0), cyanGlow);
    coreCrystal.position.y = 8.4;
    coreCrystal.name = 'sanctum_crystal';
    obeliskGroup.add(dais, spire, halo, coreCrystal);
    obeliskGroup.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    this.scene.add(obeliskGroup);
    this.interactables.push(obeliskGroup);

    // Ornate Sanctum Plaza stone & astral rune inlay rings (offset +0.03m with polygonOffset)
    const plazaRingMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.78,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const plazaOuter = new THREE.Mesh(new THREE.RingGeometry(10.5, 12.2, 32), plazaRingMat);
    plazaOuter.rotation.x = -Math.PI / 2;
    plazaOuter.position.set(0, groundHeightAt(0, 0) + 0.03, 0);
    const plazaRune = new THREE.Mesh(
      new THREE.RingGeometry(5.2, 5.55, 32),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45, depthWrite: false }),
    );
    plazaRune.rotation.x = -Math.PI / 2;
    plazaRune.position.set(0, groundHeightAt(0, 0) + 0.04, 0);
    this.scene.add(plazaOuter, plazaRune);

    // Village Cottages / Weaver Loom & Blacksmith Pavilion
    const buildPavilion = (x: number, z: number, accent: number) => {
      const g = new THREE.Group();
      const y = groundHeightAt(x, z);
      g.position.set(x, y, z);
      const floor = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.35, 5.6), stoneMat);
      floor.position.y = 0.17;
      g.add(floor);
      for (const [px, pz] of [
        [-2.3, -2.3],
        [2.3, -2.3],
        [-2.3, 2.3],
        [2.3, 2.3],
      ]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 3.6, 8), stoneMat);
        post.position.set(px, 1.9, pz);
        g.add(post);
      }
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(4.4, 2.1, 4),
        new THREE.MeshStandardMaterial({ color: accent, roughness: 0.72 }),
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 4.6;
      g.add(roof);
      g.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });
      this.scene.add(g);
      this.interactables.push(g);
    };
    buildPavilion(-13, -11, 0x1e3a8a); // Scholar Orin's Study
    buildPavilion(13, -11, 0x5b21b6);  // Weaver Clara's Pavilion
    buildPavilion(15, 7, 0x7c2d12);    // Blacksmith Forge
    buildPavilion(-15, 7, 0x065f46);   // Merchant Stall

    // 4. Floating Celestial Islands with tapered rocky undersides + Ascension Stair/Bridge Pillars
    FLOATING_ISLANDS.forEach((isl) => {
      const g = new THREE.Group();
      g.position.set(isl.x, isl.y, isl.z);
      const topDisc = new THREE.Mesh(
        new THREE.CylinderGeometry(isl.radius, isl.radius * 0.92, 1.2, 16),
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75 }),
      );
      topDisc.position.y = -0.6;
      const underside = new THREE.Mesh(
        new THREE.ConeGeometry(isl.radius * 0.9, isl.thickness, 12),
        stoneMat,
      );
      underside.rotation.x = Math.PI;
      underside.position.y = -1.2 - isl.thickness * 0.5;
      g.add(topDisc, underside);

      if (isl.hasTemple) {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 5.2, 8), stoneMat);
          col.position.set(Math.cos(a) * (isl.radius * 0.65), 2.6, Math.sin(a) * (isl.radius * 0.65));
          g.add(col);
        }
        const shrineOrb = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), goldMat);
        shrineOrb.position.y = 3.2;
        g.add(shrineOrb);
      }
      this.scene.add(g);
      this.interactables.push(g);
    });

    // Ascension Ramp / Spirit Staircase from Verdant North (0, -48) up toward Celestial Island (0, -78)
    const steps = 14;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const sz = THREE.MathUtils.lerp(-44, -67, t);
      const sy = THREE.MathUtils.lerp(groundHeightAt(0, -44) + 0.5, 13.8, t);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.45, 2.1), cyanGlow);
      pad.position.set(0, sy, sz);
      this.scene.add(pad);
    }

    // 5. Instanced Trees & Rocks (high density, single draw call per part)
    const treePositions: { x: number; y: number; z: number; s: number; biome: BiomeId }[] = [];
    for (let i = 0; i < 160; i++) {
      const angle = i * 2.39996;
      const r = 24 + ((i * 19.7) % (WORLD_RADIUS - 32));
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = groundHeightAt(x, z);
      if (y < WATER_LEVEL + 0.4) continue;
      if (Math.abs(x) < 5 && Math.abs(z) < 75) continue; // Keep north/south road clear
      if (Math.hypot(x, z - 90) < 22) continue; // Keep Abyssal Boss Arena clear
      const biome = getBiomeAt(x, z);
      if (biome === 'ember' && i % 3 !== 0) continue;
      treePositions.push({ x, y, z, s: 0.85 + (i % 7) * 0.05, biome });
    }

    if (treePositions.length > 0) {
      const trunkGeo = new THREE.CylinderGeometry(0.24, 0.38, 2.8, 7);
      trunkGeo.translate(0, 1.4, 0);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
      const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treePositions.length);

      const canopyGeo = new THREE.ConeGeometry(1.85, 3.4, 7);
      canopyGeo.translate(0, 3.6, 0);
      const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
      const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, treePositions.length);

      const canopyTopGeo = new THREE.ConeGeometry(1.25, 2.7, 7);
      canopyTopGeo.translate(0, 5.2, 0);
      const canopyTopInst = new THREE.InstancedMesh(canopyTopGeo, canopyMat, treePositions.length);

      treePositions.forEach((tp, idx) => {
        _scale.set(tp.s, tp.s, tp.s);
        _quat.setFromAxisAngle(_v1.set(0, 1, 0), idx * 0.7);
        _mat4.compose(_v2.set(tp.x, tp.y, tp.z), _quat, _scale);
        trunkInst.setMatrixAt(idx, _mat4);
        canopyInst.setMatrixAt(idx, _mat4);
        canopyTopInst.setMatrixAt(idx, _mat4);

        const tint =
          tp.biome === 'frostfall'
            ? '#bae6fd'
            : tp.biome === 'ember'
            ? '#7c2d12'
            : tp.biome === 'abyssal'
            ? '#4c1d95'
            : idx % 2 === 0
            ? '#166534'
            : '#228b22';
        _color.set(tint);
        canopyInst.setColorAt(idx, _color);
        _color.offsetHSL(0, 0, 0.06);
        canopyTopInst.setColorAt(idx, _color);
      });
      trunkInst.instanceMatrix.needsUpdate = true;
      canopyInst.instanceMatrix.needsUpdate = true;
      canopyTopInst.instanceMatrix.needsUpdate = true;
      if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
      if (canopyTopInst.instanceColor) canopyTopInst.instanceColor.needsUpdate = true;
      trunkInst.computeBoundingSphere();
      canopyInst.computeBoundingSphere();
      canopyTopInst.computeBoundingSphere();
      trunkInst.castShadow = true;
      canopyInst.castShadow = true;
      canopyTopInst.castShadow = true;
      this.scene.add(trunkInst, canopyInst, canopyTopInst);
    }

    // 6. Harvestable Resource Nodes (Wood, Stone/Iron, Aether Crystals, Astral Fragments)
    const nodeSpecs: { kind: ResourceNode['kind']; templateId: string; x: number; z: number }[] = [
      { kind: 'tree', templateId: 'wood', x: -16, z: -20 },
      { kind: 'tree', templateId: 'wood', x: 18, z: -18 },
      { kind: 'rock', templateId: 'stone', x: -21, z: 12 },
      { kind: 'rock', templateId: 'iron', x: 22, z: 16 },
      { kind: 'crystal', templateId: 'crystal', x: -10, z: -30 },
      { kind: 'crystal', templateId: 'crystal', x: 12, z: -32 },
      { kind: 'crystal', templateId: 'crystal', x: -65, z: -48 },
      { kind: 'rock', templateId: 'rare_mineral', x: 68, z: -48 },
      { kind: 'ancient', templateId: 'astral_fragment', x: 0, z: -76 },
      { kind: 'ancient', templateId: 'ancient_material', x: -14, z: 72 },
      { kind: 'crystal', templateId: 'gold_ore', x: 58, z: -42 },
      { kind: 'rock', templateId: 'iron', x: -55, z: -38 },
    ];

    nodeSpecs.forEach((ns, idx) => {
      const y = ns.z < -70 && Math.abs(ns.x) < 12 ? 14.5 : groundHeightAt(ns.x, ns.z);
      const g = new THREE.Group();
      g.position.set(ns.x, y, ns.z);

      if (ns.kind === 'crystal' || ns.kind === 'ancient') {
        const col = ns.kind === 'ancient' ? 0xfbbf24 : 0x38bdf8;
        const mat = new THREE.MeshStandardMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: 0.75,
          roughness: 0.15,
          metalness: 0.35,
        });
        for (let k = 0; k < 3; k++) {
          const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.42 - k * 0.08, 0), mat);
          shard.position.set((k - 1) * 0.28, 0.55 + (k === 1 ? 0.25 : 0), 0);
          shard.scale.set(0.7, 1.8, 0.7);
          shard.rotation.z = (k - 1) * 0.25;
          g.add(shard);
        }
      } else if (ns.kind === 'rock') {
        const oreMat = new THREE.MeshStandardMaterial({
          color: ns.templateId === 'gold_ore' ? 0xeab308 : 0x64748b,
          roughness: 0.68,
          metalness: 0.45,
        });
        const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), oreMat);
        boulder.position.y = 0.65;
        const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), oreMat);
        cap.position.set(0.55, 0.42, 0.3);
        g.add(boulder, cap);
      } else {
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.26, 0.35, 2.2, 7),
          new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 }),
        );
        trunk.position.y = 1.1;
        const crown = new THREE.Mesh(
          new THREE.DodecahedronGeometry(1.15, 0),
          new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.75 }),
        );
        crown.position.y = 2.6;
        g.add(trunk, crown);
      }
      this.scene.add(g);
      this.resourceNodes.push({
        id: `node_${idx}`,
        kind: ns.kind,
        templateId: ns.templateId,
        x: ns.x,
        y,
        z: ns.z,
        hp: 45,
        maxHp: 45,
        respawnTimer: 0,
        mesh: g,
      });
    });
  }

  private buildHero() {
    if (this.heroRig) {
      this.scene.remove(this.heroRig.root);
    }
    this.heroRig = buildHeroRig(this.character, this.textures.contactShadow, this.textures);
    this.heroRig.root.position.set(this.px, this.py, this.pz);
    this.heroRig.root.rotation.y = this.playerYaw;
    this.scene.add(this.heroRig.root);
    this.applyEquipmentVisuals();
  }

  private applyEquipmentVisuals() {
    if (!this.heroRig) return;

    // Elytra wings visibility & tint
    const elytraItem = this.equipped?.elytra;
    this.heroRig.elytraGroup.visible = Boolean(elytraItem);
    if (elytraItem) {
      const isCelestial = elytraItem.templateId === 'elytra_celestial' || elytraItem.rarity === 'celestial';
      const wingMat = this.heroRig.elytraLeft.material as THREE.MeshStandardMaterial;
      wingMat.color.set(isCelestial ? '#fde047' : '#38bdf8');
      wingMat.emissive.set(isCelestial ? '#d97706' : '#0284c7');
    }

    // Main-hand weapon mesh
    while (this.heroRig.weaponMount.children.length > 0) {
      this.heroRig.weaponMount.remove(this.heroRig.weaponMount.children[0]);
    }
    const mainWType = this.equipped?.weapon?.stats?.weaponType ?? this.character.weaponType;
    this.heroRig.weaponMount.add(buildWeaponMesh(mainWType, '#38bdf8', this.textures));

    // Off-hand mesh (shield, blade, lantern, pistol, tool)
    while (this.heroRig.offHandMount.children.length > 0) {
      this.heroRig.offHandMount.remove(this.heroRig.offHandMount.children[0]);
    }
    const offItem = this.equipped?.offHand;
    if (offItem) {
      let kind: 'shield' | 'blade' | 'lantern' | 'pistol' | 'tool' = 'blade';
      if (offItem.category === 'shield') kind = 'shield';
      else if (offItem.templateId.includes('torch')) kind = 'lantern';
      else if (offItem.stats?.weaponType === 'aether_rifle') kind = 'pistol';
      else if (offItem.category === 'tool') kind = 'tool';
      this.heroRig.offHandMount.add(buildOffHandItemMesh(kind));
    }
  }

  private buildNpcs() {
    NPCS.forEach((npc, idx) => {
      const rig = buildNpcRig(npc, this.textures.contactShadow, this.textures);
      const y = groundHeightAt(npc.x, npc.z);
      rig.position.set(npc.x, y, npc.z);
      this.scene.add(rig);
      this.npcMeshes.set(npc.id, { mesh: rig, baseX: npc.x, baseZ: npc.z, phase: idx * 1.4 });
    });
  }

  private buildEnemies() {
    const spawns: {
      id: string;
      name: string;
      archetype: EnemyArchetype;
      x: number;
      z: number;
      hp: number;
      atk: number;
      speed: number;
    }[] = [
      // Verdant border patrols
      { id: 'e_v1', name: 'Void Stalker', archetype: 'void_stalker', x: -16, z: 22, hp: 90, atk: 14, speed: 5.2 },
      { id: 'e_v2', name: 'Void Stalker', archetype: 'void_stalker', x: 18, z: 24, hp: 90, atk: 14, speed: 5.2 },
      { id: 'e_v3', name: 'Abyssal Sentinel', archetype: 'abyssal_sentinel', x: 0, z: 42, hp: 165, atk: 20, speed: 3.4 },
      { id: 'e_v4', name: 'Void Stalker', archetype: 'void_stalker', x: -26, z: -26, hp: 95, atk: 15, speed: 5.2 },
      // Frostfall
      { id: 'e_f1', name: 'Frost Charger', archetype: 'frost_charger', x: -58, z: -42, hp: 150, atk: 24, speed: 6.2 },
      { id: 'e_f2', name: 'Frost Charger', archetype: 'frost_charger', x: -82, z: -60, hp: 160, atk: 24, speed: 6.2 },
      // Ember Wastes
      { id: 'e_e1', name: 'Ember Acolyte', archetype: 'ember_acolyte', x: 60, z: -42, hp: 135, atk: 22, speed: 4.1 },
      { id: 'e_e2', name: 'Ember Acolyte', archetype: 'ember_acolyte', x: 78, z: -62, hp: 145, atk: 24, speed: 4.1 },
      // 5 World Bosses
      { id: 'boss_wezaemon', name: 'Wezaemon: Tombguard Colossus', archetype: 'boss_wezaemon', x: 0, z: 90, hp: 950, atk: 34, speed: 3.9 },
      { id: 'boss_forest_guardian', name: 'Ancient Forest Guardian', archetype: 'boss_forest_guardian', x: -45, z: 32, hp: 620, atk: 26, speed: 3.5 },
      { id: 'boss_abyssal_dragon', name: 'Abyssal Dragon Ignis', archetype: 'boss_abyssal_dragon', x: 82, z: -55, hp: 820, atk: 32, speed: 4.4 },
      { id: 'boss_celestial_devourer', name: 'Celestial Devourer', archetype: 'boss_celestial_devourer', x: 0, z: -108, hp: 900, atk: 35, speed: 4.2 },
      { id: 'boss_void_emperor', name: 'Void Emperor Vaelor', archetype: 'boss_void_emperor', x: 0, z: 116, hp: 1200, atk: 42, speed: 4.1 },
    ];

    spawns.forEach((sp) => {
      const rig = buildEnemyRig(sp.archetype, this.textures.contactShadow);
      const y = sp.archetype === 'boss_celestial_devourer' ? 24.0 : groundHeightAt(sp.x, sp.z);
      rig.root.position.set(sp.x, y, sp.z);
      this.scene.add(rig.root);
      this.enemies.push({
        id: sp.id,
        name: sp.name,
        archetype: sp.archetype,
        isBoss: rig.isBoss,
        homeX: sp.x,
        homeZ: sp.z,
        x: sp.x,
        y,
        z: sp.z,
        vx: 0,
        vz: 0,
        yaw: 0,
        hp: sp.hp,
        maxHp: sp.hp,
        atk: sp.atk,
        speed: sp.speed,
        state: 'patrol',
        stateTimer: 0,
        hitFlash: 0,
        phase: 1,
        rig,
      });
    });
  }

  private initPools() {
    // 1. Pooled Particle InstancedMesh (180 slots)
    const pGeo = new THREE.OctahedronGeometry(0.22, 0);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, 180);
    this.particleMesh.frustumCulled = false;
    for (let i = 0; i < 180; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        color: new THREE.Color('#38bdf8'),
      });
      _mat4.makeTranslation(0, -100, 0);
      this.particleMesh.setMatrixAt(i, _mat4);
      this.particleMesh.setColorAt(i, _color.set('#38bdf8'));
    }
    this.scene.add(this.particleMesh);

    // 2. Pooled Weather Drops InstancedMesh (140 drops)
    const wGeo = new THREE.BoxGeometry(0.05, 0.55, 0.05);
    const wMat = new THREE.MeshBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.55 });
    this.weatherMesh = new THREE.InstancedMesh(wGeo, wMat, 140);
    this.weatherMesh.frustumCulled = false;
    for (let i = 0; i < 140; i++) {
      this.weatherDrops.push({
        x: (Math.random() - 0.5) * 44,
        y: Math.random() * 24,
        z: (Math.random() - 0.5) * 44,
        vy: 14 + Math.random() * 6,
      });
    }
    this.weatherMesh.visible = false;
    this.scene.add(this.weatherMesh);

    // 3. Projectile Pool (20 bolts)
    const projGeo = new THREE.SphereGeometry(0.22, 8, 8);
    for (let i = 0; i < 20; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const mesh = new THREE.Mesh(projGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.projectiles.push({
        active: false,
        fromPlayer: true,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        damage: 15,
        color: '#38bdf8',
        mesh,
      });
    }

    // 4. Pooled 3D Expanding Shockwave Rings (12 rings for critical combat/music beats & shields)
    const ringGeo = new THREE.RingGeometry(0.65, 1.0, 28);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 12; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.impactRings.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        life: 0,
        maxLife: 0.45,
        maxRadius: 3.5,
        mesh,
      });
    }
  }

  private bindEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('wheel', this.onWheel, { passive: true });
    dom.addEventListener('contextmenu', this.onContextMenu);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
  }

  private onContextMenu = (e: MouseEvent) => e.preventDefault();

  private onWindowBlur = () => {
    this.heldKeys.clear();
    this.justPressed.clear();
    this.isBlocking = false;
    this.isDraggingCamera = false;
  };

  private onVisibilityChange = () => {
    if (document.hidden) {
      this.onWindowBlur();
    }
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
    if (!this.heldKeys.has(e.code)) {
      this.justPressed.add(e.code);
    }
    this.heldKeys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.studioMode || this.gameState === 'playing') {
      if (e.button === 0 || e.button === 1 || e.button === 2) {
        this.isDraggingCamera = true;
        this.dragButton = e.button;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        this.pointerDownPos = { x: e.clientX, y: e.clientY };
        this.pointerMovedDist = 0;
        if (e.button === 2 && this.gameState === 'playing' && !this.studioMode) {
          this.isBlocking = true;
        }
      }
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.isDraggingCamera) return;
    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.pointerMovedDist += Math.hypot(dx, dy);

    if (this.dragButton === 2 && this.pointerMovedDist > 5) {
      this.isBlocking = false;
    }

    const sens = 0.0055 * this.settings.cameraSensitivity;
    if (this.studioMode) {
      this.studioYawVel += dx * sens * 24;
      this.studioPitchVel += dy * sens * 18;
      this.studioAutoRotate = false;
    } else {
      this.camYawVel -= dx * sens * 24;
      this.camPitchVel += dy * sens * 18;
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    const moved = this.pointerMovedDist;
    if (this.gameState === 'playing' && !this.studioMode && e.button === 0 && moved <= 5) {
      if (this.selectedBuildKind) {
        this.tryPlaceSelectedBuilding();
      } else {
        this.attackBuffer = 0.14;
      }
    }
    if (e.button === this.dragButton) {
      this.isDraggingCamera = false;
      this.dragButton = -1;
    }
    if (e.button === 2) {
      this.isBlocking = false;
    }
  };

  private onWheel = (e: WheelEvent) => {
    if (this.studioMode) {
      this.studioDist = THREE.MathUtils.clamp(this.studioDist + e.deltaY * 0.003, 2.1, 6.2);
    } else if (this.gameState === 'playing') {
      this.settings.cameraDistance = THREE.MathUtils.clamp(
        this.settings.cameraDistance + e.deltaY * 0.006,
        3.5,
        18,
      );
    }
  };

  public handleResize() {
    if (this.disposed) return;
    const w = Math.max(320, this.container.clientWidth);
    const h = Math.max(240, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // Public API for React UI
  public setGameState(state: GameState) {
    this.gameState = state;
    if (state !== 'playing') {
      this.heldKeys.clear();
      this.isBlocking = false;
      this.isDraggingCamera = false;
    }
  }

  public setStudioMode(enabled: boolean) {
    this.studioMode = enabled;
    if (enabled) {
      this.studioYaw = 0;
      this.studioYawVel = 0;
      this.studioPitch = 0.14;
      this.studioPitchVel = 0;
      this.studioDist = 4.35;
      this.studioAutoRotate = true;
    }
  }

  public setStudioCameraControl(opts: {
    rotateDeltaYaw?: number;
    zoomDelta?: number;
    reset?: boolean;
    toggleAutoRotate?: boolean;
  }): boolean {
    if (opts.rotateDeltaYaw) {
      this.studioYawVel += opts.rotateDeltaYaw * 4.5;
      this.studioAutoRotate = false;
    }
    if (opts.zoomDelta) {
      this.studioDist = THREE.MathUtils.clamp(this.studioDist + opts.zoomDelta, 2.2, 6.8);
    }
    if (opts.reset) {
      this.studioYaw = 0;
      this.studioYawVel = 0;
      this.studioPitch = 0.14;
      this.studioPitchVel = 0;
      this.studioDist = 4.35;
    }
    if (opts.toggleAutoRotate) {
      this.studioAutoRotate = !this.studioAutoRotate;
    }
    return this.studioAutoRotate;
  }

  public updateCharacter(char: CharacterCustomization) {
    this.character = { ...char };
    this.buildHero();
  }

  public updateVitals(vitals: PlayerVitals) {
    this.vitals = { ...vitals };
  }

  public updateEquipment(equipped: SaveDataV1['equipped']) {
    this.equipped = { ...equipped };
    this.applyEquipmentVisuals();
  }

  public updateSettings(settings: GameSettings) {
    this.settings = { ...settings };
    this.applySettings(settings);
  }

  private applySettings(s: GameSettings) {
    gameAudio.setSettings(s.muted, s.soundVolume, s.musicVolume);
    this.renderer.toneMappingExposure = s.exposure ?? 1.1;
    if (!this.isSoftwareGl) {
      const presetScale =
        s.graphicsPreset === 'low' ? 0.7 : s.graphicsPreset === 'medium' ? 0.85 : s.graphicsPreset === 'ultra' ? 1.0 : 0.95;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * presetScale * s.resolutionScale);
      this.renderer.shadowMap.enabled = s.shadowsEnabled && s.graphicsPreset !== 'low';
      this.sunLight.castShadow = this.renderer.shadowMap.enabled;
    }
    this.camera.far = Math.max(120, s.viewDistance * 1.8);
    this.camera.updateProjectionMatrix();
  }

  public setMount(mount: MountVehicleType) {
    this.activeMount = mount;
    if (this.mountGroup) {
      this.scene.remove(this.mountGroup);
      this.mountGroup = null;
    }
    if (mount !== 'none') {
      this.mountGroup = buildMountVehicleRig(mount, this.textures.contactShadow);
      this.scene.add(this.mountGroup);
    }
  }

  public setPet(pet: PetType) {
    this.activePet = pet;
    if (this.petMesh) {
      this.scene.remove(this.petMesh);
      this.petMesh = null;
    }
    if (pet !== 'none') {
      this.petMesh = buildPetMesh(pet);
      this.scene.add(this.petMesh);
    }
  }

  public setSelectedBuildKind(kind: BuildingPieceKind | null) {
    this.selectedBuildKind = kind;
    if (this.buildGhost) {
      this.scene.remove(this.buildGhost);
      this.buildGhost = null;
    }
    if (kind) {
      this.buildGhost = buildBuildingPiece(kind, this.textures.woodMap, this.textures.stoneMap);
      this.buildGhost.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh && m.material) {
          const cloned = (m.material as THREE.MeshStandardMaterial).clone();
          cloned.transparent = true;
          cloned.opacity = 0.55;
          m.material = cloned;
        }
      });
      this.scene.add(this.buildGhost);
    }
  }

  public rotateBuildPreview() {
    this.buildRotation = (this.buildRotation + Math.PI / 4) % (Math.PI * 2);
  }

  public syncBuildings(buildings: PlacedBuilding[]) {
    this.buildingsData = [...buildings];
    const incomingIds = new Set(buildings.map((b) => b.id));
    for (const [id, mesh] of this.buildingMeshes.entries()) {
      if (!incomingIds.has(id)) {
        this.scene.remove(mesh);
        this.buildingMeshes.delete(id);
        this.buildingTiers.delete(id);
      }
    }
    for (const b of buildings) {
      const tier = b.tier ?? 1;
      const existingTier = this.buildingTiers.get(b.id);
      if (!this.buildingMeshes.has(b.id) || existingTier !== tier) {
        const old = this.buildingMeshes.get(b.id);
        if (old) this.scene.remove(old);
        const mesh = buildBuildingPiece(b.kind, this.textures.woodMap, this.textures.stoneMap, tier);
        mesh.position.set(b.x, b.y, b.z);
        mesh.rotation.y = b.rotationY;
        this.scene.add(mesh);
        this.buildingMeshes.set(b.id, mesh);
        this.buildingTiers.set(b.id, tier);
      }
    }
  }

  public syncLivingWorld(world: LivingWorldState) {
    this.livingWorld = world;

    // 1. Sync 3D Farm Plots
    const farmIds = new Set(world.farms.map((f) => f.id));
    for (const [id, entry] of this.farmMeshes.entries()) {
      if (!farmIds.has(id)) {
        this.scene.remove(entry.mesh);
        this.farmMeshes.delete(id);
      }
    }
    for (const plot of world.farms) {
      const sig = `${plot.crop ?? 'empty'}_${plot.stage}_${plot.water > 25 ? 1 : 0}`;
      const existing = this.farmMeshes.get(plot.id);
      if (!existing || existing.sig !== sig) {
        if (existing) this.scene.remove(existing.mesh);
        const mesh = buildFarmPlotMesh(plot, this.textures.soilMap, this.textures.woodMap);
        mesh.position.set(plot.x, groundHeightAt(plot.x, plot.z), plot.z);
        this.scene.add(mesh);
        this.farmMeshes.set(plot.id, { mesh, sig });
      }
    }

    // 2. Sync Autonomous NPC-Constructed Village Buildings
    const bldIds = new Set(world.npcBuildings.map((b) => b.id));
    for (const [id, entry] of this.npcBuildingMeshes.entries()) {
      if (!bldIds.has(id)) {
        this.scene.remove(entry.mesh);
        this.npcBuildingMeshes.delete(id);
      }
    }
    for (const b of world.npcBuildings) {
      const tier = b.tier ?? 1;
      const existing = this.npcBuildingMeshes.get(b.id);
      if (!existing || existing.tier !== tier) {
        if (existing) this.scene.remove(existing.mesh);
        const mesh = buildBuildingPiece(b.kind, this.textures.woodMap, this.textures.stoneMap, tier);
        mesh.position.set(b.x, b.y, b.z);
        mesh.rotation.y = b.rotationY;
        this.scene.add(mesh);
        this.npcBuildingMeshes.set(b.id, { mesh, tier });
      }
    }
  }

  public teleportTo(x: number, z: number, skyY?: number) {
    this.px = x;
    this.pz = z;
    this.py = skyY ?? groundHeightAt(x, z) + 0.5;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
  }

  public setMobileMove(x: number, y: number) {
    this.mobileMove = { x, y };
  }

  public rotateCameraBy(dx: number, dy: number) {
    const sens = 0.0055 * this.settings.cameraSensitivity;
    this.camYawVel -= dx * sens * 26;
    this.camPitchVel += dy * sens * 20;
  }

  public activateAscensionPower(powerId: AscensionPowerId) {
    if (this.gameState !== 'playing') return;
    if (this.powerCooldowns[powerId] > 0) return;
    const meta = ASCENSION_POWERS_META.find((p) => p.id === powerId);
    if (!meta) return;
    if (!this.callbacks.onConsumeMana(meta.manaCost)) return;

    const cdMult = getCooldownMultiplier(this.vitals.skillUpgrades?.chronos ?? 0);
    this.powerCooldowns[powerId] = meta.cooldown * cdMult;
    const rank = this.vitals.powerRanks?.[powerId] ?? 1;

    const fwdX = Math.sin(this.playerYaw);
    const fwdZ = Math.cos(this.playerYaw);

    if (powerId === 'blink_step') {
      this.emitParticles(this.px, this.py + 1.1, this.pz, '#38bdf8', 18, 6);
      const stepDist = 8 + rank * 1.5;
      this.px += fwdX * stepDist;
      this.pz += fwdZ * stepDist;
      this.py = Math.max(this.py, groundHeightAt(this.px, this.pz) + 0.25);
      this.vx = fwdX * 14;
      this.vz = fwdZ * 14;
      this.dodgeTimer = 0.35;
      this.emitParticles(this.px, this.py + 1.1, this.pz, '#bae6fd', 22, 7.5);
      this.spawnShockwave(this.px, this.py + 0.15, this.pz, '#38bdf8', 5.2, 0.42);
      gameAudio.playDodge(this.getEquippedArmorCount());
      const dmg = 45 + rank * 35 + this.vitals.level * 5;
      for (const e of this.enemies) {
        if (e.state === 'ko' || e.hp <= 0) continue;
        if (Math.hypot(e.x - this.px, e.z - this.pz) <= 5.5) {
          this.damageEnemy(e, dmg, true, false);
        }
      }
      return;
    }

    if (powerId === 'meteor_nova') {
      const radius = 7.5 + rank * 1.6;
      const dmg = Math.round((105 + rank * 48 + this.vitals.level * 6) * (1 + this.vitals.cultivationRealm * 0.25));
      this.hitstop = 0.055;
      this.trauma = 0.6;
      this.emitParticles(this.px, this.py + 1.5, this.pz, '#f97316', 36, 11);
      this.emitParticles(this.px, this.py + 1.2, this.pz, '#fde047', 24, 9);
      this.spawnShockwave(this.px, this.py + 0.2, this.pz, '#f97316', radius * 0.9, 0.55);
      gameAudio.playSkill('fire');
      const sov = this.vitals.skillUpgrades?.sovereign ?? 0;
      for (const e of this.enemies) {
        if (e.state === 'ko' || e.hp <= 0) continue;
        if (Math.hypot(e.x - this.px, e.z - this.pz) <= radius) {
          const bossMult = e.isBoss ? 1 + sov * 0.07 : 1;
          this.damageEnemy(e, Math.round(dmg * bossMult), true, true);
        }
      }
      return;
    }

    if (powerId === 'aegis_dome') {
      const duration = 3.2 + rank * 0.65;
      const healHp = 22 * rank;
      this.emitParticles(this.px, this.py + 1.2, this.pz, '#eab308', 28, 6.5);
      this.spawnShockwave(this.px, this.py + 0.2, this.pz, '#eab308', 5.0, 0.5);
      gameAudio.playShieldBlock();
      gameAudio.playBreakthrough();
      this.addDamagePopup(this.px, this.py + 2.3, this.pz, healHp, false, `AEGIS +${healHp}`);
      this.callbacks.onPowerStateChanged?.({ aegisShieldTimer: duration, healHp });
      return;
    }

    if (powerId === 'omega_overdrive') {
      const sov = this.vitals.skillUpgrades?.sovereign ?? 0;
      const duration = 12 + sov * 1.2 + (rank - 1) * 2;
      this.emitParticles(this.px, this.py + 1.4, this.pz, '#fde047', 34, 8.5);
      this.emitParticles(this.px, this.py + 1.6, this.pz, '#a855f7', 24, 7.5);
      gameAudio.playBreakthrough();
      this.addDamagePopup(this.px, this.py + 2.4, this.pz, 0, true, 'OMEGA AWAKENED!');
      this.callbacks.onPowerStateChanged?.({ awakeningActive: true, awakeningTimer: duration });
    }
  }

  public triggerAction(
    action: 'attack' | 'heavy' | 'offhand' | 'jump' | 'dodge' | 'skill1' | 'skill2' | 'skill3' | 'ultimate' | 'interact' | 'awakening' | 'meditate' | 'power',
  ) {
    if (this.gameState !== 'playing') return;
    const bar = this.vitals.activeSkillBar ?? [
      this.character.primaryElement,
      this.character.secondaryElement,
      this.vitals.unlockedElements[2] ?? this.character.primaryElement,
    ];
    if (action === 'attack') this.attackBuffer = 0.14;
    else if (action === 'heavy') this.performAttack(true);
    else if (action === 'offhand') this.performOffHandAction();
    else if (action === 'jump') {
      if (!this.grounded && this.equipped?.elytra) {
        this.isGliding = !this.isGliding;
        if (this.isGliding) {
          this.vy = Math.max(this.vy, 1.8);
          this.emitParticles(this.px, this.py + 1.1, this.pz, '#38bdf8', 10, 4);
          gameAudio.playWingSpread();
        }
      } else {
        this.jumpBuffer = 0.14;
      }
    }
    else if (action === 'dodge') this.performDodge();
    else if (action === 'skill1') this.castElementalSkill(0, bar[0] ?? this.character.primaryElement);
    else if (action === 'skill2') this.castElementalSkill(1, bar[1] ?? this.character.secondaryElement);
    else if (action === 'skill3') this.castElementalSkill(2, bar[2] ?? this.character.primaryElement);
    else if (action === 'ultimate') this.castUltimate();
    else if (action === 'interact') this.tryInteract();
    else if (action === 'awakening') this.activateAscensionPower('omega_overdrive');
    else if (action === 'power') {
      if (!this.vitals.awakeningActive && this.powerCooldowns.omega_overdrive <= 0) {
        this.activateAscensionPower('omega_overdrive');
      } else {
        this.activateAscensionPower('meteor_nova');
      }
    }
    else if (action === 'meditate') this.isMeditating = !this.isMeditating;
  }

  public setWeather(weather: WeatherType) {
    this.weather = weather;
  }

  public setTimeOfDay(hour: number) {
    this.timeOfDay = hour % 24;
  }

  public getPosition() {
    return { x: this.px, y: this.py, z: this.pz, yaw: this.playerYaw };
  }

  private tryPlaceSelectedBuilding() {
    if (!this.selectedBuildKind) return;
    const fx = this.px + Math.sin(this.playerYaw) * 3.8;
    const fz = this.pz + Math.cos(this.playerYaw) * 3.8;
    const fy = getSupportHeightAt(fx, this.py + 1.5, fz);
    const piece: PlacedBuilding = {
      id: `bld_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      kind: this.selectedBuildKind,
      x: Math.round(fx * 2) / 2,
      y: fy,
      z: Math.round(fz * 2) / 2,
      rotationY: this.buildRotation,
    };
    this.callbacks.onPlaceBuilding(piece);
    this.syncBuildings([piece]);
    this.emitParticles(piece.x, piece.y + 0.8, piece.z, '#e8c468', 12, 4);
    gameAudio.playPickup();
  }

  private emitParticles(x: number, y: number, z: number, colorHex: string, count: number, speed: number) {
    for (let i = 0; i < count; i++) {
      const slot = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % this.particles.length;
      slot.active = true;
      slot.x = x;
      slot.y = y;
      slot.z = z;
      const theta = Math.random() * Math.PI * 2;
      const up = 0.35 + Math.random() * 0.9;
      slot.vx = Math.cos(theta) * speed * (0.4 + Math.random() * 0.6);
      slot.vy = up * speed;
      slot.vz = Math.sin(theta) * speed * (0.4 + Math.random() * 0.6);
      slot.maxLife = 0.45 + Math.random() * 0.35;
      slot.life = slot.maxLife;
      slot.size = 0.6 + Math.random() * 0.8;
      slot.color.set(colorHex);
    }
  }

  private addDamagePopup(wx: number, wy: number, wz: number, amount: number, isCrit: boolean, label?: string) {
    this.popups.push({
      id: this.popupSeq++,
      x: 0,
      y: 0,
      wx,
      wy,
      wz,
      amount,
      isCrit,
      label,
      ttl: 0.95,
    });
  }

  private spawnProjectile(
    fromPlayer: boolean,
    x: number,
    y: number,
    z: number,
    dx: number,
    dy: number,
    dz: number,
    speed: number,
    damage: number,
    color: string,
  ) {
    const slot = this.projectiles.find((p) => !p.active);
    if (!slot) return;
    slot.active = true;
    slot.fromPlayer = fromPlayer;
    slot.x = x;
    slot.y = y;
    slot.z = z;
    const len = Math.hypot(dx, dy, dz) || 1;
    slot.vx = (dx / len) * speed;
    slot.vy = (dy / len) * speed;
    slot.vz = (dz / len) * speed;
    slot.life = 1.8;
    slot.damage = damage;
    slot.color = color;
    (slot.mesh.material as THREE.MeshBasicMaterial).color.set(color);
    slot.mesh.position.set(x, y, z);
    slot.mesh.visible = true;
  }

  private performAttack(isHeavy: boolean) {
    if (this.attackCooldown > 0) return;
    const w = WEAPONS[this.character.weaponType] ?? WEAPONS.katana;
    if (!this.callbacks.onConsumeStamina(isHeavy ? w.staminaCost * 1.6 : w.staminaCost)) return;

    this.isMeditating = false;
    this.attackTimer = 0.28;
    this.attackCooldown = (isHeavy ? 0.55 : 0.34) / w.speed;
    this.comboStep = (this.comboStep + 1) % 3;
    gameAudio.playSlash(isHeavy);

    // Face forward / locked target
    if (this.lockedEnemyId) {
      const target = this.enemies.find((e) => e.id === this.lockedEnemyId && e.state !== 'ko');
      if (target) {
        this.playerYaw = Math.atan2(target.x - this.px, target.z - this.pz);
      }
    }

    const fwdX = Math.sin(this.playerYaw);
    const fwdZ = Math.cos(this.playerYaw);

    if (w.isRanged) {
      const dmgRes = calculateCombatDamage({
        weaponType: this.character.weaponType,
        equippedWeaponAtk: this.equipped?.weapon?.stats?.attack ?? 0,
        offHandAtk: this.equipped?.offHand?.stats?.attack ?? 0,
        cultivationRealm: this.vitals.cultivationRealm,
        level: this.vitals.level,
        martialRank: this.vitals.skillUpgrades?.martial ?? 0,
        fortuneRank: this.vitals.skillUpgrades?.fortune ?? 0,
        isHeavy,
        isAerial: !this.grounded,
        comboStep: this.comboStep,
        awakeningActive: this.vitals.awakeningActive,
        primaryElement: this.character.primaryElement,
        secondaryElement: this.character.secondaryElement,
      });
      this.spawnProjectile(
        true,
        this.px + fwdX * 0.9,
        this.py + 1.35,
        this.pz + fwdZ * 0.9,
        fwdX,
        0,
        fwdZ,
        28,
        dmgRes.damage,
        ELEMENTS[this.character.primaryElement].color,
      );
      this.emitParticles(this.px + fwdX * 0.9, this.py + 1.35, this.pz + fwdZ * 0.9, '#38bdf8', 5, 3);
      return;
    }

    // Melee hit check against enemies and resource nodes
    const reach = w.range + (isHeavy ? 1.2 : 0);
    let hitCount = 0;
    for (const enemy of this.enemies) {
      if (enemy.state === 'ko' || enemy.hp <= 0) continue;
      const dx = enemy.x - this.px;
      const dz = enemy.z - this.pz;
      const dist = Math.hypot(dx, dz);
      const hitRadius = enemy.isBoss ? reach + 1.6 : reach;
      if (dist <= hitRadius && Math.abs(enemy.y - this.py) < 4.5) {
        const momentumMult = calculateKineticMomentumBonus(Math.hypot(this.vx, this.vz));
        const dmgRes = calculateCombatDamage({
          weaponType: this.character.weaponType,
          equippedWeaponAtk: this.equipped?.weapon?.stats?.attack ?? 0,
          offHandAtk: this.equipped?.offHand?.stats?.attack ?? 0,
          cultivationRealm: this.vitals.cultivationRealm,
          level: this.vitals.level,
          martialRank: this.vitals.skillUpgrades?.martial ?? 0,
          fortuneRank: this.vitals.skillUpgrades?.fortune ?? 0,
          sovereignRank: this.vitals.skillUpgrades?.sovereign ?? 0,
          isBossTarget: enemy.isBoss,
          isHeavy,
          isAerial: !this.grounded,
          comboStep: this.comboStep,
          awakeningActive: this.vitals.awakeningActive,
          primaryElement: this.character.primaryElement,
          secondaryElement: this.character.secondaryElement,
        });
        this.damageEnemy(enemy, Math.round(dmgRes.damage * momentumMult), dmgRes.isCrit, isHeavy);
        hitCount++;
      }
    }

    // Resource harvesting via swing
    for (const node of this.resourceNodes) {
      if (node.respawnTimer > 0) continue;
      const dist = Math.hypot(node.x - this.px, node.z - this.pz);
      if (dist <= reach + 0.8) {
        node.hp -= isHeavy ? 30 : 18;
        this.emitParticles(node.x, node.y + 1.0, node.z, '#e8c468', 6, 3.5);
        gameAudio.playHit(false);
        if (node.hp <= 0) {
          this.harvestNode(node);
        }
        hitCount++;
      }
    }

    if (hitCount > 0 && isHeavy) {
      this.hitstop = 0.045;
      this.trauma = Math.min(1, this.trauma + 0.35);
    }
  }

  private performOffHandAction() {
    if (this.offHandCooldown > 0) return;
    const offItem = this.equipped?.offHand;
    if (!offItem) {
      this.addDamagePopup(this.px, this.py + 2.1, this.pz, 0, false, 'NO OFF-HAND');
      return;
    }

    if (offItem.category === 'consumable' || offItem.category === 'core') {
      this.offHandCooldown = 0.5;
      this.callbacks.onUseOffHandConsumable?.();
      this.emitParticles(this.px, this.py + 1.2, this.pz, '#34d399', 12, 4);
      return;
    }

    this.offHandCooldown = 0.42;
    this.offHandTimer = 0.28;
    const fwdX = Math.sin(this.playerYaw);
    const fwdZ = Math.cos(this.playerYaw);

    if (offItem.category === 'shield') {
      if (!this.callbacks.onConsumeStamina(10)) return;
      this.isBlocking = true;
      window.setTimeout(() => {
        this.isBlocking = false;
      }, 450);
      gameAudio.playShieldRaise();
      this.spawnShockwave(this.px, this.py + 0.25, this.pz, '#60a5fa', 3.4, 0.35);
      this.emitParticles(this.px + fwdX * 0.9, this.py + 1.1, this.pz + fwdZ * 0.9, '#60a5fa', 14, 5);
      for (const enemy of this.enemies) {
        if (enemy.state === 'ko' || enemy.hp <= 0) continue;
        if (Math.hypot(enemy.x - this.px, enemy.z - this.pz) <= 3.6) {
          this.damageEnemy(enemy, 18 + (offItem.stats?.defense ?? 0), false, true);
        }
      }
      return;
    }

    if (!this.callbacks.onConsumeStamina(8)) return;
    gameAudio.playSlash(false);

    const wType = offItem.stats?.weaponType ?? 'dagger';
    const wMeta = WEAPONS[wType] ?? WEAPONS.dagger;
    const dmgRes = calculateCombatDamage({
      weaponType: wType,
      equippedWeaponAtk: offItem.stats?.attack ?? 18,
      cultivationRealm: this.vitals.cultivationRealm,
      level: this.vitals.level,
      martialRank: this.vitals.skillUpgrades?.martial ?? 0,
      fortuneRank: this.vitals.skillUpgrades?.fortune ?? 0,
      isHeavy: false,
      isAerial: !this.grounded,
      comboStep: 1,
      awakeningActive: this.vitals.awakeningActive,
      primaryElement: this.character.primaryElement,
      secondaryElement: this.character.secondaryElement,
    });

    if (wMeta.isRanged) {
      this.spawnProjectile(
        true,
        this.px + fwdX * 0.9,
        this.py + 1.32,
        this.pz + fwdZ * 0.9,
        fwdX,
        0,
        fwdZ,
        28,
        dmgRes.damage,
        '#f472b6',
      );
      this.emitParticles(this.px + fwdX * 0.9, this.py + 1.32, this.pz + fwdZ * 0.9, '#f472b6', 6, 3);
      return;
    }

    for (const enemy of this.enemies) {
      if (enemy.state === 'ko' || enemy.hp <= 0) continue;
      if (Math.hypot(enemy.x - this.px, enemy.z - this.pz) <= wMeta.range + 0.6) {
        this.damageEnemy(enemy, dmgRes.damage, dmgRes.isCrit, false);
      }
    }
    for (const node of this.resourceNodes) {
      if (node.respawnTimer > 0) continue;
      if (Math.hypot(node.x - this.px, node.z - this.pz) <= wMeta.range + 0.9) {
        node.hp -= offItem.category === 'tool' ? 35 : 20;
        this.emitParticles(node.x, node.y + 1.0, node.z, '#e8c468', 6, 3.5);
        if (node.hp <= 0) this.harvestNode(node);
      }
    }
  }

  private damageEnemy(enemy: EnemyActor, amount: number, isCrit: boolean, knockHeavy: boolean) {
    enemy.hp = Math.max(0, enemy.hp - amount);
    enemy.hitFlash = 0.08;
    const dx = enemy.x - this.px;
    const dz = enemy.z - this.pz;
    const len = Math.hypot(dx, dz) || 1;
    const impulse = enemy.isBoss ? 2.0 : knockHeavy ? 9.5 : 5.5;
    enemy.vx += (dx / len) * impulse;
    enemy.vz += (dz / len) * impulse;

    this.emitParticles(enemy.x, enemy.y + 1.2, enemy.z, isCrit ? '#fde047' : '#38bdf8', isCrit ? 16 : 8, 5.5);
    this.addDamagePopup(enemy.x, enemy.y + (enemy.isBoss ? 4.2 : 2.1), enemy.z, amount, isCrit);
    gameAudio.playHit(isCrit, knockHeavy);

    if (isCrit) {
      this.spawnShockwave(enemy.x, enemy.y + 0.25, enemy.z, '#fde047', enemy.isBoss ? 5.2 : 3.2, 0.38);
    }

    const lifesteal = getLifestealGain(this.vitals.skillUpgrades?.lifesteal ?? 0);
    if (lifesteal.hpGain > 0 || lifesteal.manaGain > 0) {
      this.callbacks.onLifestealGain?.(lifesteal.hpGain, lifesteal.manaGain);
    }

    if (isCrit || knockHeavy) {
      this.hitstop = Math.max(this.hitstop, 0.045);
      this.trauma = Math.min(1, this.trauma + 0.25);
    }

    if (enemy.isBoss && enemy.hp > 0 && enemy.hp < enemy.maxHp * 0.4 && enemy.phase === 1) {
      enemy.phase = 2;
      this.addDamagePopup(enemy.x, enemy.y + 4.8, enemy.z, 0, true, 'PHASE II ENRAGE');
      this.emitParticles(enemy.x, enemy.y + 2, enemy.z, '#ef4444', 28, 8);
      this.spawnShockwave(enemy.x, enemy.y + 0.4, enemy.z, '#ef4444', 9.0, 0.65);
      gameAudio.playCriticalWarningStab();
    }

    if (enemy.hp <= 0 && enemy.state !== 'ko') {
      enemy.state = 'ko';
      enemy.stateTimer = 0.45;
      this.hitstop = 0.065;
      this.trauma = Math.min(1, this.trauma + 0.42);
      this.emitParticles(enemy.x, enemy.y + 1.4, enemy.z, '#a855f7', 22, 7.5);
      this.callbacks.onEnemyKilled(enemy.archetype, enemy.isBoss, enemy.id);
    }
  }

  private harvestNode(node: ResourceNode) {
    node.respawnTimer = 28;
    node.mesh.visible = false;
    const qty = node.kind === 'ancient' ? 2 : 3;
    this.callbacks.onGatherResource(node.templateId, qty);
    this.addDamagePopup(node.x, node.y + 1.4, node.z, qty, false, `+${qty} ${node.templateId.toUpperCase()}`);
    gameAudio.playPickup();
  }

  private castElementalSkill(slotIdx: 0 | 1 | 2, elementId: ElementId) {
    if (this.skillCooldowns[slotIdx] > 0) return;
    const meta = ELEMENTS[elementId];
    if (!this.callbacks.onConsumeMana(meta.manaCost)) return;

    const cdMult = getCooldownMultiplier(this.vitals.skillUpgrades?.chronos ?? 0);
    this.skillCooldowns[slotIdx] = meta.cooldown * cdMult;
    this.attackTimer = 0.35;
    gameAudio.playSkill(elementId);
    this.trauma = Math.min(1, this.trauma + 0.32);

    const fwdX = Math.sin(this.playerYaw);
    const fwdZ = Math.cos(this.playerYaw);

    // Rasengan-inspired vortex or Chidori dash surge
    if (elementId === 'lightning' || elementId === 'chakra') {
      this.vx += fwdX * 16;
      this.vz += fwdZ * 16;
    }

    const centerX = this.px + fwdX * 2.5;
    const centerZ = this.pz + fwdZ * 2.5;
    this.emitParticles(centerX, this.py + 1.1, centerZ, meta.color, 26, 7.5);
    this.spawnShockwave(centerX, this.py + 0.2, centerZ, meta.color, meta.radius * 0.85, 0.45);

    const biome = getBiomeAt(this.px, this.pz);
    const reaction = evaluateElementalReaction(this.character.primaryElement, elementId, biome);
    if (reaction.multiplier >= 1.24) {
      gameAudio.playAlchemySynth();
      this.addDamagePopup(centerX, this.py + 2.5, centerZ, 0, true, reaction.reactionName.toUpperCase());
    }

    const sovRank = this.vitals.skillUpgrades?.sovereign ?? 0;

    for (const enemy of this.enemies) {
      if (enemy.state === 'ko' || enemy.hp <= 0) continue;
      const dist = Math.hypot(enemy.x - centerX, enemy.z - centerZ);
      if (dist <= meta.radius) {
        const dmg = calculateElementalSkillDamage({
          elementId,
          cultivationRealm: this.vitals.cultivationRealm,
          level: this.vitals.level,
          awakeningActive: this.vitals.awakeningActive,
          arcaneRank: this.vitals.skillUpgrades?.arcane ?? 0,
          elementRank: this.vitals.elementRanks?.[elementId] ?? 1,
          sovereignRank: sovRank,
          isBossTarget: enemy.isBoss,
        });
        this.damageEnemy(enemy, Math.round(dmg * (reaction.multiplier >= 1.24 ? reaction.multiplier : 1)), true, true);
      }
    }
  }

  private castUltimate() {
    if (this.skillCooldowns[3] > 0) return;
    if (!this.callbacks.onConsumeMana(50)) return;
    const cdMult = getCooldownMultiplier(this.vitals.skillUpgrades?.chronos ?? 0);
    this.skillCooldowns[3] = 12 * cdMult;
    gameAudio.playSkill('darkness');
    gameAudio.playBreakthrough();
    this.trauma = 0.65;
    this.hitstop = 0.07;

    const c1 = ELEMENTS[this.character.primaryElement].color;
    const c2 = ELEMENTS[this.character.secondaryElement].color;
    this.emitParticles(this.px, this.py + 1.4, this.pz, c1, 30, 10);
    this.emitParticles(this.px, this.py + 1.8, this.pz, c2, 30, 12);

    const sovRank = this.vitals.skillUpgrades?.sovereign ?? 0;

    for (const enemy of this.enemies) {
      if (enemy.state === 'ko' || enemy.hp <= 0) continue;
      if (Math.hypot(enemy.x - this.px, enemy.z - this.pz) <= 13) {
        const dmg =
          calculateElementalSkillDamage({
            elementId: this.character.primaryElement,
            cultivationRealm: this.vitals.cultivationRealm,
            level: this.vitals.level,
            awakeningActive: true,
            arcaneRank: this.vitals.skillUpgrades?.arcane ?? 0,
            elementRank: this.vitals.elementRanks?.[this.character.primaryElement] ?? 1,
            sovereignRank: sovRank,
            isBossTarget: enemy.isBoss,
          }) * 2;
        this.damageEnemy(enemy, dmg, true, true);
      }
    }
  }

  private performDodge() {
    if (this.dodgeCooldown > 0) return;
    if (!this.callbacks.onConsumeStamina(16)) return;
    this.dodgeTimer = 0.24;
    this.dodgeCooldown = 0.65;
    const fwdX = Math.sin(this.playerYaw);
    const fwdZ = Math.cos(this.playerYaw);
    this.vx = fwdX * 18;
    this.vz = fwdZ * 18;
    this.emitParticles(this.px, this.py + 0.5, this.pz, '#38bdf8', 8, 3.5);
    gameAudio.playDodge(this.getEquippedArmorCount());
  }

  private tryInteract() {
    // 1. Check nearby NPCs
    for (const npc of NPCS) {
      const entry = this.npcMeshes.get(npc.id);
      if (!entry) continue;
      const dist = Math.hypot(entry.mesh.position.x - this.px, entry.mesh.position.z - this.pz);
      if (dist < 4.5) {
        this.callbacks.onNpcInteract(npc.id);
        return;
      }
    }
    // 2. Check nearby Farm Plots
    if (this.livingWorld) {
      for (const plot of this.livingWorld.farms) {
        if (Math.hypot(plot.x - this.px, plot.z - this.pz) < 4.0) {
          this.callbacks.onInteractFarm?.(plot.id);
          this.emitParticles(plot.x, groundHeightAt(plot.x, plot.z) + 0.8, plot.z, '#eab308', 12, 4);
          gameAudio.playPickup();
          return;
        }
      }
    }
    // 3. Check nearby resource nodes
    for (const node of this.resourceNodes) {
      if (node.respawnTimer > 0) continue;
      if (Math.hypot(node.x - this.px, node.z - this.pz) < 4.2) {
        this.harvestNode(node);
        return;
      }
    }
  }

  private startLoop() {
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      this.update(dt, now * 0.001);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    // Draw frame 0 immediately so Title Screen and initial mount are never blank
    this.update(0.016, 0);
    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.renderer.compile(this.scene, this.camera);
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void) {
    try {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } catch {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private update(dt: number, elapsed: number) {
    // Ambient animations run on title + playing
    this.timeOfDay = (this.timeOfDay + dt * 0.04) % 24;
    this.updateAtmosphereAndLighting(dt, elapsed);
    this.updateWaterAndWorldProps(elapsed);

    if (this.studioMode) {
      this.updateStudioCamera(dt);
      this.justPressed.clear();
      return;
    }

    if (this.gameState === 'title') {
      // Live world orbital tour camera over Verdant Sanctum Plaza
      const tourAngle = elapsed * 0.12;
      const radius = 28;
      this.camPos.set(Math.sin(tourAngle) * radius, 12.5 + Math.sin(elapsed * 0.35) * 1.5, Math.cos(tourAngle) * radius - 6);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(0, 4.5, -14);
      this.animateNpcs(dt, elapsed);
      this.justPressed.clear();
      return;
    }

    if (this.gameState !== 'playing') {
      this.justPressed.clear();
      return;
    }

    // Compute live combat & critical audio state + music-driven visual pulse
    const currentBiome = getBiomeAt(this.px, this.pz);
    let inCombat = false;
    let bossNearby = false;
    let bossPhase2 = false;
    for (const e of this.enemies) {
      if (e.state === 'ko' || e.hp <= 0) continue;
      const d = Math.hypot(e.x - this.px, e.z - this.pz);
      if (e.isBoss && d < 34) {
        bossNearby = true;
        inCombat = true;
        if (e.phase === 2) bossPhase2 = true;
      } else if ((e.state === 'chase' || e.state === 'windup' || e.state === 'attack') && d < 22) {
        inCombat = true;
      }
    }
    const mountMeta = MOUNTS_CATALOG.find((m) => m.id === this.activeMount) ?? MOUNTS_CATALOG[0];
    const isFlyingNow = this.isGliding || (mountMeta.canFly && !this.grounded);
    gameAudio.tickAdaptiveMusic(dt, {
      biome: currentBiome,
      hpRatio: this.vitals.hp / Math.max(1, this.vitals.maxHp),
      inCombat,
      bossNearby,
      bossPhase2,
      speed: Math.hypot(this.vx, this.vz),
      isGrounded: this.grounded,
      isFlying: isFlyingNow,
      mount: this.activeMount,
      equippedArmorCount: this.getEquippedArmorCount(),
    });
    const beat = gameAudio.getBeatState();
    this.criticalBeatPulse = beat.beatIntensity;
    this.currentCombatMode = beat.mode;

    if (beat.justPulsed && beat.mode === 'critical') {
      this.spawnShockwave(this.px, this.py + 0.12, this.pz, bossPhase2 ? '#ef4444' : '#f59e0b', 4.4, 0.36);
    }

    // Sim-level hitstop freezes physics while keeping particles, shake & popups responsive
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - dt);
      this.updateParticles(dt);
      this.updateImpactRings(dt);
      this.updateCamera(dt);
      this.justPressed.clear();
      return;
    }

    this.updatePlayer(dt, elapsed);
    this.animateNpcs(dt, elapsed);
    this.updateEnemies(dt, elapsed);
    this.updateProjectiles(dt);
    this.updateParticles(dt);
    this.updateImpactRings(dt);
    this.updateResourceRespawns(dt);
    this.updateWeatherDrops(dt);
    this.updateBuildGhost();
    this.updateCamera(dt);
    this.updatePopups(dt);

    this.hudEmitTimer += dt;
    if (this.hudEmitTimer >= 0.09) {
      this.hudEmitTimer = 0;
      this.emitHudSnapshot();
    }

    this.justPressed.clear();
  }

  private updateAtmosphereAndLighting(dt: number, elapsed: number) {
    const biome = getBiomeAt(this.px, this.pz);
    this.callbacks.onBiomeDiscovered(biome);

    // Day/Night sun factor
    const sunAngle = ((this.timeOfDay - 6) / 24) * Math.PI * 2;
    const sunY = Math.sin(sunAngle);
    const dayFactor = THREE.MathUtils.clamp((sunY + 0.25) / 1.1, 0.12, 1.0);

    this.sunLight.position.set(
      this.px + Math.cos(sunAngle) * 55,
      Math.max(12, sunY * 65 + 18),
      this.pz + 28,
    );
    this.sunLight.target.position.set(this.px, this.py, this.pz);
    this.sunLight.intensity = 0.55 + dayFactor * 1.45;
    this.hemiLight.intensity = 0.38 + dayFactor * 0.45;

    const targetFog = _color.set(BIOMES[biome].fogColor);
    if (dayFactor < 0.4) {
      targetFog.lerp(new THREE.Color('#090d1a'), 0.6);
    }
    (this.scene.background as THREE.Color).lerp(targetFog, Math.min(1, dt * 1.5));
    (this.scene.fog as THREE.FogExp2).color.copy(this.scene.background as THREE.Color);

    // Dynamic weather cycling
    if (this.settings.weatherEnabled) {
      this.weatherTimer += dt;
      if (this.weatherTimer > 45) {
        this.weatherTimer = 0;
        if (biome === 'frostfall') this.weather = 'snow';
        else if (biome === 'celestial') this.weather = 'aurora';
        else {
          const pool: WeatherType[] = ['clear', 'clear', 'rain', 'thunderstorm'];
          this.weather = pool[Math.floor(Math.random() * pool.length)];
        }
      }
    } else {
      this.weather = 'clear';
    }
    this.weatherMesh.visible = this.weather === 'rain' || this.weather === 'snow' || this.weather === 'thunderstorm';

    // Keep hero aura glowing and pulsing to the adaptive fighting music beat
    if (this.heroRig) {
      const beatBoost = this.criticalBeatPulse * (this.currentCombatMode === 'critical' ? 0.35 : 0.18);
      const pulse = 0.4 + Math.sin(elapsed * 3.2) * 0.12 + beatBoost;
      (this.heroRig.auraRing.material as THREE.MeshBasicMaterial).opacity =
        this.vitals.awakeningActive || this.isMeditating ? 0.9 : Math.min(0.95, pulse);
      this.heroRig.auraRing.scale.setScalar(1.0 + beatBoost * 0.65);
      this.heroRig.auraRing.rotation.z = elapsed * (this.isMeditating ? 2.2 : this.currentCombatMode === 'critical' ? 1.8 : 0.7);
    }
  }

  private updateWaterAndWorldProps(elapsed: number) {
    this.waterMesh.position.y = WATER_LEVEL + Math.sin(elapsed * 1.3) * 0.06;
    if (this.textures?.waterBump) {
      this.textures.waterBump.offset.x = (elapsed * 0.028) % 1;
      this.textures.waterBump.offset.y = (elapsed * 0.02) % 1;
    }
    const crystal = this.scene.getObjectByName('sanctum_crystal');
    if (crystal) {
      crystal.rotation.y = elapsed * (0.9 + this.criticalBeatPulse * 0.9);
      crystal.position.y = 8.4 + Math.sin(elapsed * 2.0) * 0.25 + this.criticalBeatPulse * 0.22;
      crystal.scale.setScalar(1.0 + this.criticalBeatPulse * 0.12);
    }
  }

  private updateStudioCamera(dt: number) {
    if (this.studioAutoRotate) {
      this.studioYaw += dt * 0.55;
    }
    this.studioYaw += this.studioYawVel * dt;
    this.studioPitch = THREE.MathUtils.clamp(this.studioPitch + this.studioPitchVel * dt, -0.32, 0.95);
    const velDecay = Math.exp(-8.5 * dt);
    this.studioYawVel *= velDecay;
    this.studioPitchVel *= velDecay;

    const targetPos = _v1.set(this.px, this.py + 1.02, this.pz);
    const angle = this.studioYaw + this.playerYaw;
    const cosP = Math.cos(this.studioPitch);
    const desiredX = this.px + Math.sin(angle) * cosP * this.studioDist;
    const desiredZ = this.pz + Math.cos(angle) * cosP * this.studioDist;
    const desiredY = this.py + 1.06 + Math.sin(this.studioPitch) * this.studioDist;
    this.camPos.lerp(_v2.set(desiredX, desiredY, desiredZ), 1 - Math.exp(-14 * dt));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(targetPos);
  }

  private updatePlayer(dt: number, elapsed: number) {
    for (let i = 0; i < 4; i++) {
      this.skillCooldowns[i] = Math.max(0, this.skillCooldowns[i] - dt);
    }
    (Object.keys(this.powerCooldowns) as AscensionPowerId[]).forEach((k) => {
      this.powerCooldowns[k] = Math.max(0, this.powerCooldowns[k] - dt);
    });
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.offHandCooldown = Math.max(0, this.offHandCooldown - dt);
    this.offHandTimer = Math.max(0, this.offHandTimer - dt);
    this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);

    // Smooth keyboard 360° orbit assist ([ and ])
    if (this.heldKeys.has('BracketLeft')) this.camYawVel += 4.2 * dt;
    if (this.heldKeys.has('BracketRight')) this.camYawVel -= 4.2 * dt;

    // One-shot keyboard triggers
    if (this.justPressed.has('Space')) {
      if (!this.grounded && this.equipped?.elytra && this.activeMount === 'none') {
        this.isGliding = !this.isGliding;
        if (this.isGliding) {
          this.vy = Math.max(this.vy, 1.8);
          this.emitParticles(this.px, this.py + 1.1, this.pz, '#38bdf8', 10, 4);
          gameAudio.playWingSpread();
        }
      } else {
        this.jumpBuffer = 0.14;
      }
    }
    if (this.justPressed.has(this.settings.keybinds.attack)) this.attackBuffer = 0.14;
    if (this.justPressed.has(this.settings.keybinds.heavy)) this.performAttack(true);
    if (this.justPressed.has('KeyG')) this.performOffHandAction();
    if (this.justPressed.has(this.settings.keybinds.dodge)) this.performDodge();
    if (this.justPressed.has(this.settings.keybinds.interact)) this.tryInteract();

    const bar = this.vitals.activeSkillBar ?? [
      this.character.primaryElement,
      this.character.secondaryElement,
      this.vitals.unlockedElements[2] ?? this.character.primaryElement,
    ];
    if (this.justPressed.has('Digit1')) this.castElementalSkill(0, bar[0] ?? this.character.primaryElement);
    if (this.justPressed.has('Digit2')) this.castElementalSkill(1, bar[1] ?? this.character.secondaryElement);
    if (this.justPressed.has('Digit3')) this.castElementalSkill(2, bar[2] ?? this.character.primaryElement);
    if (this.justPressed.has('Digit4')) this.castUltimate();
    if (this.justPressed.has('KeyR')) this.triggerAction('power');
    if (this.justPressed.has('Tab')) this.cycleLockOn();
    if (this.justPressed.has('KeyQ')) this.buildRotation = (this.buildRotation + Math.PI / 4) % (Math.PI * 2);

    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.attackBuffer = Math.max(0, this.attackBuffer - dt);
    if (this.attackBuffer > 0 && this.attackCooldown <= 0) {
      this.attackBuffer = 0;
      this.performAttack(false);
    }

    // Horizontal movement relative to camera yaw
    let inX = this.mobileMove.x;
    let inZ = this.mobileMove.y;
    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) inZ -= 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) inZ += 1;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) inX -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) inX += 1;

    const inputLen = Math.hypot(inX, inZ);
    if (inputLen > 0.05) {
      this.isMeditating = false;
      inX /= Math.max(1, inputLen);
      inZ /= Math.max(1, inputLen);
    }

    const sinC = Math.sin(this.camYaw);
    const cosC = Math.cos(this.camYaw);
    const worldDirX = inX * cosC + inZ * sinC;
    const worldDirZ = -inX * sinC + inZ * cosC;

    const mountMeta = MOUNTS_CATALOG.find((m) => m.id === this.activeMount) ?? MOUNTS_CATALOG[0];
    const agilityMult = 1 + (this.vitals.skillUpgrades?.agility ?? 0) * 0.05;
    const isSprinting =
      (this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight')) && this.vitals.stamina > 4;
    const baseSpeed = 8.4 * agilityMult * mountMeta.speedMult * (isSprinting ? 1.45 : 1.0) * (this.vitals.awakeningActive ? 1.25 : 1.0);

    const biomeNow = getBiomeAt(this.px, this.pz);
    const surfaceTraction = getTerrainTraction(biomeNow, this.px, this.pz).traction;
    if (this.isGliding && this.equipped?.elytra && !mountMeta.canFly) {
      const glideSpeed = (this.equipped.elytra.stats?.glideSpeed ?? 22) * agilityMult;
      const dirX = inputLen > 0.05 ? worldDirX : Math.sin(this.playerYaw);
      const dirZ = inputLen > 0.05 ? worldDirZ : Math.cos(this.playerYaw);
      this.vx = THREE.MathUtils.damp(this.vx, dirX * glideSpeed, 4.5, dt);
      this.vz = THREE.MathUtils.damp(this.vz, dirZ * glideSpeed, 4.5, dt);
    } else if (this.dodgeTimer <= 0) {
      const targetVx = inputLen > 0.05 ? worldDirX * baseSpeed : 0;
      const targetVz = inputLen > 0.05 ? worldDirZ * baseSpeed : 0;
      const baseAccel = this.activeMount === 'omega_m4_coupe' ? 6.5 : 13.0;
      const accel = baseAccel * surfaceTraction;
      this.vx = THREE.MathUtils.damp(this.vx, targetVx, accel, dt);
      this.vz = THREE.MathUtils.damp(this.vz, targetVz, accel, dt);
    }

    if (inputLen > 0.08) {
      const desiredYaw = Math.atan2(worldDirX, worldDirZ);
      let diff = desiredYaw - this.playerYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.playerYaw += diff * Math.min(1, dt * 12);
    }

    // Gravity / Flight / Elytra Gliding (Aerodynamics & Thermal Updrafts)
    if (mountMeta.canFly) {
      this.isGliding = false;
      if (this.heldKeys.has('Space')) this.vy = THREE.MathUtils.damp(this.vy, 10, 8, dt);
      else if (this.heldKeys.has('ControlLeft')) this.vy = THREE.MathUtils.damp(this.vy, -10, 8, dt);
      else this.vy = THREE.MathUtils.damp(this.vy, 0, 6, dt);
    } else if (this.isGliding && this.equipped?.elytra) {
      const aero = calculateAerodynamicLift(biomeNow, this.py, true);
      const baseSink = this.heldKeys.has('Space')
        ? -1.2
        : this.heldKeys.has('ControlLeft')
        ? -11.5
        : -2.6;
      const targetSink = Math.min(2.2, baseSink + aero.sinkAdjustment);
      this.vy = THREE.MathUtils.damp(this.vy, targetSink, 5.5, dt);
      if (Math.random() < 0.25) {
        this.emitParticles(this.px, this.py + 0.9, this.pz, aero.thermalUpdraft > 0.5 ? '#fb923c' : '#bae6fd', 1, 1.5);
      }
    } else {
      this.isGliding = false;
      if (this.grounded) {
        this.coyoteTimer = 0.1;
      } else {
        this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
      }
      if (this.jumpBuffer > 0 && this.coyoteTimer > 0) {
        this.jumpBuffer = 0;
        this.coyoteTimer = 0;
        this.vy = 11.4;
        this.grounded = false;
        this.squashY = 1.2;
        gameAudio.playJump(this.getEquippedArmorCount());
      }
      if (!this.heldKeys.has('Space') && this.vy > 3.5) {
        this.vy *= 0.92; // Variable jump cut
      }
      this.vy -= 26.0 * dt;
    }

    this.px += this.vx * dt;
    this.py += this.vy * dt;
    this.pz += this.vz * dt;

    // World radial boundary clamp (smooth natural cliff wall)
    const dist = Math.hypot(this.px, this.pz);
    if (dist > WORLD_RADIUS - 4) {
      const clampScale = (WORLD_RADIUS - 4) / dist;
      this.px *= clampScale;
      this.pz *= clampScale;
    }

    const supportY = getSupportHeightAt(this.px, this.py, this.pz);
    const minSurfaceY = this.activeMount === 'astral_skiff' ? Math.max(supportY, WATER_LEVEL + 0.1) : supportY;
    if (this.py <= minSurfaceY) {
      if (!this.grounded && this.vy < -6) {
        this.squashY = 0.78;
        this.emitParticles(this.px, minSurfaceY + 0.1, this.pz, '#94a3b8', 5, 2.5);
      }
      this.py = minSurfaceY;
      this.vy = 0;
      this.grounded = true;
      this.isGliding = false;
    } else {
      this.grounded = false;
    }

    // Squash & stretch recovery
    this.squashY = THREE.MathUtils.damp(this.squashY, 1.0, 12, dt);
    const invXZ = 1 / Math.sqrt(Math.max(0.5, this.squashY));

    // Pose Hero Rig
    const mountSeatOffset =
      this.activeMount === 'none'
        ? 0
        : this.activeMount === 'omega_m4_coupe' || this.activeMount === 'astral_skiff'
        ? 0.25
        : 0.65;
    this.heroRig.root.position.set(this.px, this.py + mountSeatOffset, this.pz);
    this.heroRig.root.rotation.y = this.playerYaw;
    this.heroRig.bodyScale.scale.set(invXZ, this.squashY, invXZ);

    // Elytra wing spread & body pitch during gliding
    if (this.isGliding && this.heroRig.elytraGroup.visible) {
      this.heroRig.torso.rotation.x = THREE.MathUtils.damp(this.heroRig.torso.rotation.x, 0.5, 10, dt);
      this.heroRig.elytraLeft.rotation.z = THREE.MathUtils.damp(this.heroRig.elytraLeft.rotation.z, -1.05, 10, dt);
      this.heroRig.elytraRight.rotation.z = THREE.MathUtils.damp(this.heroRig.elytraRight.rotation.z, 1.05, 10, dt);
    } else {
      this.heroRig.torso.rotation.x = THREE.MathUtils.damp(this.heroRig.torso.rotation.x, 0, 10, dt);
      this.heroRig.elytraLeft.rotation.z = THREE.MathUtils.damp(this.heroRig.elytraLeft.rotation.z, -0.18, 10, dt);
      this.heroRig.elytraRight.rotation.z = THREE.MathUtils.damp(this.heroRig.elytraRight.rotation.z, 0.18, 10, dt);
    }

    const speedHoriz = Math.hypot(this.vx, this.vz);
    this.walkDistance += speedHoriz * dt;
    if (this.grounded && speedHoriz > 1.2 && this.activeMount === 'none') {
      const swing = Math.sin(this.walkDistance * 2.4) * 0.65;
      const halfStep = Math.floor((this.walkDistance * 2.4) / Math.PI);
      if (halfStep !== this.lastStrideHalfStep) {
        this.lastStrideHalfStep = halfStep;
        gameAudio.playFootstep(biomeNow, isSprinting, this.getEquippedArmorCount());
      }
      this.heroRig.leftLeg.rotation.x = swing;
      this.heroRig.rightLeg.rotation.x = -swing;
      if (this.offHandTimer <= 0) this.heroRig.leftArm.rotation.x = -swing * 0.6;
      if (this.attackTimer <= 0) this.heroRig.rightArm.rotation.x = swing * 0.6;
      this.heroRig.torso.position.y = 0.82 + Math.abs(Math.cos(this.walkDistance * 2.4)) * 0.05;
    } else if (this.isMeditating) {
      this.heroRig.torso.position.y = 0.95 + Math.sin(elapsed * 2.4) * 0.08;
      this.heroRig.leftLeg.rotation.x = -1.1;
      this.heroRig.rightLeg.rotation.x = -1.1;
      this.heroRig.leftArm.rotation.x = -0.5;
      this.heroRig.rightArm.rotation.x = -0.5;
    } else {
      this.heroRig.leftLeg.rotation.x = THREE.MathUtils.damp(this.heroRig.leftLeg.rotation.x, 0, 10, dt);
      this.heroRig.rightLeg.rotation.x = THREE.MathUtils.damp(this.heroRig.rightLeg.rotation.x, 0, 10, dt);
      if (this.offHandTimer <= 0) {
        this.heroRig.leftArm.rotation.x = THREE.MathUtils.damp(this.heroRig.leftArm.rotation.x, 0, 10, dt);
      }
    }

    if (this.offHandTimer > 0) {
      const op = 1 - this.offHandTimer / 0.28;
      this.heroRig.leftArm.rotation.x = -1.6 + op * 2.4;
    }

    if (this.attackTimer > 0) {
      const p = 1 - this.attackTimer / 0.28;
      this.heroRig.rightArm.rotation.x = -1.8 + p * 2.6;
      this.heroRig.rightArm.rotation.z = (this.comboStep % 2 === 0 ? 1 : -1) * 0.5;
    } else if (this.isBlocking) {
      this.heroRig.rightArm.rotation.x = -1.0;
      this.heroRig.rightArm.rotation.z = 0.7;
      this.heroRig.leftArm.rotation.x = -1.15;
    } else if (speedHoriz <= 1.2 && !this.isMeditating) {
      this.heroRig.rightArm.rotation.x = THREE.MathUtils.damp(this.heroRig.rightArm.rotation.x, 0, 10, dt);
      this.heroRig.rightArm.rotation.z = THREE.MathUtils.damp(this.heroRig.rightArm.rotation.z, 0, 10, dt);
    }

    // Mount & Pet positioning
    if (this.mountGroup) {
      this.mountGroup.position.set(this.px, this.py, this.pz);
      this.mountGroup.rotation.y = this.playerYaw;
    }
    if (this.petMesh) {
      const targetPetX = this.px - Math.sin(this.playerYaw + 0.8) * 1.6;
      const targetPetZ = this.pz - Math.cos(this.playerYaw + 0.8) * 1.6;
      const targetPetY = this.py + 0.9 + Math.sin(elapsed * 3.5) * 0.18;
      this.petMesh.position.lerp(_v1.set(targetPetX, targetPetY, targetPetZ), 1 - Math.exp(-6 * dt));
      this.petMesh.rotation.y = this.playerYaw;
    }
  }

  private cycleLockOn() {
    let best: EnemyActor | null = null;
    let bestDist = 28;
    for (const e of this.enemies) {
      if (e.state === 'ko' || e.hp <= 0) continue;
      if (e.id === this.lockedEnemyId) continue;
      const d = Math.hypot(e.x - this.px, e.z - this.pz);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    this.lockedEnemyId = best ? best.id : null;
  }

  private animateNpcs(dt: number, elapsed: number) {
    for (const npc of NPCS) {
      const entry = this.npcMeshes.get(npc.id);
      if (!entry) continue;

      const agent = this.livingWorld?.npcAgents?.[npc.id];
      let targetX = entry.baseX + Math.sin(elapsed * 0.5 + entry.phase) * npc.patrolRadius;
      let targetZ = entry.baseZ + Math.cos(elapsed * 0.35 + entry.phase) * npc.patrolRadius;

      if (agent) {
        targetX = agent.targetX + Math.sin(elapsed * 0.4 + entry.phase) * 0.9;
        targetZ = agent.targetZ + Math.cos(elapsed * 0.4 + entry.phase) * 0.9;
      }

      const curX = entry.mesh.position.x;
      const curZ = entry.mesh.position.z;
      const dx = targetX - curX;
      const dz = targetZ - curZ;
      const dist = Math.hypot(dx, dz);

      const moveStep = Math.min(dist, 2.4 * dt);
      const nx = dist > 0.02 ? curX + (dx / dist) * moveStep : curX;
      const nz = dist > 0.02 ? curZ + (dz / dist) * moveStep : curZ;
      const ny = groundHeightAt(nx, nz);
      entry.mesh.position.set(nx, ny, nz);

      if (agent?.speechPartnerId && this.npcMeshes.has(agent.speechPartnerId)) {
        const partner = this.npcMeshes.get(agent.speechPartnerId)!;
        entry.mesh.rotation.y = Math.atan2(partner.mesh.position.x - nx, partner.mesh.position.z - nz);
      } else if (dist > 0.05) {
        entry.mesh.rotation.y = Math.atan2(dx, dz);
      }

      const marker = entry.mesh.getObjectByName('npc_marker');
      if (marker) {
        marker.rotation.y = elapsed * 1.8;
        marker.position.y = 2.45 + Math.sin(elapsed * 3.0 + entry.phase) * 0.1;
      }
    }
  }

  private updateEnemies(dt: number, elapsed: number) {
    for (const enemy of this.enemies) {
      if (enemy.hitFlash > 0) {
        enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
        enemy.rig.body.scale.setScalar(1.06);
      } else {
        enemy.rig.body.scale.setScalar(1.0);
      }

      if (enemy.state === 'ko') {
        enemy.stateTimer -= dt;
        enemy.rig.body.rotation.x = THREE.MathUtils.lerp(enemy.rig.body.rotation.x, Math.PI * 0.48, dt * 8);
        enemy.rig.root.scale.setScalar(Math.max(0.05, enemy.stateTimer / 0.45));
        if (enemy.stateTimer <= 0) {
          // Respawn non-boss enemies after delay or reset
          if (!enemy.isBoss) {
            enemy.hp = enemy.maxHp;
            enemy.x = enemy.homeX;
            enemy.z = enemy.homeZ;
            enemy.y = groundHeightAt(enemy.x, enemy.z);
            enemy.state = 'patrol';
            enemy.rig.body.rotation.x = 0;
            enemy.rig.root.scale.setScalar(1);
          } else {
            enemy.rig.root.visible = false;
          }
        }
        continue;
      }

      const dx = this.px - enemy.x;
      const dz = this.pz - enemy.z;
      const distPlayer = Math.hypot(dx, dz);
      const aggroRange = enemy.isBoss ? 24 : 18;
      const attackRange = enemy.isBoss ? 4.8 : enemy.archetype === 'ember_acolyte' ? 13 : 2.6;

      // Damping knockback
      enemy.vx = THREE.MathUtils.damp(enemy.vx, 0, 8, dt);
      enemy.vz = THREE.MathUtils.damp(enemy.vz, 0, 8, dt);

      const teleMat = enemy.rig.telegraphRing.material as THREE.MeshBasicMaterial;
      teleMat.opacity = 0;

      if (enemy.state === 'patrol') {
        const pAngle = elapsed * 0.45 + enemy.homeX;
        const tx = enemy.homeX + Math.cos(pAngle) * 3.5;
        const tz = enemy.homeZ + Math.sin(pAngle) * 3.5;
        const pdx = tx - enemy.x;
        const pdz = tz - enemy.z;
        const pLen = Math.hypot(pdx, pdz) || 1;
        enemy.x += (pdx / pLen) * 1.4 * dt;
        enemy.z += (pdz / pLen) * 1.4 * dt;
        enemy.yaw = Math.atan2(pdx, pdz);
        if (distPlayer < aggroRange && Math.abs(this.py - enemy.y) < 8) {
          enemy.state = 'chase';
        }
      } else if (enemy.state === 'chase') {
        enemy.yaw = Math.atan2(dx, dz);
        const dirX = dx / (distPlayer || 1);
        const dirZ = dz / (distPlayer || 1);

        if (enemy.archetype === 'ember_acolyte') {
          // Kiter keeps optimal range 9..13m
          if (distPlayer < 8) {
            enemy.x -= dirX * enemy.speed * dt;
            enemy.z -= dirZ * enemy.speed * dt;
          } else if (distPlayer > 13) {
            enemy.x += dirX * enemy.speed * dt;
            enemy.z += dirZ * enemy.speed * dt;
          } else {
            // Strafe
            enemy.x += -dirZ * enemy.speed * 0.7 * dt;
            enemy.z += dirX * enemy.speed * 0.7 * dt;
          }
          if (distPlayer <= attackRange) {
            enemy.state = 'windup';
            enemy.stateTimer = 0.55;
          }
        } else if (enemy.archetype === 'frost_charger') {
          if (distPlayer > 9) {
            enemy.x += dirX * enemy.speed * 0.8 * dt;
            enemy.z += dirZ * enemy.speed * 0.8 * dt;
          } else {
            enemy.state = 'windup';
            enemy.stateTimer = 0.6;
          }
        } else {
          // Stalker, Sentinel, Bosses
          if (distPlayer > attackRange) {
            const sp = enemy.speed * (enemy.phase === 2 ? 1.3 : 1.0);
            enemy.x += dirX * sp * dt;
            enemy.z += dirZ * sp * dt;
          } else {
            enemy.state = 'windup';
            enemy.stateTimer = enemy.isBoss ? 0.65 : 0.45;
          }
        }
        if (distPlayer > aggroRange + 14) enemy.state = 'patrol';
      } else if (enemy.state === 'windup') {
        enemy.stateTimer -= dt;
        teleMat.opacity = 0.72;
        enemy.rig.telegraphRing.scale.setScalar(1 + (1 - Math.max(0, enemy.stateTimer) / 0.65) * 0.4);
        if (enemy.stateTimer <= 0) {
          enemy.state = 'attack';
          enemy.stateTimer = 0.28;
          if (enemy.archetype === 'ember_acolyte') {
            this.spawnProjectile(
              false,
              enemy.x,
              enemy.y + 1.3,
              enemy.z,
              dx,
              this.py + 1.1 - (enemy.y + 1.3),
              dz,
              15,
              enemy.atk,
              '#f97316',
            );
          } else if (enemy.archetype === 'frost_charger') {
            enemy.vx = (dx / (distPlayer || 1)) * 18;
            enemy.vz = (dz / (distPlayer || 1)) * 18;
          }
        }
      } else if (enemy.state === 'attack') {
        enemy.stateTimer -= dt;
        if (enemy.stateTimer <= 0) {
          if (enemy.archetype !== 'ember_acolyte' && distPlayer <= attackRange + 1.4 && this.dodgeTimer <= 0) {
            const shieldActive = this.isBlocking || (this.vitals.aegisShieldTimer ?? 0) > 0;
            const mitigated = this.isBlocking ? Math.round(enemy.atk * 0.3) : enemy.atk;
            this.callbacks.onPlayerDamaged(mitigated);
            this.trauma = Math.min(1, this.trauma + (shieldActive ? 0.18 : 0.38));
            if (shieldActive) {
              gameAudio.playShieldBlock();
              this.spawnShockwave(this.px, this.py + 0.3, this.pz, '#60a5fa', 3.4, 0.35);
              this.emitParticles(this.px, this.py + 1.1, this.pz, '#60a5fa', 12, 4.5);
            } else {
              gameAudio.playHurt();
              this.emitParticles(this.px, this.py + 1.1, this.pz, '#ef4444', 10, 4);
            }
          }
          enemy.state = 'recover';
          enemy.stateTimer = enemy.isBoss && enemy.phase === 2 ? 0.55 : 0.9;
        }
      } else if (enemy.state === 'recover') {
        enemy.stateTimer -= dt;
        if (enemy.stateTimer <= 0) enemy.state = 'chase';
      }

      enemy.x += enemy.vx * dt;
      enemy.z += enemy.vz * dt;
      if (enemy.archetype !== 'boss_celestial_devourer') {
        enemy.y = groundHeightAt(enemy.x, enemy.z);
      }
      enemy.rig.root.position.set(enemy.x, enemy.y, enemy.z);
      enemy.rig.root.rotation.y = enemy.yaw;
      enemy.rig.weakPoint.rotation.y = elapsed * 2.5;
    }
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.mesh.position.set(p.x, p.y, p.z);

      let hit = false;
      if (p.fromPlayer) {
        for (const e of this.enemies) {
          if (e.state === 'ko' || e.hp <= 0) continue;
          const r = e.isBoss ? 2.4 : 1.15;
          if (Math.hypot(e.x - p.x, e.z - p.z) < r && Math.abs(e.y + 1.2 - p.y) < 2.4) {
            this.damageEnemy(e, p.damage, false, false);
            hit = true;
            break;
          }
        }
      } else {
        if (
          this.dodgeTimer <= 0 &&
          Math.hypot(this.px - p.x, this.pz - p.z) < 1.1 &&
          Math.abs(this.py + 1.0 - p.y) < 1.5
        ) {
          const shieldActive = this.isBlocking || (this.vitals.aegisShieldTimer ?? 0) > 0;
          const dmg = this.isBlocking ? Math.round(p.damage * 0.35) : p.damage;
          this.callbacks.onPlayerDamaged(dmg);
          if (shieldActive) {
            gameAudio.playShieldBlock();
            this.spawnShockwave(this.px, this.py + 0.3, this.pz, '#60a5fa', 3.0, 0.32);
            this.emitParticles(this.px, this.py + 1.1, this.pz, '#60a5fa', 10, 4.5);
          } else {
            gameAudio.playHurt();
            this.emitParticles(this.px, this.py + 1.1, this.pz, '#f97316', 10, 4);
          }
          hit = true;
        }
      }

      if (hit || p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
      }
    }
  }

  private updateParticles(dt: number) {
    let any = false;
    for (let i = 0; i < this.particles.length; i++) {
      const s = this.particles[i];
      if (!s.active) continue;
      any = true;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        _mat4.makeTranslation(0, -100, 0);
        this.particleMesh.setMatrixAt(i, _mat4);
        continue;
      }
      s.vy -= 9.8 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      const sc = s.size * (s.life / s.maxLife);
      _scale.set(sc, sc, sc);
      _quat.identity();
      _mat4.compose(_v1.set(s.x, s.y, s.z), _quat, _scale);
      this.particleMesh.setMatrixAt(i, _mat4);
      this.particleMesh.setColorAt(i, s.color);
    }
    if (any) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  private getEquippedArmorCount(): number {
    let count = 0;
    if (this.equipped?.helmet) count++;
    if (this.equipped?.armor) count++;
    if (this.equipped?.leggings) count++;
    if (this.equipped?.boots) count++;
    return count;
  }

  private spawnShockwave(x: number, y: number, z: number, colorHex: string, maxRadius = 4.2, maxLife = 0.42) {
    const slot = this.impactRings[this.impactRingCursor];
    this.impactRingCursor = (this.impactRingCursor + 1) % this.impactRings.length;
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.z = z;
    slot.life = maxLife;
    slot.maxLife = maxLife;
    slot.maxRadius = maxRadius;
    const mat = slot.mesh.material as THREE.MeshBasicMaterial;
    mat.color.set(colorHex);
    mat.opacity = 0.85;
    slot.mesh.position.set(x, y, z);
    slot.mesh.scale.setScalar(0.35);
    slot.mesh.visible = true;
  }

  private updateImpactRings(dt: number) {
    for (const r of this.impactRings) {
      if (!r.active) continue;
      r.life -= dt;
      if (r.life <= 0) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const progress = 1 - r.life / r.maxLife;
      const radius = 0.4 + progress * r.maxRadius;
      r.mesh.scale.setScalar(radius);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.78;
    }
  }

  private updateResourceRespawns(dt: number) {
    for (const node of this.resourceNodes) {
      if (node.respawnTimer > 0) {
        node.respawnTimer -= dt;
        if (node.respawnTimer <= 0) {
          node.hp = node.maxHp;
          node.mesh.visible = true;
        }
      }
    }
  }

  private updateWeatherDrops(dt: number) {
    if (!this.weatherMesh.visible) return;
    const isSnow = this.weather === 'snow';
    const speedMult = isSnow ? 0.25 : 1.0;
    for (let i = 0; i < this.weatherDrops.length; i++) {
      const d = this.weatherDrops[i];
      d.y -= d.vy * speedMult * dt;
      if (d.y < 0) {
        d.y = 22 + Math.random() * 6;
        d.x = this.px + (Math.random() - 0.5) * 44;
        d.z = this.pz + (Math.random() - 0.5) * 44;
      }
      _scale.set(isSnow ? 2.2 : 1, isSnow ? 0.25 : 1.4, isSnow ? 2.2 : 1);
      _quat.identity();
      _mat4.compose(_v1.set(d.x, this.py + d.y - 4, d.z), _quat, _scale);
      this.weatherMesh.setMatrixAt(i, _mat4);
    }
    this.weatherMesh.instanceMatrix.needsUpdate = true;
  }

  private updateBuildGhost() {
    if (!this.buildGhost) return;
    const fx = this.px + Math.sin(this.playerYaw) * 3.8;
    const fz = this.pz + Math.cos(this.playerYaw) * 3.8;
    const fy = getSupportHeightAt(fx, this.py + 1.5, fz);
    this.buildGhost.position.set(Math.round(fx * 2) / 2, fy, Math.round(fz * 2) / 2);
    this.buildGhost.rotation.y = this.buildRotation;
  }

  private updateCamera(dt: number) {
    // Apply smooth inertial angular velocity for 360° orbit camera
    this.camYaw += this.camYawVel * dt;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + this.camPitchVel * dt, -0.35, 1.22);
    const orbDecay = Math.exp(-9.5 * dt);
    this.camYawVel *= orbDecay;
    this.camPitchVel *= orbDecay;

    const isFirstPerson = this.settings.cameraMode === 'first_person' && this.activeMount === 'none';
    this.heroRig.root.visible = !isFirstPerson;

    const shakeAmt = this.trauma * this.trauma * 0.45;
    const shakeX = (Math.random() - 0.5) * shakeAmt;
    const shakeY = (Math.random() - 0.5) * shakeAmt;

    // Speed FOV kick for vehicles/mounts
    const speed = Math.hypot(this.vx, this.vz);
    const targetFov = 58 + THREE.MathUtils.clamp((speed - 8) * 0.7, 0, 14);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, dt);
    this.camera.updateProjectionMatrix();

    if (isFirstPerson) {
      const eyeY = this.py + 1.62;
      this.camPos.set(this.px + shakeX, eyeY + shakeY, this.pz);
      this.camera.position.copy(this.camPos);
      const lookX = this.px - Math.sin(this.camYaw) * Math.cos(this.camPitch) * 10;
      const lookY = eyeY - Math.sin(this.camPitch) * 10;
      const lookZ = this.pz - Math.cos(this.camYaw) * Math.cos(this.camPitch) * 10;
      this.camera.lookAt(lookX, lookY, lookZ);
      return;
    }

    // Smooth 360° Free Orbit / Third-Person damped camera with terrain & wall pull-in
    const anchorY = this.py + 1.55;
    const desiredDist = this.settings.cameraDistance;
    const offX = Math.sin(this.camYaw) * Math.cos(this.camPitch) * desiredDist;
    const offY = Math.sin(this.camPitch) * desiredDist + 1.1;
    const offZ = Math.cos(this.camYaw) * Math.cos(this.camPitch) * desiredDist;

    let actualDist = desiredDist;
    _rayOrigin.set(this.px, anchorY, this.pz);
    _rayDir.set(offX, offY, offZ).normalize();
    this.raycaster.set(_rayOrigin, _rayDir);
    this.raycaster.far = desiredDist;
    const hits = this.raycaster.intersectObjects(this.interactables, true);
    if (hits.length > 0 && hits[0].distance < desiredDist && hits[0].distance > 1.8) {
      actualDist = hits[0].distance - 0.45;
    }

    const ratio = actualDist / desiredDist;
    let camX = this.px + offX * ratio;
    let camY = anchorY + offY * ratio;
    let camZ = this.pz + offZ * ratio;
    const minGround = groundHeightAt(camX, camZ) + 0.85;
    if (camY < minGround) camY = minGround;

    const smoothFactor = Math.max(0.4, this.settings.cameraSmoothness ?? 1.0);
    const damp = 1 - Math.exp(-(15 / smoothFactor) * dt);
    this.camPos.lerp(_v1.set(camX + shakeX, camY + shakeY, camZ), damp);
    this.camTarget.lerp(_v2.set(this.px, anchorY, this.pz), damp);

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
  }

  private updatePopups(dt: number) {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.ttl -= dt;
      p.wy += dt * 1.4;
      if (p.ttl <= 0) {
        this.popups.splice(i, 1);
        continue;
      }
      _v3.set(p.wx, p.wy, p.wz).project(this.camera);
      if (_v3.z >= -1 && _v3.z <= 1) {
        p.x = (_v3.x * 0.5 + 0.5) * w;
        p.y = (-_v3.y * 0.5 + 0.5) * h;
      } else {
        p.x = -9999;
        p.y = -9999;
      }
    }
  }

  private emitHudSnapshot() {
    let nearbyPrompt: HudSnapshot['nearbyPrompt'] = null;
    for (const npc of NPCS) {
      const entry = this.npcMeshes.get(npc.id);
      if (!entry) continue;
      if (Math.hypot(entry.mesh.position.x - this.px, entry.mesh.position.z - this.pz) < 4.5) {
        nearbyPrompt = { kind: 'npc', id: npc.id, label: `Talk to ${npc.name} (${npc.role})` };
        break;
      }
    }
    if (!nearbyPrompt && this.livingWorld) {
      for (const plot of this.livingWorld.farms) {
        if (Math.hypot(plot.x - this.px, plot.z - this.pz) < 4.0) {
          const actionLabel = !plot.crop
            ? 'Plant Crop in Farm Plot'
            : plot.stage === 3
            ? `Harvest Ripe ${plot.crop.replace('_', ' ')}`
            : `Water ${plot.crop.replace('_', ' ')}`;
          nearbyPrompt = { kind: 'farm', id: plot.id, label: actionLabel };
          break;
        }
      }
    }
    if (!nearbyPrompt) {
      for (const node of this.resourceNodes) {
        if (node.respawnTimer > 0) continue;
        if (Math.hypot(node.x - this.px, node.z - this.pz) < 4.2) {
          nearbyPrompt = { kind: 'node', id: node.id, label: `Harvest ${node.templateId.replace('_', ' ')}` };
          break;
        }
      }
    }

    let lockedBoss: HudSnapshot['lockedBoss'] = null;
    for (const e of this.enemies) {
      if (e.isBoss && e.state !== 'ko' && e.hp > 0 && Math.hypot(e.x - this.px, e.z - this.pz) < 34) {
        lockedBoss = { name: e.name, hp: e.hp, maxHp: e.maxHp, phase: e.phase };
        break;
      }
    }

    let nearbyBuilding: HudSnapshot['nearbyBuilding'] = null;
    let bestBDist = 5.5;
    for (const b of this.buildingsData) {
      const bd = Math.hypot(b.x - this.px, b.z - this.pz);
      if (bd < bestBDist) {
        bestBDist = bd;
        nearbyBuilding = { id: b.id, kind: b.kind, tier: b.tier ?? 1 };
      }
    }

    // Project active autonomous NPC thought/chat bubbles into HUD coordinates
    const npcBubbles: NpcBubbleHud[] = [];
    if (this.livingWorld) {
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      for (const npc of NPCS) {
        const agent = this.livingWorld.npcAgents[npc.id];
        if (!agent?.speechBubble || agent.speechTtl <= 0) continue;
        const entry = this.npcMeshes.get(npc.id);
        if (!entry) continue;
        const d = Math.hypot(entry.mesh.position.x - this.px, entry.mesh.position.z - this.pz);
        if (d > 34) continue;
        _v3.set(entry.mesh.position.x, entry.mesh.position.y + 2.75, entry.mesh.position.z).project(this.camera);
        if (_v3.z >= -1 && _v3.z <= 1) {
          const sx = (_v3.x * 0.5 + 0.5) * w;
          const sy = (-_v3.y * 0.5 + 0.5) * h;
          if (sx > 40 && sx < w - 40 && sy > 50 && sy < h - 90) {
            npcBubbles.push({
              id: npc.id,
              name: npc.name,
              text: agent.speechBubble,
              x: sx,
              y: sy,
            });
          }
        }
        if (npcBubbles.length >= 4) break;
      }
    }

    this.callbacks.onHudUpdate({
      biome: getBiomeAt(this.px, this.pz),
      weather: this.weather,
      timeOfDay: this.timeOfDay,
      hp: Math.round(this.vitals.hp),
      maxHp: Math.round(this.vitals.maxHp),
      stamina: Math.round(this.vitals.stamina),
      maxStamina: Math.round(this.vitals.maxStamina),
      mana: Math.round(this.vitals.mana),
      maxMana: Math.round(this.vitals.maxMana),
      hunger: Math.round(this.vitals.hunger),
      thirst: Math.round(this.vitals.thirst),
      temperature: Math.round(this.vitals.temperature),
      qi: Math.round(this.vitals.qi),
      qiRequired: Math.round(this.vitals.qiRequired),
      speed: Math.round(Math.hypot(this.vx, this.vz) * 3.6),
      isMeditating: this.isMeditating,
      isGliding: this.isGliding,
      hasElytra: Boolean(this.equipped?.elytra),
      isMounted: this.activeMount,
      nearbyPrompt,
      nearbyBuilding,
      lockedBoss,
      cooldowns: [...this.skillCooldowns] as [number, number, number, number],
      powerCooldowns: { ...this.powerCooldowns },
      awakeningActive: Boolean(this.vitals.awakeningActive),
      aegisActive: (this.vitals.aegisShieldTimer ?? 0) > 0,
      criticalPulse: this.criticalBeatPulse,
      combatAudioMode: this.currentCombatMode,
      popups: this.popups.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        amount: p.amount,
        isCrit: p.isCrit,
        label: p.label,
      })),
      npcBubbles,
      playerX: this.px,
      playerY: this.py,
      playerZ: this.pz,
      playerYaw: this.playerYaw,
    });
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.resizeObserver?.disconnect();
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
