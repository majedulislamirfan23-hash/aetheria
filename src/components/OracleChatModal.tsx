import React, { useEffect, useRef, useState } from 'react';

export interface OracleMessage {
  role: 'user' | 'model';
  text: string;
  highThinking?: boolean;
}

interface OracleChatModalProps {
  initialPersona?: string;
  customPersonaMeta?: { id: string; name: string; role: string } | null;
  playerContext: Record<string, unknown>;
  onClose: () => void;
}

const BASE_PERSONAS = [
  { id: 'omega_oracle', name: 'Omega Astral Oracle', role: 'Deep Strategy & Lore Reasoning' },
  { id: 'scholar_orin', name: 'Scholar Orin', role: 'Sanctum Historian' },
  { id: 'weaver_clara', name: 'Weaver Clara', role: 'Astral Artisan & Crafter' },
];

export const OracleChatModal: React.FC<OracleChatModalProps> = ({
  initialPersona = 'omega_oracle',
  customPersonaMeta = null,
  playerContext,
  onClose,
}) => {
  const [personaId, setPersonaId] = useState<string>(initialPersona);
  const personas = customPersonaMeta && !BASE_PERSONAS.some((p) => p.id === customPersonaMeta.id)
    ? [customPersonaMeta, ...BASE_PERSONAS]
    : BASE_PERSONAS;

  const activeMeta = personas.find((p) => p.id === personaId) ?? personas[0];
  const [highThinking, setHighThinking] = useState(true);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<OracleMessage[]>([
    {
      role: 'model',
      text: `${activeMeta.name} greets you. Ask about crafting, Verdant farms, the Omega Fracture, elemental synergies, or how to defeat Wezaemon.`,
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendMessage = async (textOverride?: string) => {
    const trimmed = (textOverride ?? input).trim();
    if (!trimmed || loading) return;

    const nextHistory: OracleMessage[] = [...messages, { role: 'user', text: trimmed }];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId,
          personaName: activeMeta.name,
          personaRole: activeMeta.role,
          history: nextHistory.slice(0, -1).map((m) => ({ role: m.role, text: m.text })),
          message: trimmed,
          highThinking,
          playerContext,
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Oracle failed to respond.');
      }
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: data.reply || 'No reply received.', highThinking },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach Gemini Oracle.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div className="celestial-panel rounded-xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-700/60">
          <div>
            <h2 className="font-display text-lg font-bold text-[#38bdf8]">
              {activeMeta.name}
            </h2>
            <p className="text-xs text-slate-400">
              {activeMeta.role} · Multi-turn Gemini AI Comms
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0b101d] border border-slate-700 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={highThinking}
                onChange={(e) => setHighThinking(e.target.checked)}
              />
              Deep Thinking
            </label>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* Persona Switcher */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b border-slate-800 bg-[#090d16]">
          {personas.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPersonaId(p.id)}
              className={`px-3 py-1 rounded text-xs font-medium cursor-pointer ${
                personaId === p.id
                  ? 'bg-[#e8c468] text-[#07090f]'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Scrollable Chat Thread */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[84%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-[#1e293b] text-slate-100 border border-slate-600/60'
                    : 'bg-[#0d1424] text-slate-200 border border-[#38bdf8]/30'
                }`}
              >
                {m.role === 'model' && m.highThinking && (
                  <div className="text-[10px] uppercase tracking-wider text-[#e8c468] mb-1">
                    Deep Reasoning Synthesis
                  </div>
                )}
                <div className="whitespace-pre-wrap">{m.text}</div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="text-xs text-[#38bdf8] px-2">
              Channeling astral resonance...
            </div>
          )}
          {error && (
            <div className="text-xs text-rose-300 bg-rose-950/50 border border-rose-700/50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Quick Prompts + Input */}
        <div className="p-4 border-t border-slate-700/60 space-y-2.5 bg-[#090d16]">
          <div className="flex flex-wrap gap-1.5">
            {[
              'How do I defeat Wezaemon?',
              'What caused the Omega Fracture?',
              'Best elemental combo for my build?',
            ].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendMessage(q)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Scholar Orin, Weaver Clara, or the Omega Oracle..."
              className="flex-1 px-3.5 py-2.5 rounded-lg bg-[#0b101d] border border-slate-700 text-sm text-slate-100"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-5 py-2.5 rounded-lg bg-[#e8c468] hover:bg-[#f3d482] text-[#07090f] font-bold text-sm cursor-pointer disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
