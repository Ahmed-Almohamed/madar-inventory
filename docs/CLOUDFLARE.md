# Deploying to Cloudflare

Madar runs on a Worker with a D1 database bound as `DB`. GitHub Pages alone cannot run the API.

## First deployment to your own account

```sh
npm ci
npm run check
npx wrangler login
npx wrangler d1 create madar-db
```

Set `database_id` in `wrangler.jsonc` to the ID returned by the create command. The checked-in configuration points to the existing Madar installation; replace it when deploying your own copy. Keep the `DB` binding and migrations directory intact. Database IDs are not secrets; API tokens should never be committed.

```sh
npm run db:remote
npm run build
npm run deploy
```

Wrangler prints the deployed URL. All data APIs require login. Provision the first administrator after migration 0010 and before deploying the authenticated version. Run scripts/provision-admin.mjs with username/password JSON on stdin, then execute backups/admin-bootstrap.sql using Wrangler against the intended database. Never commit that file. Employee accounts are then managed inside the app.

## Updating an existing installation

1. Export a fresh backup of the production database.
2. Run `npm run check` and `npm run build`.
3. Apply pending migrations with `npm run db:remote`.
4. Deploy with `npm run deploy`.
5. Check the app's pages, images, reports, and language switch.

Keep production and local data separate. The `dev` and `db:local` scripts use `wrangler.local.jsonc`; remote commands use `wrangler.jsonc`.

## Migrations

| Migration | Adds |
| --- | --- |
| `0001` | Products, warehouses, sales, and stock movements |
| `0002` | Technicians and installation fees |
| `0003` | Governorates and technician-to-warehouse links |
| `0004` | Product photos |
| `0005` | Shipping fees |
| `0006` | SIM codes, sale revisions, and stock reconciliation for sale edits |
| `0007` | Stock history with before/after quantities |
| `0008` | Independent customer directory and business categories |
| `0009` | Independent technician custody and atomic transfers |
| `0010` | Accounts, sessions, employee activity and Syria expenses |
| `0011` | Atomic Odoo outbox, initial snapshot and per-table change capture |

## Odoo secret

Set `ODOO_API_KEY` using `wrangler secret put ODOO_API_KEY` with the key on standard input, never in command arguments or source. The production configuration enables immediate delivery and a one-minute retry cron. Local configuration leaves delivery disabled. See [Odoo synchronization](ODOO-PLAN.md) for scope, permissions, retry behavior and recovery.

Do not delete or rewrite applied migrations. Add a new migration for future schema changes.

## Backups

Create a `backups` directory if it does not already exist, then export with a new filename each time:

```sh
npx wrangler d1 export DB --remote --output=backups/remote-YYYY-MM-DD.sql
npx wrangler d1 export DB --local --config wrangler.local.jsonc --output=backups/local-YYYY-MM-DD.sql
```

Exports contain customer records and images. Keep them out of Git; `backups/` is already ignored.

## Moving local data

Local records are not uploaded during deployment. Test a full import into a separate, empty D1 database before switching production to it. Do not import over existing sales or apply migrations to an imported schema without checking its `d1_migrations` records.

The import helper orders tables before data, places triggers after data, and validates foreign keys in a temporary SQLite database:

```sh
node scripts/prepare-import.mjs backups/local.sql backups/import.sql
```

It refuses to overwrite an existing output file. Its output is intended for an **empty database only**. Verify stock quantities, sale totals, and migration records after importing. There is no automatic local-to-production data sync.

## References

- [D1 import and export](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Workers pricing and quotas](https://developers.cloudflare.com/workers/platform/pricing/)
- [D1 pricing and quotas](https://developers.cloudflare.com/d1/platform/pricing/)

GitHub Actions only runs checks and a deployment dry run. It does not create D1 databases, publish the Worker, or require Cloudflare secrets.
