import React, { useState } from 'react';
import { ArrowLeftRight, Feather, Shield, Sword } from 'lucide-react';
import { CRAFTING_RECIPES, ITEM_TEMPLATES } from '../game/catalog';
import { computeTotalDefense, countTemplateInInventory } from '../game/rules';
import type {
  EquipmentSlot,
  InventoryItem,
  ItemRarity,
  SaveDataV1,
} from '../game/types';

interface InventoryCraftingModalProps {
  inventory: (InventoryItem | null)[];
  storage: (InventoryItem | null)[];
  equipped: SaveDataV1['equipped'];
  vitalityRank?: number;
  martialRank?: number;
  fortuneRank?: number;
  onSwapSlots: (fromIdx: number, toIdx: number) => void;
  onSortInventory: () => void;
  onUseOrEquip: (slotIdx: number) => void;
  onEquipToSlot: (slotIdx: number, targetSlot: EquipmentSlot) => void;
  onSwapHands: () => void;
  onTransferToStorage: (slotIdx: number) => void;
  onRetrieveFromStorage: (storageIdx: number) => void;
  onUnequip: (slot: EquipmentSlot) => void;
  onCraft: (recipeId: string) => void;
  onClose: () => void;
}

const RARITY_BORDER: Record<ItemRarity, string> = {
  common: 'border-slate-600/80 text-slate-200',
  uncommon: 'border-emerald-500/70 text-emerald-300',
  rare: 'border-sky-500/80 text-sky-300',
  epic: 'border-violet-500/85 text-violet-300',
  mythic: 'border-amber-500/90 text-amber-300',
  celestial: 'border-yellow-300 text-yellow-200',
};

const EQUIPMENT_SLOTS: {
  slot: EquipmentSlot;
  label: string;
  hint: string;
}[] = [
  { slot: 'helmet', label: 'Helmet', hint: 'Head' },
  { slot: 'armor', label: 'Chestplate', hint: 'Torso' },
  { slot: 'leggings', label: 'Leggings', hint: 'Legs' },
  { slot: 'boots', label: 'Boots', hint: 'Feet' },
  { slot: 'elytra', label: 'Elytra Wings', hint: 'Glide (Space)' },
  { slot: 'weapon', label: 'Main Hand', hint: 'Left-Click / J' },
  { slot: 'offHand', label: 'Off-Hand', hint: 'Key G' },
  { slot: 'accessory', label: 'Accessory', hint: 'Quiver / Charm' },
];

export const InventoryCraftingModal: React.FC<InventoryCraftingModalProps> = ({
  inventory,
  storage,
  equipped,
  vitalityRank = 0,
  martialRank = 0,
  fortuneRank = 0,
  onSwapSlots,
  onSortInventory,
  onUseOrEquip,
  onEquipToSlot,
  onSwapHands,
  onTransferToStorage,
  onRetrieveFromStorage,
  onUnequip,
  onCraft,
  onClose,
}) => {
  const [tab, setTab] = useState<'backpack' | 'crafting' | 'storage'>('backpack');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [craftFilter, setCraftFilter] = useState<string>('All');

  const selectedItem = selectedIdx !== null ? inventory[selectedIdx] : null;
  const filteredRecipes =
    craftFilter === 'All'
      ? CRAFTING_RECIPES
      : CRAFTING_RECIPES.filter((r) => r.category === craftFilter);

  const totalDef = computeTotalDefense(equipped, vitalityRank);
  const mainAtk = equipped.weapon?.stats?.attack ?? 0;
  const offAtk = equipped.offHand?.stats?.attack ?? 0;
  const totalAtk = Math.round((mainAtk + offAtk * 0.7) * (1 + martialRank * 0.08));
  const glideSpeed = equipped.elytra?.stats?.glideSpeed ?? 0;
  const critBonus = (equipped.accessory?.stats?.critBonus ?? 0) + fortuneRank * 2;

  const canEquipOffHand =
    selectedItem &&
    (selectedItem.category === 'weapon' ||
      selectedItem.category === 'shield' ||
      selectedItem.category === 'tool' ||
      selectedItem.category === 'consumable');

  const renderSlotButton = (item: InventoryItem | null, idx: number, isHotbar: boolean) => (
    <button
      key={idx}
      type="button"
      draggable={Boolean(item)}
      onDragStart={() => setDragIdx(idx)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => {
        if (dragIdx !== null) {
          onSwapSlots(dragIdx, idx);
          setDragIdx(null);
        }
      }}
      onClick={() => setSelectedIdx(idx)}
      className={`h-16 rounded-lg p-1.5 border text-left flex flex-col justify-between transition-colors cursor-pointer bg-[#0a0f1c] relative ${
        item ? RARITY_BORDER[item.rarity] : 'border-slate-800/80 text-slate-600'
      } ${selectedIdx === idx ? 'ring-2 ring-[#e8c468]' : ''} ${
        isHotbar ? 'border-b-2 border-b-[#e8c468]/50' : ''
      }`}
    >
      {isHotbar && (
        <span className="font-mono-num text-[9px] text-[#e8c468]/80 leading-none">
          H{idx + 1}
        </span>
      )}
      {item ? (
        <>
          <span className="text-[10px] sm:text-[11px] font-medium leading-tight line-clamp-2">
            {item.name}
          </span>
          <span className="font-mono-num text-[10px] text-slate-400 self-end">
            x{item.quantity}
          </span>
        </>
      ) : (
        <span className="text-[10px] m-auto opacity-30">{isHotbar ? '' : 'Empty'}</span>
      )}
    </button>
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3 sm:p-4">
      <div className="celestial-panel rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-700/60">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#e8c468]">
              Adventurer Loadout & Crafting
            </h2>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0b101d] border border-slate-700/60">
              {(['backpack', 'crafting', 'storage'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`px-3 py-1 rounded text-xs font-medium capitalize cursor-pointer ${
                    tab === t ? 'bg-[#e8c468] text-[#07090f]' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {t === 'storage' ? 'Chest Storage' : t === 'backpack' ? 'Loadout & Bag' : t}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {tab === 'backpack' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* LEFT: Minecraft Paperdoll & Dual-Handed + Elytra Slots */}
              <div className="lg:col-span-5 space-y-3">
                <div className="celestial-surface rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#e8c468]">
                      Minecraft-Style Equipment Paperdoll
                    </h3>
                    <button
                      type="button"
                      onClick={onSwapHands}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] text-[#38bdf8] cursor-pointer"
                      title="Swap Main Hand and Off-Hand (Shortcut: F)"
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      <span>Swap Hands [F]</span>
                    </button>
                  </div>

                  {/* Live Combat / Glide Summary */}
                  <div className="grid grid-cols-4 gap-1.5 text-center font-mono-num text-[11px]">
                    <div className="rounded bg-[#090d16] border border-slate-800 py-1.5 px-1">
                      <div className="text-[9px] text-slate-400">ATK</div>
                      <div className="font-bold text-amber-300">{totalAtk}</div>
                    </div>
                    <div className="rounded bg-[#090d16] border border-slate-800 py-1.5 px-1">
                      <div className="text-[9px] text-slate-400">DEF</div>
                      <div className="font-bold text-sky-300">{totalDef}</div>
                    </div>
                    <div className="rounded bg-[#090d16] border border-slate-800 py-1.5 px-1">
                      <div className="text-[9px] text-slate-400">CRIT</div>
                      <div className="font-bold text-emerald-300">+{critBonus}%</div>
                    </div>
                    <div className="rounded bg-[#090d16] border border-slate-800 py-1.5 px-1">
                      <div className="text-[9px] text-slate-400">ELYTRA</div>
                      <div className="font-bold text-cyan-300">
                        {glideSpeed > 0 ? `${glideSpeed}m/s` : 'Off'}
                      </div>
                    </div>
                  </div>

                  {/* Armor + Elytra + Dual-Hand Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {EQUIPMENT_SLOTS.map(({ slot, label, hint }) => {
                      const eq = equipped[slot];
                      return (
                        <div
                          key={slot}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (dragIdx !== null) {
                              onEquipToSlot(dragIdx, slot);
                              setDragIdx(null);
                            }
                          }}
                          className={`rounded-lg p-2.5 border bg-[#090d16] flex flex-col justify-between min-h-[68px] transition-colors ${
                            eq
                              ? RARITY_BORDER[eq.rarity]
                              : slot === 'elytra'
                              ? 'border-cyan-800/60 border-dashed text-slate-500'
                              : 'border-slate-800 text-slate-500'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="uppercase tracking-wider text-slate-400 flex items-center gap-1">
                              {slot === 'elytra' && <Feather className="w-3 h-3 text-cyan-400" />}
                              {slot === 'weapon' && <Sword className="w-3 h-3 text-amber-400" />}
                              {slot === 'offHand' && <Shield className="w-3 h-3 text-sky-400" />}
                              {label}
                            </span>
                            <span className="text-[9px] text-slate-500">{hint}</span>
                          </div>
                          {eq ? (
                            <div className="flex items-center justify-between gap-1 mt-1">
                              <span className="text-xs font-semibold text-slate-100 truncate">
                                {eq.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => onUnequip(slot)}
                                className="text-[10px] text-amber-300 hover:underline shrink-0 cursor-pointer"
                              >
                                Unequip
                              </button>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-600 mt-1">Drop or Equip</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Drag items onto any gear slot above to equip. Equipping an Elytra lets you press{' '}
                    <strong className="text-sky-300">Space</strong> mid-air to glide across valleys!
                  </p>
                </div>

                {/* Selected Item Inspector */}
                <div className="celestial-surface rounded-xl p-4 min-h-[145px] flex flex-col justify-between">
                  {selectedItem ? (
                    <>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm text-slate-100">
                            {selectedItem.name}
                          </span>
                          <span className="text-[11px] capitalize text-[#e8c468]">
                            {selectedItem.rarity} · {selectedItem.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mb-3">{selectedItem.description}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(selectedItem.category === 'consumable' ||
                          selectedItem.category === 'weapon' ||
                          selectedItem.category === 'armor' ||
                          selectedItem.category === 'elytra' ||
                          selectedItem.category === 'shield' ||
                          selectedItem.category === 'tool' ||
                          selectedItem.category === 'ammo' ||
                          selectedItem.category === 'core' ||
                          selectedItem.category === 'building') && (
                          <button
                            type="button"
                            onClick={() => onUseOrEquip(selectedIdx!)}
                            className="flex-1 py-2 px-3 rounded bg-[#e8c468] hover:bg-[#f3d482] text-[#07090f] text-xs font-bold cursor-pointer"
                          >
                            {selectedItem.category === 'building'
                              ? 'Select to Build'
                              : selectedItem.category === 'consumable' || selectedItem.category === 'core'
                              ? 'Use'
                              : 'Equip'}
                          </button>
                        )}
                        {canEquipOffHand && (
                          <button
                            type="button"
                            onClick={() => onEquipToSlot(selectedIdx!, 'offHand')}
                            className="py-2 px-3 rounded bg-sky-700 hover:bg-sky-600 text-white text-xs font-bold cursor-pointer"
                          >
                            Off-Hand
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onTransferToStorage(selectedIdx!)}
                          className="py-2 px-3 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
                        >
                          Store
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500 m-auto text-center">
                      Click or drag any item in your Backpack or Quick Hotbar to inspect, equip to Main/Off-Hand, equip Armor/Elytra, or store.
                    </p>
                  )}
                </div>
              </div>

              {/* RIGHT: 21 Backpack Slots + 9-Slot Quick Hotbar */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Main Backpack (Slots 10–30 · Drag to rearrange or drop on Equipment)
                  </span>
                  <button
                    type="button"
                    onClick={onSortInventory}
                    className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-[#38bdf8] cursor-pointer"
                  >
                    Sort by Rarity
                  </button>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {inventory.slice(9, 30).map((item, offset) => renderSlotButton(item, offset + 9, false))}
                </div>

                <div className="pt-2 border-t border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#e8c468]">
                      Quick Action Hotbar (Slots H1–H9 · Accessible on HUD)
                    </span>
                    <span className="text-[11px] text-slate-400">Drag items here for fast HUD access</span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5">
                    {inventory.slice(0, 9).map((item, idx) => renderSlotButton(item, idx, true))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'crafting' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {['All', 'Potions & Food', 'Weapons & Armor', 'Cultivation', 'Building'].map(
                  (cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCraftFilter(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border ${
                        craftFilter === cat
                          ? 'bg-[#38bdf8] text-[#07090f] border-[#38bdf8]'
                          : 'bg-[#0b101d] text-slate-300 border-slate-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ),
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredRecipes.map((rec) => {
                  const outTpl = ITEM_TEMPLATES[rec.outputTemplateId];
                  const canCraft = rec.ingredients.every(
                    (ing) => countTemplateInInventory(inventory, ing.templateId) >= ing.qty,
                  );
                  return (
                    <div
                      key={rec.id}
                      className="celestial-surface rounded-lg p-4 flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-100">
                          {outTpl.name}{' '}
                          <span className="font-mono-num text-xs text-[#e8c468]">x{rec.outputQty}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {rec.ingredients
                            .map((ing) => {
                              const have = countTemplateInInventory(inventory, ing.templateId);
                              return `${ITEM_TEMPLATES[ing.templateId]?.name ?? ing.templateId} (${have}/${ing.qty})`;
                            })
                            .join(' · ')}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!canCraft}
                        onClick={() => onCraft(rec.id)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold shrink-0 cursor-pointer ${
                          canCraft
                            ? 'bg-[#e8c468] hover:bg-[#f3d482] text-[#07090f]'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        Craft
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'storage' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Homestead Expandable Chest (30 Slots) — click any stored item to withdraw it to your backpack.
              </p>
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                {storage.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={!item}
                    onClick={() => item && onRetrieveFromStorage(idx)}
                    className={`h-16 rounded-lg p-1.5 border text-left flex flex-col justify-between bg-[#0a0f1c] ${
                      item
                        ? `${RARITY_BORDER[item.rarity]} cursor-pointer hover:bg-slate-800/60`
                        : 'border-slate-800/70 text-slate-600'
                    }`}
                  >
                    {item ? (
                      <>
                        <span className="text-[11px] font-medium leading-tight line-clamp-2">
                          {item.name}
                        </span>
                        <span className="font-mono-num text-[10px] text-slate-400 self-end">
                          x{item.quantity}
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] m-auto opacity-30">Empty</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
