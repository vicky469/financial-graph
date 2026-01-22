# Subsidiary Type Migration

## Background

Previously, all subsidiaries were incorrectly classified as `PRIVATE` companies (type 2). We now have a dedicated `SUBSIDIARY` type (type 6) that should be used for companies that have parent relationships.

## Migration Script

The script `migrate-subsidiaries-to-type-6.ts` will:

1. Find all companies with `type = 2` (PRIVATE)
2. Check which ones have parent relationships (are subsidiaries)
3. Update those companies to `type = 6` (SUBSIDIARY)

## Usage

### Dry Run (Recommended First)

Run a dry run to see what would be changed without modifying the database:

```bash
cd backend
bun run src/scripts/migrate-subsidiaries-to-type-6.ts --dry-run
```

This will show:
- How many PRIVATE companies exist
- How many are actually subsidiaries (have parent relationships)
- A sample of companies that would be updated

### Live Migration

Once you've reviewed the dry run output and are ready to proceed:

```bash
cd backend
bun run src/scripts/migrate-subsidiaries-to-type-6.ts
```

**Note:** The script will wait 5 seconds before starting to give you a chance to cancel (Ctrl+C).

## What Gets Updated

- **Companies with parent relationships**: Updated from type 2 → type 6
- **True private companies**: Remain as type 2 (no parent relationships)

## Verification

The script automatically verifies the migration by:
1. Checking that no PRIVATE companies still have parent relationships
2. Counting the total number of SUBSIDIARY companies after migration

## Safety Features

- **Dry run mode**: Test without making changes
- **Batch processing**: Updates in batches of 100 to avoid overwhelming the database
- **Progress logging**: Shows progress during migration
- **Error handling**: Logs errors and continues with remaining batches
- **Verification**: Confirms migration was successful

## Expected Results

After running this migration:
- All subsidiaries will have `type = 6` (SUBSIDIARY)
- True private companies will remain `type = 2` (PRIVATE)
- ID generation for new subsidiaries will use the correct type

## Rollback

If you need to rollback (not recommended), you can manually update:

```sql
UPDATE company 
SET type = 2 
WHERE type = 6;
```

However, this would revert to the incorrect classification.
