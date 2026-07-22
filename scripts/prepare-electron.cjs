/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const standalone = path.join(root, '.next', 'standalone');
const staticSource = path.join(root, '.next', 'static');
const staticDestination = path.join(standalone, '.next', 'static');
const publicSource = path.join(root, 'public');
const publicDestination = path.join(standalone, 'public');
const prismaEngineSource = path.join(root, 'node_modules', '.prisma');
const prismaEngineDestination = path.join(standalone, 'node_modules', '.prisma');

if (!fs.existsSync(path.join(standalone, 'server.js'))) {
  throw new Error('Missing .next/standalone/server.js. Run `pnpm build` first.');
}

fs.mkdirSync(path.dirname(staticDestination), { recursive: true });
fs.cpSync(staticSource, staticDestination, { recursive: true });
fs.cpSync(publicSource, publicDestination, { recursive: true });

// Prisma's native query engine is not always discovered by Next output tracing.
// Copy its generated runtime next to the traced @prisma/client package.
if (!fs.existsSync(prismaEngineSource)) {
  throw new Error('Missing generated Prisma engine. Run `pnpm prisma generate` first.');
}
fs.mkdirSync(path.dirname(prismaEngineDestination), { recursive: true });
fs.cpSync(prismaEngineSource, prismaEngineDestination, { recursive: true });
