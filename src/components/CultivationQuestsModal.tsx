import React, { useState } from 'react';
import {
  ASCENSION_POWERS_META,
  CULTIVATION_REALMS,
  ELEMENTS,
  QUESTS,
  SKILL_UPGRADE_META,
} from '../game/catalog';
import type {
  AchievementState,
  AscensionPowerId,
  ElementId,
  PlayerVitals,
  QuestProgress,
  SkillUpgrades,
} from '../game/types';

interface CultivationQuestsModalProps {
  vitals: PlayerVitals;
  quests: Record<string, QuestProgress>;
  achievements: AchievementState[];
  onMeditateTick: () => void;
  onBreakthrough: () => void;
  onUnlockElement: (el: ElementId) => void;
  onUpgradeSkill: (key: keyof SkillUpgrades) => void;
  onUpgradeElement: (el: ElementId) => void;
  onUpgradePower: (powerId: AscensionPowerId) => void;
  onSetActiveSkillBar: (slotIdx: 0 | 1 | 2, el: ElementId) => void;
  onCastPower?: (powerId: AscensionPowerId) => void;
  onSelectQuestChoice: (questId: string, choiceId: string) => void;
  onClaimQuest: (questId: string) => void;
  onClose: () => void;
}

export const CultivationQuestsModal: React.FC<CultivationQuestsModalProps> = ({
  vitals,
  quests,
  achievements,
  onMeditateTick,
  onBreakthrough,
  onUnlockElement,
  onUpgradeSkill,
  onUpgradeElement,
  onUpgradePower,
  onSetActiveSkillBar,
  onCastPower,
  onSelectQuestChoice,
  onClaimQuest,
  onClose,
}) => {
  const [tab, setTab] = useState<
    'cultivation' | 'skills' | 'elements' | 'quests' | 'achievements'
  >('cultivation');
  const currentRealm = CULTIVATION_REALMS[vitals.cultivationRealm];
  const nextRealm = CULTIVATION_REALMS[vitals.cultivationRealm + 1];
  const skillPts = vitals.skillPoints ?? 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3 sm:p-4">
      <div className="celestial-panel rounded-xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-700/60">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#e8c468]">
              Cultivation & Power Upgrades
            </h2>
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#0b101d] border border-slate-700/60">
              {(
                [
                  ['cultivation', 'Cultivation'],
                  ['skills', skillPts > 0 ? `Power & Skills (${skillPts})` : 'Power & Skills'],
                  ['elements', 'Elements'],
                  ['quests', 'Quests'],
                  ['achievements', 'Achievements'],
                ] as const
              ).map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${
                    tab === t ? 'bg-[#e8c468] text-[#07090f]' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {label}
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

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {tab === 'cultivation' && (
            <div className="space-y-6">
              <div className="celestial-surface rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-400">Current Realm</div>
                  <div className="font-display text-2xl font-bold" style={{ color: currentRealm.auraColor }}>
                    {currentRealm.name}
                  </div>
                  <div className="text-xs text-slate-300 mt-1">{currentRealm.unlockNote}</div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-right mr-2">
                    <div className="font-mono-num text-sm text-[#38bdf8]">
                      Qi: {Math.round(vitals.qi)} / {vitals.qiRequired}
                    </div>
                    <div className="font-mono-num text-xs text-[#e8c468]">
                      Astral Cores: {vitals.astralCores} · Skill Pts: {skillPts}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onMeditateTick}
                    className="px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer"
                  >
                    Channel Qi (+25)
                  </button>
                  <button
                    type="button"
                    disabled={!nextRealm}
                    onClick={onBreakthrough}
                    className="px-4 py-2.5 rounded-lg bg-[#e8c468] hover:bg-[#f3d482] text-[#07090f] text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {nextRealm ? `Breakthrough → ${nextRealm.name}` : 'Max Realm Reached'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {CULTIVATION_REALMS.map((realm) => {
                  const unlocked = vitals.cultivationRealm >= realm.id;
                  return (
                    <div
                      key={realm.id}
                      className={`rounded-lg p-3.5 border ${
                        unlocked
                          ? 'bg-[#0f172a] border-[#e8c468]/50'
                          : 'bg-[#090d16] border-slate-800 opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-mono-num text-slate-400">Stage {realm.id + 1}</span>
                        <span style={{ color: realm.auraColor }}>
                          {unlocked ? 'Ascended' : `${realm.coresRequired} Cores`}
                        </span>
                      </div>
                      <div className="font-semibold text-sm text-slate-100">{realm.name}</div>
                      <div className="text-[11px] text-slate-400 mt-1">{realm.unlockNote}</div>
                      <div className="font-mono-num text-[11px] text-[#38bdf8] mt-2">
                        +{realm.hpBonus} HP · {realm.atkMultiplier.toFixed(2)}x Power
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'skills' && (
            <div className="space-y-6">
              <div className="celestial-surface rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-sm text-[#e8c468]">
                    Omega Ascension Powers & Skill Tree
                  </h3>
                  <p className="text-xs text-slate-400">
                    Upgrade passive attributes, empower Active Ascension Powers, and bind any unlocked element to hotkeys [1] [2] [3].
                  </p>
                </div>
                <div className="px-4 py-2 rounded-lg bg-[#090d16] border border-[#e8c468]/50 font-mono-num text-sm font-bold text-[#e8c468]">
                  Available Skill Points: {skillPts}
                </div>
              </div>

              {/* Active Ascension Powers (Rank I - V) */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-amber-300">
                  Active Ascension Powers (Press [R] in combat or trigger below)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ASCENSION_POWERS_META.map((pw) => {
                    const rank = vitals.powerRanks?.[pw.id] ?? 1;
                    const maxed = rank >= pw.maxRank;
                    return (
                      <div
                        key={pw.id}
                        className="celestial-surface rounded-lg p-4 flex flex-col justify-between gap-3 border border-slate-700/70"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm" style={{ color: pw.color }}>
                              {pw.name}
                            </span>
                            <span className="font-mono-num text-xs text-[#e8c468]">
                              Rank {rank} / {pw.maxRank}
                            </span>
                          </div>
                          <div className="text-[11px] text-sky-300 mt-0.5">
                            {pw.hotkey} · {pw.manaCost} Mana · {pw.cooldown}s CD
                          </div>
                          <p className="text-xs text-slate-300 mt-1">{pw.desc}</p>
                          <div className="text-[11px] text-emerald-300 mt-1">{pw.scalingNote}</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={maxed || skillPts < 1}
                            onClick={() => onUpgradePower(pw.id)}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                              !maxed && skillPts >= 1
                                ? 'bg-[#e8c468] hover:bg-[#f3d482] text-[#07090f]'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            {maxed ? 'Max Rank V' : 'Upgrade Power (1 SP)'}
                          </button>
                          {onCastPower && (
                            <button
                              type="button"
                              onClick={() => {
                                onCastPower(pw.id);
                                onClose();
                              }}
                              className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer"
                            >
                              Cast
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3-Slot Active Skill Bar Selector */}
              <div className="celestial-surface rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-sm text-[#38bdf8]">
                  Active Elemental Skill Bar ([1] [2] [3] Loadout)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {([0, 1, 2] as const).map((slotIdx) => {
                    const currentEl =
                      vitals.activeSkillBar?.[slotIdx] ??
                      vitals.unlockedElements[slotIdx] ??
                      vitals.unlockedElements[0];
                    return (
                      <label key={slotIdx} className="block bg-[#090d16] rounded-lg p-3 border border-slate-800">
                        <span className="text-xs text-slate-400 block mb-1.5">
                          Hotkey [{slotIdx + 1}] Skill
                        </span>
                        <select
                          value={currentEl}
                          onChange={(e) => onSetActiveSkillBar(slotIdx, e.target.value as ElementId)}
                          className="w-full px-2.5 py-1.5 rounded bg-[#0b101d] border border-slate-700 text-xs text-slate-100"
                        >
                          {vitals.unlockedElements.map((elId) => (
                            <option key={elId} value={elId}>
                              {ELEMENTS[elId].name} — {ELEMENTS[elId].abilityName}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 8 Passive Core Upgrades */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-[#e8c468]">
                  Passive Lineage & Combat Attributes
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {SKILL_UPGRADE_META.map((sk) => {
                    const rank = vitals.skillUpgrades?.[sk.key] ?? 0;
                    const maxed = rank >= sk.maxRank;
                    return (
                      <div
                        key={sk.key}
                        className="celestial-surface rounded-lg p-4 flex flex-col justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm text-slate-100">{sk.name}</span>
                            <span className="font-mono-num text-xs text-[#38bdf8]">
                              Rank {rank} / {sk.maxRank}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#e8c468] mt-0.5">{sk.perRank}</div>
                          <p className="text-xs text-slate-400 mt-1">{sk.desc}</p>
                          <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden mt-2.5">
                            <div
                              className="h-full bg-[#e8c468]"
                              style={{ width: `${(rank / sk.maxRank) * 100}%` }}
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={maxed || skillPts < 1}
                          onClick={() => onUpgradeSkill(sk.key)}
                          className={`py-2 rounded-lg text-xs font-bold cursor-pointer ${
                            !maxed && skillPts >= 1
                              ? 'bg-[#e8c468] hover:bg-[#f3d482] text-[#07090f]'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {maxed ? 'Max Rank Reached' : 'Upgrade (+1 Skill Point)'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-700/60 pt-4 space-y-3">
                <h3 className="font-semibold text-sm text-[#38bdf8]">
                  Elemental Arts Mastery Ranks (+15% Elemental Damage per Rank)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {vitals.unlockedElements.map((elId) => {
                    const el = ELEMENTS[elId];
                    const rank = vitals.elementRanks?.[elId] ?? 1;
                    const maxed = rank >= 5;
                    return (
                      <div
                        key={elId}
                        className="celestial-surface rounded-lg p-3.5 flex flex-col justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold" style={{ color: el.color }}>
                              {el.name}
                            </span>
                            <span className="font-mono-num text-slate-300">Rank {rank}/5</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{el.abilityName}</div>
                        </div>
                        <button
                          type="button"
                          disabled={maxed || skillPts < 1}
                          onClick={() => onUpgradeElement(elId)}
                          className={`py-1.5 rounded text-xs font-bold cursor-pointer ${
                            !maxed && skillPts >= 1
                              ? 'bg-[#38bdf8] hover:bg-sky-300 text-[#07090f]'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {maxed ? 'Master Rank V' : 'Empower (1 SP)'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'elements' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Initial 2 elements are harmonized at creation. Reach higher cultivation realms or spend Astral Cores to unlock all 8 elemental arts.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.values(ELEMENTS).map((el) => {
                  const unlocked = vitals.unlockedElements.includes(el.id);
                  return (
                    <div
                      key={el.id}
                      className="celestial-surface rounded-lg p-4 flex items-start justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm" style={{ color: el.color }}>
                            {el.name}
                          </span>
                          <span className="text-xs text-slate-400">· {el.abilityName}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{el.abilityDesc}</p>
                        <div className="font-mono-num text-[11px] text-slate-300 mt-2">
                          Power {el.power} · {el.manaCost} Mana · {el.cooldown}s CD
                        </div>
                      </div>
                      {!unlocked ? (
                        <button
                          type="button"
                          onClick={() => onUnlockElement(el.id)}
                          className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-[#e8c468] shrink-0 cursor-pointer"
                        >
                          Unlock (1 Core)
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-400 font-medium shrink-0">Mastered</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'quests' && (
            <div className="space-y-3">
              {QUESTS.map((q) => {
                const prog = quests[q.id] ?? { questId: q.id, status: 'available', progress: 0 };
                const readyToClaim = prog.status !== 'completed' && prog.progress >= q.targetCount;
                return (
                  <div key={q.id} className="celestial-surface rounded-lg p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] uppercase tracking-wider text-[#38bdf8] mr-2">
                          Chapter {q.chapter} · {q.type}
                        </span>
                        <span className="font-semibold text-sm text-slate-100">{q.title}</span>
                      </div>
                      <span className="font-mono-num text-xs text-[#e8c468]">
                        {Math.min(prog.progress, q.targetCount)} / {q.targetCount}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{q.description}</p>
                    <div className="text-xs text-slate-400">
                      Giver: {q.giver} · Reward: {q.rewardGold} Gold, {q.rewardXp} XP, {q.rewardQi} Qi
                      {q.rewardSkillPoints ? `, +${q.rewardSkillPoints} Skill Pts` : ''}
                    </div>

                    {q.choices && prog.status !== 'completed' && !prog.chosenOutcome && (
                      <div className="pt-2 border-t border-slate-700/50 space-y-2">
                        <div className="text-xs text-slate-300">{q.choicePrompt}</div>
                        <div className="flex flex-wrap gap-2">
                          {q.choices.map((ch) => (
                            <button
                              key={ch.id}
                              type="button"
                              onClick={() => onSelectQuestChoice(q.id, ch.id)}
                              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-100 border border-slate-600 cursor-pointer"
                            >
                              {ch.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {prog.chosenOutcome && (
                      <div className="text-xs text-emerald-400">Path Chosen: {prog.chosenOutcome}</div>
                    )}

                    <div className="flex justify-end">
                      {prog.status === 'completed' ? (
                        <span className="text-xs text-emerald-400 font-semibold">Completed</span>
                      ) : (
                        <button
                          type="button"
                          disabled={!readyToClaim}
                          onClick={() => onClaimQuest(q.id)}
                          className={`px-4 py-1.5 rounded text-xs font-bold cursor-pointer ${
                            readyToClaim
                              ? 'bg-[#e8c468] text-[#07090f]'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {readyToClaim ? 'Claim Reward' : q.objectiveLabel}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'achievements' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {achievements.map((a) => (
                <div
                  key={a.id}
                  className={`celestial-surface rounded-lg p-4 flex items-center justify-between gap-3 ${
                    a.unlocked ? 'border-[#e8c468]/60' : 'opacity-70'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-sm text-slate-100">{a.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{a.description}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono-num text-xs text-[#38bdf8]">+{a.rewardDiamonds} Diamonds</div>
                    <div className="text-[11px] text-slate-400">
                      {a.unlocked ? 'Unlocked' : 'Locked'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
