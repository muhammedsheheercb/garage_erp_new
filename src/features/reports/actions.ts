"use server"

import prisma from "@/lib/prisma"
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths, format, subDays, eachDayOfInterval, eachMonthOfInterval } from "date-fns"
import { formatDisplayDate } from "@/lib/date-format"

export async function getDashboardStats() {
  const now = new Date()
  const currentMonthStart = startOfMonth(now)
  const currentMonthEnd = endOfMonth(now)
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)

  const [
    todayPaymentsQuery,
    todayExpensesQuery,
    todayPaymeterExpensesQuery,
    todayPaymeterPaymentsQuery,
    todayPurchasesQuery,
    monthlyPaymentsQuery,
    monthlyExpensesQuery,
    monthlyPaymeterExpensesQuery,
    monthlyPaymeterPaymentsQuery,
    monthlyPurchasesQuery,
    pendingJobsCount,
    completedJobsCount,
    totalCustomersCount,
    totalVehiclesCount
  ] = await Promise.all([
    // Today's Income
    prisma.payment.aggregate({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
      _sum: { amount: true }
    }),
    // Today's Expenses
    prisma.expense.aggregate({
      where: { date: { gte: todayStart, lte: todayEnd } },
      _sum: { amount: true }
    }),
    prisma.expense.aggregate({
      where: { date: { gte: todayStart, lte: todayEnd }, paymeterId: { not: null } },
      _sum: { amount: true }
    }),
    prisma.purchasePayment.aggregate({
      where: { date: { gte: todayStart, lte: todayEnd } },
      _sum: { amount: true }
    }),
    // Today's Purchases
    prisma.purchase.aggregate({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
      _sum: { grandTotal: true }
    }),
    // Monthly Income
    prisma.payment.aggregate({
      where: { createdAt: { gte: currentMonthStart, lte: currentMonthEnd } },
      _sum: { amount: true }
    }),
    // Monthly Expenses
    prisma.expense.aggregate({
      where: { date: { gte: currentMonthStart, lte: currentMonthEnd } },
      _sum: { amount: true }
    }),
    prisma.expense.aggregate({
      where: { date: { gte: currentMonthStart, lte: currentMonthEnd }, paymeterId: { not: null } },
      _sum: { amount: true }
    }),
    prisma.purchasePayment.aggregate({
      where: { date: { gte: currentMonthStart, lte: currentMonthEnd } },
      _sum: { amount: true }
    }),
    // Monthly Purchases
    prisma.purchase.aggregate({
      where: { createdAt: { gte: currentMonthStart, lte: currentMonthEnd } },
      _sum: { grandTotal: true }
    }),
    // Pending Jobs
    prisma.jobCard.count({
      where: { status: { in: ['PENDING', 'IN_PROGRESS'] } }
    }),
    // Completed Jobs
    prisma.jobCard.count({
      where: { status: 'COMPLETED', createdAt: { gte: currentMonthStart, lte: currentMonthEnd } }
    }),
    // Total Customers
    prisma.customer.count(),
    // Total Vehicles
    prisma.vehicle.count()
  ])

  const dailyRevenue = todayPaymentsQuery._sum.amount || 0
  const dailyPurchase = todayPurchasesQuery._sum.grandTotal || 0
  const dailyExpense = todayExpensesQuery._sum.amount || 0
  const dailyPaymeterPaid = (todayPaymeterExpensesQuery._sum.amount || 0) + (todayPaymeterPaymentsQuery._sum.amount || 0)
  const dailyProfit = dailyRevenue - dailyPurchase - dailyExpense - dailyPaymeterPaid

  const monthlyRevenue = monthlyPaymentsQuery._sum.amount || 0
  const monthlyExpenses = monthlyExpensesQuery._sum.amount || 0
  const monthlyPaymeterPaid = (monthlyPaymeterExpensesQuery._sum.amount || 0) + (monthlyPaymeterPaymentsQuery._sum.amount || 0)
  const monthlyPurchaseTotal = monthlyPurchasesQuery._sum.grandTotal || 0

  const pendingJobs = pendingJobsCount
  const completedJobs = completedJobsCount
  const totalCustomers = totalCustomersCount
  const totalVehicles = totalVehiclesCount

  const profit = monthlyRevenue - monthlyPurchaseTotal - monthlyExpenses - monthlyPaymeterPaid

  return {
    dailyRevenue,
    dailyPurchase,
    dailyExpense,
    dailyProfit,
    dailyPaymeterPaid,
    monthlyRevenue,
    monthlyExpenses,
    profit,
    monthlyPaymeterPaid,
    pendingJobs,
    completedJobs,
    totalCustomers,
    totalVehicles
  }
}

export async function getRevenueExpenseChartData(period: 'daily' | 'monthly' = 'daily') {
  const now = new Date()
  
  if (period === 'daily') {
    const startDate = subDays(now, 14)
    const interval = eachDayOfInterval({ start: startDate, end: now })
    
    const [payments, expenses, paymeterExpenses, paymeterPayments] = await Promise.all([
      prisma.payment.findMany({
        where: { createdAt: { gte: startOfDay(startDate), lte: endOfDay(now) } },
        select: { amount: true, createdAt: true }
      }),
      prisma.expense.findMany({
        where: { date: { gte: startOfDay(startDate), lte: endOfDay(now) }, paymeterId: null },
        select: { amount: true, date: true }
      }),
      prisma.expense.findMany({
        where: { date: { gte: startOfDay(startDate), lte: endOfDay(now) }, paymeterId: { not: null } },
        select: { amount: true, date: true }
      }),
      prisma.purchasePayment.findMany({
        where: { date: { gte: startOfDay(startDate), lte: endOfDay(now) } },
        select: { amount: true, date: true }
      })
    ])

    return interval.map(date => {
      const dateString = formatDisplayDate(date)
      
      const revenue = payments.filter(p => formatDisplayDate(p.createdAt) === dateString)
        .reduce((sum, p) => sum + p.amount, 0)
      
      const regularExpense = expenses.filter(e => formatDisplayDate(e.date) === dateString)
        .reduce((sum, e) => sum + e.amount, 0)
      
      const paymeterExpense = paymeterExpenses.filter(e => formatDisplayDate(e.date) === dateString)
        .reduce((sum, e) => sum + e.amount, 0)
      const paymeterPayment = paymeterPayments.filter(p => formatDisplayDate(p.date) === dateString)
        .reduce((sum, p) => sum + p.amount, 0)
      
      const expense = regularExpense + paymeterExpense + paymeterPayment
      
      return { name: dateString, revenue, expense, profit: revenue - expense }
    })
  } else {
    const startDate = subMonths(now, 5)
    const interval = eachMonthOfInterval({ start: startDate, end: now })

    const [payments, expenses, paymeterExpenses, paymeterPayments] = await Promise.all([
      prisma.payment.findMany({
        where: { createdAt: { gte: startOfMonth(startDate), lte: endOfMonth(now) } },
        select: { amount: true, createdAt: true }
      }),
      prisma.expense.findMany({
        where: { date: { gte: startOfMonth(startDate), lte: endOfMonth(now) }, paymeterId: null },
        select: { amount: true, date: true }
      }),
      prisma.expense.findMany({
        where: { date: { gte: startOfMonth(startDate), lte: endOfMonth(now) }, paymeterId: { not: null } },
        select: { amount: true, date: true }
      }),
      prisma.purchasePayment.findMany({
        where: { date: { gte: startOfMonth(startDate), lte: endOfMonth(now) } },
        select: { amount: true, date: true }
      })
    ])

    return interval.map(date => {
      const dateString = format(date, 'MM/yyyy')
      
      const revenue = payments.filter(p => format(p.createdAt, 'MM/yyyy') === dateString)
        .reduce((sum, p) => sum + p.amount, 0)
      
      const regularExpense = expenses.filter(e => format(e.date, 'MM/yyyy') === dateString)
        .reduce((sum, e) => sum + e.amount, 0)
      
      const paymeterExpense = paymeterExpenses.filter(e => format(e.date, 'MM/yyyy') === dateString)
        .reduce((sum, e) => sum + e.amount, 0)
      const paymeterPayment = paymeterPayments.filter(p => format(p.date, 'MM/yyyy') === dateString)
        .reduce((sum, p) => sum + p.amount, 0)
      
      const expense = regularExpense + paymeterExpense + paymeterPayment
      
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
    
    return data.map(p => ({
      id: p.id,
      date: formatDisplayDate(p.createdAt, true),
      amount: p.amount,
      method: p.method,
      customer: p.invoice.customer.name,
      vehicle: p.invoice.jobCard.vehicle.plateNumber,
      invoice: `INV-${p.invoice.id.split('-')[0].toUpperCase()}`
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
  const now = new Date()
  let dateFilter: any = {}
  
  if (fromDate || toDate) {
    const start = fromDate ? new Date(fromDate) : new Date(toDate!)
    const end = toDate ? new Date(toDate) : new Date(fromDate!)
    dateFilter.gte = start
    dateFilter.lte = endOfDay(end)
  } else {
    dateFilter = { gte: startOfMonth(now), lte: endOfMonth(now) }
  }

  // 1. Total Income & breakdown
  const payments = await prisma.payment.findMany({
    where: { createdAt: dateFilter },
    select: { amount: true, method: true }
  })
  let totalIncome = 0;
  const incomeByMethod: Record<string, number> = {};
  for (const p of payments) {
    totalIncome += p.amount;
    incomeByMethod[p.method] = (incomeByMethod[p.method] || 0) + p.amount;
  }

  // 2. Regular expenses. Paymeter-funded expenses are counted below as
  // paymeter outflows, so they must not be counted twice.
  const expenses = await prisma.expense.findMany({
    where: { date: dateFilter },
    select: { amount: true, paymentMethod: true }
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
  const [paymeterExpenses, paymeterPayments] = await Promise.all([
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
  const totalPaymeterPaid = paymeterExpenses.reduce((sum, expense) => sum + expense.amount, 0)
    + paymeterPayments.reduce((sum, payment) => sum + payment.amount, 0)
  const paymeterByName: Record<string, number> = {}
  for (const expense of paymeterExpenses) {
    const name = expense.paymeter?.name || "Unknown"
    paymeterByName[name] = (paymeterByName[name] || 0) + expense.amount
  }
  for (const payment of paymeterPayments) {
    const name = payment.paymeter.name
    paymeterByName[name] = (paymeterByName[name] || 0) + payment.amount
  }

  // Kept for the existing purchase KPI and its breakdown.
  const purchases = await prisma.purchase.findMany({
    where: { createdAt: dateFilter },
    include: { paymentMethod: true }
  })
  let totalPurchase = 0;
  const purchaseByMethod: Record<string, number> = {};
  for (const p of purchases) {
    totalPurchase += p.grandTotal;
    const method = p.paymentMethod?.name || 'Unknown';
    purchaseByMethod[method] = (purchaseByMethod[method] || 0) + p.grandTotal;
  }

  // 4. Total Revenue (Profit)
  const totalRevenue = totalIncome - totalPurchase - totalExpense - totalPaymeterPaid;

  return {
    totalIncome,
    incomeByMethod,
    totalExpense,
    expenseByMethod,
    expenseBySource,
    totalPurchase,
    purchaseByMethod,
    totalPaymeterPaid,
    paymeterByName,
    totalRevenue
  }
}

export async function getPaymeterReportTransactions(fromDate?: string, toDate?: string) {
  const dateFilter: any = {}
  if (fromDate || toDate) {
    if (fromDate) dateFilter.gte = new Date(fromDate)
    if (toDate) dateFilter.lte = endOfDay(new Date(toDate))
  } else {
    dateFilter.gte = startOfMonth(new Date())
    dateFilter.lte = endOfMonth(new Date())
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
  } else {
    dateFilter.gte = startOfMonth(new Date())
    dateFilter.lte = endOfMonth(new Date())
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
