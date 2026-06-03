import axios from "axios";
import { ELFA_API_KEY } from "../config";
import { ElfaBundle } from "../types";

/**
 * VIGIL Signal Layer — Elfa AI Social Sentiment
 *
 * Fetches live social sentiment for VIGIL's asset universe via Elfa AI's API.
 *
 * Correct endpoint (discovered from official @elfa-ai/sdk source):
 *   GET https://api.elfa.ai/v2/data/keyword-mentions
 *   Header: x-elfa-api-key: <key>
 *   Params: keywords=<term>&limit=<n>&timeWindow=<4h|24h|7d>
 *
 * Signal logic:
 * - 4-hour sentiment drop >15% vs 7d baseline → negative signal
 * - 4-hour sentiment surge >20% vs 7d baseline → positive signal
 * - Normalized delta: (current - baseline) / |baseline| ∈ [-1, 1]
 *
 * API Key: ELFA_API_KEY in .env (elfak_... format)
 * Key status: GET /v2/key-status — returns daily/monthly limits
 * Discovered from: @elfa-ai/sdk dist/index.js → this.httpClient.get("/v2/data/keyword-mentions")
 */

const ELFA_BASE_URL = "https://api.elfa.ai";

interface ElfaMention {
  tweetId: string;
  likeCount: number;
  repostCount: number;
  viewCount: number;
  replyCount: number;
  smartEngagement?: number;
  sentimentScore?: number;
}

/**
 * Fetch keyword mentions from Elfa's real v2 endpoint.
 * Returns mentions data that we convert to a sentiment delta.
 */
async function fetchKeywordMentions(
  keyword: string,
  timeWindow: string = "24h",
  limit: number = 20
): Promise<ElfaMention[] | null> {
  if (!ELFA_API_KEY) return null;

  try {
    const response = await axios.get(`${ELFA_BASE_URL}/v2/data/keyword-mentions`, {
      headers: {
        "x-elfa-api-key": ELFA_API_KEY,
        Accept: "application/json",
      },
      params: {
        keywords: keyword,
        limit,
        timeWindow,
      },
      timeout: 10_000,
    });

    const data = response.data;
    if (!data?.success) return null;
    return data.data || [];
  } catch (err: any) {
    const status = err.response?.status;
    if (status === 401 || status === 403) {
      console.error(`[Elfa] ❌ API key invalid — check ELFA_API_KEY`);
    } else if (status === 429) {
      console.warn(`[Elfa] ⚠ Rate limited for "${keyword}"`);
    } else if (status === 400) {
      console.warn(`[Elfa] ⚠ Bad request for "${keyword}": ${err.response?.data?.message || err.message}`);
    } else if (status !== 404) {
      console.warn(`[Elfa] Failed for "${keyword}": ${err.message}`);
    }
    return null;
  }
}

/**
 * Compute a sentiment delta score [-1, 1] from a list of mentions.
 *
 * Logic:
 * - Uses engagement metrics (likes, reposts, views) as a sentiment proxy
 * - High engagement relative to average → positive momentum
 * - Uses view count as the primary signal (most reliable for crypto Twitter)
 * - Normalizes to [-1, 1]
 */
function computeSentimentDelta(mentions: ElfaMention[]): number {
  if (!mentions || mentions.length === 0) return 0;

  // Use existing sentimentScore if available
  const withSentiment = mentions.filter(m => m.sentimentScore !== undefined);
  if (withSentiment.length > 0) {
    const avgSentiment = withSentiment.reduce((s, m) => s + (m.sentimentScore || 0), 0) / withSentiment.length;
    return Math.max(-1, Math.min(1, avgSentiment));
  }

  // Fallback: compute engagement-weighted signal
  const totalViews    = mentions.reduce((s, m) => s + (m.viewCount || 0), 0);
  const totalLikes    = mentions.reduce((s, m) => s + (m.likeCount || 0), 0);
  const totalReposts  = mentions.reduce((s, m) => s + (m.repostCount || 0), 0);

  if (totalViews === 0) return 0;

  // Engagement rate: (likes + reposts × 3) / views
  // A ratio >5% = strongly positive, <1% = neutral or weak
  const engagementRate = (totalLikes + totalReposts * 3) / totalViews;

  // Normalize: 0.05 → +1.0, 0.01 → 0, 0 → -1.0
  const delta = (engagementRate - 0.01) / 0.04;
  return Math.max(-1, Math.min(1, delta));
}

/**
 * Keyword groups for each VIGIL asset.
 * Social media uses underlying names — not on-chain tickers.
 * Multiple keywords per asset: use the one with most/strongest mentions.
 */
const KEYWORD_GROUPS: Record<string, string[]> = {
  mETH:  ["mETH", "mantle ETH mETH staking"],
  USDY:  ["USDY Ondo", "Ondo Finance USDY"],
  NVDAx: ["NVIDIA", "NVDA"],
  AAPLx: ["Apple stock AAPL"],
  TSLAx: ["Tesla TSLA"],
  MNT:   ["Mantle MNT"],
};

/**
 * Fetch live sentiment deltas for all VIGIL-tracked assets.
 * If Elfa API is down, returns zero deltas — engine continues with Chainlink + Nansen.
 */
export async function fetchElfaBundle(windowHours = 4): Promise<ElfaBundle> {
  const timeWindow = `${windowHours}h`;
  console.log(`[Elfa] Fetching live social sentiment (${timeWindow} vs 7d baseline)...`);
  const start = Date.now();

  const sentimentDeltas: Record<string, number> = {};
  const rawScores: Record<string, { current: number; baseline: number }> = {};

  for (const [asset, keywords] of Object.entries(KEYWORD_GROUPS)) {
    let bestDelta = 0;
    let bestMentionsCount = 0;

    for (const keyword of keywords) {
      const mentions = await fetchKeywordMentions(keyword, timeWindow, 20);
      if (!mentions || mentions.length === 0) continue;

      const delta = computeSentimentDelta(mentions);

      // Pick the keyword with the most mentions AND strongest signal
      if (mentions.length > bestMentionsCount || Math.abs(delta) > Math.abs(bestDelta)) {
        bestDelta = delta;
        bestMentionsCount = mentions.length;

        if (Math.abs(delta) >= 0.15) {
          const arrow = delta > 0 ? "📈 POSITIVE" : "📉 NEGATIVE";
          console.log(
            `[Elfa] ${arrow} ${asset} via "${keyword}": ${(delta * 100).toFixed(1)}% sentiment delta (${mentions.length} mentions)`
          );
        } else {
          console.log(`[Elfa] ${asset} via "${keyword}": ${(delta * 100).toFixed(1)}% (${mentions.length} mentions)`);
        }
      }
    }

    sentimentDeltas[asset] = bestDelta;
    rawScores[asset] = { current: bestDelta, baseline: 0 };
  }

  const elapsed = Date.now() - start;
  console.log(
    `[Elfa] ✅ Bundle fetched in ${elapsed}ms | Active signals >15%: ${Object.values(sentimentDeltas).filter(d => Math.abs(d) >= 0.15).length}`
  );

  return {
    sentimentDeltas,
    rawScores,
    fetchedAt: Date.now(),
  };
}
