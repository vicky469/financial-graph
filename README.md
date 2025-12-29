# Financial Failure Tracker

A visual graph-based tool for tracking and analyzing cascading financial failure events with entity relationships.

## Features

- **Interactive Graph Visualization**: Visualize financial events and entities as an interactive node graph using React Flow
- **Event Timeline**: Track causal and simultaneous event relationships in financial crises
- **Entity Management**: Create and link entities (banks, regulators, sectors) to events
- **Edit History**: Full undo/redo support with detailed change tracking
- **Real-time Collaboration**: Multi-user selection indicators
- **Programmatic Seeding**: Populate data via TypeScript scripts

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Database**: InstantDB (real-time sync)
- **Graph**: React Flow
- **State**: XState (state machines)
- **Styling**: Vanilla CSS

## Project Structure

```
src/
├── components/          # React components
│   ├── FailureGraph.tsx    # Main graph visualization
│   ├── Sidebar.tsx         # Event/entity editing panel
│   ├── EditHistory.tsx     # Undo/redo panel
│   ├── EventNode.tsx       # Event node component
│   └── EntityNode.tsx      # Entity node component
├── db/                  # Database layer
│   ├── client.ts           # DB initialization
│   ├── schema.ts           # InstantDB schema
│   ├── queries.ts          # Query hooks
│   └── repos/              # Domain repositories
│       ├── events.ts       # Event CRUD
│       ├── entities.ts     # Entity CRUD
│       ├── edges.ts        # Edge CRUD
│       ├── users.ts        # User selections
│       └── history.ts      # Edit history
├── machines/            # XState state machines
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
└── scripts/             # Data seeding scripts
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Create .env file with your InstantDB credentials
cat > .env << EOF
VITE_INSTANTDB_APP_ID=your-app-id-here
INSTANTDB_ADMIN_TOKEN=your-admin-token-here
EOF
```

### Development

```bash
# Start dev server
npm run dev

# Seed example data (SVB crisis example)
npx tsx scripts/seed_example.ts
```

### Building

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Data Model

### Events

- Title, description, date
- Trigger flag (root cause events)
- Created by/at metadata

### Entities

- Name, type (Bank, Regulator, Sector)
- Custom properties (key-value pairs)
- Aliases for matching

### Edges

- Source → Target relationships
- Edge types: `causal` (sequential) or `simultaneous` (parallel)
- Optional labels

## Roadmap

- [ ] Auto-entity detection from event titles (Gemini API)
- [ ] Verifiable sources for events
- [ ] Event aliases for entity matching
- [ ] Automated event-event chain inference
- [ ] Serverless functions for LLM integration (Vercel)

## License

MIT
