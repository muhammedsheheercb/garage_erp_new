const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

// Execute the real server actions with isolated database and authorization mocks.
function loadSource(file, mocks = {}, cache = new Map()) {
  const absolute = path.resolve(file)
  if (cache.has(absolute)) return cache.get(absolute).exports
  const module = { exports: {} }
  cache.set(absolute, module)
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  const localRequire = (name) => {
    if (name in mocks) return mocks[name]
    if (name.startsWith('@/') || name.startsWith('.')) {
      const target = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : path.resolve(path.dirname(absolute), name)
      return loadSource(target + '.ts', mocks, cache)
    }
    return require(name)
  }
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports)
  return module.exports
}

const form = {
  customerId: 'customer', vehicleId: 'vehicle', mechanicId: 'mechanic', status: 'PENDING',
  complaint: 'Service required', date: '2026-10-03', expectedFinishDate: '2026-10-04', vehicleKm: 0,
  services: [], parts: [], otherCharges: [], hideServicePartsAmounts: false,
  serviceTotal: 100, partsTotal: 0, discount: 0, tax: 0, grandTotal: 100, advancePaid: 50,
}
const auth = { requirePagePermission: async () => {}, getCreatorName: async () => 'Test' }
const commonMocks = { 'next/cache': { revalidatePath: () => {} }, '@/lib/authorization': auth }

test('advance payment method is optional and accepts Cash, Card or Bank Transfer', () => {
  const { jobCardSchema } = loadSource('src/features/jobcards/schema.ts')
  assert.equal(jobCardSchema.safeParse(form).success, true)
  assert.equal(jobCardSchema.safeParse({ ...form, advancePaymentMethod: 'INVALID' }).success, false)
  for (const advancePaymentMethod of ['CASH', 'CARD', 'TRANSFER']) {
    assert.equal(jobCardSchema.safeParse({ ...form, advancePaymentMethod }).success, true)
  }
  assert.equal(jobCardSchema.safeParse({ ...form, advancePaid: 0 }).success, true)
})

test('creating and editing an advance saves its channel on one receipt', async () => {
  let created, updated, extraReceipts = 0
  const tx = {
    payment: {
      findMany: async () => [{ id: 'advance', amount: 50, receivedMethod: 'CASH' }],
      update: async (args) => { updated = args },
      create: async () => { extraReceipts++ },
    },
    jobCardService: { deleteMany: async () => {} }, jobCardPart: { deleteMany: async () => {} },
    jobCard: { update: async () => {} },
  }
  const prisma = {
    jobCard: {
      create: async (args) => { created = args; return { id: 'job' } },
      findUnique: async () => ({ status: 'PENDING', customerId: 'customer' }),
    },
    $transaction: async (callback) => callback(tx),
  }
  const actions = loadSource('src/features/jobcards/actions.ts', { ...commonMocks, '@/lib/prisma': prisma })
  await actions.createJobCard(form)
  assert.equal(created.data.payments.create.amount, 50)
  assert.equal(created.data.payments.create.method, 'ADVANCE')
  assert.equal(created.data.payments.create.receivedMethod, 'CASH')
  await actions.updateJobCard('job', { ...form, advancePaymentMethod: 'TRANSFER' })
  assert.equal(updated.where.id, 'advance')
  assert.equal(updated.data.amount, 50)
  assert.equal(updated.data.receivedMethod, 'TRANSFER')
  assert.equal(extraReceipts, 0)
})

test('income, purchase and expense channels reconcile including unclassified entries', async () => {
  let paymentQuery
  const prisma = {
    payment: { findMany: async (query) => {
      paymentQuery = query
      return [
        { amount: 50, method: 'ADVANCE', receivedMethod: 'CASH' },
        { amount: 20, method: 'ADVANCE', receivedMethod: 'TRANSFER' },
        { amount: 30, method: 'CASH' }, // Later balance: no repeat of the advance.
        { amount: 15, method: 'CARD' },
        { amount: 5, method: 'ADVANCE', receivedMethod: null },
      ]
    } },
    directSale: { findMany: async () => [{ grandTotal: 10, items: [] }] },
    jobCard: { findMany: async () => [] },
    expense: { findMany: async (query) => query.where.paymeterId ? [] : [
      { amount: 2, paymentMethod: 'CASH' }, { amount: 3, paymentMethod: 'CARD' },
      { amount: 4, paymentMethod: 'TRANSFER' }, { amount: 6, paymentMethod: 'PAYMETER' },
    ] },
    purchasePayment: { findMany: async () => [] }, paymeterSettlement: { findMany: async () => [] },
    purchase: { findMany: async () => [
      { grandTotal: 10, paymentMethod: { name: 'Direct Cash' } },
      { grandTotal: 20, paymentMethod: { name: 'Direct Bank Transfer' } },
      { grandTotal: 30, paymentMethod: { name: 'Direct Card' } },
      { grandTotal: 40, paymentMethod: { name: 'Staff Ledger' } },
    ] },
  }
  const { getReportsDashboardTotals } = loadSource('src/features/reports/actions.ts', { '@/lib/prisma': prisma })
  const totals = await getReportsDashboardTotals('2026-10-03', '2026-10-03')
  assert.equal(totals.totalIncome, 130)
  assert.equal(totals.incomeByMethod['Total Cash Amount'], 80)
  assert.equal(totals.incomeByMethod['Total Bank Transfer Amount'], 20)
  assert.equal(totals.incomeByMethod['Total Card Amount'], 15)
  assert.equal(totals.incomeByMethod['Other / Unspecified'], 15)
  for (const [total, breakdown] of [
    [totals.totalIncome, totals.incomeByMethod], [totals.totalPurchase, totals.purchaseByMethod],
    [totals.totalExpense, totals.expenseByMethod],
  ]) assert.equal(Object.values(breakdown).reduce((sum, value) => sum + value, 0), total)
  assert.equal(paymentQuery.where.paymentDate.gte.toISOString().slice(0, 10), '2026-10-03')
  assert.deepEqual(Object.keys(paymentQuery.where), ['paymentDate'])
})

test('invoice creation does not recreate advances when any receipt already exists', async () => {
  for (const existingMethod of ['ADVANCE', 'CASH']) {
    let extraReceipts = 0
    const prisma = {
      jobCard: { findUnique: async (args) => {
        assert.equal(args.select.payments.where, undefined)
        return { ...form, payments: [{ id: 'existing', method: existingMethod }] }
      } },
      invoice: { create: async () => ({ id: 'invoice' }) },
      payment: { create: async () => { extraReceipts++ } },
    }
    const { createInvoice } = loadSource('src/features/invoices/actions.ts', { ...commonMocks, '@/lib/prisma': prisma })
    await createInvoice({ jobCardId: 'job', customerId: 'customer', serviceCharge: 100, labourCharge: 0,
      partsCost: 0, discount: 0, tax: 0, status: 'PARTIAL' })
    assert.equal(extraReceipts, 0)
  }
})

test('later payments include the advance in the paid balance and collect only the remainder', async () => {
  let saved
  const tx = {
    jobCard: { findUnique: async () => ({ grandTotal: 100, customerId: 'customer', parts: [], payments: [{ amount: 50, method: 'ADVANCE', receivedMethod: 'TRANSFER' }] }) },
    payment: { create: async (args) => { saved = args.data; return args.data } },
  }
  const prisma = { $transaction: async (callback) => callback(tx) }
  const { createPayment } = loadSource('src/features/payments/actions.ts', { ...commonMocks, '@/lib/prisma': prisma })
  const payment = { jobCardId: 'job', amount: 50, method: 'CASH', paymentDate: '2026-10-04', discountAmount: 0 }
  await createPayment(payment)
  assert.equal(saved.amount, 50)
  assert.equal(saved.totalPaidAtPayment, 100)
  assert.equal(saved.balanceAfterPayment, 0)
  await assert.rejects(createPayment({ ...payment, amount: 51 }), /outstanding balance/)
})

test('advance details show the payment date and selected channel', async () => {
  const prisma = {
    payment: { findMany: async () => [{ id: 'receipt', method: 'ADVANCE', receivedMethod: 'TRANSFER', amount: 50,
      createdAt: new Date('2026-10-04T10:00:00Z'), paymentDate: new Date('2026-10-03T12:00:00Z'), jobCard: { id: 'job', date: new Date('2026-10-02T12:00:00Z'),
        customer: { name: 'Customer' }, vehicle: { plateNumber: '123' } } }] },
    directSale: { findMany: async () => [] }, expense: { findMany: async () => [] },
    purchase: { findMany: async () => [] }, purchasePayment: { findMany: async () => [] },
  }
  const { getReportsDashboardDetails } = loadSource('src/features/reports/actions.ts', { '@/lib/prisma': prisma })
  const details = await getReportsDashboardDetails('2026-10-03', '2026-10-03')
  assert.equal(details.incomeDetails[0].method, 'Advance (Bank Transfer)')
  assert.equal(details.incomeDetails[0].amount, 50)
  assert.match(details.incomeDetails[0].date, /^03\/10\/2026/)
})


test('a backdated payment counts on its payment date rather than its creation or job date', async () => {
  const payment = { amount: 75, method: 'CASH', paymentDate: new Date('2026-10-03T12:00:00Z'),
    createdAt: new Date('2026-10-04T12:00:00Z'), jobCard: { date: new Date('2026-10-04T12:00:00Z') } }
  const prisma = {
    payment: { findMany: async ({ where }) => {
      assert.deepEqual(Object.keys(where), ['paymentDate'])
      const { gte, lte } = where.paymentDate
      return payment.paymentDate >= gte && payment.paymentDate <= lte ? [payment] : []
    } },
    directSale: { findMany: async () => [] }, jobCard: { findMany: async () => [] },
    expense: { findMany: async () => [] }, purchase: { findMany: async () => [] },
    purchasePayment: { findMany: async () => [] }, paymeterSettlement: { findMany: async () => [] },
  }
  const { getReportsDashboardTotals } = loadSource('src/features/reports/actions.ts', { '@/lib/prisma': prisma })
  assert.equal((await getReportsDashboardTotals('2026-10-03', '2026-10-03')).totalIncome, 75)
  assert.equal((await getReportsDashboardTotals('2026-10-04', '2026-10-04')).totalIncome, 0)
})
