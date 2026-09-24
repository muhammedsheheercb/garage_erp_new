"use server"

import prisma from "@/lib/prisma"
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths, format, subDays, eachDayOfInterval, eachMonthOfInterval } from "date-fns"
import { formatDisplayDate } from "@/lib/date-format"

export async function getDashboardStats() {
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const today = { gte: todayStart, lte: todayEnd }
  const directPaymeterNames = ["Direct Cash", "Direct Bank Transfer", "Card", "Direct Card"]
  const isDirectPaymeter = (name?: string) => directPaymeterNames.includes(name || "")

  const [
    payments,
    jobCards,
    directSales,
    purchases,
    expenses,
    purchasePayments,
    paymeterExpenses,
    settlements,
    pendingJobs,
  ] = await Promise.all([
    prisma.payment.aggregate({ where: { createdAt: today }, _sum: { amount: true } }),
    prisma.jobCard.aggregate({
      where: { date: today, status: { not: "CANCELLED" } },
      _sum: { grandTotal: true },
    }),
    prisma.directSale.aggregate({ where: { saleDate: today }, _sum: { grandTotal: true } }),
    prisma.purchase.aggregate({ where: { purchaseDate: today }, _sum: { grandTotal: true } }),
    prisma.expense.findMany({ where: { date: today }, select: { amount: true, paymeterId: true } }),
    prisma.purchasePayment.findMany({
      where: { date: today },
      select: { amount: true, paidAmount: true, pendingAmount: true, paymeter: { select: { name: true } } },
    }),
    prisma.expense.findMany({
      where: { date: today, paymeterId: { not: null } },
      select: { amount: true, paymeter: { select: { name: true } } },
    }),
    prisma.paymeterSettlement.findMany({
      where: { date: today },
      select: { amount: true, paymeter: { select: { name: true } } },
    }),
    prisma.jobCard.count({ where: { status: { in: ["PENDING", "IN_PROGRESS"] } } }),
  ])

  const dailyJobCardSales = jobCards._sum.grandTotal || 0
  const dailyIncome = (payments._sum.amount || 0) + (directSales._sum.grandTotal || 0)
  const dailyPurchase = purchases._sum.grandTotal || 0
  const dailyExpense = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const dailyRevenue = dailyIncome - dailyPurchase - dailyExpense
  const dailyDirectPurchasePaid = purchasePayments
    .filter((payment) => isDirectPaymeter(payment.paymeter.name) && payment.paidAmount === 0 && payment.pendingAmount === 0)
    .reduce((sum, payment) => sum + payment.amount, 0)
  const dailyDirectSupplierPaid = purchasePayments
    .filter((payment) => isDirectPaymeter(payment.paymeter.name) && (payment.paidAmount > 0 || payment.pendingAmount > 0))
    .reduce((sum, payment) => sum + payment.amount, 0)
  const dailyDirectExpensePaid = expenses
    .filter((expense) => !expense.paymeterId)
    .reduce((sum, expense) => sum + expense.amount, 0)
  const dailyPaymeterPaid = paymeterExpenses
    .filter((expense) => !isDirectPaymeter(expense.paymeter?.name))
    .reduce((sum, expense) => sum + expense.amount, 0)
    + purchasePayments
      .filter((payment) => !isDirectPaymeter(payment.paymeter.name))
      .reduce((sum, payment) => sum + payment.amount, 0)
  const dailyCompanyReturnToPaymeter = settlements
    .filter((settlement) => !isDirectPaymeter(settlement.paymeter.name))
    .reduce((sum, settlement) => sum + settlement.amount, 0)
  const dailyNetCashFlow = dailyIncome
    - dailyDirectPurchasePaid
    - dailyDirectSupplierPaid
    - dailyDirectExpensePaid
    - dailyCompanyReturnToPaymeter

  return {
    dailyJobCardSales,
    dailyIncome,
    dailyPurchase,
    dailyExpense,
    dailyRevenue,
    dailyDirectPurchasePaid,
    dailyDirectSupplierPaid,
    dailyDirectExpensePaid,
    dailyPaymeterPaid,
    dailyCompanyReturnToPaymeter,
    dailyNetCashFlow,
    pendingJobs,
  }
}

export async function getRevenueExpenseChartData(period: 'daily' | 'monthly' = 'daily') {
  const now = new Date()
  
  if (period === 'daily') {
    const startDate = subDays(now, 14)
    const interval = eachDayOfInterval({ start: startDate, end: now })
    
    const [payments, directSales, expenses, paymeterExpenses] = await Promise.all([
      prisma.payment.findMany({
        where: { createdAt: { gte: startOfDay(startDate), lte: endOfDay(now) } },
        select: { amount: true, createdAt: true }
      }),
      prisma.directSale.findMany({ where: { saleDate: { gte: startOfDay(startDate), lte: endOfDay(now) } }, select: { grandTotal: true, saleDate: true } }),
      prisma.expense.findMany({
        where: { date: { gte: startOfDay(startDate), lte: endOfDay(now) }, paymeterId: null },
        select: { amount: true, date: true }
      }),
      prisma.expense.findMany({
        where: { date: { gte: startOfDay(startDate), lte: endOfDay(now) }, paymeterId: { not: null } },
        select: { amount: true, date: true }
      })
    ])

    return interval.map(date => {
      const dateString = formatDisplayDate(date)
      
      const revenue = payments.filter(p => formatDisplayDate(p.createdAt) === dateString).reduce((sum, p) => sum + p.amount, 0)
        + directSales.filter(s => formatDisplayDate(s.saleDate) === dateString).reduce((sum, s) => sum + s.grandTotal, 0)
      
      const regularExpense = expenses.filter(e => formatDisplayDate(e.date) === dateString)
        .reduce((sum, e) => sum + e.amount, 0)
      
      const paymeterExpense = paymeterExpenses.filter(e => formatDisplayDate(e.date) === dateString)
        .reduce((sum, e) => sum + e.amount, 0)
      // Supplier repayments only settle the Paymeter balance, so they are
      // not included as a second cost in the revenue calculation.
      const expense = regularExpense + paymeterExpense
      
      return { name: dateString, revenue, expense, profit: revenue - expense }
    })
  } else {
    const startDate = subMonths(now, 5)
    const interval = eachMonthOfInterval({ start: startDate, end: now })

    const [payments, directSales, expenses, paymeterExpenses] = await Promise.all([
      prisma.payment.findMany({
        where: { createdAt: { gte: startOfMonth(startDate), lte: endOfMonth(now) } },
        select: { amount: true, createdAt: true }
      }),
      prisma.directSale.findMany({ where: { saleDate: { gte: startOfMonth(startDate), lte: endOfMonth(now) } }, select: { grandTotal: true, saleDate: true } }),
      prisma.expense.findMany({
        where: { date: { gte: startOfMonth(startDate), lte: endOfMonth(now) }, paymeterId: null },
        select: { amount: true, date: true }
      }),
      prisma.expense.findMany({
        where: { date: { gte: startOfMonth(startDate), lte: endOfMonth(now) }, paymeterId: { not: null } },
        select: { amount: true, date: true }
      })
    ])

    return interval.map(date => {
      const dateString = format(date, 'MM/yyyy')
      
      const revenue = payments.filter(p => format(p.createdAt, 'MM/yyyy') === dateString).reduce((sum, p) => sum + p.amount, 0)
        + directSales.filter(s => format(s.saleDate, 'MM/yyyy') === dateString).reduce((sum, s) => sum + s.grandTotal, 0)
      
      const regularExpense = expenses.filter(e => format(e.date, 'MM/yyyy') === dateString)
        .reduce((sum, e) => sum + e.amount, 0)
      
      const paymeterExpense = paymeterExpenses.filter(e => format(e.date, 'MM/yyyy') === dateString)
        .reduce((sum, e) => sum + e.amount, 0)
      // Supplier repayments only settle the Paymeter balance, so they are
      // not included as a second cost in the revenue calculation.
      const expense = regularExpense + paymeterExpense
      
      return { name: dateString, revenue, expense, profit: revenue - expense }
    })
  }
}


export async function getDetailedReportData(type: 'revenue' | 'expenses' | 'jobs' | 'customers' | 'vehicles', period: 'daily' | 'monthly' = 'daily') {
  const now = new Date()
  const startDate = period === 'daily' ? startOfDay(subDays(now, 30)) : startOfMonth(subMonths(now, 12))
  
  if (type === 'revenue') {
    const data = await prisma.payment.findMany({
      where: { createdAt: { gte: startDate } },
      include: {
        invoice: {
          include: { customer: true, jobCard: { include: { vehicle: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    return data.map((p: any) => ({
      id: p.id,
      date: formatDisplayDate(p.createdAt, true),
      amount: p.amount,
      method: p.method,
      customer: p.invoice?.customer.name || p.jobCard?.customer.name || '-',
      vehicle: p.invoice?.jobCard.vehicle.plateNumber || p.jobCard?.vehicle.plateNumber || '-',
      invoice: p.invoice ? `INV-${p.invoice.id.split('-')[0].toUpperCase()}` : `JOB-${p.jobCard?.id.split('-')[0].toUpperCase() || '-'}`
    }))
  }
  
  if (type === 'expenses') {
    const data = await prisma.expense.findMany({
      where: { date: { gte: startDate } },
      orderBy: { date: 'desc' }
    })
    
    return data.map(e => ({
      id: e.id,
      date: formatDisplayDate(e.date),
      category: e.category,
      amount: e.amount,
      description: e.description || '-'
    }))
  }

  if (type === 'jobs') {
    const data = await prisma.jobCard.findMany({
      where: { createdAt: { gte: startDate } },
      include: { customer: true, vehicle: true, mechanic: true },
      orderBy: { createdAt: 'desc' }
    })
    
    return data.map(j => ({
      id: j.id,
      date: formatDisplayDate(j.createdAt),
      customer: j.customer.name,
      vehicle: j.vehicle.plateNumber,
      mechanic: j.mechanic.name,
      status: j.status,
      grandTotal: j.grandTotal
    }))
  }

  if (type === 'customers') {
    const data = await prisma.customer.findMany({
      where: { createdAt: { gte: startDate } },
      orderBy: { createdAt: 'desc' }
    })
    
    return data.map(c => ({
      id: c.id,
      dateJoined: formatDisplayDate(c.createdAt),
      name: c.name,
      email: c.email || '-',
      phone: c.phone || '-'
    }))
  }

  if (type === 'vehicles') {
    const data = await prisma.vehicle.findMany({
      where: { createdAt: { gte: startDate } },
      include: { customer: true },
      orderBy: { createdAt: 'desc' }
    })
    
    return data.map(v => ({
      id: v.id,
      dateAdded: formatDisplayDate(v.createdAt),
      plateNumber: v.plateNumber,
      brand: v.brand,
      model: v.model,
      customer: v.customer.name
    }))
  }

  return []
}

export async function getRecentActivities() {
  const [latestInvoices, latestJobs] = await Promise.all([
    prisma.invoice.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        customer: { select: { name: true } },
      }
    }),
    prisma.jobCard.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        customer: { select: { name: true } },
      }
    })
  ])
  
  const activities = [
    ...latestInvoices.map(i => ({
      id: `inv-${i.id}`,
      action: `Invoice #${i.id.split('-')[0].toUpperCase()} Created/Updated`,
      customer: i.customer.name,
      status: i.status,
      time: i.createdAt
    })),
    ...latestJobs.map(j => ({
      id: `job-${j.id}`,
      action: `Job Card Updated`,
      customer: j.customer.name,
      status: j.status,
      time: j.createdAt
    }))
  ]
  
  // Sort by time descending and take top 5
  return activities
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, 5)
    .map(a => ({
      ...a,
      time: formatDisplayDate(a.time, true)
    }))
}

export async function getReportsDashboardTotals(fromDate?: string, toDate?: string) {
  let dateFilter: any = {}
  
  if (fromDate || toDate) {
    const start = fromDate ? new Date(fromDate) : new Date(toDate!)
    const end = toDate ? new Date(toDate) : new Date(fromDate!)
    dateFilter.gte = start
    dateFilter.lte = endOfDay(end)
  }

  const directPaymeterNames = ["Direct Cash", "Direct Bank Transfer", "Card", "Direct Card"]
  const isDirectPaymeter = (name?: string) => directPaymeterNames.includes(name || "")

  // 1. Total Income & breakdown
  const [payments, directSales, completedJobCards] = await Promise.all([prisma.payment.findMany({
    where: { createdAt: dateFilter },
    select: { amount: true, method: true }
  }),
  prisma.directSale.findMany({
    where: { saleDate: dateFilter },
    select: {
      grandTotal: true,
      items: { select: { quantity: true, purchasePrice: true, salesPrice: true } },
    },
  }),
  // Job Cards are reported from the moment their saved service or part rows exist.
  // Cancelled cards are excluded. Each part retains its linked stock batch.
  prisma.jobCard.findMany({
    where: { status: { not: "CANCELLED" }, date: dateFilter },
    select: {
      grandTotal: true,
      discount: true,
      services: { select: { price: true } },
      parts: {
        select: {
          quantity: true,
          price: true,
          batch: { select: { purchasePrice: true } },
        },
      },
    },
  })])
  let totalIncome = 0;
  const incomeByMethod: Record<string, number> = {};
  for (const p of payments) {
    totalIncome += p.amount;
    incomeByMethod[p.method] = (incomeByMethod[p.method] || 0) + p.amount;
  }
  const directSaleIncome = directSales.reduce((sum, sale) => sum + sale.grandTotal, 0)
  totalIncome += directSaleIncome
  if (directSaleIncome) incomeByMethod["Direct Sale"] = directSaleIncome

  // A payment discount reduces labour first. If it is larger than the
  // labour value, only the remainder reduces parts sales and parts profit.
  const totalLabourCharges = completedJobCards.reduce((sum, jobCard) => {
    const labour = jobCard.services.reduce((serviceSum, service) => serviceSum + service.price, 0)
    return sum + Math.max(0, labour - jobCard.discount)
  }, 0)

  const jobCardPartsSales = completedJobCards.reduce((sum, jobCard) => {
    const labour = jobCard.services.reduce((serviceSum, service) => serviceSum + service.price, 0)
    const partsSales = jobCard.parts.reduce((partSum, part) => partSum + part.price * part.quantity, 0)
    const remainingDiscount = Math.max(0, jobCard.discount - labour)
    return sum + Math.max(0, partsSales - remainingDiscount)
  }, 0)
  const jobCardPartsCost = completedJobCards.reduce(
    (sum, jobCard) => sum + jobCard.parts.reduce((partSum, part) => partSum + (part.batch?.purchasePrice || 0) * part.quantity, 0),
    0,
  )
  const jobCardPartsProfit = jobCardPartsSales - jobCardPartsCost

  // DirectSaleItem snapshots the actual batch purchase price and selling price at sale time.
  const directSalePartsSales = directSales.reduce(
    (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.salesPrice * item.quantity, 0),
    0,
  )
  const directSalePartsCost = directSales.reduce(
    (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.purchasePrice * item.quantity, 0),
    0,
  )
  const directSalePartsProfit = directSalePartsSales - directSalePartsCost
  const totalPartsProfit = jobCardPartsProfit + directSalePartsProfit

  // 2. Regular expenses. Paymeter-funded expenses are counted below as
  // paymeter outflows, so they must not be counted twice.
  const expenses = await prisma.expense.findMany({
    where: { date: dateFilter },
    select: { amount: true, paymentMethod: true, paymeterId: true }
  })
  const totalExpense = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const expenseByMethod: Record<string, number> = {}
  for (const expense of expenses) {
    expenseByMethod[expense.paymentMethod] = (expenseByMethod[expense.paymentMethod] || 0) + expense.amount
  }
  const allExpenses = await prisma.expense.findMany({
    where: { date: dateFilter },
    select: { amount: true, paymentMethod: true, paymeter: { select: { name: true } } },
  })
  const expenseBySource: Record<string, number> = {}
  for (const expense of allExpenses) {
    const source = expense.paymeter?.name || expense.paymentMethod
    expenseBySource[source] = (expenseBySource[source] || 0) + expense.amount
  }

  // 3. Actual money taken from paymeters: paymeter expenses plus every
  // purchase payment (initial purchase payments and later supplier payments).
  const [paymeterExpenses, paymeterPayments, paymeterSettlements] = await Promise.all([
    prisma.expense.findMany({
      where: { date: dateFilter, paymeterId: { not: null } },
      include: { paymeter: true },
      orderBy: { date: "desc" }
    }),
    prisma.purchasePayment.findMany({
      where: { date: dateFilter },
      include: { paymeter: true, purchase: { select: { purchaseNumber: true } } },
      orderBy: { date: "desc" }
    }),
    prisma.paymeterSettlement.findMany({
      where: { date: dateFilter },
      include: { paymeter: true },
      orderBy: { date: "desc" }
    })
  ])
  const totalPaymeterPaid = paymeterExpenses
    .filter((expense) => !isDirectPaymeter(expense.paymeter?.name))
    .reduce((sum, expense) => sum + expense.amount, 0)
    + paymeterPayments
      .filter((payment) => !isDirectPaymeter(payment.paymeter.name))
      .reduce((sum, payment) => sum + payment.amount, 0)
  const paymeterByName: Record<string, number> = {}
  for (const expense of paymeterExpenses) {
    const name = expense.paymeter?.name || "Unknown"
    if (isDirectPaymeter(name)) continue
    paymeterByName[name] = (paymeterByName[name] || 0) + expense.amount
  }
  for (const payment of paymeterPayments) {
    const name = payment.paymeter.name
    if (isDirectPaymeter(name)) continue
    paymeterByName[name] = (paymeterByName[name] || 0) + payment.amount
  }

  // Kept for the existing purchase KPI and its breakdown.
  const purchases = await prisma.purchase.findMany({
    where: { purchaseDate: dateFilter },
    include: { paymentMethod: true }
  })
  let totalPurchase = 0;
  const purchaseByMethod: Record<string, number> = {};
  for (const p of purchases) {
    totalPurchase += p.grandTotal;
    const method = p.paymentMethod?.name || 'Unknown';
    purchaseByMethod[method] = (purchaseByMethod[method] || 0) + p.grandTotal;
  }

  const totalJobCardSales = completedJobCards.reduce((sum, jobCard) => sum + jobCard.grandTotal, 0)
  const totalDirectPurchasePaid = paymeterPayments
    .filter((payment) => isDirectPaymeter(payment.paymeter.name) && payment.paidAmount === 0 && payment.pendingAmount === 0)
    .reduce((sum, payment) => sum + payment.amount, 0)
  const totalDirectSupplierPaid = paymeterPayments
    .filter((payment) => isDirectPaymeter(payment.paymeter.name) && (payment.paidAmount > 0 || payment.pendingAmount > 0))
    .reduce((sum, payment) => sum + payment.amount, 0)
  const totalDirectExpensePaid = expenses
    .filter((expense) => !expense.paymeterId)
    .reduce((sum, expense) => sum + expense.amount, 0)
  const totalCompanyReturnToPaymeter = paymeterSettlements
    .filter((settlement) => !isDirectPaymeter(settlement.paymeter.name))
    .reduce((sum, settlement) => sum + settlement.amount, 0)

  // Revenue is income less the actual purchase and expense cost.
  const totalRevenue = totalIncome - totalPurchase - totalExpense
  // Cash flow includes only direct company payments plus staff repayments.
  const totalCashFlow = totalIncome
    - totalDirectPurchasePaid
    - totalDirectSupplierPaid
    - totalDirectExpensePaid
    - totalCompanyReturnToPaymeter;

  return {
    totalIncome,
    incomeByMethod,
    totalExpense,
    expenseByMethod,
    expenseBySource,
    totalPurchase,
    totalJobCardSales,
    totalDirectPurchasePaid,
    totalDirectSupplierPaid,
    totalDirectExpensePaid,
    totalCompanyReturnToPaymeter,
    totalCashFlow,
    purchaseByMethod,
    totalPaymeterPaid,
    paymeterByName,
    totalRevenue,
    totalLabourCharges,
    jobCardPartsSales,
    jobCardPartsCost,
    jobCardPartsProfit,
    directSalePartsSales,
    directSalePartsCost,
    directSalePartsProfit,
    totalPartsProfit,
  }
}

export async function getReportsDashboardDetails(fromDate?: string, toDate?: string) {
  let dateFilter: any = {}
  
  if (fromDate || toDate) {
    const start = fromDate ? new Date(fromDate) : new Date(toDate!)
    const end = toDate ? new Date(toDate) : new Date(fromDate!)
    dateFilter.gte = start
    dateFilter.lte = endOfDay(end)
  }

  const [incomeList, directSaleList, expenseList, purchaseList, paymeterExpensesList, paymeterPaymentsList] = await Promise.all([
    prisma.payment.findMany({
      where: { createdAt: dateFilter },
      include: {
        invoice: {
          include: { customer: true, jobCard: { include: { vehicle: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.directSale.findMany({
      where: { saleDate: dateFilter },
      select: { id: true, saleDate: true, customerName: true, vehicleNumber: true, customerMobile: true, grandTotal: true, createdBy: true },
      orderBy: { saleDate: 'desc' }
    }),
    prisma.expense.findMany({
      where: { date: dateFilter },
      include: { paymeter: true },
      orderBy: { date: 'desc' }
    }),
    prisma.purchase.findMany({
      where: { createdAt: dateFilter },
      include: { supplier: true, paymentMethod: true },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.expense.findMany({
      where: { date: dateFilter, paymeterId: { not: null } },
      include: { paymeter: true },
      orderBy: { date: 'desc' }
    }),
    prisma.purchasePayment.findMany({
      where: { date: dateFilter },
      include: { paymeter: true, purchase: { select: { purchaseNumber: true } } },
      orderBy: { date: 'desc' }
    })
  ])

  const incomeDetails = [...incomeList.map((p: any) => ({
    id: p.id,
    date: formatDisplayDate(p.createdAt, true),
    amount: p.amount,
    method: p.method,
    customer: p.invoice?.customer.name || p.jobCard?.customer.name || '-',
    vehicle: p.invoice?.jobCard?.vehicle?.plateNumber || p.jobCard?.vehicle?.plateNumber || '-',
    invoice: p.invoice ? `INV-${p.invoice.id.split('-')[0].toUpperCase()}` : `JOB-${p.jobCard?.id.split('-')[0].toUpperCase() || '-'}`,
    createdBy: p.createdBy || 'Admin'
  })), ...directSaleList.map(sale => ({
    id: `direct-${sale.id}`,
    date: formatDisplayDate(sale.saleDate, true),
    amount: sale.grandTotal,
    method: 'Direct Sale',
    customer: sale.customerName,
    vehicle: sale.vehicleNumber,
    invoice: `DS-${sale.id.split('-')[0].toUpperCase()}`,
    createdBy: sale.createdBy || 'Admin'
  }))].sort((a, b) => b.date.localeCompare(a.date))

  const expenseDetails = expenseList.map(e => ({
    id: e.id,
    date: formatDisplayDate(e.date),
    category: e.category,
    description: e.description || '-',
    source: e.paymeter?.name || e.paymentMethod,
    amount: e.amount,
    createdBy: e.createdBy || 'Admin'
  }))

  const purchaseDetails = purchaseList.map(p => ({
    id: p.id,
    purchaseNumber: p.purchaseNumber,
    date: formatDisplayDate(p.createdAt),
    supplier: p.supplier.name,
    method: p.paymentMethod?.name || 'Unknown',
    grandTotal: p.grandTotal,
    paidAmount: p.paidAmount,
    pendingAmount: p.pendingAmount,
    status: p.pendingAmount === 0 ? 'PAID' : (p.paidAmount > 0 ? 'PARTIAL' : 'UNPAID'),
    createdBy: p.createdBy || 'Admin'
  }))

  const paymeterDetails = [
    ...paymeterExpensesList.map((e) => ({
      id: `exp-${e.id}`,
      date: formatDisplayDate(e.date),
      paymeter: e.paymeter?.name || 'Unknown',
      type: 'Expense',
      reference: e.category,
      amount: e.amount,
      createdBy: e.createdBy || 'Admin'
    })),
    ...paymeterPaymentsList.map((pp) => ({
      id: `pp-${pp.id}`,
      date: formatDisplayDate(pp.date),
      paymeter: pp.paymeter.name,
      type: 'Purchase Payment',
      reference: pp.purchase.purchaseNumber,
      amount: pp.amount,
      createdBy: 'Admin'
    }))
  ]

  return {
    incomeDetails,
    expenseDetails,
    purchaseDetails,
    paymeterDetails
  }
}

export async function getPaymeterReportTransactions(fromDate?: string, toDate?: string) {
  const dateFilter: any = {}
  if (fromDate || toDate) {
    if (fromDate) dateFilter.gte = new Date(fromDate)
    if (toDate) dateFilter.lte = endOfDay(new Date(toDate))
  }

  const [expenses, payments] = await Promise.all([
    prisma.expense.findMany({
      where: { date: dateFilter, paymeterId: { not: null } },
      include: { paymeter: true },
      orderBy: { date: "desc" }
    }),
    prisma.purchasePayment.findMany({
      where: { date: dateFilter },
      include: { paymeter: true, purchase: { select: { purchaseNumber: true } } },
      orderBy: { date: "desc" }
    })
  ])

  return [
    ...expenses.map((expense) => ({
      id: `expense-${expense.id}`,
      date: expense.date,
      paymeter: expense.paymeter?.name || "Unknown",
      type: "Expense",
      reference: expense.category,
      amount: expense.amount,
    })),
    ...payments.map((payment) => ({
      id: `purchase-payment-${payment.id}`,
      date: payment.date,
      paymeter: payment.paymeter.name,
      type: "Purchase payment",
      reference: payment.purchase.purchaseNumber,
      amount: payment.amount,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())
}

export async function getExpenseReportDetails(fromDate?: string, toDate?: string) {
  const dateFilter: any = {}
  if (fromDate || toDate) {
    if (fromDate) dateFilter.gte = new Date(fromDate)
    if (toDate) dateFilter.lte = endOfDay(new Date(toDate))
  }

  const expenses = await prisma.expense.findMany({
    where: { date: dateFilter, paymeterId: null },
    orderBy: { date: "desc" },
  })

  return expenses.map((expense) => ({
    id: expense.id,
    date: expense.date,
    category: expense.category,
    description: expense.description || "-",
    paymentMethod: expense.paymentMethod,
    amount: expense.amount,
  }))
}
