import { parseTags, tagSimilarity } from "./tags";
import { isStale } from "./freshness";

export interface MentorStats {
  sessionsLed: number; // completed or scheduled sessions assigned to them
  recentSessions: number; // sessions within +/-14 days of "now"
  requestsReceived: number;
  requestsResponded: number;
  requestsAccepted: number;
}

export interface MatchCandidate {
  id: string;
  name: string;
  title?: string | null;
  company?: string | null;
  expertise: string; // serialized tags
  active: boolean;
  lastVerifiedAt: Date;
  stats: MentorStats;
}

export interface MatchNeed {
  topics: string[];
}

export interface MatchResult {
  mentorId: string;
  name: string;
  title?: string | null;
  company?: string | null;
  score: number; // 0-100
  matchedTopics: string[];
  reasons: string[];
}

// Relevance dominates; engagement and responsiveness break ties between
// mentors with similar expertise.
export const WEIGHTS = { relevance: 60, engagement: 20, responsiveness: 15, freshness: 5 };
const HEAVY_LOAD_THRESHOLD = 3;
const HEAVY_LOAD_PENALTY = 10;

export function scoreMentor(c: MatchCandidate, need: MatchNeed, now = new Date()): MatchResult | null {
  if (!c.active) return null;
  const needTopics = parseTags(need.topics);
  const tags = parseTags(c.expertise);
  if (!needTopics.length || !tags.length) return null;

  const matchedTopics: string[] = [];
  let relevanceSum = 0;
  for (const topic of needTopics) {
    const best = Math.max(0, ...tags.map((t) => tagSimilarity(topic, t)));
    if (best > 0) matchedTopics.push(topic);
    relevanceSum += best;
  }
  if (!matchedTopics.length) return null;

  const reasons: string[] = [`Expertise matches ${matchedTopics.join(", ")}`];
  const relevance = relevanceSum / needTopics.length;

  const engagements = c.stats.sessionsLed + c.stats.requestsAccepted;
  const engagement = Math.min(engagements, 5) / 5;
  if (engagements > 0) reasons.push(`${engagements} past engagement${engagements === 1 ? "" : "s"}`);

  // Unknown responsiveness is neutral rather than penalized, so new mentors still surface.
  const responsiveness =
    c.stats.requestsReceived > 0 ? c.stats.requestsResponded / c.stats.requestsReceived : 0.5;
  if (c.stats.requestsReceived > 0) reasons.push(`${Math.round(responsiveness * 100)}% response rate`);
  else reasons.push("New to requests");

  const stale = isStale(c.lastVerifiedAt, now);
  if (stale) reasons.push("Profile may be out of date");

  let score =
    relevance * WEIGHTS.relevance +
    engagement * WEIGHTS.engagement +
    responsiveness * WEIGHTS.responsiveness +
    (stale ? 0 : WEIGHTS.freshness);

  if (c.stats.recentSessions >= HEAVY_LOAD_THRESHOLD) {
    score -= HEAVY_LOAD_PENALTY;
    reasons.push(`Already booked for ${c.stats.recentSessions} sessions this fortnight`);
  }

  return {
    mentorId: c.id,
    name: c.name,
    title: c.title,
    company: c.company,
    score: Math.max(0, Math.round(score)),
    matchedTopics,
    reasons,
  };
}

export function rankMentors(
  candidates: MatchCandidate[],
  need: MatchNeed,
  { limit = 5, now = new Date() }: { limit?: number; now?: Date } = {},
): MatchResult[] {
  return candidates
    .map((c) => scoreMentor(c, need, now))
    .filter((r): r is MatchResult => r !== null)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}
