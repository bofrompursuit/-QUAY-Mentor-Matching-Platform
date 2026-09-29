/**
 * Expertise/topic tags are stored as a normalized, comma-separated string.
 * Aliases collapse common synonyms so "VC", "venture capital" and
 * "fundraising" all match each other.
 */
const ALIASES: Record<string, string> = {
  vc: "fundraising",
  "venture capital": "fundraising",
  fundraise: "fundraising",
  "raising capital": "fundraising",
  gtm: "go-to-market",
  "go to market": "go-to-market",
  ai: "ai/ml",
  ml: "ai/ml",
  "machine learning": "ai/ml",
  "artificial intelligence": "ai/ml",
  pm: "product management",
  product: "product management",
  ux: "design",
  ui: "design",
  "ux design": "design",
  hr: "hiring",
  recruiting: "hiring",
  talent: "hiring",
  eng: "engineering",
  "software engineering": "engineering",
  finance: "finance",
  cfo: "finance",
  legal: "legal",
  marketing: "marketing",
  growth: "growth marketing",
  "b2b sales": "sales",
  "enterprise sales": "sales",
};

export function normalizeTag(raw: string): string {
  const t = raw.toLowerCase().trim().replace(/\s+/g, " ");
  return ALIASES[t] ?? t;
}

export function parseTags(input: string | string[] | null | undefined): string[] {
  if (!input) return [];
  const parts = Array.isArray(input) ? input : input.split(/[,;\n]/);
  const out: string[] = [];
  for (const p of parts) {
    const t = normalizeTag(p);
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

export function serializeTags(input: string | string[] | null | undefined): string {
  return parseTags(input).join(", ");
}

function words(s: string): string[] {
  return s.split(/[^a-z0-9/+#-]+/).filter(Boolean);
}

/**
 * 1 for an exact (alias-aware) match, 0.6 when one tag's words are all
 * contained in the other ("sales" vs "healthcare sales"), else 0.
 */
export function tagSimilarity(a: string, b: string): number {
  const x = normalizeTag(a);
  const y = normalizeTag(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const wx = words(x);
  const wy = words(y);
  const [small, big] = wx.length <= wy.length ? [wx, wy] : [wy, wx];
  if (small.length && small.every((w) => big.includes(w))) return 0.6;
  return 0;
}
