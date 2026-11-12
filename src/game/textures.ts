import * as THREE from 'three';

export interface ProceduralTextureSet {
  terrainBump: THREE.CanvasTexture;
  stoneMap: THREE.CanvasTexture;
  stoneBump: THREE.CanvasTexture;
  woodMap: THREE.CanvasTexture;
  fabricMap: THREE.CanvasTexture;
  fabricBump: THREE.CanvasTexture;
  metalMap: THREE.CanvasTexture;
  metalBump: THREE.CanvasTexture;
  waterBump: THREE.CanvasTexture;
  soilMap: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  // 1. Terrain micro-relief bump map (linear data space)
  const [tbCanvas, tbCtx] = makeCanvas(256);
  tbCtx.fillStyle = '#808080';
  tbCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3200; i++) {
    const x = (i * 73) % 256;
    const y = (i * 139) % 256;
    const v = 96 + ((i * 29) % 68);
    tbCtx.fillStyle = `rgb(${v},${v},${v})`;
    tbCtx.fillRect(x, y, 3, 3);
  }
  const terrainBump = new THREE.CanvasTexture(tbCanvas);
  terrainBump.wrapS = THREE.RepeatWrapping;
  terrainBump.wrapT = THREE.RepeatWrapping;
  terrainBump.repeat.set(36, 36);
  terrainBump.anisotropy = maxAnisotropy;

  // 2. Ancient masonry stone albedo + bump
  const [sCanvas, sCtx] = makeCanvas(256);
  const [sbCanvas, sbCtx] = makeCanvas(256);
  sCtx.fillStyle = '#57606f';
  sCtx.fillRect(0, 0, 256, 256);
  sbCtx.fillStyle = '#404040';
  sbCtx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 4; row++) {
    const y = row * 64;
    const offset = (row % 2) * 32;
    for (let col = -1; col < 5; col++) {
      const x = col * 64 + offset;
      const shade = 82 + ((row * 17 + col * 31) & 23);
      sCtx.fillStyle = `rgb(${shade}, ${shade + 5}, ${shade + 12})`;
      sCtx.fillRect(x + 2, y + 2, 60, 60);
      sbCtx.fillStyle = `rgb(${155 + (shade % 40)}, ${155 + (shade % 40)}, ${155 + (shade % 40)})`;
      sbCtx.fillRect(x + 3, y + 3, 58, 58);
    }
  }
  const stoneMap = new THREE.CanvasTexture(sCanvas);
  stoneMap.colorSpace = THREE.SRGBColorSpace;
  stoneMap.wrapS = THREE.RepeatWrapping;
  stoneMap.wrapT = THREE.RepeatWrapping;
  stoneMap.anisotropy = maxAnisotropy;

  const stoneBump = new THREE.CanvasTexture(sbCanvas);
  stoneBump.wrapS = THREE.RepeatWrapping;
  stoneBump.wrapT = THREE.RepeatWrapping;
  stoneBump.anisotropy = maxAnisotropy;

  // 3. Timber wood planks
  const [wCanvas, wCtx] = makeCanvas(256);
  wCtx.fillStyle = '#6f4e37';
  wCtx.fillRect(0, 0, 256, 256);
  for (let p = 0; p < 8; p++) {
    const y = p * 32;
    const tone = 96 + ((p * 19) % 24);
    wCtx.fillStyle = `rgb(${tone + 18}, ${tone - 10}, ${tone - 32})`;
    wCtx.fillRect(0, y + 1, 256, 30);
    wCtx.fillStyle = 'rgba(40,24,14,0.25)';
    for (let g = 0; g < 6; g++) {
      wCtx.fillRect(0, y + 4 + g * 4, 256, 1);
    }
  }
  const woodMap = new THREE.CanvasTexture(wCanvas);
  woodMap.colorSpace = THREE.SRGBColorSpace;
  woodMap.wrapS = THREE.RepeatWrapping;
  woodMap.wrapT = THREE.RepeatWrapping;
  woodMap.anisotropy = maxAnisotropy;

  // 4. Woven Cloth / Astral Silk Texture + Bump
  const [fCanvas, fCtx] = makeCanvas(128);
  const [fbCanvas, fbCtx] = makeCanvas(128);
  fCtx.fillStyle = '#e5e7eb';
  fCtx.fillRect(0, 0, 128, 128);
  fbCtx.fillStyle = '#707070';
  fbCtx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 4) {
    for (let x = 0; x < 128; x += 4) {
      const alt = ((x + y) / 4) % 2 === 0;
      fCtx.fillStyle = alt ? 'rgba(255,255,255,0.22)' : 'rgba(15,23,42,0.16)';
      fCtx.fillRect(x, y, 3, 3);
      fbCtx.fillStyle = alt ? '#c2c2c2' : '#585858';
      fbCtx.fillRect(x, y, 3, 3);
    }
  }
  const fabricMap = new THREE.CanvasTexture(fCanvas);
  fabricMap.colorSpace = THREE.SRGBColorSpace;
  fabricMap.wrapS = THREE.RepeatWrapping;
  fabricMap.wrapT = THREE.RepeatWrapping;
  fabricMap.repeat.set(3, 3);
  fabricMap.anisotropy = maxAnisotropy;

  const fabricBump = new THREE.CanvasTexture(fbCanvas);
  fabricBump.wrapS = THREE.RepeatWrapping;
  fabricBump.wrapT = THREE.RepeatWrapping;
  fabricBump.repeat.set(3, 3);
  fabricBump.anisotropy = maxAnisotropy;

  // 5. Brushed Damascus Steel Albedo + Bump
  const [mCanvas, mCtx] = makeCanvas(128);
  const [mbCanvas, mbCtx] = makeCanvas(128);
  mCtx.fillStyle = '#cbd5e1';
  mCtx.fillRect(0, 0, 128, 128);
  mbCtx.fillStyle = '#808080';
  mbCtx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 2) {
    const streak = 185 + Math.round(Math.sin(y * 0.45) * 30);
    mCtx.fillStyle = `rgb(${streak}, ${streak + 6}, ${streak + 14})`;
    mCtx.fillRect(0, y, 128, 1);
    const bv = 110 + ((y * 17) % 45);
    mbCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    mbCtx.fillRect(0, y, 128, 1);
  }
  const metalMap = new THREE.CanvasTexture(mCanvas);
  metalMap.colorSpace = THREE.SRGBColorSpace;
  metalMap.wrapS = THREE.RepeatWrapping;
  metalMap.wrapT = THREE.RepeatWrapping;
  metalMap.anisotropy = maxAnisotropy;

  const metalBump = new THREE.CanvasTexture(mbCanvas);
  metalBump.wrapS = THREE.RepeatWrapping;
  metalBump.wrapT = THREE.RepeatWrapping;
  metalBump.anisotropy = maxAnisotropy;

  // 6. Water Ripple Bump Map
  const [wbCanvas, wbCtx] = makeCanvas(256);
  wbCtx.fillStyle = '#808080';
  wbCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 4) {
    for (let x = 0; x < 256; x += 4) {
      const wave =
        Math.sin(x * 0.098 + y * 0.049) * 34 +
        Math.cos(y * 0.14 - x * 0.049) * 28;
      const v = Math.max(40, Math.min(220, Math.round(128 + wave)));
      wbCtx.fillStyle = `rgb(${v},${v},${v})`;
      wbCtx.fillRect(x, y, 4, 4);
    }
  }
  const waterBump = new THREE.CanvasTexture(wbCanvas);
  waterBump.wrapS = THREE.RepeatWrapping;
  waterBump.wrapT = THREE.RepeatWrapping;
  waterBump.repeat.set(20, 20);
  waterBump.anisotropy = maxAnisotropy;

  // 7. Tilled Farm Soil Texture
  const [soilCanvas, soilCtx] = makeCanvas(128);
  soilCtx.fillStyle = '#4a3222';
  soilCtx.fillRect(0, 0, 128, 128);
  for (let row = 0; row < 8; row++) {
    const y = row * 16;
    soilCtx.fillStyle = '#332014';
    soilCtx.fillRect(0, y, 128, 5);
    soilCtx.fillStyle = '#5e412e';
    soilCtx.fillRect(0, y + 6, 128, 8);
  }
  const soilMap = new THREE.CanvasTexture(soilCanvas);
  soilMap.colorSpace = THREE.SRGBColorSpace;
  soilMap.wrapS = THREE.RepeatWrapping;
  soilMap.wrapT = THREE.RepeatWrapping;
  soilMap.anisotropy = maxAnisotropy;

  // 8. Radial contact shadow disc
  const [cCanvas, cCtx] = makeCanvas(128);
  const grad = cCtx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(4, 7, 15, 0.72)');
  grad.addColorStop(0.55, 'rgba(4, 7, 15, 0.32)');
  grad.addColorStop(1, 'rgba(4, 7, 15, 0)');
  cCtx.fillStyle = grad;
  cCtx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(cCanvas);
  contactShadow.colorSpace = THREE.SRGBColorSpace;

  return {
    terrainBump,
    stoneMap,
    stoneBump,
    woodMap,
    fabricMap,
    fabricBump,
    metalMap,
    metalBump,
    waterBump,
    soilMap,
    contactShadow,
    dispose: () => {
      terrainBump.dispose();
      stoneMap.dispose();
      stoneBump.dispose();
      woodMap.dispose();
      fabricMap.dispose();
      fabricBump.dispose();
      metalMap.dispose();
      metalBump.dispose();
      waterBump.dispose();
      soilMap.dispose();
      contactShadow.dispose();
    },
  };
}
