import React, { useState } from 'react';
import { ELEMENTS, WEAPONS } from '../game/catalog';
import type {
  BodyPreset,
  CharacterCustomization,
  ElementId,
  GenderOption,
  HairStyle,
  OutfitStyle,
  WeaponType,
} from '../game/types';

interface CharacterStudioModalProps {
  character: CharacterCustomization;
  onChange: (next: CharacterCustomization) => void;
  onStudioCameraControl?: (opts: {
    rotateDeltaYaw?: number;
    zoomDelta?: number;
    reset?: boolean;
    toggleAutoRotate?: boolean;
  }) => boolean;
  onClose: () => void;
  onEnterWorld: () => void;
}

const HAIR_COLORS = ['#1e293b', '#f8fafc', '#991b1b', '#ca8a04', '#0284c7', '#7c3aed'];
const SKIN_TONES = ['#fde0c8', '#f1c7a5', '#d9a077', '#a66b47', '#6b422a'];
const EYE_COLORS = ['#38bdf8', '#e8c468', '#ef4444', '#a855f7', '#34d399'];
const OUTFIT_COLORS = ['#1e293b', '#312e81', '#7f1d1d', '#064e3b', '#475569'];

export const CharacterStudioModal: React.FC<CharacterStudioModalProps> = ({
  character,
  onChange,
  onStudioCameraControl,
  onClose,
  onEnterWorld,
}) => {
  const [draft, setDraft] = useState<CharacterCustomization>({ ...character });
  const [autoSpin, setAutoSpin] = useState(true);

  const update = (patch: Partial<CharacterCustomization>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onChange(next);
  };

  return (
    <div className="fixed inset-0 z-40 pointer-events-none flex justify-end p-4 md:p-6">
      {/* Live 360° Turntable Control Dock over Left/Center 3D Viewport */}
      {onStudioCameraControl && (
        <div className="fixed bottom-5 left-4 md:left-8 pointer-events-auto flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-xl bg-[#080c16]/90 border border-[#e8c468]/35 shadow-xl">
          <button
            type="button"
            onClick={() => {
              const nextAuto = onStudioCameraControl({ rotateDeltaYaw: -0.65 });
              setAutoSpin(nextAuto);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100 cursor-pointer"
          >
            ↺ Rotate
          </button>
          <button
            type="button"
            onClick={() => {
              const nextAuto = onStudioCameraControl({ toggleAutoRotate: true });
              setAutoSpin(nextAuto);
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
              autoSpin
                ? 'bg-[#e8c468] text-[#07090f] border-[#e8c468]'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            360° Spin: {autoSpin ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={() => {
              const nextAuto = onStudioCameraControl({ rotateDeltaYaw: 0.65 });
              setAutoSpin(nextAuto);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100 cursor-pointer"
          >
            ↻ Rotate
          </button>
          <button
            type="button"
            onClick={() => onStudioCameraControl({ zoomDelta: -0.45 })}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-sky-300 cursor-pointer"
          >
            Zoom +
          </button>
          <button
            type="button"
            onClick={() => onStudioCameraControl({ zoomDelta: 0.45 })}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-sky-300 cursor-pointer"
          >
            Zoom -
          </button>
          <button
            type="button"
            onClick={() => onStudioCameraControl({ reset: true })}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 cursor-pointer"
          >
            Reset View
          </button>
        </div>
      )}

      {/* Keep left/center open so the user sees and rotates their 3D character live */}
      <div className="pointer-events-auto celestial-panel rounded-xl w-full max-w-md h-full flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
          <div>
            <h2 className="font-display text-lg font-bold text-[#e8c468]">Character Creation Studio</h2>
            <p className="text-xs text-slate-400">Drag 3D canvas or scroll wheel for smooth 360° inspection</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
          {/* Identity */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-slate-400 block mb-1">Traveler Name</span>
              <input
                type="text"
                value={draft.name}
                maxLength={24}
                onChange={(e) => update({ name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#0b101d] border border-slate-700 text-slate-100 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-400 block mb-1">Lineage Title</span>
              <input
                type="text"
                value={draft.title}
                maxLength={24}
                onChange={(e) => update({ title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#0b101d] border border-slate-700 text-slate-100 text-sm"
              />
            </label>
          </div>

          {/* Gender & Body */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-slate-400 block mb-1">Silhouette</span>
              <div className="grid grid-cols-2 gap-1.5">
                {(['male', 'female'] as GenderOption[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => update({ gender: g })}
                    className={`py-2 rounded-lg text-xs font-medium capitalize cursor-pointer border ${
                      draft.gender === g
                        ? 'bg-[#e8c468] text-[#07090f] border-[#e8c468]'
                        : 'bg-slate-900 text-slate-300 border-slate-700'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-400 block mb-1">Physique</span>
              <select
                value={draft.bodyPreset}
                onChange={(e) => update({ bodyPreset: e.target.value as BodyPreset })}
                className="w-full px-3 py-2 rounded-lg bg-[#0b101d] border border-slate-700 text-slate-100 text-xs"
              >
                <option value="athletic">Athletic</option>
                <option value="slender">Slender</option>
                <option value="vanguard">Vanguard</option>
              </select>
            </div>
          </div>

          {/* Hair Style & Color */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Hairstyle</span>
              <select
                value={draft.hairStyle}
                onChange={(e) => update({ hairStyle: e.target.value as HairStyle })}
                className="px-2.5 py-1 rounded bg-[#0b101d] border border-slate-700 text-xs text-slate-100"
              >
                <option value="spiky">Spiky Shinobi</option>
                <option value="flowing">Flowing Mane</option>
                <option value="ponytail">High Ponytail</option>
                <option value="twin_tails">Twin Tails</option>
                <option value="cropped">Cropped Tactical</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              {HAIR_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  aria-label={`Hair color ${hex}`}
                  onClick={() => update({ hairColor: hex })}
                  className={`w-7 h-7 rounded-full border-2 cursor-pointer ${
                    draft.hairColor === hex ? 'border-[#e8c468] scale-110' : 'border-slate-700'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>

          {/* Skin & Eyes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-slate-400 block mb-1.5">Skin Tone</span>
              <div className="flex items-center gap-1.5">
                {SKIN_TONES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Skin tone ${hex}`}
                    onClick={() => update({ skinTone: hex })}
                    className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                      draft.skinTone === hex ? 'border-[#e8c468]' : 'border-slate-700'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-400 block mb-1.5">Eye Resonance</span>
              <div className="flex items-center gap-1.5">
                {EYE_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Eye color ${hex}`}
                    onClick={() => update({ eyeColor: hex })}
                    className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                      draft.eyeColor === hex ? 'border-[#e8c468]' : 'border-slate-700'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Outfit & Cape */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Armor & Vestment</span>
              <select
                value={draft.outfitStyle}
                onChange={(e) => update({ outfitStyle: e.target.value as OutfitStyle })}
                className="px-2.5 py-1 rounded bg-[#0b101d] border border-slate-700 text-xs text-slate-100"
              >
                <option value="shinobi_cloak">Shinobi Cloak</option>
                <option value="celestial_robe">Celestial Robe</option>
                <option value="vanguard_plate">Vanguard Plate</option>
                <option value="abyssal_coat">Abyssal Coat</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {OUTFIT_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Outfit color ${hex}`}
                    onClick={() => update({ outfitColor: hex })}
                    className={`w-6 h-6 rounded border-2 cursor-pointer ${
                      draft.outfitColor === hex ? 'border-[#e8c468]' : 'border-slate-700'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.capeEnabled}
                  onChange={(e) => update({ capeEnabled: e.target.checked })}
                />
                Cape
              </label>
            </div>
          </div>

          {/* Weapon Class */}
          <div>
            <span className="text-xs text-slate-400 block mb-1.5">Primary Weapon Mastery</span>
            <select
              value={draft.weaponType}
              onChange={(e) => update({ weaponType: e.target.value as WeaponType })}
              className="w-full px-3 py-2 rounded-lg bg-[#0b101d] border border-slate-700 text-slate-100 text-xs"
            >
              {Object.values(WEAPONS).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} — {w.style}
                </option>
              ))}
            </select>
          </div>

          {/* Dual Initial Elements */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-slate-400 block mb-1">Primary Element</span>
              <select
                value={draft.primaryElement}
                onChange={(e) => update({ primaryElement: e.target.value as ElementId })}
                className="w-full px-3 py-2 rounded-lg bg-[#0b101d] border border-slate-700 text-slate-100 text-xs"
              >
                {Object.values(ELEMENTS).map((el) => (
                  <option key={el.id} value={el.id}>
                    {el.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-slate-400 block mb-1">Secondary Element</span>
              <select
                value={draft.secondaryElement}
                onChange={(e) => update({ secondaryElement: e.target.value as ElementId })}
                className="w-full px-3 py-2 rounded-lg bg-[#0b101d] border border-slate-700 text-slate-100 text-xs"
              >
                {Object.values(ELEMENTS).map((el) => (
                  <option key={el.id} value={el.id}>
                    {el.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="p-4 border-t border-slate-700/60 flex gap-3">
          <button
            type="button"
            onClick={onEnterWorld}
            className="flex-1 py-3 rounded-lg bg-[#e8c468] hover:bg-[#f3d482] text-[#07090f] font-bold text-sm cursor-pointer"
          >
            Save & Enter Aetheria
          </button>
        </div>
      </div>
    </div>
  );
};
