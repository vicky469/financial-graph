import { getDb, generateId } from "./utils";
import { NodeType } from "../src/types/domain";

const db = getDb();

// Sample Corporate Hierarchy Data
// Demonstrates: Parent Companies → Subsidiaries → Brands
// Uses deterministic IDs - safe to run multiple times without creating duplicates

// Node IDs (deterministic based on name)
const NODES = {
  // Parent Companies
  apple: generateId.node("Apple Inc."),
  meta: generateId.node("Meta Platforms Inc."),
  alphabet: generateId.node("Alphabet Inc."),

  // Apple Subsidiaries
  beats: generateId.node("Beats Electronics"),
  shazam: generateId.node("Shazam Entertainment"),

  // Meta Subsidiaries
  instagram: generateId.node("Instagram"),
  whatsapp: generateId.node("WhatsApp Inc."),
  oculus: generateId.node("Oculus VR"),

  // Alphabet Subsidiaries
  google: generateId.node("Google LLC"),
  youtube: generateId.node("YouTube LLC"),
  waymo: generateId.node("Waymo LLC"),
  verily: generateId.node("Verily Life Sciences"),

  // Brands (children of subsidiaries)
  beatsByDre: generateId.node("Beats By Dre"),
  beatsMusic: generateId.node("Beats Music"),
  questVR: generateId.node("Meta Quest"),
};

// Events showing acquisitions (deterministic based on title + date)
const EVENT_IDS = {
  appleBeats: generateId.event("Apple Acquires Beats Electronics", "2014-05-28"),
  appleShazam: generateId.event("Apple Acquires Shazam", "2018-09-24"),
  facebookInstagram: generateId.event("Facebook Acquires Instagram", "2012-04-09"),
  facebookWhatsapp: generateId.event("Facebook Acquires WhatsApp", "2014-02-19"),
  facebookOculus: generateId.event("Facebook Acquires Oculus VR", "2014-03-25"),
  googleYoutube: generateId.event("Google Acquires YouTube", "2006-10-09"),
  alphabetWaymo: generateId.event("Alphabet Spins Out Waymo", "2016-12-13"),
};

const SEED_NODES = [
  // Parent Companies
  {
    id: NODES.apple,
    name: "Apple Inc.",
    type: NodeType.Company,
    properties: { ticker: "AAPL", sector: "Technology", structure: "Public Company" },
    jurisdiction: "US-DE",
    cik: "0000320193",
    validFrom: new Date("1977-01-03").getTime(), // Incorporation
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: NODES.meta,
    name: "Meta Platforms Inc.",
    type: NodeType.Company,
    properties: { ticker: "META", sector: "Social Media", structure: "Public Company" },
    jurisdiction: "US-DE",
    cik: "0001326801",
    validFrom: new Date("2004-01-04").getTime(),
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: NODES.alphabet,
    name: "Alphabet Inc.",
    type: NodeType.Company,
    properties: { ticker: "GOOGL", sector: "Technology", structure: "Public Company" },
    jurisdiction: "US-DE",
    cik: "0001652044",
    validFrom: new Date("2015-10-02").getTime(),
    createdAt: Date.now(),
    createdBy: "seed_script",
  },

  // Apple Subsidiaries
  {
    id: NODES.beats,
    name: "Beats Electronics",
    type: NodeType.Company,
    properties: { acquiredDate: "2014-05-28", acquiredFor: "$3B", structure: "Subsidiary" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: NODES.shazam,
    name: "Shazam Entertainment",
    type: NodeType.Company,
    properties: { acquiredDate: "2018-09-24", acquiredFor: "$400M", structure: "Subsidiary" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },

  // Meta Subsidiaries
  {
    id: NODES.instagram,
    name: "Instagram",
    type: NodeType.Company,
    properties: { acquiredDate: "2012-04-09", acquiredFor: "$1B", structure: "Subsidiary" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: NODES.whatsapp,
    name: "WhatsApp Inc.",
    type: NodeType.Company,
    properties: { acquiredDate: "2014-02-19", acquiredFor: "$19B", structure: "Subsidiary" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: NODES.oculus,
    name: "Oculus VR",
    type: NodeType.Company,
    properties: { acquiredDate: "2014-03-25", acquiredFor: "$2.3B", structure: "Subsidiary" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },

  // Alphabet Subsidiaries
  {
    id: NODES.google,
    name: "Google LLC",
    type: NodeType.Company,
    properties: { note: "Core search and advertising business", structure: "Subsidiary" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: NODES.youtube,
    name: "YouTube LLC",
    type: NodeType.Company,
    properties: { acquiredDate: "2006-10-09", acquiredFor: "$1.65B", structure: "Subsidiary" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: NODES.waymo,
    name: "Waymo LLC",
    type: NodeType.Company,
    properties: { focus: "Autonomous vehicles", structure: "Subsidiary" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: NODES.verily,
    name: "Verily Life Sciences",
    type: NodeType.Company,
    properties: { focus: "Healthcare technology", structure: "Subsidiary" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },

  // Brands
  {
    id: NODES.beatsByDre,
    name: "Beats By Dre",
    type: NodeType.Brand,
    properties: { category: "Consumer Audio" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: NODES.beatsMusic,
    name: "Beats Music",
    type: NodeType.Brand,
    properties: { status: "Discontinued 2015", note: "Became Apple Music" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: NODES.questVR,
    name: "Meta Quest",
    type: NodeType.Brand,
    properties: { category: "VR Hardware", formerlyKnownAs: "Oculus Quest" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
];

const SEED_EVENTS = [
  {
    id: EVENT_IDS.appleBeats,
    title: "Apple Acquires Beats Electronics",
    description: "Apple acquires Beats for $3 billion, its largest acquisition at the time",
    link: "https://www.apple.com/newsroom/2014/05/28Apple-to-Acquire-Beats-Music-Beats-Electronics/",
    isTrigger: false,
    date: "2014-05-28",
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: EVENT_IDS.appleShazam,
    title: "Apple Acquires Shazam",
    description: "Apple completes acquisition of music recognition app Shazam",
    isTrigger: false,
    date: "2018-09-24",
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: EVENT_IDS.facebookInstagram,
    title: "Facebook Acquires Instagram",
    description: "Facebook buys photo-sharing app Instagram for $1 billion",
    isTrigger: false,
    date: "2012-04-09",
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: EVENT_IDS.facebookWhatsapp,
    title: "Facebook Acquires WhatsApp",
    description: "Facebook acquires messaging platform WhatsApp for $19 billion",
    isTrigger: false,
    date: "2014-02-19",
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: EVENT_IDS.facebookOculus,
    title: "Facebook Acquires Oculus VR",
    description: "Facebook enters VR market with Oculus acquisition",
    isTrigger: false,
    date: "2014-03-25",
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: EVENT_IDS.googleYoutube,
    title: "Google Acquires YouTube",
    description: "Google buys video-sharing platform YouTube for $1.65 billion",
    isTrigger: false,
    date: "2006-10-09",
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: EVENT_IDS.alphabetWaymo,
    title: "Alphabet Spins Out Waymo",
    description: "Google's self-driving car project becomes independent Waymo LLC",
    isTrigger: false,
    date: "2016-12-13",
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
];

const SEED_EDGES = [
  // Apple → Subsidiaries
  {
    id: generateId.edge(NODES.apple, NODES.beats),
    sourceId: NODES.apple,
    targetId: NODES.beats,
    label: "owns 100%",
    edgeType: "causal" as const,
    ownership: 100,
    validFrom: new Date("2014-05-28").getTime(),
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: generateId.edge(NODES.apple, NODES.shazam),
    sourceId: NODES.apple,
    targetId: NODES.shazam,
    label: "owns 100%",
    edgeType: "causal" as const,
    ownership: 100,
    validFrom: new Date("2018-09-24").getTime(),
    createdAt: Date.now(),
    createdBy: "seed_script",
  },

  // Beats → Brands
  {
    id: generateId.edge(NODES.beats, NODES.beatsByDre),
    sourceId: NODES.beats,
    targetId: NODES.beatsByDre,
    label: "brand",
    edgeType: "causal" as const,
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: generateId.edge(NODES.beats, NODES.beatsMusic),
    sourceId: NODES.beats,
    targetId: NODES.beatsMusic,
    label: "brand (discontinued)",
    edgeType: "causal" as const,
    createdAt: Date.now(),
    createdBy: "seed_script",
  },

  // Meta → Subsidiaries
  {
    id: generateId.edge(NODES.meta, NODES.instagram),
    sourceId: NODES.meta,
    targetId: NODES.instagram,
    label: "owns 100%",
    edgeType: "causal" as const,
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: generateId.edge(NODES.meta, NODES.whatsapp),
    sourceId: NODES.meta,
    targetId: NODES.whatsapp,
    label: "owns 100%",
    edgeType: "causal" as const,
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: generateId.edge(NODES.meta, NODES.oculus),
    sourceId: NODES.meta,
    targetId: NODES.oculus,
    label: "owns 100%",
    edgeType: "causal" as const,
    createdAt: Date.now(),
    createdBy: "seed_script",
  },

  // Oculus → Brand
  {
    id: generateId.edge(NODES.oculus, NODES.questVR),
    sourceId: NODES.oculus,
    targetId: NODES.questVR,
    label: "brand",
    edgeType: "causal" as const,
    createdAt: Date.now(),
    createdBy: "seed_script",
  },

  // Alphabet → Subsidiaries
  {
    id: generateId.edge(NODES.alphabet, NODES.google),
    sourceId: NODES.alphabet,
    targetId: NODES.google,
    label: "owns 100%",
    edgeType: "causal" as const,
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: generateId.edge(NODES.alphabet, NODES.youtube),
    sourceId: NODES.alphabet,
    targetId: NODES.youtube,
    label: "owns 100%",
    edgeType: "causal" as const,
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: generateId.edge(NODES.alphabet, NODES.waymo),
    sourceId: NODES.alphabet,
    targetId: NODES.waymo,
    label: "owns 100%",
    edgeType: "causal" as const,
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: generateId.edge(NODES.alphabet, NODES.verily),
    sourceId: NODES.alphabet,
    targetId: NODES.verily,
    label: "owns 100%",
    edgeType: "causal" as const,
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
];

async function seed() {
  console.log("🌱 Seeding Corporate Hierarchy Data...");

  try {
    // Add entities
    console.log("📦 Adding nodes...");
    for (const node of SEED_NODES) {
      const { id, ...data } = node;
      await db.transact([db.tx.nodes[id].update(data)]);
    }
    console.log(`✅ Added ${SEED_NODES.length} nodes`);

    // Add events
    console.log("📅 Adding events...");
    for (const event of SEED_EVENTS) {
      const { id, ...data } = event;
      await db.transact([db.tx.events[id].update(data)]);
    }
    console.log(`✅ Added ${SEED_EVENTS.length} events`);

    // Add edges
    console.log("🔗 Adding edges...");
    for (const edge of SEED_EDGES) {
      const { id, ...data } = edge;
      await db.transact([db.tx.edges[id].update(data)]);
    }
    console.log(`✅ Added ${SEED_EDGES.length} edges`);

    console.log("\n✨ Seed completed successfully!");
    console.log("\nCorporate Hierarchy:");
    console.log("├── Apple Inc. (AAPL)");
    console.log("│   ├── Beats Electronics");
    console.log("│   │   ├── Beats By Dre (brand)");
    console.log("│   │   └── Beats Music (brand, discontinued)");
    console.log("│   └── Shazam Entertainment");
    console.log("│");
    console.log("├── Meta Platforms Inc. (META)");
    console.log("│   ├── Instagram");
    console.log("│   ├── WhatsApp Inc.");
    console.log("│   └── Oculus VR");
    console.log("│       └── Meta Quest (brand)");
    console.log("│");
    console.log("└── Alphabet Inc. (GOOGL)");
    console.log("    ├── Google LLC");
    console.log("    ├── YouTube LLC");
    console.log("    ├── Waymo LLC");
    console.log("    └── Verily Life Sciences");
  } catch (error) {
    console.error("❌ Error seeding data:", error);
    process.exit(1);
  }
}

seed();
