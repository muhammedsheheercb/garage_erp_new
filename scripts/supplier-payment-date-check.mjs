
import { createRequire } from "node:module"
const nodeRequire = createRequire(import.meta.url)
import assert from "node:assert/strict"
import fs from "node:fs"
import ts from "typescript"
import { startOfDay, endOfDay, subDays } from "date-fns"

// Run the actual report actions against isolated fixtures, without changing the database.
function load(file, overrides = {}) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  new Function('require', 'exports', code)((name) => {
    if (name in overrides) return overrides[name]
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`, overrides)
    return nodeRequire(name)
  }, exports)
  return exports
}

async function main() {
  const today = startOfDay(new Date())
  const yesterday = subDays(today, 1)
  const rows = [
    { id: 'backdated', date: yesterday, createdAt: today, amount: 75, paidAmount: 0, pendingAmount: 75, paymeter: { name: 'Direct Cash' }, purchase: { purchaseNumber: 'OLD-BILL' } },
    { id: 'today', date: today, createdAt: yesterday, amount: 25, paidAmount: 0, pendingAmount: 25, paymeter: { name: 'Direct Bank Transfer' }, purchase: { purchaseNumber: 'OLD-BILL' } },
    { id: 'initial', date: today, createdAt: today, amount: 10, paidAmount: 0, pendingAmount: 0, paymeter: { name: 'Direct Cash' }, purchase: { purchaseNumber: 'NEW-BILL' } },
    { id: 'staff', date: today, createdAt: today, amount: 15, paidAmount: 0, pendingAmount: 15, paymeter: { name: 'Staff Ledger' }, purchase: { purchaseNumber: 'OLD-BILL' } },
  ]
  const emptyModel = {
    findMany: async () => [],
    aggregate: async () => ({ _sum: { amount: 0, grandTotal: 0 } }),
    count: async () => 0,
  }
  const prisma = new Proxy({}, { get: (_, model) => model === 'purchasePayment' ? {
    findMany: async ({ where }) => {
      assert.deepEqual(Object.keys(where), ['date'])
      return rows.filter((row) => (!where.date.gte || row.date >= where.date.gte)
        && (!where.date.lte || row.date <= where.date.lte))
    },
  } : emptyModel })
  const actions = load('src/features/reports/actions.ts', { '@/lib/prisma': { default: prisma }, '@/lib/authorization': { requireSession: async () => {}, requirePagePermission: async () => {} } })
  const dashboard = await actions.getDashboardStats()
  assert.equal(dashboard.dailyDirectSupplierPaid, 25)
  assert.equal(dashboard.dailyDirectPurchasePaid, 10)
  const report = async (date) => actions.getReportsDashboardTotals(date.toISOString(), endOfDay(date).toISOString())
  assert.equal((await report(today)).totalDirectSupplierPaid, 25)
  assert.equal((await report(yesterday)).totalDirectSupplierPaid, 75)
  assert.equal((await actions.getReportsDashboardTotals(yesterday.toISOString(), endOfDay(today).toISOString())).totalDirectSupplierPaid, 100)
  const details = await actions.getReportsDashboardDetails(yesterday.toISOString(), endOfDay(yesterday).toISOString())
  assert.deepEqual(details.paymeterDetails.map((row) => row.id), ['pp-backdated'])
  console.log('Passed: dashboard and report totals/details use Payment Date, independent of creation date and purchase funding source.')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
