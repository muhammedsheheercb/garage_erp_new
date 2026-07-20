"use server"

import prisma from "@/lib/prisma"
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths, format, subDays, eachDayOfInterval, eachMonthOfInterval } from "date-fns"

export async function getDashboardStats() {
  const now = new Date()
  const currentMonthStart = startOfMonth(now)
  const currentMonthEnd = endOfMonth(now)
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)

  // Today's Income (invoice payments received today)
  const todayPayments = await prisma.payment.aggregate({
    where: { createdAt: { gte: todayStart, lte: todayEnd } },
    _sum: { amount: true }
  })
  const dailyRevenue = todayPayments._sum.amount || 0

  // Today's Expenses (regular expenses + purchase grandTotals created today)
  const [todayExpenses, todayPurchases] = await Promise.all([
    prisma.expense.aggregate({
      where: { date: { gte: todayStart, lte: todayEnd } },
      _sum: { amount: true }
    }),
    prisma.purchase.aggregate({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
      _sum: { grandTotal: true }
    })
  ])
  const dailyExpense = (todayExpenses._sum.amount || 0) + (todayPurchases._sum.grandTotal || 0)
  const dailyProfit = dailyRevenue - dailyExpense

  // Monthly Income
  const monthlyPayments = await prisma.payment.aggregate({
    where: { createdAt: { gte: currentMonthStart, lte: currentMonthEnd } },
    _sum: { amount: true }
  })
  const monthlyRevenue = monthlyPayments._sum.amount || 0

  // Monthly Expenses (regular + purchases)
  const [monthlyExpensesQuery, monthlyPurchases] = await Promise.all([
    prisma.expense.aggregate({
      where: { date: { gte: currentMonthStart, lte: currentMonthEnd } },
      _sum: { amount: true }
    }),
    prisma.purchase.aggregate({
      where: { createdAt: { gte: currentMonthStart, lte: currentMonthEnd } },
      _sum: { grandTotal: true }
    })
  ])
  const monthlyExpenses = (monthlyExpensesQuery._sum.amount || 0) + (monthlyPurchases._sum.grandTotal || 0)

  // Job Cards Stats
  const pendingJobs = await prisma.jobCard.count({
    where: { status: { in: ['PENDING', 'IN_PROGRESS'] } }
  })

  const completedJobs = await prisma.jobCard.count({
    where: { status: 'COMPLETED', createdAt: { gte: currentMonthStart, lte: currentMonthEnd } }
  })

  const totalCustomers = await prisma.customer.count()
  const totalVehicles = await prisma.vehicle.count()

  const profit = monthlyRevenue - monthlyExpenses

  return {
    dailyRevenue,
    dailyExpense,
    dailyProfit,
    monthlyRevenue,
    monthlyExpenses,
    profit,
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
    
    const [payments, expenses, purchases] = await Promise.all([
      prisma.payment.findMany({
        where: { createdAt: { gte: startOfDay(startDate), lte: endOfDay(now) } },
        select: { amount: true, createdAt: true }
      }),
      prisma.expense.findMany({
        where: { date: { gte: startOfDay(startDate), lte: endOfDay(now) } },
        select: { amount: true, date: true }
      }),
      prisma.purchase.findMany({
        where: { createdAt: { gte: startOfDay(startDate), lte: endOfDay(now) } },
        select: { grandTotal: true, createdAt: true }
      })
    ])

    return interval.map(date => {
      const dateString = format(date, 'MMM dd')
      
      const revenue = payments.filter(p => format(p.createdAt, 'MMM dd') === dateString)
        .reduce((sum, p) => sum + p.amount, 0)
      
      const regularExpense = expenses.filter(e => format(e.date, 'MMM dd') === dateString)
        .reduce((sum, e) => sum + e.amount, 0)
      
      const purchaseExpense = purchases.filter(p => format(p.createdAt, 'MMM dd') === dateString)
        .reduce((sum, p) => sum + p.grandTotal, 0)
      
      const expense = regularExpense + purchaseExpense
      
      return { name: dateString, revenue, expense, profit: revenue - expense }
    })
  } else {
    const startDate = subMonths(now, 5)
    const interval = eachMonthOfInterval({ start: startDate, end: now })

    const [payments, expenses, purchases] = await Promise.all([
      prisma.payment.findMany({
        where: { createdAt: { gte: startOfMonth(startDate), lte: endOfMonth(now) } },
        select: { amount: true, createdAt: true }
      }),
      prisma.expense.findMany({
        where: { date: { gte: startOfMonth(startDate), lte: endOfMonth(now) } },
        select: { amount: true, date: true }
      }),
      prisma.purchase.findMany({
        where: { createdAt: { gte: startOfMonth(startDate), lte: endOfMonth(now) } },
        select: { grandTotal: true, createdAt: true }
      })
    ])

    return interval.map(date => {
      const dateString = format(date, 'MMM yyyy')
      
      const revenue = payments.filter(p => format(p.createdAt, 'MMM yyyy') === dateString)
        .reduce((sum, p) => sum + p.amount, 0)
      
      const regularExpense = expenses.filter(e => format(e.date, 'MMM yyyy') === dateString)
        .reduce((sum, e) => sum + e.amount, 0)
      
      const purchaseExpense = purchases.filter(p => format(p.createdAt, 'MMM yyyy') === dateString)
        .reduce((sum, p) => sum + p.grandTotal, 0)
      
      const expense = regularExpense + purchaseExpense
      
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
      date: format(p.createdAt, 'yyyy-MM-dd HH:mm'),
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
      date: format(e.date, 'yyyy-MM-dd'),
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
      date: format(j.createdAt, 'yyyy-MM-dd'),
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
      dateJoined: format(c.createdAt, 'yyyy-MM-dd'),
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
      dateAdded: format(v.createdAt, 'yyyy-MM-dd'),
      plateNumber: v.plateNumber,
      brand: v.brand,
      model: v.model,
      customer: v.customer.name
    }))
  }

  return []
}

export async function getRecentActivities() {
  const latestInvoices = await prisma.invoice.findMany({
    take: 3,
    orderBy: { createdAt: 'desc' },
    include: { customer: true }
  })
  
  const latestJobs = await prisma.jobCard.findMany({
    take: 3,
    orderBy: { createdAt: 'desc' },
    include: { customer: true }
  })
  
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
      time: format(a.time, 'MMM dd, HH:mm')
    }))
}
