# Production cleanup report

## Scope and safety

Reviewed the App Router frontend, Server Actions, API routes, Prisma schema and query patterns, authentication/permissions, shared components, services, dependencies, environment variable usage, tests, CI, and web/Electron deployment. Read the installed Next.js guides before editing. No production data, schema, financial formulas, stock rules, payment history, receipt dates, or existing migration/repair scripts were changed or executed against a live database. No credentials are included here.

## 1. Files removed

Reference searches and the source import graph confirmed these were unused or obsolete:

- `patch_purchase_actions.js`: obsolete source-patching script.
- `scratch.ts`, `test_action.ts`, `tsc.log`: development scratch files and compiler output.
- `src/components/ui/date-range-picker.tsx.patch`: abandoned patch artifact.
- `src/components/ui/drawer.tsx`, `dropdown-menu.tsx`, `tooltip.tsx`: unreferenced UI components.
- `src/store/store.ts`: unused sidebar state store.

Preserved and moved three files: `update-expenses.ts` → `scripts/repair-expense-balances.ts`, `tests/payment-methods.test.cjs` → `.mjs`, and `scripts/supplier-payment-date-check.cjs` → `.mjs`. The financial repair script remains a manual tool.

## 2. Dead code removed

Removed unused imports, callback annotations, destructured values/state, the unreferenced legacy `getDetailedReportData`, unused `deleteSupplierPayment` and `isAuthenticated` exports, redundant search/dialog synchronization effects, duplicate hover prefetching, a reports detail request whose result was not displayed, and verbose desktop logout debug logs. Removed the global console override that hid React warnings; operational error logging remains.

## 3. Dependencies

Removed confirmed unused `oman-currency` from package.json and the lockfile. Moved `shadcn` to development dependencies while retaining its existing resolved version, because its CSS is consumed during the build. Keep development dependencies installed when building. Next.js and its matching ESLint configuration received a security update from 16.2.10 to 16.3.6 in response to audit findings. Electron was updated within version 43, from 43.1.1 to 43.5.0, to resolve four desktop runtime advisories. Compatible transitive security overrides pin Nano ID 3.3.18, Browserslist 4.28.7, and baseline-browser-mapping 2.11.0; no major upgrades were made. Declared pnpm 10.25.0, documented Node.js 22, and aligned Windows CI with these tools and a frozen lockfile.

## 4. Refactoring

Replaced explicit `any` and redundant callback casts with inferred server-action/Prisma contracts, typed form input/output boundaries, and shared type-only view models. Consolidated the direct-payment paymeter lookup into `src/lib/paymeter.ts`. Replaced render-time form `watch` calls with `useWatch` subscriptions. Simplified selection and dialog state without changing save calculations. Retained standalone web/Electron architecture and maintenance scripts. Updated setup/deployment documentation and added runnable test/typecheck/smoke scripts.

## 5. Performance

Removed an unused report query and redundant router prefetch call. Reduced unnecessary state synchronization renders and scroll-listener reattachment. QueryClient is now created once per provider instance instead of sharing a mutable module singleton across server requests. Scroll throttling now cleans up its timer and uses a passive listener. Desktop readiness checks poll sequentially instead of overlapping HTTP requests, consume responses, and time out stalled requests. Print images keep eager, unoptimized loading and existing layout/source behavior. These are code-level improvements, not measured latency or load-test claims.

## 6. Security

Settings/account/tax mutations now require admin authorization on the server. Report-only actions require Reports View permission; dashboard/recent-activity reads require a session, preserving dashboard access for signed-in employees. Added regression checks for authorization before database access. Login return URLs are restricted to local application paths. Seed initialization requires explicit credentials and preserves existing admins instead of resetting/deleting them. Added ignore rules for local database files and compiler output. Existing tracked SQLite data remains untouched and requires review.

The final **production dependency audit reports zero findings**. The complete dependency audit, including development/desktop build tooling, reports **0 critical, 46 high, 41 moderate, and 7 low findings**. These are registry advisory findings, not proof that each application path is exploitable. Moving build tooling out of production does not fix its development advisories. Remaining tooling advisories need assessment before release; this pass does not provide an unconditional security clearance.

The framework update resolves the reported critical Windows, AVIF image optimization, and ImageResponse advisories. Electron 43.5.0 resolves the four reported Electron runtime advisories. Electron's local binary install script was deliberately not run during the package update; Windows CI must install and validate the updated runtime before shipping an installer. The hosted web production dependency tree is clean in the final audit.

Remaining development/build-tool advisory groups:

| Package | Severities | Advisory entries | Example source |
| --- | --- | --- | --- |
| @hono/node-server | moderate | 1 | [Registry advisory](https://github.com/advisories/GHSA-frvp-7c67-39w9) |
| @xmldom/xmldom | high, moderate | 10 | [Registry advisory](https://github.com/advisories/GHSA-6gmq-8vp8-gcm6) |
| axios | high, moderate | 12 | [Registry advisory](https://github.com/advisories/GHSA-vh66-26gq-q6x8) |
| brace-expansion | high, moderate | 15 | [Registry advisory](https://github.com/advisories/GHSA-mh99-v99m-4gvg) |
| braces | high | 1 | [Registry advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) |
| fast-uri | high, moderate | 8 | [Registry advisory](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx) |
| hono | low, moderate | 8 | [Registry advisory](https://github.com/advisories/GHSA-8j4g-w8fx-2239) |
| http-cache-semantics | high | 1 | [Registry advisory](https://github.com/advisories/GHSA-ch52-4w7c-c8xp) |
| ip-address | high, moderate | 7 | [Registry advisory](https://github.com/advisories/GHSA-mwp4-54f8-5fhr) |
| joi | high, low | 3 | [Registry advisory](https://github.com/advisories/GHSA-6w3j-5fw6-r9vr) |
| js-yaml | high | 2 | [Registry advisory](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) |
| postcss | moderate | 1 | [Registry advisory](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) |
| qs | moderate | 2 | [Registry advisory](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx) |
| shell-quote | high | 1 | [Registry advisory](https://github.com/advisories/GHSA-395f-4hp3-45gv) |
| tar | high | 1 | [Registry advisory](https://github.com/advisories/GHSA-r292-9mhp-454m) |
| undici | high, low, moderate | 21 | [Registry advisory](https://github.com/advisories/GHSA-8xcm-r25x-g524) |

Do not blindly apply major build-tool upgrades or blanket audit fixes: assess patched ranges and exercise Windows packaging in CI. Revisit the three compatible overrides when upstream dependencies incorporate their fixes. SQL reviewed uses parameterized Prisma queries or schema-derived quoted identifiers; no new SQL or HTML rendering scheme was introduced.

## 7. Verification

- `pnpm lint`: passed, zero errors and warnings. Generated `dist/` output is correctly ignored; lint rules were not weakened.
- `pnpm typecheck`: passed, including generated route validation. A corrupt development-generated validator was removed and Next regenerated route types; source/typecheck errors were not suppressed.
- `pnpm test`: 44 financial/stock/date/authorization/navigation regression tests and 4 backup/scheduler tests passed (48 total), using isolated fixtures.
- `node scripts/supplier-payment-date-check.mjs`: passed; supplier totals/details use payment date.
- `pnpm prisma validate`: passed.
- `git diff --check`, `node --check main.js`: passed.
- `pnpm install --frozen-lockfile --lockfile-only --offline --ignore-scripts`: passed.
- `pnpm audit --prod --json` and `pnpm audit --json`: completed with findings above; production audit passes; the full tooling audit remains nonzero.
- Final reference scans found no stale references to removed/moved application modules and no TypeScript `any` annotations or temporary debug logs in application source.

## 8. Build

`pnpm build` passed with Next.js 16.3.6/Turbopack, Prisma generation, TypeScript validation, static generation and route optimization. `pnpm electron:prepare` passed. `pnpm test:smoke` passed against the prepared standalone server: login shell and compiled JavaScript returned 200; anonymous requests to `/`, `/jobcards`, `/purchases`, `/reports`, and `/api/backups` redirected to login. The smoke server uses dummy database credentials and disables scheduled backups. It checks HTTP behavior, not browser hydration or interactive forms. Sandbox restrictions required running compilation and socket-based checks outside the sandbox; the normal production build command was retained.

## 9. Remaining technical debt

Large job card/purchase/quotation forms remain candidates for gradual extraction with browser coverage. Financial tests use mocked database models; they do not prove real PostgreSQL concurrency behavior. There are no automated hydrated-browser workflows or Windows installer runtime tests in this repository. Login has no dedicated rate limiting. Existing session revocation/page permissions rely partly on cookie snapshots; inactive employee access and account/session revocation need a separate policy review. Production schema changes still need reviewed PostgreSQL migrations rather than relying on `db push` alone. Backup scheduling needs an always-running process and shared persistent storage; serverless deployments require an external scheduler. Desktop deployments distribute direct database access credentials and need a least-privilege deployment review.

## 10. Manual review before release

1. Resolve/assess remaining development and build-tool advisories, and review the compatible transitive version overrides during future dependency maintenance.
2. Review and remove the tracked `prisma/dev.db` from Git/history if no longer needed; ignore rules do not untrack it. It may contain private historical data. No database file was opened or deleted in this pass.
3. Rotate any previously hardcoded/default or exposed credentials. Verify private production environment values and backup storage; no secret values were printed.
4. Run real PostgreSQL integration/concurrency tests on a disposable database and browser checks for nested dialogs, quotation conversion, job card/purchase edits, invoices/printing, stock deduction, payments and role permissions.
5. Build and launch the Windows installer through CI with Electron 43.5.0, and validate hosted/desktop parity and backups. Only server preparation was validated locally; the updated Electron binary was not downloaded or launched here.
6. Review public assets and historical repair/migration scripts before deleting them; uncertain or externally referenced resources were preserved.

All changes remain uncommitted for review. No deployment, production migration, seed, or financial data repair was performed.
