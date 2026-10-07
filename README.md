# Garage ERP

Next.js web application and Electron desktop wrapper, sharing a PostgreSQL database and server actions. See [DEPLOYMENT.md](DEPLOYMENT.md) for hosting, Windows releases and backup storage requirements.

## Development and verification

Use Node.js 22 and pnpm 10.25.0. Install with `pnpm install --frozen-lockfile`, copy `.env.example` to `.env`, configure the database and session secret, and run `pnpm prisma generate` followed by `pnpm dev`.

- `pnpm lint`: repository lint checks; generated build output is excluded.
- `pnpm typecheck`: strict TypeScript checks. Run `pnpm exec next typegen` first in a fresh checkout to generate route types.
- `pnpm test`: financial/stock/date regression checks and database backup/scheduler tests using isolated fixtures.
- `node scripts/supplier-payment-date-check.mjs`: independent supplier payment reporting check, without database writes.
- `pnpm prisma validate`: database schema validation.
- `pnpm build`: generate Prisma Client and build the production application.
- `pnpm electron:prepare`: prepare the standalone server assets after a successful build.
- `pnpm test:smoke`: verify the prepared production HTTP server, assets and protected-route redirects with isolated database credentials; does not exercise browser hydration.

Initialize a new admin only through the reviewed deployment setup. Seeding requires `INITIAL_ADMIN_EMAIL` and a password of at least 12 characters in `INITIAL_ADMIN_PASSWORD`; it never resets an existing admin or deletes other admins. No credentials belong in source control or installers. Repair scripts in `scripts/` can change live financial data and are manual tools, not startup tasks.

## Purchase cancellation

Before deploying this feature to an existing database, run `pnpm db:add-purchase-cancellation`, then rebuild. Purchases → Cancel Purchase archives the original purchase and reverses its active purchase, payment, outstanding balance and stock records in one transaction. Vehicle parts are removed and job-card/invoice totals recalculated; purchased pending parts return to pending status. The Cancelled Purchases button opens a modal showing the latest 50 cancellations, original totals, reversed payments, cleared balances and cancellation details. Cancelled purchases disable their original action buttons. Users with Purchases → Restore Purchase permission can use the restore icon after confirmation. Restoration recreates original items, stock batches, payment history and supplier balances atomically, and recalculates job-card/invoice totals. It rejects missing suppliers/items/ledgers, closed job cards and pending or vehicle parts already replaced. Repeated restores never duplicate stock or payments; restored purchases return to the active list. Restoration identity and time remain recorded in the archive. Cancelled purchase numbers remain reserved.

Cancellation corrects recorded entries; it does not return real money from a supplier. Stock already sold, consumed or reserved elsewhere, completed job cards and reimbursed payments block cancellation with a readable message. Historical reimbursement entries do not identify their purchase, so they cannot safely be reversed automatically. `pnpm test:purchase-cancellation-db` verifies stock, vehicle and pending-parts cancellation and restoration against the configured database using temporary fixtures that always roll back. Take a new database backup after upgrading: snapshots from before this schema change do not match the new backup schema.

## Database backups

Settings database backups use PostgreSQL snapshots of all application tables, including accounts and settings. Administrators can create and restore backups from Settings → Database Management. Restore validates the schema, saves a safety snapshot, and replaces the application data in one transaction. Backups from the previous SQLite implementation are not compatible.

Snapshots are private JSON files stored outside the project by default, in `.garage-erp/backups` under the server user's home directory. The directory is created when the first backup is saved, with private directory and file permissions. Set `BACKUP_DIRECTORY` to an absolute path to a writable persistent directory for hosted or packaged deployments; all server instances must share that directory to display the same backups. Keep this directory outside publicly served assets. Backups contain application data only, not PostgreSQL roles, database extensions, or migration history.

If upgrading from the previous `prisma/backups` location, copy existing snapshot files into the new directory to make them available in Settings, or set `BACKUP_DIRECTORY` to the old directory until you migrate them. Existing files are not moved automatically.

Run the backup checks with `node --import tsx --test src/features/settings/database-backup.test.ts src/features/settings/weekly-backup.test.ts`.

Automatic cleanup keeps the latest five snapshots in total, including restore safety backups. Older snapshots are deleted after a successful backup or restore, and when the backup list is opened in Settings. Failed backup writes or restores do not trigger cleanup. Download any snapshots you want to keep longer before they expire.

Each backup shows its creation date and time in the browser's local timezone. Administrators can delete individual backups after confirmation; deleting a backup file does not change the current database.

The running Next.js server automatically creates a backup every Friday at 12:00 PM in `BACKUP_TIMEZONE` (default `Asia/Muscat`). It checks once per minute, retries failures during Friday afternoon, and records the completed week in PostgreSQL to avoid duplicate scheduled backups across restarts and server instances. A PostgreSQL transaction lock prevents simultaneous scheduled backups. Automatic backups share the five-snapshot retention limit with manual and restore safety backups. Set `WEEKLY_BACKUP_ENABLED=false` on development servers or instances that should not schedule backups.

The server must remain running for this schedule; sleeping/serverless hosts need an external scheduler and persistent backup storage. If the server starts later on Friday after noon, the backup runs immediately. If it stays offline until Saturday, that week's automatic backup is missed. Desktop backups require the application to remain open. Multiple scheduling instances must share the same persistent backup directory. Cloud storage is not configured.

Use Download beside a backup to keep a private copy outside the server. Creation, listing, download, deletion, and restoration require an administrator account. Hosts with temporary or read-only disks need persistent storage configured before using this feature. Uploaded files are not included in database snapshots.
