import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { build as viteBuild, createServer as createViteServer } from 'vite';
import { buildStandaloneHtml5 } from './scripts/bundle-html5';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const PORT = 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  realm: string;
  level: number;
  bossesDefeated: number;
  updatedAt: number;
}

const leaderboardStore: LeaderboardEntry[] = [
  { id: 'npc_orin', name: 'Scholar Orin', realm: 'Core Formation', level: 18, bossesDefeated: 2, updatedAt: Date.now() - 86400000 },
  { id: 'npc_thorne', name: 'Captain Thorne', realm: 'Soul Transformation', level: 24, bossesDefeated: 3, updatedAt: Date.now() - 43200000 },
  { id: 'npc_seris', name: 'Elder Seris', realm: 'Heavenly Ascension', level: 32, bossesDefeated: 4, updatedAt: Date.now() - 12000000 },
];

const PERSONA_PROMPTS: Record<string, string> = {
  scholar_orin:
    'You are Scholar Orin of the Verdant Sanctum in Aetheria: Project Omega. You are an ancient historian studying the Omega Fracture that shattered the boundaries between five realms (Verdant Kingdom, Frostfall Dominion, Ember Wastes, Celestial Islands, Abyssal Frontier). Speak with warm scholarly depth, concise prose (2-4 sentences unless asked for deep analysis), and give actionable gameplay lore and tactics.',
  weaver_clara:
    'You are Weaver Clara of the Verdant Sanctum in Aetheria: Project Omega. You weave astral silk, elemental vestments, and memory threads. Speak poetically yet practically about crafting, materials (Aether Crystals, Frostfire Mithril, Astral Fragments), and survival.',
  omega_oracle:
    'You are the Omega Astral Oracle, a crystalline intelligence resonating inside the Sanctum Obelisk of Aetheria: Project Omega. You analyze cultivation realms (Mortal Foundation through Eternal Transcendence), elemental resonance combinations (Fire, Water, Wind, Earth, Lightning, Chakra, Light, Darkness), boss phases (Wezaemon, Abyssal Dragon, Celestial Devourer, Void Emperor), and survival strategy with crystalline precision.',
  farmer_rowan:
    'You are Farmer Rowan of the Verdant Farmstead in Aetheria: Project Omega. You tend Golden Wheat, Sunberry Vines, Aether Herbs, and Spirit Rice to keep the entire sanctuary fed and supply the Market Stall. Speak warmly and practically in 2-3 sentences.',
  mason_cedric:
    'You are Master Mason Cedric in Aetheria: Project Omega. You design and raise timber halls, watchtowers, beacons, and granaries for Verdant Sanctuary. Speak enthusiastically about architecture, stone tiers, and building in 2-3 sentences.',
  smith_kael:
    'You are Blacksmith Kael of Verdant Forge in Aetheria: Project Omega. You temper Sovereign Katanas, Starsteel blades, and twin crescents for the village market. Speak with proud craftsman energy in 2-3 sentences.',
  armorer_garrick:
    'You are Armorer Garrick in Aetheria: Project Omega. You forge Frostfire Mithril cuirasses, Starsteel helmets, and Aegis shields for travelers. Speak concisely in 2-3 sentences.',
  chemist_vesper:
    'You are Alchemist Vesper in Aetheria: Project Omega. You distill Crimson Vitality Elixirs, Mana Draughts, and Frostfire Tonics from Farmer Rowan’s herbs. Speak concisely in 2-3 sentences.',
  fletcher_sylvan:
    'You are Fletcher Sylvan in Aetheria: Project Omega. You craft Starfall Longbows and wind-fletched quivers. Speak concisely in 2-3 sentences.',
  gunsmith_vance:
    'You are Artificer Gunsmith Vance in Aetheria: Project Omega. You engineer Aether Pulse Rifles and Omega Arc Revolvers. Speak concisely in 2-3 sentences.',
  toolsmith_orson:
    'You are Toolsmith Orson in Aetheria: Project Omega. You supply high-yield pickaxes, axes, and Astral Lanterns. Speak concisely in 2-3 sentences.',
  merchant_lyra:
    'You are Merchant Lyra of the Verdant Market District in Aetheria: Project Omega. You coordinate Gold, Diamonds, Emeralds, Ancient Coins, and Aether Shards across village craftsmen. Speak concisely in 2-3 sentences.',
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'aetheria-project-omega' });
  });

  // Multi-turn Gemini NPC & Oracle Chat with optional High Thinking mode
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { personaId = 'omega_oracle', history = [], message = '', highThinking = false, playerContext = {} } =
        req.body as {
          personaId?: string;
          history?: ChatTurn[];
          message?: string;
          highThinking?: boolean;
          playerContext?: Record<string, unknown>;
        };

      if (!message || typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ error: 'Message is required.' });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(503).json({
          error: 'GEMINI_API_KEY is not configured in server secrets.',
        });
        return;
      }

      const systemBase =
        PERSONA_PROMPTS[personaId] ??
        `You are ${personaId.replace(/_/g, ' ')} in the living fantasy sanctuary of Aetheria: Project Omega. Stay in character, be helpful, and respond concisely in 2-3 sentences.`;
      const contextLine = `\nCurrent traveler context: ${JSON.stringify(playerContext)}. Keep answers grounded in Aetheria: Project Omega's real mechanics and concise.`;

      const contents = [
        ...history.slice(-12).map((turn) => ({
          role: turn.role,
          parts: [{ text: turn.text }],
        })),
        { role: 'user' as const, parts: [{ text: message.trim() }] },
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction: systemBase + contextLine,
          thinkingConfig: {
            thinkingLevel: highThinking ? ThinkingLevel.HIGH : ThinkingLevel.LOW,
          },
        },
      });

      const reply = response.text?.trim() || 'The Astral resonance flickered without forming words.';
      res.json({ reply, model: 'gemini-4-hydrogen', highThinking });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gemini request failed';
      console.error('[/api/ai/chat] error:', msg);
      res.status(500).json({ error: msg });
    }
  });

  // Autonomous NPC-to-NPC conversational dialogue generator (graceful fallback when no key)
  app.post('/api/npc/converse', async (req, res) => {
    try {
      const {
        speakerName = 'Farmer Rowan',
        speakerRole = 'Farmer',
        partnerName = 'Blacksmith Kael',
        partnerRole = 'Blacksmith',
        villageFood = 30,
        villageOre = 25,
      } = req.body as {
        speakerName?: string;
        speakerRole?: string;
        partnerName?: string;
        partnerRole?: string;
        villageFood?: number;
        villageOre?: number;
      };

      if (!process.env.GEMINI_API_KEY) {
        res.status(503).json({ fallback: true });
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `Write ONE short natural in-character line (max 20 words) spoken by ${speakerName} (${speakerRole}) to ${partnerName} (${partnerRole}) in Verdant Sanctuary. Mention farming/food (${villageFood} rations), forging weapons/armor (${villageOre} ingots), building structures, or trading at the market.`,
      });
      res.json({ line: response.text?.trim() || '' });
    } catch {
      res.status(503).json({ fallback: true });
    }
  });

  // Fast discovery/lore inscription generator using gemini-3.1-flash-lite
  app.post('/api/ai/lore', async (req, res) => {
    try {
      const { biomeName = 'Verdant Kingdom', realmName = 'Mortal Foundation' } = req.body as {
        biomeName?: string;
        realmName?: string;
      };
      if (!process.env.GEMINI_API_KEY) {
        res.status(503).json({ error: 'GEMINI_API_KEY is not configured.' });
        return;
      }
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `Write a single atmospheric 2-sentence ancient monument inscription discovered by a ${realmName} cultivator entering ${biomeName} in Aetheria: Project Omega.`,
      });
      res.json({ inscription: response.text?.trim() || '' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lore generation failed';
      res.status(500).json({ error: msg });
    }
  });

  // Local World Server Prototype Social & Leaderboard Endpoints
  app.get('/api/social/state', (_req, res) => {
    const sorted = [...leaderboardStore].sort(
      (a, b) => b.bossesDefeated - a.bossesDefeated || b.level - a.level,
    );
    res.json({
      mode: 'offline-prototype-server',
      leaderboard: sorted.slice(0, 12),
    });
  });

  app.post('/api/social/leaderboard', (req, res) => {
    const { id, name, realm, level, bossesDefeated } = req.body as Partial<LeaderboardEntry>;
    if (!id || !name) {
      res.status(400).json({ error: 'Missing player id or name.' });
      return;
    }
    const existing = leaderboardStore.find((e) => e.id === id);
    const entry: LeaderboardEntry = {
      id,
      name: String(name).slice(0, 32),
      realm: String(realm || 'Mortal Foundation'),
      level: Number(level) || 1,
      bossesDefeated: Number(bossesDefeated) || 0,
      updatedAt: Date.now(),
    };
    if (existing) {
      Object.assign(existing, entry);
    } else {
      leaderboardStore.push(entry);
    }
    res.json({ ok: true, entry });
  });

  // Standalone single-file HTML5 export endpoint (builds on demand if not yet built)
  let html5BuildPromise: Promise<string> | null = null;
  app.get('/api/download/html5', async (_req, res) => {
    try {
      const distDir = path.resolve(process.cwd(), 'dist');
      const html5Path = path.join(distDir, 'Aetheria-Project-Omega-HTML5.html');
      if (!fs.existsSync(html5Path)) {
        if (!html5BuildPromise) {
          html5BuildPromise = (async () => {
            await viteBuild();
            return buildStandaloneHtml5(distDir);
          })().finally(() => {
            html5BuildPromise = null;
          });
        }
        await html5BuildPromise;
      }
      if (!fs.existsSync(html5Path)) {
        res.status(500).json({ error: 'HTML5 bundle could not be created.' });
        return;
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="Aetheria-Project-Omega-HTML5.html"',
      );
      res.sendFile(html5Path);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'HTML5 bundle failed';
      console.error('[/api/download/html5] error:', msg);
      res.status(500).json({ error: msg });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Aetheria: Project Omega server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
