import { describe, expect, it } from "vitest";
import { normalizeTag, parseTags, serializeTags, tagSimilarity } from "@/lib/tags";

describe("tags", () => {
  it("normalizes case, whitespace and aliases", () => {
    expect(normalizeTag("  Venture   Capital ")).toBe("fundraising");
    expect(normalizeTag("GTM")).toBe("go-to-market");
    expect(normalizeTag("Machine Learning")).toBe("ai/ml");
  });

  it("parses and dedupes comma/semicolon lists", () => {
    expect(parseTags("VC, fundraising; Hiring\nrecruiting")).toEqual(["fundraising", "hiring"]);
    expect(parseTags(["A", "a", ""])).toEqual(["a"]);
    expect(parseTags(null)).toEqual([]);
    expect(serializeTags("b2b sales, Pricing")).toBe("sales, pricing");
  });

  it("scores exact, partial and no matches", () => {
    expect(tagSimilarity("vc", "fundraising")).toBe(1);
    expect(tagSimilarity("sales", "healthcare sales")).toBe(0.6);
    expect(tagSimilarity("legal", "design")).toBe(0);
  });
});
