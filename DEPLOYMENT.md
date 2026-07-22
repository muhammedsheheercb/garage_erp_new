# Garage ERP: web and Electron deployment

This repository contains one Next.js application. The website and the Electron
desktop app both execute the same App Router pages, Server Actions, session
code, and Prisma client. Electron starts the standalone Next.js server locally
and opens `http://127.0.0.1:3001`; it does not contain a second UI, API, or
database.

## Shared configuration

Create a root `.env` from `.env.example` for local development. Set the same
values in the web host and in the environment that launches the desktop app:

- `DATABASE_URL`: Neon PostgreSQL pooled connection string, including TLS.
- `AUTH_SECRET`: one long random value shared by both deployments.
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`: a stable base64-encoded 32-byte key for
  a multi-instance web deployment.

Never put these values in `NEXT_PUBLIC_*`, source code, or the installer.

## Initialize Neon

The old `prisma/dev.db` is SQLite and is deliberately no longer used. Create
the Neon schema from the current Prisma schema before using either runtime:

```bash
pnpm prisma db push
pnpm prisma db seed
```

For a production change-management workflow, create and commit a PostgreSQL
migration against a disposable PostgreSQL database, then apply it to Neon with
`pnpm prisma migrate deploy`. Existing SQLite data needs a one-time, reviewed
data migration; do not point both runtimes at SQLite during that move.

## Website

Set the three shared environment variables in Vercel (or the chosen Node.js
host), then deploy normally:

```bash
pnpm build
```

The host runs the same application and connects to Neon through Prisma.

## Windows desktop app

Build the installer with:

```bash
pnpm electron:build
```

For the release installer, use the included GitHub Actions workflow. It builds
on `windows-latest`, so Prisma generates the native Windows query engine before
Electron packages it. This is the supported release path when development is
on Linux or macOS.

Before launching the packaged app, make `DATABASE_URL` and `AUTH_SECRET`
available in its process environment. The Electron main process passes only
those existing values to its local Next.js server; it never overrides them with
a SQLite path. This is required for the desktop app to read and write the same
Neon database as the website.

Direct database access from a distributed desktop binary means its database
credential is reachable by that machine. Use a least-privilege Neon role and
credential rotation, or change the desktop app to open the hosted HTTPS site if
you cannot accept that credential-distribution trade-off.

## Verification

With both runtimes configured to the same `DATABASE_URL`, create or change a
customer, vehicle, mechanic, inventory item, supplier, purchase, invoice, and
payment in one runtime. Refresh the matching page in the other runtime; it
reads the same Neon rows. Reports and settings use the same Prisma client and
tables. Login uses the same `Admin` table and encrypted cookie implementation,
with separate browser cookie stores per origin.
