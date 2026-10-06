import { renderToStaticMarkup } from "react-dom/server"
import { Prisma } from "@prisma/client"
import { createRequire } from "node:module"
const nodeRequire = createRequire(import.meta.url)
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

// Execute the real server actions with isolated database and authorization mocks.
function loadSource(file, mocks = {}, cache = new Map()) {
  const absolute = path.resolve(file)
  if (cache.has(absolute)) return cache.get(absolute).exports
  const loadedModule = { exports: {} }
  cache.set(absolute, loadedModule)
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const localRequire = (name) => {
    if (name in mocks) return mocks[name]
    if (name.startsWith('@/') || name.startsWith('.')) {
      const target = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : path.resolve(path.dirname(absolute), name)
      return loadSource(target + '.ts', mocks, cache)
    }
    return nodeRequire(name)
  }
  new Function('require', 'module', 'exports', code)(localRequire, loadedModule, loadedModule.exports)
  return loadedModule.exports
}

const form = {
  customerId: 'customer', vehicleId: 'vehicle', mechanicId: 'mechanic', status: 'PENDING',
  complaint: 'Service required', date: '2026-10-03', expectedFinishDate: '2026-10-04', vehicleKm: 0,
  services: [], parts: [], otherCharges: [], hideServicePartsAmounts: false,
  serviceTotal: 100, partsTotal: 0, discount: 0, tax: 0, grandTotal: 100, advancePaid: 50,
}
const auth = { requireSession: async () => {}, requirePagePermission: async () => {}, getCreatorName: async () => 'Test' }
const commonMocks = { '../invoices/current-totals': { syncJobCardInvoice: async () => {} }, 'next/cache': { revalidatePath: () => {} }, '@/lib/authorization': auth }

test('job card print keeps service line amounts and names parts without a batch', () => {
  const { JobCardPrintClient } = loadSource('src/app/jobcards/[id]/print/job-card-print-client.tsx', {
    react: { useEffect: () => {}, useSyncExternalStore: () => true },
    '@/i18n': { useTranslation: () => ({ isRTL: false }) },
    '@/components/currency': { Currency: ({ amount }) => String(amount) },
    './print-button': { PrintButton: () => null },
    './job-card-terms-and-conditions': { JobCardTermsAndConditions: () => null },
  })
  const tree = JobCardPrintClient({ job: {
    id: 'job', createdAt: new Date('2026-01-01'), date: new Date('2026-01-01'),
    services: [{ id: 'service', quantity: 3, price: 75, service: { name: 'Repair' } }],
    parts: [{ id: 'part', quantity: 2, price: 10, inventory: { itemName: 'Brake Pad', partNumber: 'BP1' } }],
    grandTotal: 95, customer: {}, vehicle: {},
  } })
  const html = renderToStaticMarkup(tree)
  assert.match(html, /Brake Pad \(BP1\)/)
  assert.match(html, /class="money">25<\/td><td class="money">75<\/td>/)
  assert.match(html, /Service total: 75/)
})

test('sale date inputs keep the local calendar day at midnight and early morning', () => {
  const { formatDateInput } = loadSource('src/lib/date-format.ts')
  const previousTimezone = process.env.TZ
  try {
    process.env.TZ = 'Asia/Kolkata'
    assert.equal(formatDateInput(new Date('2026-10-06T00:00:00+05:30')), '2026-10-06')
    assert.equal(formatDateInput(new Date('2026-10-06T02:00:00+05:30')), '2026-10-06')
    assert.equal(formatDateInput('2026-10-06'), '2026-10-06')
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ
    else process.env.TZ = previousTimezone
  }
})

test('direct sale writes explicitly allow thirty seconds and keep stock changes in the transaction', async () => {
  let transactions = 0, inside = false
  const tx = {
    directSale: {
      create: async () => ({ id: 'sale' }),
      findUnique: async () => ({ id: 'sale', items: [{ batchId: 'batch', quantity: 1 }] }),
      update: async () => { assert.equal(inside, true) },
      delete: async () => { assert.equal(inside, true) },
    },
    inventoryBatch: {
      findUnique: async () => ({ quantity: 10, jobCardParts: [] }),
      update: async () => { assert.equal(inside, true) },
      updateMany: async () => { assert.equal(inside, true); return { count: 1 } },
    },
  }
  const actions = loadSource('src/features/direct-sales/actions.ts', {
    ...commonMocks,
    '@/lib/prisma': { $transaction: async (callback, options) => {
      assert.equal(options.timeout, 30000)
      transactions++
      inside = true
      try { return await callback(tx) } finally { inside = false }
    } },
  })
  const data = { paymentMethod: 'CASH', saleDate: '2026-01-01', items: [{ batchId: 'batch', quantity: 1, purchasePrice: 5, salesPrice: 10, vat: 0 }] }
  await actions.createDirectSale(data)
  await actions.updateDirectSale('sale', data)
  await actions.deleteDirectSale('sale')
  assert.equal(transactions, 3)
})

test('purchase edits preserve consumed stock and batch identity, and reject removal of used stock', async () => {
  const { editPurchaseStock } = loadSource('src/features/purchases/edit-stock.ts')
  const batch = { id: 'batch', inventoryId: 'item', quantity: 6, jobCardParts: [], directSaleItems: [{ id: 'sale' }] }
  const tx = {
    inventoryBatch: {
      findMany: async () => [{ ...batch }],
      update: async ({ where, data }) => { assert.equal(where.id, 'batch'); Object.assign(batch, data) },
      create: async () => { assert.fail('Existing stock must not be recreated') },
      delete: async () => { assert.fail('Used batch must not be deleted') },
    },
    purchaseItem: { findMany: async () => [{ inventoryId: 'item', quantity: 10 }] },
  }
  const purchase = { id: 'purchase', purchaseNumber: 'PUR-1', purchaseType: 'STOCK', jobCardId: null }
  const data = { purchaseType: 'STOCK', items: [{ inventoryId: 'item', quantity: 10, purchasePrice: 5, sellingPrice: 10 }] }
  await editPurchaseStock(tx, purchase, data)
  assert.equal(batch.quantity, 6)
  await editPurchaseStock(tx, purchase, { ...data, items: [{ ...data.items[0], quantity: 12 }] })
  assert.equal(batch.quantity, 8)
  await assert.rejects(editPurchaseStock(tx, purchase, { ...data, items: [] }), /cannot be removed/)
  await assert.rejects(editPurchaseStock(tx, purchase, { ...data, items: [{ ...data.items[0], quantity: 1 }] }), /already used or reserved/)
})

test('pending-parts purchase edits update existing linked parts and keep their batch', async () => {
  const { editPurchaseStock, assertPurchasableJobCard } = loadSource('src/features/purchases/edit-stock.ts')
  let savedPart, savedBatch
  const part = { id: 'part', jobCardId: 'job', quantity: 2, isPending: false, jobCard: { status: 'PENDING' } }
  const tx = {
    inventoryBatch: {
      findMany: async () => [{ id: 'batch', inventoryId: 'item', quantity: 2, jobCardParts: [part], directSaleItems: [] }],
      update: async args => { savedBatch = args },
    },
    purchaseItem: { findMany: async () => [{ inventoryId: 'item', quantity: 2 }] },
    jobCardPart: { update: async args => { savedPart = args } },
    jobCard: { findUnique: async () => ({ status: 'COMPLETED' }) },
  }
  const purchase = { id: 'purchase', purchaseNumber: 'PUR-1', purchaseType: 'PENDING_PARTS', jobCardId: 'job' }
  const data = { purchaseType: 'PENDING_PARTS', jobCardId: 'job', items: [{ inventoryId: 'item', quantity: 3, purchasePrice: 10, sellingPrice: 30 }] }
  await editPurchaseStock(tx, purchase, data)
  assert.equal(savedBatch.where.id, 'batch')
  assert.equal(savedBatch.data.quantity, 3)
  assert.deepEqual(savedPart, { where: { id: 'part' }, data: { quantity: 3, price: 30 } })
  await assert.rejects(assertPurchasableJobCard(tx, 'job'), /completed/)
  part.jobCard.status = 'COMPLETED'
  await assert.rejects(editPurchaseStock(tx, purchase, data), /completed job card/)
})

test('quotation conversion retains the full value of service quantities', async () => {
  const actions = loadSource('src/features/quotations/actions.ts', {
    ...commonMocks,
    '@/lib/prisma': { quotation: { findFirst: async () => ({
      services: [{ serviceId: 'service', service: { name: 'Repair' }, quantity: 3, price: 25 }],
      parts: [], serviceTotal: 75,
    }) } },
  })
  const prefill = await actions.getQuotationJobCardPrefill('quote')
  const { calculateJobCardTotals } = loadSource('src/features/jobcards/totals.ts')
  assert.equal(prefill.services[0].price, 75)
  assert.equal(calculateJobCardTotals({ ...prefill, otherCharges: [] }).grandTotal, 75)
})

test('payment table uses current outstanding balance after charges and later payments', async () => {
  const now = new Date('2026-01-01')
  const history = [{ id: 'first', amount: 100, createdAt: now }, { id: 'second', amount: 150, createdAt: new Date('2026-01-02') }]
  const jobCard = { grandTotal: 1250, payments: history, customer: { name: 'Customer' }, vehicle: { plateNumber: '123' }, parts: [] }
  const actions = loadSource('src/features/payments/actions.ts', {
    ...commonMocks,
    '@/lib/prisma': {
      payment: { findMany: async () => history.map(item => ({ ...item, paymentDate: item.createdAt, grandTotalAtPayment: 200, totalPaidAtPayment: 100, balanceAfterPayment: 100, jobCard })), count: async () => 2 },
      directSale: { findMany: async () => [], count: async () => 0 },
    },
  })
  const result = await actions.getPayments()
  for (const row of result.data) {
    assert.equal(row.totalPaid, 250)
    assert.equal(row.balanceAmount, 1000)
    assert.equal(row.isLatestTransaction, row.id === 'second')
  }
  jobCard.grandTotal = 200
  const overpaid = await actions.getPayments()
  assert.equal(overpaid.data[0].balanceAmount, 0)
})

test('payment invoice uses current charges and all payments instead of historical snapshots', async () => {
  const payment = { id: 'receipt', amount: 100, paymentDate: new Date('2026-01-01'),
    grandTotalAtPayment: 200, totalPaidAtPayment: 100, balanceAfterPayment: 100,
    jobCard: { serviceTotal: 200, partsTotal: 1050, grandTotal: 1250, discount: 0, tax: 0,
      payments: [{ amount: 100 }], services: [], parts: [], otherCharges: '[]',
      customer: {}, vehicle: {}, complaint: 'Repair', hideServicePartsAmounts: false },
  }
  const { default: page } = loadSource('src/app/payments/[id]/invoice/page.tsx', {
    '@/features/payments/actions': { getPaymentBill: async () => payment },
    '@/app/invoices/[id]/print/invoice-print-client': { InvoicePrintClient: () => null },
    'next/navigation': { notFound: () => { throw new Error('Not found') } },
  })
  let result = await page({ params: Promise.resolve({ id: 'receipt' }) })
  assert.equal(result.props.invoice.subTotal, 1250)
  assert.equal(result.props.invoice.grandTotal, 1250)
  assert.equal(result.props.invoice.balanceAfterPayment, 1150)
  payment.jobCard.payments.push({ amount: 150 })
  result = await page({ params: Promise.resolve({ id: 'receipt' }) })
  assert.equal(result.props.invoice.totalPaidToDate, 250)
  assert.equal(result.props.invoice.balanceAfterPayment, 1000)
  assert.equal(result.props.invoice.transactionPaymentAmount, 100)
  assert.equal(payment.grandTotalAtPayment, 200)
  assert.equal(payment.balanceAfterPayment, 100)
})

test('purchase edits restore direct methods and retain ordinary ledger selections', () => {
  const { getPurchasePaymentSelection } = loadSource('src/features/purchases/payment-selection.ts')
  for (const [name, method] of [['Direct Cash', 'CASH'], ['Direct Bank Transfer', 'BANK_TRANSFER'], ['Card', 'CARD'], ['Direct Card', 'CARD']]) {
    assert.deepEqual(getPurchasePaymentSelection({ paymentMethodId: 'internal', paymentMethod: { name } }), {
      paymentSource: 'DIRECT', paymentMethodId: '', directPaymentMethod: method,
    })
  }
  assert.deepEqual(getPurchasePaymentSelection({ paymentMethodId: 'ledger', paymentMethod: { name: 'Staff Ledger' } }), {
    paymentSource: 'PAYMETER', paymentMethodId: 'ledger', directPaymentMethod: undefined,
  })
})

test('job card customer lookup skips empty searches and bounds matching results', async () => {
  const queries = []
  const actions = loadSource('src/features/jobcards/actions.ts', {
    ...commonMocks,
    '@/lib/prisma': { customer: { findMany: async (query) => { queries.push(query); return [] } } },
  })
  assert.deepEqual(await actions.getJobCardCustomers('   '), [])
  assert.equal(queries.length, 0)
  await actions.getJobCardCustomers('  Ahmed  ')
  assert.equal(queries[0].take, 20)
  assert.equal(queries[0].where.OR[0].name.contains, 'Ahmed')
  assert.equal(queries[0].where.OR[1].phone.contains, 'Ahmed')
  await actions.getJobCardCustomers('', 'selected-customer')
  assert.deepEqual(queries[1].where, { id: 'selected-customer' })
  await actions.getJobCardCustomers('', undefined, true)
  assert.deepEqual(queries[2].where, {})
  assert.equal(queries[2].take, undefined)
  await actions.getJobCardCustomers('Ahmed', undefined, true)
  assert.equal(queries[3].take, 20)
})

test('completed job cards reject edits before making any database writes', async () => {
  const actions = loadSource('src/features/jobcards/actions.ts', {
    ...commonMocks,
    '@/lib/prisma': {
      jobCard: { findUnique: async () => ({ status: 'COMPLETED' }) },
      $transaction: async () => { assert.fail('Completed card must not start a write transaction') },
      inventoryBatch: { update: async () => { assert.fail('Completed card must not change stock') } },
    },
  })
  await assert.rejects(actions.updateJobCard('completed-job', form), /Completed job cards cannot be edited/)
})

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
    jobCard: { findUniqueOrThrow: async () => ({ discount: 0, tax: 0, status: "PENDING" }), update: async () => {} },
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

test('job card saves derive totals from items even when submitted totals are stale', async () => {
  let created, updated
  const tx = {
    payment: { findMany: async () => [], create: async () => {} },
    jobCardService: { deleteMany: async () => {} },
    jobCardPart: { deleteMany: async () => {} },
    jobCard: { findUniqueOrThrow: async () => ({ discount: 0, tax: 0, status: "PENDING" }), update: async (args) => { updated = args.data } },
  }
  const prisma = {
    jobCard: {
      create: async (args) => { created = args.data; return { id: 'job' } },
      findUnique: async () => ({ status: 'PENDING', customerId: 'customer' }),
    },
    $transaction: async (callback) => callback(tx),
  }
  const actions = loadSource('src/features/jobcards/actions.ts', { ...commonMocks, '@/lib/prisma': prisma })
  const data = {
    ...form,
    services: [{ serviceId: 'service', name: 'Repair', quantity: 1, price: 100 }],
    parts: [{ batchId: 'batch', inventoryId: 'item', name: 'Part', quantity: 2, price: 25, maxStock: 2, isPending: false }],
    otherCharges: [{ description: 'Delivery', amount: 5 }],
  }
  await actions.createJobCard(data)
  assert.equal(created.serviceTotal, 100)
  assert.equal(created.partsTotal, 50)
  assert.equal(created.grandTotal, 155)
  assert.equal(created.payments.create.grandTotalAtPayment, 155)
  assert.equal(created.payments.create.balanceAfterPayment, 105)
  await actions.updateJobCard('job', data)
  assert.equal(updated.partsTotal, 50)
  assert.equal(updated.grandTotal, 155)
  await actions.updateJobCard('job', { ...data, parts: [] })
  assert.equal(updated.partsTotal, 0)
  assert.equal(updated.grandTotal, 105)
})

test('job card edits retain payment discounts and saved tax rather than stale form adjustments', async () => {
  let saved
  const tx = {
    jobCard: {
      findUniqueOrThrow: async () => ({ discount: 20, tax: 5, status: 'PENDING' }),
      update: async ({ data }) => { saved = data },
    },
    payment: { findMany: async () => [] },
    jobCardService: { deleteMany: async () => {} },
    jobCardPart: { deleteMany: async () => {} },
  }
  const actions = loadSource('src/features/jobcards/actions.ts', {
    ...commonMocks,
    '@/lib/prisma': {
      jobCard: { findUnique: async () => ({ status: 'PENDING', customerId: 'customer' }) },
      $transaction: async callback => callback(tx),
    },
  })
  await actions.updateJobCard('job', { ...form, advancePaid: 0,
    services: [{ serviceId: 'service', name: 'Repair', quantity: 1, price: 100 }],
  })
  assert.equal(saved.discount, 20)
  assert.equal(saved.tax, 5)
  assert.equal(saved.grandTotal, 85)
})

test('job card completion sets its timeout explicitly and deducts stock inside the save transaction', async () => {
  let insideTransaction = false, stockUpdated = false
  const tx = {
    jobCard: {
      findUniqueOrThrow: async () => ({ discount: 0, tax: 0, status: 'PENDING' }),
      update: async () => { assert.equal(stockUpdated, true) },
    },
    inventoryBatch: { findUnique: async () => ({ jobCardParts: [] }), updateMany: async () => { assert.equal(insideTransaction, true); stockUpdated = true; return { count: 1 } } },
    payment: { findMany: async () => [] },
    jobCardService: { deleteMany: async () => {} }, jobCardPart: { deleteMany: async () => {} },
  }
  const actions = loadSource('src/features/jobcards/actions.ts', {
    ...commonMocks,
    '@/lib/prisma': {
      jobCard: { findUnique: async () => ({ status: 'PENDING', customerId: 'customer' }) },
      inventoryBatch: { update: async () => { assert.fail('Stock must change inside the transaction') } },
      $transaction: async (callback, options) => {
        assert.equal(options.timeout, 30000)
        insideTransaction = true
        try { return await callback(tx) } finally { insideTransaction = false }
      },
    },
  })
  await actions.updateJobCard('job', { ...form, status: 'COMPLETED', advancePaid: 0,
    parts: [{ batchId: 'batch', inventoryId: 'item', name: 'Part', quantity: 1, price: 25, maxStock: 2, isPending: false }],
  })
  assert.equal(stockUpdated, true)
})

test('purchase recalculation uses actual parts and retains other charges and adjustments', async () => {
  const { recalculateJobCardTotals } = loadSource('src/features/jobcards/recalculate.ts', commonMocks)
  let saved
  const job = { serviceTotal: 999, partsTotal: 999, discount: 20, tax: 5,
    services: [{ price: 100 }], parts: [{ quantity: 2, price: 30 }],
    otherCharges: JSON.stringify([{ description: 'Delivery', amount: 10 }]),
  }
  const tx = { jobCard: { findUnique: async () => job, update: async args => { saved = args.data } } }
  await recalculateJobCardTotals(tx, 'job')
  assert.deepEqual(saved, { serviceTotal: 100, partsTotal: 60, grandTotal: 155 })
  job.parts = []
  await recalculateJobCardTotals(tx, 'job')
  assert.equal(saved.grandTotal, 95)
})

test('quotation create and edit derive totals instead of trusting submitted totals', async () => {
  let saved
  const actions = loadSource('src/features/quotations/actions.ts', {
    ...commonMocks,
    '@/lib/prisma': { quotation: {
      create: async args => { saved = args.data; return { id: 'quote' } },
      update: async args => { saved = args.data },
    } },
  })
  const data = { customerId: 'customer', vehicleId: 'vehicle', complaint: 'Repair',
    date: '2026-01-01', validUntil: '2026-12-31', vehicleKm: 0,
    services: [{ serviceId: 'service', name: 'Repair', quantity: 2, price: 25 }],
    parts: [{ inventoryId: 'part', name: 'Part', quantity: 3, price: 10 }],
    serviceTotal: 0, partsTotal: 0, grandTotal: 0, hideServicePartsAmounts: false,
  }
  await actions.createQuotation(data)
  assert.equal(saved.serviceTotal, 50)
  assert.equal(saved.partsTotal, 30)
  assert.equal(saved.grandTotal, 80)
  await actions.updateQuotation('quote', { ...data, parts: [] })
  assert.equal(saved.grandTotal, 50)
})

test('purchasing pending parts updates the job card total in the same transaction', async () => {
  let total, partUpdated = false
  const part = { id: 'part', quantity: 2, price: 0 }
  const tx = {
    purchase: { create: async () => ({ id: 'purchase' }) },
    inventoryBatch: { create: async () => ({ id: 'batch' }) },
    jobCardPart: {
      findFirst: async () => part,
      update: async ({ data }) => { Object.assign(part, data); partUpdated = true },
    },
    jobCard: {
      findUnique: async (args) => {
        if (args.select?.status) return { status: 'PENDING' }
        assert.equal(partUpdated, true)
        return { services: [{ price: 100 }], parts: [part], discount: 20, tax: 0,
          otherCharges: JSON.stringify([{ amount: 10 }]) }
      },
      update: async ({ data }) => { total = data.grandTotal },
    },
  }
  const actions = loadSource('src/features/purchases/actions.ts', {
    ...commonMocks,
    '@/lib/prisma': { purchase: { findFirst: async () => null }, $transaction: async callback => callback(tx) },
  })
  await actions.createPurchase({ purchaseDate: '2026-01-01', supplierId: 'supplier',
    purchaseType: 'PENDING_PARTS', jobCardId: 'job', paymentSource: 'PAYMETER',
    paymentMethodId: 'ledger', discount: 0, paidAmount: 0,
    items: [{ inventoryId: 'item', quantity: 2, purchasePrice: 10, sellingPrice: 30, taxRate: 0 }],
  })
  assert.equal(total, 150)
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
  const { getReportsDashboardTotals } = loadSource('src/features/reports/actions.ts', { ...commonMocks, '@/lib/prisma': prisma })
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
        return { ...form, payments: [{ id: 'existing', method: existingMethod, amount: 50 }] }
      } },
      invoice: { create: async () => ({ id: 'invoice' }) },
      payment: { create: async () => { extraReceipts++ } },
    }
    prisma.$transaction = async callback => callback(prisma)
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
  const prisma = { $transaction: async (callback, options) => {
    assert.equal(options.isolationLevel, 'Serializable')
    assert.equal(options.timeout, 30000)
    return callback(tx)
  } }
  const { createPayment } = loadSource('src/features/payments/actions.ts', { ...commonMocks, '@/lib/prisma': prisma })
  const payment = { jobCardId: 'job', amount: 50, method: 'CASH', paymentDate: '2026-10-04', discountAmount: 0 }
  await createPayment(payment)
  assert.equal(saved.amount, 50)
  assert.equal(saved.totalPaidAtPayment, 100)
  assert.equal(saved.balanceAfterPayment, 0)
  await assert.rejects(createPayment({ ...payment, amount: 51 }), /outstanding balance/)
})

test('conflicting payment transactions ask the user to refresh and retry', async () => {
  const { createPayment } = loadSource('src/features/payments/actions.ts', {
    ...commonMocks,
    '@/lib/prisma': { $transaction: async () => {
      throw new Prisma.PrismaClientKnownRequestError('Write conflict', { code: 'P2034', clientVersion: '5.22.0' })
    } },
  })
  await assert.rejects(createPayment({ jobCardId: 'job', amount: 10, discountAmount: 0, method: 'CASH', paymentDate: '2026-01-01' }), /Refresh the balance and try again/)
})

test('advance details show the payment date and selected channel', async () => {
  const prisma = {
    payment: { findMany: async () => [{ id: 'receipt', method: 'ADVANCE', receivedMethod: 'TRANSFER', amount: 50,
      createdAt: new Date('2026-10-04T10:00:00Z'), paymentDate: new Date('2026-10-03T12:00:00Z'), jobCard: { id: 'job', date: new Date('2026-10-02T12:00:00Z'),
        customer: { name: 'Customer' }, vehicle: { plateNumber: '123' } } }] },
    directSale: { findMany: async () => [] }, expense: { findMany: async () => [] },
    purchase: { findMany: async () => [] }, purchasePayment: { findMany: async () => [] },
  }
  const { getReportsDashboardDetails } = loadSource('src/features/reports/actions.ts', { ...commonMocks, '@/lib/prisma': prisma })
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
  const { getReportsDashboardTotals } = loadSource('src/features/reports/actions.ts', { ...commonMocks, '@/lib/prisma': prisma })
  assert.equal((await getReportsDashboardTotals('2026-10-03', '2026-10-03')).totalIncome, 75)
  assert.equal((await getReportsDashboardTotals('2026-10-04', '2026-10-04')).totalIncome, 0)
})

test('completion groups duplicate batches and protects stock reserved by other jobs', async () => {
  const { deductCompletionStock } = loadSource('src/features/jobcards/complete-stock.ts')
  let stock = 5, reads = 0
  const tx = { inventoryBatch: {
    findUnique: async args => {
      reads++
      assert.equal(args.include.jobCardParts.where.jobCardId.not, 'job')
      return { jobCardParts: [{ quantity: 2 }] }
    },
    updateMany: async args => {
      if (stock < args.where.quantity.gte) return { count: 0 }
      stock -= args.data.quantity.decrement
      return { count: 1 }
    },
  } }
  const parts = [1, 2].map(quantity => ({ batchId: 'batch', quantity, isPending: false }))
  await deductCompletionStock(tx, 'job', parts)
  assert.equal(reads, 1)
  assert.equal(stock, 2)
  await assert.rejects(deductCompletionStock(tx, 'job', parts), /Stock changed/)
  assert.equal(stock, 2)
  await assert.rejects(deductCompletionStock(tx, 'job', [{ batchId: '', quantity: 1, isPending: true }]), /pending parts/)
})

test('manual reimbursement writes its receipt atomically and rejects excessive or repeated amounts', async () => {
  let balance = 50, receipts = 0, failReceipt = false
  const prisma = { $transaction: async callback => {
    const original = balance
    try { return await callback({
      paymeter: {
        updateMany: async args => {
          if (balance < args.where.spentAmount.gte) return { count: 0 }
          balance -= args.data.spentAmount.decrement
          return { count: 1 }
        },
        findUniqueOrThrow: async () => ({ spentAmount: balance }),
      },
      paymeterSettlement: { create: async () => { if (failReceipt) throw Error('receipt failed'); receipts++ } },
    }) } catch (error) { balance = original; throw error }
  } }
  const { settlePaymeter } = loadSource('src/features/paymeters/actions.ts', { ...commonMocks, '@/lib/prisma': prisma })
  await assert.rejects(settlePaymeter('ledger', 60), /cannot exceed/)
  failReceipt = true
  await assert.rejects(settlePaymeter('ledger', 20), /receipt failed/)
  assert.equal(balance, 50)
  failReceipt = false
  await settlePaymeter('ledger', 50)
  await assert.rejects(settlePaymeter('ledger', 1), /cannot exceed/)
  assert.equal(balance, 0)
  assert.equal(receipts, 1)
})

test('supplier payments recheck the remaining balance before creating a receipt', async () => {
  let pending = 40, receipts = 0
  const { createSupplierPayment } = loadSource('src/features/suppliers/actions.ts', {
    ...commonMocks, '@/lib/prisma': {
      purchase: { findFirst: async () => ({ id: 'purchase', pendingAmount: 40 }) },
      $transaction: async callback => callback({
        purchase: { updateMany: async args => {
          if (pending < args.where.pendingAmount.gte) return { count: 0 }
          pending -= args.data.pendingAmount.decrement
          return { count: 1 }
        } },
        purchasePayment: { create: async () => { receipts++; return {} } },
        paymeter: { update: async () => {} },
      }),
    },
  })
  const data = { purchaseId: 'purchase', paymentDate: '2026-01-01', paymentSource: 'PAYMETER', paymeterId: 'ledger', amount: 30 }
  await createSupplierPayment('supplier', data)
  await assert.rejects(createSupplierPayment('supplier', data), /balance changed/)
  assert.equal(pending, 10)
  assert.equal(receipts, 1)
})

test('saved invoices follow current job charges and count shared receipts once', async () => {
  const { currentInvoiceTotals, syncJobCardInvoice } = loadSource('src/features/invoices/current-totals.ts')
  const receipt = { id: 'receipt', amount: 100 }
  const invoice = { id: 'invoice', serviceCharge: 200, partsCost: 0, labourCharge: 10,
    otherCharges: '[{"amount":20}]', tax: 5, discount: 15, payments: [receipt],
    jobCard: { serviceTotal: 200, partsTotal: 1050, payments: [receipt, { id: 'second', amount: 50 }] } }
  const totals = currentInvoiceTotals(invoice)
  assert.equal(totals.grandTotal, 1270)
  assert.equal(totals.status, 'PARTIAL')
  let saved
  await syncJobCardInvoice({ invoice: { findUnique: async () => invoice, update: async args => { saved = args.data } } }, 'job')
  assert.deepEqual(saved, totals)
  invoice.jobCard.payments.push({ id: 'third', amount: 1120 })
  assert.equal(currentInvoiceTotals(invoice).status, 'PAID')
})

test('financial mutations check their specific permission before accessing the database', async () => {
  for (const [module, action, args, permission] of [
    ['jobcards', 'updateJobCard', ['job', {}], 'edit'],
    ['purchases', 'updatePurchase', ['purchase', {}], 'edit'],
    ['suppliers', 'createSupplierPayment', ['supplier', {}], 'create'],
    ['paymeters', 'settlePaymeter', ['ledger', 1], 'edit'],
    ['payments', 'createPayment', [{}], 'create'],
    ['invoices', 'deleteInvoice', ['invoice'], 'delete'],
    ['expenses', 'createExpense', [{}], 'create'],
    ['inventory', 'deleteInventoryItem', ['item'], 'delete'],
  ]) {
    const actions = loadSource(`src/features/${module}/actions.ts`, { ...commonMocks, '@/lib/prisma': {},
      '@/lib/authorization': { ...auth, requirePagePermission: async (name, verb) => {
        assert.equal(name, module); assert.equal(verb, permission); throw Error('Forbidden')
      } },
    })
    await assert.rejects(actions[action](...args), /Forbidden/)
  }
})

test('purchase edits retain supplier receipts and reject changing settled payment details', async () => {
  const supplierReceipt = { id: 'supplier-payment', amount: 30, pendingAmount: 30, paidAmount: 0 }
  const initialReceipt = { id: 'initial-payment', amount: 20, pendingAmount: 0, paidAmount: 0 }
  const purchase = { id: 'purchase', purchaseType: 'STOCK', jobCardId: null, supplierId: 'supplier', paymentMethodId: 'ledger',
    paidAmount: 50, paymeterReimbursed: 0, purchasePayments: [initialReceipt, supplierReceipt] }
  let writes = 0
  const actions = loadSource('src/features/purchases/actions.ts', { ...commonMocks,
    './edit-stock': { assertPurchasableJobCard: async () => {}, editPurchaseStock: async () => {} },
    '@/lib/prisma': {
      purchase: { findUnique: async () => purchase },
      $transaction: async (callback, options) => {
        assert.equal(options.isolationLevel, 'Serializable')
        return callback({ purchase: { findUniqueOrThrow: async () => purchase, update: async args => { writes++; return args.data } },
          purchaseItem: { deleteMany: async () => {} },
          purchasePayment: { deleteMany: async () => assert.fail('Payment history must survive edits'), create: async () => assert.fail('No duplicate receipt'), update: async () => assert.fail('Do not change supplier receipts') },
          paymeter: { update: async () => assert.fail('Already settled money must not move ledgers') },
        })
      },
    },
  })
  const data = { purchaseDate: '2026-01-01', supplierId: 'supplier', purchaseType: 'STOCK', paymentSource: 'PAYMETER',
    paymentMethodId: 'ledger', discount: 0, paidAmount: 50,
    items: [{ inventoryId: 'item', quantity: 1, purchasePrice: 100, sellingPrice: 120, taxRate: 0 }] }
  const result = await actions.updatePurchase('purchase', data)
  assert.equal(result.pendingAmount, 50)
  await assert.rejects(actions.updatePurchase('purchase', { ...data, paidAmount: 60 }), /has settlements/)
  assert.equal(writes, 1)
})

test('invoice edits use current charges even when the stored invoice was previously fully paid', async () => {
  let saved
  const oldInvoice = { id: 'invoice', jobCardId: 'job', customerId: 'customer', status: 'PAID', grandTotal: 100,
    serviceCharge: 100, partsCost: 0, labourCharge: 0, discount: 0, tax: 0, otherCharges: null,
    payments: [{ id: 'receipt', amount: 100 }],
    jobCard: { serviceTotal: 200, partsTotal: 50, payments: [{ id: 'receipt', amount: 100 }] } }
  const { updateInvoice } = loadSource('src/features/invoices/actions.ts', { ...commonMocks, '@/lib/prisma': {
    $transaction: async (callback, options) => {
      assert.equal(options.isolationLevel, 'Serializable')
      return callback({ invoice: { findUnique: async () => oldInvoice, update: async args => { saved = args.data; return args.data } } })
    },
  } })
  await updateInvoice('invoice', { jobCardId: 'job', customerId: 'customer', labourCharge: 10, discount: 0, tax: 0,
    serviceCharge: 100, partsCost: 0, status: 'PAID' })
  assert.equal(saved.serviceCharge, 200)
  assert.equal(saved.partsCost, 50)
  assert.equal(saved.grandTotal, 260)
  assert.equal(saved.status, 'PARTIAL')
})

test('expense reimbursement rechecks its balance and rolls back if receipt creation fails', async () => {
  let pending = 100, balance = 100, paid = 0, failReceipt = true
  const tx = {
    expense: {
      findUnique: async () => ({ paymeterId: 'ledger' }),
      updateMany: async args => {
        if (pending < args.where.pendingAmount.gte) return { count: 0 }
        pending -= args.data.pendingAmount.decrement; paid += args.data.paidAmount.increment
        return { count: 1 }
      },
      findUniqueOrThrow: async () => ({ pendingAmount: pending }),
    },
    paymeter: { updateMany: async args => {
      if (balance < args.where.spentAmount.gte) return { count: 0 }
      balance -= args.data.spentAmount.decrement; return { count: 1 }
    } },
    paymeterSettlement: { create: async () => { if (failReceipt) throw Error('Receipt failed') } },
  }
  const { payExpense } = loadSource('src/features/expenses/actions.ts', { ...commonMocks, '@/lib/prisma': {
    $transaction: async callback => {
      const snapshot = [pending, balance, paid]
      try { return await callback(tx) } catch (error) { [pending, balance, paid] = snapshot; throw error }
    },
  } })
  await assert.rejects(payExpense('expense', 80, '2026-01-01'), /Receipt failed/)
  assert.deepEqual([pending, balance, paid], [100, 100, 0])
  failReceipt = false
  await payExpense('expense', 80, '2026-01-01')
  await assert.rejects(payExpense('expense', 80, '2026-01-01'), /remaining expense balance/)
  assert.deepEqual([pending, balance, paid], [20, 20, 80])
})

test('reimbursed expenses cannot be deleted or have financial details changed', async () => {
  const oldExpense = { amount: 100, paidAmount: 40, pendingAmount: 60, paymeterId: 'ledger', paymentMethod: 'PAYMETER' }
  const actions = loadSource('src/features/expenses/actions.ts', { ...commonMocks, '@/lib/prisma': {
    $transaction: async callback => callback({ expense: { findUnique: async () => oldExpense },
      paymeter: { update: async () => assert.fail('Balance must not change') } }),
  } })
  await assert.rejects(actions.deleteExpense('expense'), /settlement history/)
  const schema = loadSource('src/features/expenses/schema.ts')
  const input = { category: 'Other Expenses', title: 'Expense', description: '', amount: 120, date: '2026-01-01', paymentType: 'PAYMETER', paymeterId: 'ledger', paymentMethod: 'PAYMETER' }
  const parsed = schema.expenseSchema.safeParse(input)
  assert.equal(parsed.success, true, JSON.stringify(parsed.error))
  await assert.rejects(actions.updateExpense('expense', input), /has reimbursements/)
})

test('purchase deletion reverses each contributing ledger and protects reimbursed history', async () => {
  const purchase = { paidAmount: 100, pendingAmount: 0, paymentMethodId: 'A', paymeterReimbursed: 0,
    purchasePayments: [{ amount: 20, paidAmount: 0, pendingAmount: 0, paymeterId: 'A' }, { amount: 80, paidAmount: 0, pendingAmount: 80, paymeterId: 'B' }] }
  const reversed = [], deleted = []
  const { deletePurchase } = loadSource('src/features/purchases/actions.ts', { ...commonMocks, '@/lib/prisma': {
    $transaction: async callback => callback({ purchase: { findUnique: async () => purchase, delete: async () => deleted.push(true) },
      inventoryBatch: { updateMany: async () => {} },
      paymeter: { updateMany: async args => { reversed.push([args.where.id, args.data.spentAmount.decrement]); return { count: 1 } } },
    }),
  } })
  await deletePurchase('purchase')
  assert.deepEqual(reversed, [['A', 20], ['B', 80]])
  purchase.paymeterReimbursed = 10
  await assert.rejects(deletePurchase('purchase'), /settlement history/)
  assert.equal(deleted.length, 1)
})

test('supplier payment deletion preserves reimbursed receipts', async () => {
  const { deletePurchasePayment } = loadSource('src/features/suppliers/actions.ts', { ...commonMocks, '@/lib/prisma': {
    $transaction: async callback => callback({ purchasePayment: { findUnique: async () => ({ paidAmount: 50, amount: 50, pendingAmount: 0 }),
      delete: async () => assert.fail('Reimbursed history must survive') } }),
  } })
  await assert.rejects(deletePurchasePayment('receipt'), /settlement history/)
})

test('paymeter deletion refuses history and only deletes an unused zero-balance ledger', async () => {
  const ledger = { spentAmount: 0, initialSpentAmount: 0, _count: { purchases: 1, purchasePayments: 0, expenses: 0, settlements: 0 } }
  let deleted = 0
  const { deletePaymeter } = loadSource('src/features/paymeters/actions.ts', { ...commonMocks, '@/lib/prisma': {
    $transaction: async callback => callback({ paymeter: { findUnique: async () => ledger, delete: async () => { deleted++ } } }),
  } })
  assert.equal((await deletePaymeter('ledger')).success, false)
  assert.equal(deleted, 0)
  ledger._count.purchases = 0
  assert.equal((await deletePaymeter('ledger')).success, true)
  assert.equal(deleted, 1)
})

test('invoice and missing advance save together or roll back together', async () => {
  let invoices = 0, receipts = 0, failReceipt = true
  const { createInvoice } = loadSource('src/features/invoices/actions.ts', { ...commonMocks, '@/lib/prisma': {
    $transaction: async (callback, options) => {
      assert.equal(options.isolationLevel, 'Serializable')
      const snapshot = [invoices, receipts]
      try { return await callback({
        jobCard: { findUnique: async () => ({ customerId: 'customer', serviceTotal: 200, partsTotal: 0, advancePaid: 50, payments: [] }) },
        invoice: { create: async args => { invoices++; return { id: 'invoice', ...args.data } } },
        payment: { create: async args => { if (failReceipt) throw Error('Receipt failed'); assert.equal(args.data.amount, 50); receipts++ } },
      }) } catch (error) { [invoices, receipts] = snapshot; throw error }
    },
  } })
  const input = { jobCardId: 'job', customerId: 'customer', serviceCharge: 200, labourCharge: 0, partsCost: 0, discount: 0, tax: 0, status: 'PARTIAL' }
  await assert.rejects(createInvoice(input), /Receipt failed/)
  assert.deepEqual([invoices, receipts], [0, 0])
  failReceipt = false
  await createInvoice(input)
  assert.deepEqual([invoices, receipts], [1, 1])
})

test('quotation conversion claims the quotation before creating a job card', async () => {
  let converted = false, cards = 0
  const { createJobCard } = loadSource('src/features/jobcards/actions.ts', { ...commonMocks, '@/lib/prisma': {
    $transaction: async callback => callback({
      quotation: {
        findUnique: async () => ({ customerId: 'customer', vehicleId: 'vehicle' }),
        updateMany: async () => { if (converted) return { count: 0 }; converted = true; return { count: 1 } },
        update: async args => { assert.equal(args.data.jobCardId, 'job') },
      },
      jobCard: { create: async () => { cards++; return { id: 'job' } } },
    }),
  } })
  await createJobCard(form, 'quote')
  await assert.rejects(createJobCard(form, 'quote'), /already been converted/)
  assert.equal(cards, 1)
})

test('invoice deletion detaches receipts without deleting customer payments', async () => {
  let detached = false
  const { deleteInvoice } = loadSource('src/features/invoices/actions.ts', { ...commonMocks, '@/lib/prisma': {
    $transaction: async callback => callback({
      invoice: { findUnique: async () => ({ customerId: 'customer' }), delete: async () => { assert.equal(detached, true) } },
      payment: { updateMany: async args => { assert.deepEqual(args, { where: { invoiceId: 'invoice' }, data: { invoiceId: null } }); detached = true }, deleteMany: async () => assert.fail('Keep customer receipts') },
    }),
  } })
  await deleteInvoice('invoice')
  assert.equal(detached, true)
})

test('invoice descriptions follow current service and part names including pending parts without batches', () => {
  const { currentInvoiceDetails } = loadSource('src/features/invoices/current-totals.ts')
  const job = { services: [{ service: { name: 'Oil Change' }, quantity: 1 }], parts: [{ inventory: { itemName: 'Brake Pad' }, batch: null, quantity: 2, isPending: true }] }
  assert.match(currentInvoiceDetails(job).partsDetails, /Brake Pad.*2.*Pending purchase/)
  job.parts[0] = { batch: { inventory: { itemName: 'Filter' } }, quantity: 1, isPending: false }
  assert.match(currentInvoiceDetails(job).partsDetails, /Filter/)
  assert.doesNotMatch(currentInvoiceDetails(job).partsDetails, /Brake Pad/)
})

test('report actions reject anonymous requests before querying data', async () => {
  const actions = loadSource('src/features/reports/actions.ts', {
    '@/lib/authorization': { requireSession: async () => { throw new Error('Unauthorized') }, requirePagePermission: async () => { throw new Error('Unauthorized') } },
    '@/lib/prisma': new Proxy({}, { get: (_, key) => { if (key === '__esModule') return false; throw new Error('Database accessed before authorization') } }),
  })
  for (const action of Object.values(actions)) await assert.rejects(() => action(), /Unauthorized/)
})

test('login return paths allow local pages and reject executable or external URLs', () => {
  const { safeReturnPath } = loadSource('src/lib/navigation.ts')
  assert.equal(safeReturnPath('/jobcards?status=PENDING#details'), '/jobcards?status=PENDING#details')
  for (const value of [null, 'javascript:alert(1)', 'https://example.com', '//example.com', '/\\example.com', '/\n/example.com']) assert.equal(safeReturnPath(value), '/')
})

test('settings mutations reject non-admin requests before database access', async () => {
  const actions = loadSource('src/features/settings/actions.ts', {
    '@/lib/authorization': { requireAdmin: async () => { throw new Error('Unauthorized') } },
    '@/lib/prisma': new Proxy({}, { get: (_, key) => { if (key === '__esModule') return false; throw new Error('Database accessed before authorization') } }),
    './database-backup': {}, './backup-auth': {}, '@/lib/session': {},
  })
  for (const name of ['updateSettings', 'updateAdminCredentials', 'createTaxSetting', 'updateTaxSetting', 'activateTaxSetting', 'deleteTaxSetting']) await assert.rejects(() => actions[name](), /Unauthorized/)
})
