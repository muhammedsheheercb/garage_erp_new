"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getDashboardStats, getRevenueExpenseChartData, getDetailedReportData } from "../actions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Loader2, Download, Printer, DollarSign, TrendingUp, Users, Car, Wrench, CheckCircle, Activity } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useTranslation } from "@/i18n"

export function ReportsDashboard() {
  const { t } = useTranslation()
  const [chartPeriod, setChartPeriod] = useState<'daily' | 'monthly'>('daily')
  const [reportType, setReportType] = useState<'revenue' | 'expenses' | 'jobs' | 'customers' | 'vehicles'>('revenue')

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['report-stats'],
    queryFn: () => getDashboardStats()
  })

  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ['report-chart', chartPeriod],
    queryFn: () => getRevenueExpenseChartData(chartPeriod)
  })

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['report-details', reportType, chartPeriod],
    queryFn: () => getDetailedReportData(reportType, chartPeriod)
  })

  const handlePrint = () => {
    window.print()
  }

  const handleExportCSV = () => {
    if (!detailData || detailData.length === 0) return

    const headers = Object.keys(detailData[0]).join(',')
    const rows = detailData.map(obj => Object.values(obj).map(v => `"${v}"`).join(','))
    const csv = [headers, ...rows].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `garage_report_${reportType}_${new Date().getTime()}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (statsLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const kpis = [
    { title: t.dashboard.monthlyIncome, value: `${stats?.monthlyRevenue.toFixed(3) || "0.000"} OMR`, icon: DollarSign, color: "text-green-500", desc: t.dashboard.paymentsReceivedToday },
    { title: t.nav.expenses, value: `${stats?.monthlyExpenses.toFixed(3) || "0.000"} OMR`, icon: TrendingUp, color: "text-red-500", desc: t.dashboard.expensesPurchasesToday },
    { title: t.dashboard.monthlyProfit, value: `${stats?.profit.toFixed(3) || "0.000"} OMR`, icon: Activity, color: stats?.profit != null && stats.profit >= 0 ? "text-primary" : "text-destructive", desc: t.dashboard.incomeMinusAllExpenses },
    { title: t.dashboard.pendingJobs, value: stats?.pendingJobs || 0, icon: Wrench, color: "text-orange-500", desc: "" },
    { title: t.dashboard.completedJobsMonth, value: stats?.completedJobs || 0, icon: CheckCircle, color: "text-green-500", desc: t.dashboard.thisMonth },
    { title: t.nav.customers, value: stats?.totalCustomers || 0, icon: Users, color: "text-indigo-500", desc: "" },
    { title: t.nav.vehicles, value: stats?.totalVehicles || 0, icon: Car, color: "text-purple-500", desc: "" },
  ]

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t.nav.reports}</h2>
          <p className="text-muted-foreground mt-1">{t.nav.reports}</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" className="flex-1 sm:flex-none" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> {t.invoicesMod.print}
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={handleExportCSV} disabled={detailLoading || !detailData?.length}>
            <Download className="mr-2 h-4 w-4" /> {t.jobcards.download}
          </Button>
        </div>
      </div>

      {/* Print Title (Only visible when printing) */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-center">{t.common.appName} - {t.nav.reports}</h1>
        <p className="text-center text-sm text-muted-foreground">{t.payments.date}: {new Date().toLocaleDateString()}</p>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <Card key={i} className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
                <Icon className={`h-4 w-4 ${kpi.color}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
                {kpi.desc && <p className="text-xs text-muted-foreground mt-1">{kpi.desc}</p>}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Chart Section */}
      <Card className="shadow-sm print:break-inside-avoid">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <CardTitle>{t.nav.reports}</CardTitle>
            <CardDescription>{t.nav.reports}</CardDescription>
          </div>
          <Tabs value={chartPeriod} onValueChange={(v: any) => setChartPeriod(v)} className="w-full sm:w-[200px] print:hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="daily">{t.dashboard.todaysIncome}</TabsTrigger>
              <TabsTrigger value="monthly">{t.common.month}</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-6 pl-0">
          {chartLoading ? (
            <div className="flex justify-center items-center h-[300px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dx={-10} />
                  <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="revenue" name={t.dashboard.todaysIncome} fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  <Bar dataKey="expense" name={t.nav.expenses} fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Data Tables */}
      <Card className="shadow-sm print:break-inside-avoid">
        <CardHeader className="border-b pb-4 print:hidden">
          <Tabs value={reportType} onValueChange={(v: any) => setReportType(v)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 max-w-[600px]">
              <TabsTrigger value="revenue">{t.dashboard.todaysIncome}</TabsTrigger>
              <TabsTrigger value="expenses">{t.nav.expenses}</TabsTrigger>
              <TabsTrigger value="jobs">{t.nav.createJobCard}</TabsTrigger>
              <TabsTrigger value="customers">{t.nav.customers}</TabsTrigger>
              <TabsTrigger value="vehicles">{t.nav.vehicles}</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        
        <div className="hidden print:block border-b p-4 font-bold text-lg">
          {t.nav.reports}: {reportType.toUpperCase()}
        </div>

        <CardContent className="pt-4 p-0 sm:p-6">
          {detailLoading ? (
            <div className="flex justify-center items-center h-[200px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : detailData?.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">{t.common.noResults}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(detailData![0]).filter(k => k !== 'id').map(key => (
                      <TableHead key={key} className="capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailData?.map((row: any) => (
                    <TableRow key={row.id}>
                      {Object.entries(row).filter(([k]) => k !== 'id').map(([k, v]) => (
                        <TableCell key={`${row.id}-${k}`}>
                          {typeof v === 'number' && k !== 'id' ? v.toFixed(3) : String(v)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
