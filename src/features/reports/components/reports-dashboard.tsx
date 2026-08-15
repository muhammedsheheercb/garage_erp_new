"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getReportsDashboardTotals,
  getRevenueExpenseChartData,
  getReportsDashboardDetails,
} from "../actions";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Printer,
  TrendingUp,
  Package,
  Activity,
  ChevronDown,
  ChevronUp,
  Receipt,
  CreditCard,
  ShoppingCart,
  Wallet
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/i18n";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { endOfDay } from "date-fns";
import { OmanIcon } from "@/components/currency";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { formatDisplayDate } from "@/lib/date-format";

function BreakdownCard({
  title,
  value,
  icon: Icon,
  color,
  breakdown,
  details,
  detailsHref,
}: {
  title: string;
  value: string;
  icon: any;
  color: string;
  breakdown?: Record<string, number>;
  details?: React.ReactNode;
  detailsHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const expandable = Boolean(breakdown || details);
  
  return (
    <Card className="shadow-sm transition-all h-fit">
      <CardHeader 
        className={`flex flex-row items-center justify-between pb-2 space-y-0 ${expandable ? "cursor-pointer hover:bg-muted/30" : ""}`}
        onClick={() => expandable && setOpen(!open)}
      >
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1 select-none">
          {title}
          {expandable && (open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
        </CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${color}`}>
          {value}
        </div>
        {detailsHref && (
          <Link href={detailsHref} className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-3 w-full`}>
            Details
          </Link>
        )}
        {open && breakdown && (
          <div className="mt-4 space-y-2 border-t pt-2">
            {Object.entries(breakdown).map(([method, amount]) => (
              <div key={method} className="flex justify-between text-sm">
                <span className="text-muted-foreground capitalize">{method.toLowerCase()}</span>
                <span className="font-medium">{amount.toFixed(3)} OMR</span>
              </div>
            ))}
          </div>
        )}
        {open && details}
      </CardContent>
    </Card>
  )
}

export function ReportsDashboard() {
  const { t } = useTranslation();
  const [chartPeriod, setChartPeriod] = useState<"daily" | "monthly">("daily");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [activeDetailTab, setActiveDetailTab] = useState<"income" | "expenses" | "purchases" | "paymeters">("income");

  const fromDateStr = dateRange?.from?.toISOString();
  const toDateStr = dateRange?.to ? endOfDay(dateRange.to).toISOString() : undefined;

  const getDetailsUrl = (baseHref: string) => {
    if (!fromDateStr && !toDateStr) return baseHref;
    const params = new URLSearchParams();
    if (fromDateStr) params.set("from", fromDateStr);
    if (toDateStr) params.set("to", toDateStr);
    return `${baseHref}?${params.toString()}`;
  };

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["report-totals", fromDateStr, toDateStr],
    queryFn: () => getReportsDashboardTotals(fromDateStr, toDateStr),
  });

  const { data: reportDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ["report-details", fromDateStr, toDateStr],
    queryFn: () => getReportsDashboardDetails(fromDateStr, toDateStr),
  });

  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ["report-chart", chartPeriod],
    queryFn: () => getRevenueExpenseChartData(chartPeriod),
  });

  const handlePrint = () => {
    window.print();
  };

  if (statsLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const dateFilterLabel = dateRange?.from
    ? `${formatDisplayDate(dateRange.from)} ${dateRange.to ? `- ${formatDisplayDate(dateRange.to)}` : ""}`
    : "All Time";

  return (
    <div id="report-content" className="space-y-6 print:space-y-4 rounded-xl">
      {/* Header Actions */}
      <div id="report-header-actions" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div className="flex items-center gap-2 flex-wrap">
          <DatePickerWithRange 
            date={dateRange} 
            setDate={setDateRange} 
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={handlePrint}
          >
            <Printer className="mr-2 h-4 w-4" /> {t.invoicesMod.print}
          </Button>
        </div>
      </div>

      {/* Print Title (Only visible when printing) */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <h1 className="text-2xl font-bold text-center">
          {t.common.appName} - {t.nav.reports}
        </h1>
        <div className="flex justify-between items-center text-sm text-muted-foreground mt-2">
          <span>{t.payments.date}: {formatDisplayDate(new Date())}</span>
          <span className="font-semibold">Filter Period: {dateFilterLabel}</span>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
        <BreakdownCard 
          title="Total Income" 
          value={`${stats?.totalIncome.toFixed(3) || "0.000"} OMR`}
          icon={OmanIcon}
          color="text-green-500"
          breakdown={stats?.incomeByMethod}
          detailsHref={getDetailsUrl("/payments")}
        />
        <BreakdownCard 
          title="Total Expense" 
          value={`${stats?.totalExpense.toFixed(3) || "0.000"} OMR`}
          icon={TrendingUp}
          color="text-red-500"
          breakdown={stats?.expenseBySource}
          detailsHref={getDetailsUrl("/expenses")}
        />
        <BreakdownCard 
          title="Total Purchase" 
          value={`${stats?.totalPurchase.toFixed(3) || "0.000"} OMR`}
          icon={Package}
          color="text-orange-500"
          breakdown={stats?.purchaseByMethod}
          detailsHref={getDetailsUrl("/purchases")}
        />
        <BreakdownCard
          title="Total Paymeter Paid"
          value={`${stats?.totalPaymeterPaid.toFixed(3) || "0.000"} OMR`}
          icon={OmanIcon}
          color="text-orange-500"
          breakdown={stats?.paymeterByName}
          detailsHref={getDetailsUrl("/paymeters")}
        />
        <BreakdownCard 
          title="Total Revenue" 
          value={`${stats?.totalRevenue.toFixed(3) || "0.000"} OMR`}
          icon={Activity}
          color={stats?.totalRevenue != null && stats.totalRevenue >= 0 ? "text-primary" : "text-destructive"}
        />
      </div>

      {/* Chart Section */}
      <Card className="shadow-sm print:break-inside-avoid">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <CardTitle>{t.nav.reports}</CardTitle>
            <CardDescription>{t.nav.reports} ({dateFilterLabel})</CardDescription>
          </div>
          <Tabs
            value={chartPeriod}
            onValueChange={(v: any) => setChartPeriod(v)}
            className="w-full sm:w-[200px] print:hidden"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="daily">
                {t.dashboard.todaysIncome}
              </TabsTrigger>
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
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    opacity={0.3}
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                    dx={-10}
                  />
                  <RechartsTooltip
                    cursor={{ fill: "rgba(0,0,0,0.05)" }}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: "20px" }} />
                  <Bar
                    dataKey="revenue"
                    name={t.dashboard.todaysIncome}
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={50}
                  />
                  <Bar
                    dataKey="expense"
                    name={t.nav.expenses}
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={50}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filtered Details Transaction Tables */}
      <Card className="shadow-sm print:shadow-none print:border-0">
        <CardHeader className="print:pb-2">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Filtered Transaction Details
          </CardTitle>
          <CardDescription>
            Showing detailed records for: <span className="font-semibold text-foreground">{dateFilterLabel}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {detailsLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div>
              {/* Screen Tab View */}
              <div className="print:hidden">
                <Tabs value={activeDetailTab} onValueChange={(v: any) => setActiveDetailTab(v)}>
                  <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full mb-4">
                    <TabsTrigger value="income" className="flex items-center gap-1.5">
                      <CreditCard className="h-4 w-4" /> Total Income ({reportDetails?.incomeDetails.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="expenses" className="flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4" /> Expenses ({reportDetails?.expenseDetails.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="purchases" className="flex items-center gap-1.5">
                      <ShoppingCart className="h-4 w-4" /> Purchases ({reportDetails?.purchaseDetails.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="paymeters" className="flex items-center gap-1.5">
                      <Wallet className="h-4 w-4" /> Paymeter Paid ({reportDetails?.paymeterDetails.length || 0})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="income">
                    <div className="border rounded-md overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t.payments.date}</TableHead>
                            <TableHead>{t.jobcards.customer}</TableHead>
                            <TableHead>{t.payments.invoice}</TableHead>
                            <TableHead>{t.payments.method}</TableHead>
                            <TableHead>Created By</TableHead>
                            <TableHead className="text-right">{t.payments.amount} (OMR)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportDetails?.incomeDetails.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No income transactions found for this period</TableCell></TableRow>
                          ) : (
                            reportDetails?.incomeDetails.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>{item.date}</TableCell>
                                <TableCell>{item.customer}</TableCell>
                                <TableCell className="font-semibold">{item.invoice}</TableCell>
                                <TableCell>{item.method}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{item.createdBy}</TableCell>
                                <TableCell className="text-right font-semibold text-green-600">+{item.amount.toFixed(3)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="expenses">
                    <div className="border rounded-md overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t.payments.date}</TableHead>
                            <TableHead>{t.services.category}</TableHead>
                            <TableHead>{t.common.description}</TableHead>
                            <TableHead>Source/Method</TableHead>
                            <TableHead>Created By</TableHead>
                            <TableHead className="text-right">{t.payments.amount} (OMR)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportDetails?.expenseDetails.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No expense transactions found for this period</TableCell></TableRow>
                          ) : (
                            reportDetails?.expenseDetails.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>{item.date}</TableCell>
                                <TableCell><span className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-xs">{item.category}</span></TableCell>
                                <TableCell>{item.description}</TableCell>
                                <TableCell>{item.source}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{item.createdBy}</TableCell>
                                <TableCell className="text-right font-semibold text-destructive">-{item.amount.toFixed(3)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="purchases">
                    <div className="border rounded-md overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t.purchases.purchaseNo}</TableHead>
                            <TableHead>{t.payments.date}</TableHead>
                            <TableHead>{t.suppliers.supplierTitle}</TableHead>
                            <TableHead>{t.purchases.ledger}</TableHead>
                            <TableHead>Created By</TableHead>
                            <TableHead className="text-right">{t.invoicesMod.grandTotal} (OMR)</TableHead>
                            <TableHead className="text-right">{t.purchases.paidAmount} (OMR)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportDetails?.purchaseDetails.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No purchase transactions found for this period</TableCell></TableRow>
                          ) : (
                            reportDetails?.purchaseDetails.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-semibold">{item.purchaseNumber}</TableCell>
                                <TableCell>{item.date}</TableCell>
                                <TableCell>{item.supplier}</TableCell>
                                <TableCell>{item.method}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{item.createdBy}</TableCell>
                                <TableCell className="text-right font-semibold">{item.grandTotal.toFixed(3)}</TableCell>
                                <TableCell className="text-right font-semibold text-green-600">{item.paidAmount.toFixed(3)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="paymeters">
                    <div className="border rounded-md overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t.payments.date}</TableHead>
                            <TableHead>Paymeter</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Reference / Category</TableHead>
                            <TableHead>Created By</TableHead>
                            <TableHead className="text-right">{t.payments.amount} (OMR)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportDetails?.paymeterDetails.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No paymeter transactions found for this period</TableCell></TableRow>
                          ) : (
                            reportDetails?.paymeterDetails.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>{item.date}</TableCell>
                                <TableCell className="font-semibold">{item.paymeter}</TableCell>
                                <TableCell><span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-xs">{item.type}</span></TableCell>
                                <TableCell>{item.reference}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{item.createdBy}</TableCell>
                                <TableCell className="text-right font-semibold text-orange-600">{item.amount.toFixed(3)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Print View Layout (Render all 4 tables when printing) */}
              <div className="hidden print:block space-y-6">
                <div>
                  <h3 className="font-bold text-base mb-2 text-green-700">1. Total Income Details ({reportDetails?.incomeDetails.length || 0})</h3>
                  <Table className="border text-xs">
                    <TableHeader>
                      <TableRow className="bg-gray-100">
                        <TableHead>{t.payments.date}</TableHead>
                        <TableHead>{t.jobcards.customer}</TableHead>
                        <TableHead>{t.payments.invoice}</TableHead>
                        <TableHead>{t.payments.method}</TableHead>
                        <TableHead className="text-right">{t.payments.amount} (OMR)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportDetails?.incomeDetails.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.date}</TableCell>
                          <TableCell>{item.customer}</TableCell>
                          <TableCell>{item.invoice}</TableCell>
                          <TableCell>{item.method}</TableCell>
                          <TableCell className="text-right font-semibold text-green-700">+{item.amount.toFixed(3)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div>
                  <h3 className="font-bold text-base mb-2 text-red-700">2. Expense Details ({reportDetails?.expenseDetails.length || 0})</h3>
                  <Table className="border text-xs">
                    <TableHeader>
                      <TableRow className="bg-gray-100">
                        <TableHead>{t.payments.date}</TableHead>
                        <TableHead>{t.services.category}</TableHead>
                        <TableHead>{t.common.description}</TableHead>
                        <TableHead>Source/Method</TableHead>
                        <TableHead className="text-right">{t.payments.amount} (OMR)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportDetails?.expenseDetails.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.date}</TableCell>
                          <TableCell>{item.category}</TableCell>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>{item.source}</TableCell>
                          <TableCell className="text-right font-semibold text-red-700">-{item.amount.toFixed(3)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div>
                  <h3 className="font-bold text-base mb-2 text-orange-700">3. Purchase Details ({reportDetails?.purchaseDetails.length || 0})</h3>
                  <Table className="border text-xs">
                    <TableHeader>
                      <TableRow className="bg-gray-100">
                        <TableHead>{t.purchases.purchaseNo}</TableHead>
                        <TableHead>{t.payments.date}</TableHead>
                        <TableHead>{t.suppliers.supplierTitle}</TableHead>
                        <TableHead className="text-right">{t.invoicesMod.grandTotal} (OMR)</TableHead>
                        <TableHead className="text-right">{t.purchases.paidAmount} (OMR)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportDetails?.purchaseDetails.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-semibold">{item.purchaseNumber}</TableCell>
                          <TableCell>{item.date}</TableCell>
                          <TableCell>{item.supplier}</TableCell>
                          <TableCell className="text-right font-semibold">{item.grandTotal.toFixed(3)}</TableCell>
                          <TableCell className="text-right font-semibold text-green-700">{item.paidAmount.toFixed(3)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div>
                  <h3 className="font-bold text-base mb-2 text-orange-700">4. Paymeter Paid Details ({reportDetails?.paymeterDetails.length || 0})</h3>
                  <Table className="border text-xs">
                    <TableHeader>
                      <TableRow className="bg-gray-100">
                        <TableHead>{t.payments.date}</TableHead>
                        <TableHead>Paymeter</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Reference / Category</TableHead>
                        <TableHead className="text-right">{t.payments.amount} (OMR)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportDetails?.paymeterDetails.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.date}</TableCell>
                          <TableCell className="font-semibold">{item.paymeter}</TableCell>
                          <TableCell>{item.type}</TableCell>
                          <TableCell>{item.reference}</TableCell>
                          <TableCell className="text-right font-semibold text-orange-700">{item.amount.toFixed(3)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
