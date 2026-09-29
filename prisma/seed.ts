import { PrismaClient } from "@prisma/client";
import { serializeTags } from "../src/lib/tags";

const prisma = new PrismaClient();
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const daysAhead = (n: number, hour = 16) => {
  const d = new Date(Date.now() + n * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const MENTORS = [
  ["Amara Okafor", "amara@example.com", "Partner", "Northbeam Ventures", "fundraising, pitch deck, seed strategy", 20, "MANUAL"],
  ["Daniel Reyes", "daniel@example.com", "VP Sales", "Ledgerly", "enterprise sales, pricing, b2b saas", 45, "MANUAL"],
  ["Priya Natarajan", "priya@example.com", "Head of Product", "Canopy Health", "product management, healthtech, user research", 10, "SLACK"],
  ["Marcus Lee", "marcus@example.com", "CTO", "Stackwise", "engineering, ai/ml, hiring", 200, "MANUAL"],
  ["Sofia Alvarez", "sofia@example.com", "CMO", "Brightloop", "growth marketing, brand, go-to-market", 60, "IMPORT"],
  ["James Whitfield", "james@example.com", "Former CFO", "Arcadia Freight", "finance, fundraising, unit economics", 400, "IMPORT"],
  ["Nadia Haddad", "nadia@example.com", "General Counsel", "Openfield", "legal, fundraising, ip", 90, "MANUAL"],
  ["Kenji Watanabe", "kenji@example.com", "Founder", "Tidepool AI", "ai/ml, fundraising, product management", 15, "SLACK"],
  ["Grace Mensah", "grace@example.com", "Talent Partner", "Northbeam Ventures", "hiring, culture, people ops", 30, "MANUAL"],
  ["Luis Ortega", "luis@example.com", "Director of Partnerships", "Mercado Pay", "fintech, partnerships, go-to-market", 250, "IMPORT"],
  ["Hannah Brooks", "hannah@example.com", "Design Lead", "Figmentry", "design, user research", 5, "SLACK"],
  ["Omar Farouk", "omar@example.com", "Angel Investor", null, "fundraising, marketplaces", 120, "MANUAL"],
] as const;

async function main() {
  await prisma.freshnessFlag.deleteMany();
  await prisma.mentorRequest.deleteMany();
  await prisma.session.deleteMany();
  await prisma.startup.deleteMany();
  await prisma.mentor.deleteMany();

  const m: Record<string, string> = {};
  for (const [name, email, title, company, expertise, verifiedDaysAgo, source] of MENTORS) {
    const created = await prisma.mentor.create({
      data: {
        name, email, title, company, source,
        expertise: serializeTags(expertise),
        lastVerifiedAt: daysAgo(verifiedDaysAgo),
        createdAt: daysAgo(Math.max(verifiedDaysAgo, 3)),
        active: email !== "omar@example.com",
      },
    });
    m[name.split(" ")[0]] = created.id;
  }

  const startups = [
    ["Harbor Health", "Dana Kim", "Healthtech", "Pre-seed", "fundraising, product management, hiring"],
    ["Loop Logistics", "Tariq Ali", "Logistics", "Seed", "enterprise sales, pricing, finance"],
    ["Verdant AI", "Maya Chen", "AI", "Pre-seed", "ai/ml, fundraising, go-to-market"],
    ["Kinfolk Pay", "Andre Wright", "Fintech", "Seed", "fintech, legal, partnerships"],
    ["Studio Nest", "Ivy Park", "Consumer", "Pre-seed", "design, growth marketing, brand"],
  ] as const;
  const s: Record<string, string> = {};
  for (const [name, founderName, sector, stage, needs] of startups) {
    s[name.split(" ")[0]] = (await prisma.startup.create({ data: { name, founderName, sector, stage, needs: serializeTags(needs) } })).id;
  }

  await prisma.session.createMany({
    data: [
      { title: "Fundraising 101: building your seed round", topics: "fundraising, pitch deck", scheduledAt: daysAgo(21), status: "COMPLETED", mentorId: m.Amara },
      { title: "Hiring your first engineers", topics: "hiring, engineering", scheduledAt: daysAgo(14), status: "COMPLETED", mentorId: m.Grace },
      { title: "Pricing for B2B", topics: "pricing, enterprise sales", scheduledAt: daysAgo(7), status: "COMPLETED", mentorId: m.Daniel },
      { title: "Customer discovery sprint", topics: "user research, product management", scheduledAt: daysAhead(3), mentorId: m.Priya },
      { title: "Go-to-market planning", topics: "go-to-market, growth marketing", scheduledAt: daysAhead(6) },
      { title: "Term sheets & legal basics", topics: "legal, fundraising", scheduledAt: daysAhead(10) },
      { title: "Building with AI responsibly", topics: "ai/ml, product management", scheduledAt: daysAhead(13) },
    ],
  });

  const req = (startup: string, mentor: string, topic: string, status: string, ageDays: number, respondHours?: number) => ({
    startupId: s[startup], mentorId: m[mentor], topic, status,
    createdAt: daysAgo(ageDays),
    respondedAt: respondHours != null ? new Date(daysAgo(ageDays).getTime() + respondHours * 36e5) : null,
    matchScore: 60 + Math.round(Math.random() * 30),
  });
  await prisma.mentorRequest.createMany({
    data: [
      req("Harbor", "Amara", "fundraising", "COMPLETED", 48, 20),
      req("Harbor", "Priya", "product management", "ACCEPTED", 30, 6),
      req("Loop", "Daniel", "pricing", "COMPLETED", 40, 12),
      req("Loop", "James", "finance", "DECLINED", 35, 70),
      req("Verdant", "Kenji", "ai/ml", "ACCEPTED", 20, 3),
      req("Verdant", "Amara", "fundraising", "ACCEPTED", 12, 30),
      req("Kinfolk", "Luis", "fintech", "PENDING", 9),
      req("Kinfolk", "Nadia", "legal", "ACCEPTED", 6, 18),
      req("Studio", "Hannah", "design", "PENDING", 2),
      req("Studio", "Sofia", "growth marketing", "PENDING", 1),
      req("Harbor", "Grace", "hiring", "ACCEPTED", 16, 9),
    ],
  });

  await prisma.freshnessFlag.create({
    data: {
      mentorId: m.Marcus, reason: "JOB_CHANGE", source: "WEBHOOK",
      details: JSON.stringify({ from: { title: "CTO", company: "Stackwise" }, to: { title: "VP Engineering", company: "Nimbus Labs" } }),
    },
  });
  console.log(`Seeded ${MENTORS.length} mentors, ${startups.length} startups.`);
}

main().finally(() => prisma.$disconnect());
