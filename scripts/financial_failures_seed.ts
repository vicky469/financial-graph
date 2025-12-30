import { getDb } from "./utils";
import { v4 as uuidv4 } from "uuid";

const db = getDb();

// Definitions
const SEED_EVENTS = [
  {
    title: "Fed Raises Rates Aggressively",
    description: "Fed begins aggressive rate hiking cycle",
    isTrigger: true,
    date: "2022-03-16",
  },
  {
    title: "Tech Valuations Plummet",
    description: "Rising rates cause tech stock correction",
    isTrigger: false,
    date: "2022-06-01",
  },
  {
    title: "Startups Burn Cash Faster",
    description: "VC funding dries up",
    isTrigger: false,
    date: "2022-09-01",
  },
  {
    title: "SVB Clients Withdraw Deposits",
    description: "Tech companies draw down deposits",
    isTrigger: false,
    date: "2023-03-08",
  },
  {
    title: "SVB Sells Bond Portfolio at Loss",
    description: "Bank sells underwater bonds",
    isTrigger: false,
    date: "2023-03-08",
  },
  {
    title: "SVB Stock Crashes 60%",
    description: "Stock plummets on losses",
    isTrigger: false,
    date: "2023-03-09",
  },
  {
    title: "Bank Run Accelerates",
    description: "$42B in withdrawals",
    isTrigger: false,
    date: "2023-03-10",
  },
  {
    title: "FDIC Takes Over SVB",
    description: "Bank seized by regulators",
    isTrigger: false,
    date: "2023-03-10",
  },
  {
    title: "Signature Bank Fails",
    description: "Contagion spreads",
    isTrigger: false,
    date: "2023-03-12",
  },
  {
    title: "Fed Creates BTFP",
    description: "Emergency lending program",
    isTrigger: false,
    date: "2023-03-12",
  },
];

const SEED_EDGES: [number, number, "causal" | "simultaneous"][] = [
  [0, 1, "causal"],
  [1, 2, "simultaneous"],
  [2, 3, "causal"],
  [3, 4, "causal"],
  [4, 5, "causal"],
  [5, 6, "causal"],
  [6, 7, "causal"],
  [7, 8, "causal"],
  [8, 9, "causal"],
  [7, 9, "causal"],
];

const SEED_ENTITIES = [
  {
    name: "Federal Reserve",
    type: "Regulator",
    properties: { "Rate Policy": "Aggressive" },
  },
  {
    name: "Silicon Valley Bank",
    type: "Bank",
    properties: { "Asset Size": "$209B" },
  },
  {
    name: "Tech Sector",
    type: "Market",
    properties: { Dependency: "High" },
  },
  {
    name: "Tech Startups",
    type: "Sector",
    properties: { "Funding Status": "Constrained", "Cash Burn": "High" },
  },
];

async function seed() {
  console.log("Generating IDs...");
  const eventIds = SEED_EVENTS.map(() => uuidv4());
  const entityIds = SEED_ENTITIES.map(() => uuidv4());

  console.log("Preparing transactions...");

  // Events
  const eventOps = SEED_EVENTS.map((e, i) =>
    db.tx.events[eventIds[i]].update({
      ...e,
      createdAt: Date.now(),
      createdBy: "Seed Script",
    })
  );

  // Entities
  const entityOps = SEED_ENTITIES.map((e, i) =>
    db.tx.entities[entityIds[i]].update({
      ...e,
      createdAt: Date.now(),
      createdBy: "Seed Script",
    })
  );

  // Edges (Events to Events)
  const edgeOps = SEED_EDGES.map(([s, t, type]) =>
    db.tx.edges[uuidv4()].update({
      sourceId: eventIds[s],
      targetId: eventIds[t],
      label: "led to",
      edgeType: type,
      createdAt: Date.now(),
      createdBy: "Seed Script",
    })
  );

  // Entity Edges (Entities to Events)
  // 0: Fed -> 0: Fed Raises Rates
  // 1: SVB -> 3: Withdrawals
  // 3: Tech Startups -> 2: Startups Burn Cash Faster
  const entityEdgeData: { s: number; t: number; label?: string }[] = [
    { s: 0, t: 0 },
    { s: 1, t: 3 },
    { s: 3, t: 2 },
  ];

  const entityEdgeOps = entityEdgeData.map(({ s, t, label }) =>
    db.tx.edges[uuidv4()].update({
      sourceId: entityIds[s],
      targetId: eventIds[t],
      label: label || "", // Empty string if no label
      edgeType: "causal",
      createdAt: Date.now(),
      createdBy: "Seed Script",
    })
  );

  console.log(
    `Seeding ${eventOps.length} events, ${entityOps.length} entities, and connections...`
  );

  await db.transact([...eventOps, ...entityOps, ...edgeOps, ...entityEdgeOps]);

  console.log("Done!");
}

seed().catch(console.error);
