import type { BiomeId, MountVehicleType } from './types';

export type CombatAudioMode = 'calm' | 'combat' | 'critical';

export interface MusicBeatState {
  mode: CombatAudioMode;
  beatIntensity: number; // 0..1 smooth pulse synced to beat
  stepCount: number;
  justPulsed: boolean;
}

export interface AdaptiveAudioFrame {
  biome: BiomeId;
  hpRatio: number;
  inCombat: boolean;
  bossNearby: boolean;
  bossPhase2: boolean;
  speed: number;
  isGrounded: boolean;
  isFlying: boolean;
  mount: MountVehicleType;
  equippedArmorCount: number;
}

const BIOME_SCALES: Record<BiomeId, number[]> = {
  verdant: [261.63, 293.66, 329.63, 392.0, 440.0, 523.25], // Warm Major Pentatonic
  frostfall: [246.94, 293.66, 329.63, 369.99, 440.0, 493.88], // Crystalline Minor
  ember: [220.0, 233.08, 293.66, 329.63, 349.23, 440.0], // Phrygian Volcanic Tension
  celestial: [293.66, 329.63, 440.0, 493.88, 587.33, 659.25], // Ethereal Celestial
  abyssal: [196.0, 220.0, 233.08, 293.66, 311.13, 392.0], // Dark Dorian
};

class ProceduralAudio {
  private ctx: AudioContext | null = null;
  private muted = false;
  private sfxVolume = 0.7;
  private musicVolume = 0.45;

  // Sequencer & Beat State
  private stepTimer = 0;
  private stepCount = 0;
  private heartbeatTimer = 0;
  private beatIntensity = 0;
  private currentMode: CombatAudioMode = 'calm';
  private justPulsed = false;

  // Continuous Movement Audio Nodes (Wind/Fly & Vehicle Engine)
  private noiseBuffer: AudioBuffer | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;

  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private gallopTimer = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private ensureNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const len = Math.floor(ctx.sampleRate * 1.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.04 * white) / 1.04;
      data[i] = lastOut * 2.8;
    }
    this.noiseBuffer = buf;
    return buf;
  }

  private ensureMovementLoops(ctx: AudioContext) {
    if (!this.windGain) {
      const buf = this.ensureNoiseBuffer(ctx);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 420;
      filter.Q.value = 1.4;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      this.windSource = src;
      this.windFilter = filter;
      this.windGain = gain;
    }

    if (!this.engineGain) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 65;
      const sub = ctx.createOscillator();
      sub.type = 'triangle';
      sub.frequency.value = 32.5;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 260;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      osc.connect(filter);
      sub.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      sub.start();
      this.engineOsc = osc;
      this.engineSubOsc = sub;
      this.engineFilter = filter;
      this.engineGain = gain;
    }
  }

  public setSettings(muted: boolean, sfxVolume: number, musicVolume: number) {
    this.muted = muted;
    this.sfxVolume = sfxVolume;
    this.musicVolume = musicVolume;
    if (muted && this.ctx) {
      const now = this.ctx.currentTime;
      this.windGain?.gain.setTargetAtTime(0.0001, now, 0.05);
      this.engineGain?.gain.setTargetAtTime(0.0001, now, 0.05);
    }
  }

  public getBeatState(): MusicBeatState {
    return {
      mode: this.currentMode,
      beatIntensity: this.beatIntensity,
      stepCount: this.stepCount,
      justPulsed: this.justPulsed,
    };
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainPeak = 0.18,
    isMusic = false,
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    const jitter = isMusic ? 1.0 : 0.94 + Math.random() * 0.12;
    osc.frequency.setValueAtTime(Math.max(32, freqStart * jitter), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(28, freqEnd * jitter), now + duration);

    const scaleVol = isMusic ? this.musicVolume : this.sfxVolume;
    const vol = Math.max(0.0008, gainPeak * scaleVol);
    gain.gain.setValueAtTime(0.0008, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  private playNoiseBurst(
    duration: number,
    filterFreq: number,
    filterType: BiquadFilterType = 'bandpass',
    gainPeak = 0.14,
    q = 1.6,
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.ensureNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.value = q;
    const gain = ctx.createGain();
    const vol = Math.max(0.0008, gainPeak * this.sfxVolume);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  public playArmorClink(intensity = 1.0) {
    // Crisp metallic chain/plate brush
    const k = Math.max(0.3, Math.min(1.5, intensity));
    this.playTone(1380, 980, 0.055, 'triangle', 0.04 * k);
    this.playTone(2150, 1620, 0.04, 'sine', 0.025 * k);
  }

  public playFootstep(biome: BiomeId = 'verdant', isSprinting = false, armorCount = 0) {
    const sprintBoost = isSprinting ? 1.35 : 1.0;
    if (biome === 'frostfall') {
      this.playNoiseBurst(0.075, 1650, 'bandpass', 0.075 * sprintBoost, 2.2);
      this.playTone(155, 80, 0.055, 'triangle', 0.05 * sprintBoost);
    } else if (biome === 'ember' || biome === 'abyssal') {
      this.playTone(175, 72, 0.06, 'triangle', 0.075 * sprintBoost);
      this.playNoiseBurst(0.04, 900, 'highpass', 0.04 * sprintBoost, 1.4);
    } else {
      this.playTone(125, 62, 0.065, 'triangle', 0.07 * sprintBoost);
      this.playNoiseBurst(0.05, 580, 'lowpass', 0.045 * sprintBoost, 1.0);
    }
    if (armorCount > 0) {
      this.playArmorClink(0.35 + armorCount * 0.16 + (isSprinting ? 0.25 : 0));
    }
  }

  public playEquipGear(slotName?: string) {
    if (slotName === 'elytra') {
      this.playWingSpread();
      this.playTone(540, 810, 0.18, 'sine', 0.12);
      return;
    }
    // Leather latch + armor steel clank
    this.playArmorClink(1.1);
    this.playTone(320, 480, 0.11, 'triangle', 0.13);
    setTimeout(() => this.playTone(640, 880, 0.12, 'sine', 0.1), 55);
  }

  public playShieldRaise() {
    this.playTone(280, 460, 0.14, 'triangle', 0.14);
    this.playTone(920, 620, 0.16, 'sine', 0.08);
  }

  public playShieldBlock() {
    // Resonant metallic deflection clang + crystalline ward hum
    this.playTone(980, 420, 0.24, 'square', 0.16);
    this.playTone(1480, 1120, 0.28, 'triangle', 0.14);
    this.playNoiseBurst(0.09, 2400, 'highpass', 0.12, 2.0);
  }

  public playWingSpread() {
    this.playNoiseBurst(0.28, 720, 'bandpass', 0.16, 0.9);
    this.playTone(260, 520, 0.22, 'sine', 0.11);
  }

  public playJump(armorCount = 0) {
    this.playTone(210, 460, 0.15, 'sine', 0.13);
    if (armorCount > 0) this.playArmorClink(0.75);
  }

  public playSlash(isHeavy = false) {
    if (isHeavy) {
      this.playNoiseBurst(0.2, 1200, 'bandpass', 0.14, 1.1);
      this.playTone(340, 92, 0.25, 'sawtooth', 0.18);
      this.playTone(165, 52, 0.28, 'triangle', 0.2);
    } else {
      this.playNoiseBurst(0.11, 1850, 'bandpass', 0.09, 1.5);
      this.playTone(560, 175, 0.13, 'sawtooth', 0.12);
    }
  }

  public playHit(isCrit = false, isHeavy = false) {
    if (isCrit) {
      this.playTone(260, 58, 0.24, 'square', 0.22);
      this.playTone(840, 460, 0.18, 'sine', 0.17);
      this.playNoiseBurst(0.08, 1600, 'highpass', 0.14, 1.8);
    } else if (isHeavy) {
      this.playTone(210, 62, 0.2, 'sawtooth', 0.2);
      this.playNoiseBurst(0.07, 900, 'lowpass', 0.14, 1.2);
    } else {
      this.playTone(195, 74, 0.14, 'triangle', 0.16);
      this.playNoiseBurst(0.05, 1100, 'bandpass', 0.08, 1.5);
    }
  }

  public playSkill(element: string) {
    if (element === 'lightning' || element === 'chakra') {
      this.playTone(720, 240, 0.3, 'sawtooth', 0.18);
      this.playTone(1040, 540, 0.24, 'sine', 0.13);
    } else if (element === 'fire' || element === 'darkness') {
      this.playTone(185, 52, 0.36, 'sawtooth', 0.22);
      this.playNoiseBurst(0.24, 650, 'lowpass', 0.14, 1.0);
    } else {
      this.playTone(430, 680, 0.28, 'sine', 0.16);
    }
  }

  public playAlchemySynth() {
    this.playTone(480, 720, 0.14, 'sine', 0.12);
    setTimeout(() => this.playTone(720, 1080, 0.18, 'triangle', 0.1), 70);
  }

  public playPickup() {
    this.playTone(540, 900, 0.14, 'sine', 0.12);
  }

  public playDodge(armorCount = 0) {
    this.playNoiseBurst(0.12, 950, 'bandpass', 0.1, 1.2);
    this.playTone(340, 140, 0.12, 'triangle', 0.12);
    if (armorCount > 0) this.playArmorClink(0.8);
  }

  public playBreakthrough() {
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99];
    notes.forEach((n, idx) => {
      setTimeout(() => {
        this.playTone(n, n * 1.02, 0.48, 'sine', 0.15);
      }, idx * 75);
    });
  }

  public playHurt() {
    this.playTone(145, 50, 0.22, 'sawtooth', 0.2);
    this.playNoiseBurst(0.08, 600, 'lowpass', 0.12, 1.0);
  }

  public playCriticalWarningStab() {
    this.playTone(110, 82.41, 0.28, 'sawtooth', 0.16, true);
    this.playTone(440, 329.63, 0.22, 'triangle', 0.11, true);
  }

  public tickAdaptiveMusic(dt: number, frame: AdaptiveAudioFrame) {
    this.justPulsed = false;
    this.beatIntensity = Math.max(0, this.beatIntensity - dt * 2.8);

    const isLowHp = frame.hpRatio <= 0.34;
    const isCritical = isLowHp || frame.bossPhase2 || (frame.bossNearby && frame.hpRatio <= 0.58);
    const nextMode: CombatAudioMode = isCritical
      ? 'critical'
      : frame.inCombat || frame.bossNearby
      ? 'combat'
      : 'calm';
    this.currentMode = nextMode;

    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    // 1. Update continuous movement soundscapes (Flying wind / Driving engine / Gallop)
    this.ensureMovementLoops(ctx);
    const now = ctx.currentTime;
    const windTarget =
      frame.isFlying && frame.speed > 1.5
        ? Math.min(0.14, (frame.speed / 28) * 0.14) * this.sfxVolume
        : 0.0001;
    if (this.windGain && this.windFilter) {
      this.windGain.gain.setTargetAtTime(Math.max(0.0001, windTarget), now, 0.08);
      this.windFilter.frequency.setTargetAtTime(360 + Math.min(1800, frame.speed * 58), now, 0.08);
    }

    const isVehicleEngine =
      frame.mount === 'omega_m4_coupe' || frame.mount === 'astral_skiff';
    if (this.engineGain && this.engineOsc && this.engineSubOsc && this.engineFilter) {
      if (isVehicleEngine) {
        const rpmRatio = Math.min(1, frame.speed / 26);
        const baseFreq = frame.mount === 'omega_m4_coupe' ? 56 + rpmRatio * 96 : 82 + rpmRatio * 65;
        this.engineOsc.type = frame.mount === 'omega_m4_coupe' ? 'sawtooth' : 'sine';
        this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.06);
        this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.06);
        this.engineFilter.frequency.setTargetAtTime(190 + rpmRatio * 680, now, 0.06);
        this.engineGain.gain.setTargetAtTime(
          Math.max(0.0001, (0.045 + rpmRatio * 0.07) * this.sfxVolume),
          now,
          0.08,
        );
      } else {
        this.engineGain.gain.setTargetAtTime(0.0001, now, 0.08);
      }
    }

    // Hoof gallop / flying dragon wing flaps when mounted
    if (frame.speed > 2.5 && (frame.mount === 'horse' || frame.mount === 'dragon')) {
      this.gallopTimer += dt * (1 + frame.speed * 0.08);
      const interval = frame.mount === 'horse' ? 0.38 : 0.72;
      if (this.gallopTimer >= interval) {
        this.gallopTimer = 0;
        if (frame.mount === 'horse') {
          this.playTone(135, 72, 0.055, 'triangle', 0.075);
          setTimeout(() => this.playTone(115, 64, 0.05, 'triangle', 0.06), 75);
        } else {
          this.playNoiseBurst(0.24, 340, 'lowpass', 0.11, 0.9);
        }
      }
    }

    // 2. Heartbeat double-thump during Critical Low-HP situations
    if (isLowHp) {
      this.heartbeatTimer += dt;
      if (this.heartbeatTimer >= 0.72) {
        this.heartbeatTimer = 0;
        this.playTone(62, 40, 0.14, 'sine', 0.22);
        setTimeout(() => this.playTone(54, 36, 0.16, 'sine', 0.18), 160);
      }
    } else {
      this.heartbeatTimer = 0.5;
    }

    // 3. Adaptive Music Sequencer
    if (this.musicVolume <= 0.02) return;
    const stepInterval = nextMode === 'critical' ? 0.21 : nextMode === 'combat' ? 0.31 : 1.15;
    this.stepTimer += dt;
    if (this.stepTimer < stepInterval) return;

    this.stepTimer = 0;
    this.stepCount += 1;
    const scale = BIOME_SCALES[frame.biome] ?? BIOME_SCALES.verdant;
    const step = this.stepCount;

    if (nextMode === 'calm') {
      if (step % 2 === 0) {
        const padFreq = scale[(step >> 1) % scale.length] * 0.5;
        this.playTone(padFreq, padFreq * 1.004, 2.8, 'sine', 0.055, true);
      }
      if (step % 3 === 0) {
        const chime = scale[(step * 2) % scale.length];
        this.playTone(chime, chime, 1.4, 'triangle', 0.035, true);
      }
      this.beatIntensity = 0.25;
      return;
    }

    // Combat or Critical Battle Ostinato
    this.beatIntensity = nextMode === 'critical' ? 1.0 : 0.72;
    this.justPulsed = true;

    const root = scale[0] * 0.5;
    const arpPattern =
      nextMode === 'critical' ? [0, 2, 4, 5, 3, 2, 5, 1] : [0, 2, 3, 4, 2, 3, 5, 0];
    const arpNote = scale[arpPattern[step % arpPattern.length]];

    // Driving bass pulse every 2 steps (or every step in critical downbeat)
    if (step % 2 === 0) {
      const bassMult = nextMode === 'critical' && step % 4 === 2 ? 1.122 : 1.0; // tense minor-second shift
      this.playTone(root * bassMult * 0.5, root * bassMult * 0.48, 0.22, 'sawtooth', 0.11, true);
    }

    // Percussion pulse (kick + crisp hi-hat/snare)
    if (step % 2 === 0) {
      this.playTone(95, 38, 0.11, 'sine', nextMode === 'critical' ? 0.16 : 0.11, true);
    } else if (nextMode === 'critical' || step % 4 === 3) {
      this.playNoiseBurst(0.055, 2200, 'highpass', 0.045 * (this.musicVolume / Math.max(0.1, this.sfxVolume)), 1.4);
    }

    // Battle lead arpeggio
    this.playTone(
      arpNote,
      arpNote * 0.995,
      nextMode === 'critical' ? 0.18 : 0.24,
      nextMode === 'critical' ? 'sawtooth' : 'triangle',
      nextMode === 'critical' ? 0.095 : 0.07,
      true,
    );

    // Heroic / Critical orchestral brass chord stab on bar downbeats
    if (nextMode === 'critical' && step % 8 === 0) {
      this.playTone(scale[0], scale[0], 0.52, 'sawtooth', 0.09, true);
      this.playTone(scale[2], scale[2], 0.52, 'triangle', 0.075, true);
    }
  }
}

export const gameAudio = new ProceduralAudio();
