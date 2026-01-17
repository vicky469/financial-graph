# Subsidiary Tree Structure Implementation

## Summary

Added hierarchical tree view for company subsidiaries in the left panel, showing parent-child relationships with ownership percentages.

## Changes Made

### 1. New Component: SubsidiaryTree (`frontend/src/components/Sidebar/SubsidiaryTree.tsx`)
- **Tree visualization** with expand/collapse functionality
- **Auto-expands** first 2 levels for better UX
- **Shows ownership percentages** next to each subsidiary
- **Visual indicators**:
  - Blue dot for parent companies (with children)
  - Gray dot for leaf subsidiaries
  - Chevron icons for expand/collapse
- **Indentation** based on hierarchy level
- **Hover effects** for better interactivity

### 2. Updated Query: `useCompanySubsidiaries` (`frontend/src/db/queries.ts`)
- **Fetches hierarchical data** using InstantDB's link traversal
- **Builds tree structure** recursively from parent-child relationships
- **Returns both**:
  - `subsidiaryTree`: Hierarchical structure for tree view
  - `subsidiaries`: Flat list for backward compatibility
- **Includes ownership percentages** from `parent_of` edges

### 3. Updated Component: Company (`frontend/src/components/Sidebar/Company.tsx`)
- **Replaced flat list** with `SubsidiaryTree` component
- **Maintains count** in section header
- **Loading states** handled properly

## Features

### Tree Structure
```
Apple Inc.
├─ 100% Beats Electronics
│  ├─ 100% Beats By Dre (subsidiary)
│  └─ 100% Beats Music (subsidiary)
└─ 100% Shazam Entertainment
   └─ 100% Shazam UK (subsidiary)
```

### User Experience
- **Click to expand/collapse** branches
- **Hover highlighting** for better navigation
- **Ownership percentages** shown inline
- **Responsive indentation** shows hierarchy depth
- **Empty state** when no subsidiaries exist

## Database Schema Used

The implementation leverages:
- **`companies` table**: Company records
- **`parent_of` edges**: Parent-child relationships with ownership percentages
- **InstantDB links**: `companies.subsidiaries` relationship for efficient querying

## Query Pattern

```typescript
{
  companies: {
    $: { where: { id: companyId } },
    subsidiaries: {
      parent_of: {}  // Fetch ownership data
    }
  }
}
```

This fetches:
1. The parent company
2. All its subsidiaries (via the `subsidiaries` link)
3. The `parent_of` edges containing ownership percentages

## Next Steps

### Graph Visualization (Treemap)
To show the tree structure in the graph:

1. **Update graph layout** to use hierarchical/treemap layout
2. **Add visual grouping** for parent-child relationships
3. **Size nodes** based on ownership percentage or number of subsidiaries
4. **Add expand/collapse** in graph view
5. **Sync selection** between tree view and graph

### Suggested Libraries
- **dagre** (already installed): For hierarchical layouts
- **d3-hierarchy**: For treemap layouts
- **reactflow** (already installed): Has built-in support for nested nodes

## Testing

To test the tree view:
1. Start frontend: `cd financial-graph/frontend && bun run dev`
2. Click on a company with subsidiaries (e.g., "Apple Inc.")
3. View the "Structure" section in the left panel
4. Click chevrons to expand/collapse branches
5. Hover over subsidiaries to see hover effects

## Notes

- Tree automatically expands first 2 levels for better initial view
- Ownership percentages are shown when available
- Empty state shown when company has no subsidiaries
- Component is fully typed with TypeScript
- Responsive design works with sidebar resizing
