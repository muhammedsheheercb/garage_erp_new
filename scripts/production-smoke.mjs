import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'

// Exercise the packaged HTTP server without connecting to a real database.
const root = fileURLToPath(new URL('../', import.meta.url))
const port = 31847
const base = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, ['.next/standalone/server.js'], {
  cwd: root,
  env: { ...process.env, NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: String(port),
    DATABASE_URL: 'postgresql://smoke:smoke@127.0.0.1:1/smoke',
    AUTH_SECRET: 'isolated-production-smoke-test-session-secret', WEEKLY_BACKUP_ENABLED: 'false' },
  stdio: 'ignore',
})
let startupError
server.on('error', error => { startupError = error })
try {
  let login
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (startupError) throw startupError
    assert.equal(server.exitCode, null, 'Production server exited before becoming ready')
    try {
      login = await fetch(`${base}/login`, { signal: AbortSignal.timeout(1000) })
      break
    } catch { await new Promise(resolve => setTimeout(resolve, 200)) }
  }
  assert.ok(login, 'Production server did not become ready within 30 seconds')
  assert.equal(login.status, 200)
  const html = await login.text()
  // Login uses useSearchParams and renders its interactive form after hydration.
  // This HTTP check verifies the production shell and assets; browser tests are separate.
  assert.match(html, /<title>Bin Matar Garage<\/title>/)
  const asset = html.match(/src="([^\"]*\/_next\/static\/[^\"]+)"/)
  assert.ok(asset, 'Login page must reference a compiled JavaScript asset')
  assert.equal((await fetch(new URL(asset[1], base))).status, 200)
  for (const path of ['/', '/jobcards', '/purchases', '/reports', '/api/backups']) {
    const response = await fetch(`${base}${path}`, { redirect: 'manual' })
    assert.equal(response.status, 307, `${path} must redirect anonymous requests`)
    assert.equal(new URL(response.headers.get('location'), base).pathname, '/login')
  }
  console.log('Passed: standalone login shell, static JavaScript, and five protected route redirects; no live database used.')
} finally {
  if (server.exitCode === null && !startupError) {
    const stopped = once(server, 'exit')
    server.kill('SIGTERM')
    await stopped
  }
}
