import { getDb, generateId } from "./utils";

const db = getDb();

// Sample Corporate Hierarchy Data
// Demonstrates: Parent Companies → Subsidiaries → Brands
// Uses deterministic IDs - safe to run multiple times without creating duplicates

// Entity IDs (deterministic based on name)
const ENTITIES = {
  // Parent Companies
  apple: generateId.entity("Apple Inc."),
  meta: generateId.entity("Meta Platforms Inc."),
  alphabet: generateId.entity("Alphabet Inc."),

  // Apple Subsidiaries
  beats: generateId.entity("Beats Electronics"),
  shazam: generateId.entity("Shazam Entertainment"),

  // Meta Subsidiaries
  instagram: generateId.entity("Instagram"),
  whatsapp: generateId.entity("WhatsApp Inc."),
  oculus: generateId.entity("Oculus VR"),

  // Alphabet Subsidiaries
  google: generateId.entity("Google LLC"),
  youtube: generateId.entity("YouTube LLC"),
  waymo: generateId.entity("Waymo LLC"),
  verily: generateId.entity("Verily Life Sciences"),

  // Brands (children of subsidiaries)
  beatsByDre: generateId.entity("Beats By Dre"),
  beatsMusic: generateId.entity("Beats Music"),
  questVR: generateId.entity("Meta Quest"),
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

const SEED_ENTITIES = [
  // Parent Companies
  {
    id: ENTITIES.apple,
    name: "Apple Inc.",
    type: "Public Company",
    properties: { ticker: "AAPL", sector: "Technology" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: ENTITIES.meta,
    name: "Meta Platforms Inc.",
    type: "Public Company",
    properties: { ticker: "META", sector: "Social Media" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: ENTITIES.alphabet,
    name: "Alphabet Inc.",
    type: "Public Company",
    properties: { ticker: "GOOGL", sector: "Technology" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },

  // Apple Subsidiaries
  {
    id: ENTITIES.beats,
    name: "Beats Electronics",
    type: "Subsidiary",
    properties: { acquiredDate: "2014-05-28", acquiredFor: "$3B" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: ENTITIES.shazam,
    name: "Shazam Entertainment",
    type: "Subsidiary",
    properties: { acquiredDate: "2018-09-24", acquiredFor: "$400M" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },

  // Meta Subsidiaries
  {
    id: ENTITIES.instagram,
    name: "Instagram",
    type: "Subsidiary",
    properties: { acquiredDate: "2012-04-09", acquiredFor: "$1B" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: ENTITIES.whatsapp,
    name: "WhatsApp Inc.",
    type: "Subsidiary",
    properties: { acquiredDate: "2014-02-19", acquiredFor: "$19B" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: ENTITIES.oculus,
    name: "Oculus VR",
    type: "Subsidiary",
    properties: { acquiredDate: "2014-03-25", acquiredFor: "$2.3B" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },

  // Alphabet Subsidiaries
  {
    id: ENTITIES.google,
    name: "Google LLC",
    type: "Subsidiary",
    properties: { note: "Core search and advertising business" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: ENTITIES.youtube,
    name: "YouTube LLC",
    type: "Subsidiary",
    properties: { acquiredDate: "2006-10-09", acquiredFor: "$1.65B" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: ENTITIES.waymo,
    name: "Waymo LLC",
    type: "Subsidiary",
    properties: { focus: "Autonomous vehicles" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: ENTITIES.verily,
    name: "Verily Life Sciences",
    type: "Subsidiary",
    properties: { focus: "Healthcare technology" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },

  // Brands
  {
    id: ENTITIES.beatsByDre,
    name: "Beats By Dre",
    type: "Brand",
    properties: { category: "Consumer Audio" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: ENTITIES.beatsMusic,
    name: "Beats Music",
    type: "Brand",
    properties: { status: "Discontinued 2015", note: "Became Apple Music" },
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: ENTITIES.questVR,
    name: "Meta Quest",
    type: "Brand",
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
    id: generateId.edge(ENTITIES.apple, ENTITIES.beats),
    sourceId: ENTITIES.apple,
    targetId: ENTITIES.beats,
    label: "owns 100%",
    edgeType: "causal" as const,
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: generateId.edge(ENTITIES.apple, ENTITIES.shazam),
    sourceId: ENTITIES.apple,
    targetId: ENTITIES.shazam,
    label: "owns 100%",
    edgeType: "causal" as const,
    createdAt: Date.now(),
    createdBy: "seed_script",
  },

  // Beats → Brands
  {
    id: generateId.edge(ENTITIES.beats, ENTITIES.beatsByDre),
    sourceId: ENTITIES.beats,
    targetId: ENTITIES.beatsByDre,
    label: "brand",
    edgeType: "causal" as const,
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: generateId.edge(ENTITIES.beats, ENTITIES.beatsMusic),
    sourceId: ENTITIES.beats,
    targetId: ENTITIES.beatsMusic,
    label: "brand (discontinued)",
    edgeType: "causal" as const,
    createdAt: Date.now(),
    createdBy: "seed_script",
  },

  // Meta → Subsidiaries
  {
    id: generateId.edge(ENTITIES.meta, ENTITIES.instagram),
    sourceId: ENTITIES.meta,
    targetId: ENTITIES.instagram,
    label: "owns 100%",
    edgeType: "causal" as const,
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: generateId.edge(ENTITIES.meta, ENTITIES.whatsapp),
    sourceId: ENTITIES.meta,
    targetId: ENTITIES.whatsapp,
    label: "owns 100%",
    edgeType: "causal" as const,
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: generateId.edge(ENTITIES.meta, ENTITIES.oculus),
    sourceId: ENTITIES.meta,
    targetId: ENTITIES.oculus,
    label: "owns 100%",
    edgeType: "causal" as const,
    createdAt: Date.now(),
    createdBy: "seed_script",
  },

  // Oculus → Brand
  {
    id: generateId.edge(ENTITIES.oculus, ENTITIES.questVR),
    sourceId: ENTITIES.oculus,
    targetId: ENTITIES.questVR,
    label: "brand",
    edgeType: "causal" as const,
    createdAt: Date.now(),
    createdBy: "seed_script",
  },

  // Alphabet → Subsidiaries
  {
    id: generateId.edge(ENTITIES.alphabet, ENTITIES.google),
    sourceId: ENTITIES.alphabet,
    targetId: ENTITIES.google,
    label: "owns 100%",
    edgeType: "causal" as const,
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: generateId.edge(ENTITIES.alphabet, ENTITIES.youtube),
    sourceId: ENTITIES.alphabet,
    targetId: ENTITIES.youtube,
    label: "owns 100%",
    edgeType: "causal" as const,
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: generateId.edge(ENTITIES.alphabet, ENTITIES.waymo),
    sourceId: ENTITIES.alphabet,
    targetId: ENTITIES.waymo,
    label: "owns 100%",
    edgeType: "causal" as const,
    createdAt: Date.now(),
    createdBy: "seed_script",
  },
  {
    id: generateId.edge(ENTITIES.alphabet, ENTITIES.verily),
    sourceId: ENTITIES.alphabet,
    targetId: ENTITIES.verily,
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
    console.log("📦 Adding entities...");
    for (const entity of SEED_ENTITIES) {
      await db.transact([db.tx.entities[entity.id].update(entity)]);
    }
    console.log(`✅ Added ${SEED_ENTITIES.length} entities`);

    // Add events
    console.log("📅 Adding events...");
    for (const event of SEED_EVENTS) {
      await db.transact([db.tx.events[event.id].update(event)]);
    }
    console.log(`✅ Added ${SEED_EVENTS.length} events`);

    // Add edges
    console.log("🔗 Adding edges...");
    for (const edge of SEED_EDGES) {
      await db.transact([db.tx.edges[edge.id].update(edge)]);
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
