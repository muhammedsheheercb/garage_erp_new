"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getReportsDashboardTotals,
  getRevenueExpenseChartData,
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
  Download,
  Printer,
  TrendingUp,
  Package,
  Activity,
  ChevronDown,
  ChevronUp
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

function BreakdownCard({
  title,
  value,
  icon: Icon,
  color,
  breakdown,
  details,
}: {
  title: string;
  value: string;
  icon: any;
  color: string;
  breakdown?: Record<string, number>;
  details?: React.ReactNode;
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
  const fromDateStr = dateRange?.from?.toISOString();
  const toDateStr = dateRange?.to ? endOfDay(dateRange.to).toISOString() : undefined;

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["report-totals", fromDateStr, toDateStr],
    queryFn: () => getReportsDashboardTotals(fromDateStr, toDateStr),
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
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-center">
          {t.common.appName} - {t.nav.reports}
        </h1>
        <p className="text-center text-sm text-muted-foreground">
          {t.payments.date}: {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
        <BreakdownCard 
          title="Total Income" 
          value={`${stats?.totalIncome.toFixed(3) || "0.000"} OMR`}
          icon={OmanIcon}
          color="text-green-500"
          breakdown={stats?.incomeByMethod}
        />
        <BreakdownCard 
          title="Total Expense" 
          value={`${stats?.totalExpense.toFixed(3) || "0.000"} OMR`}
          icon={TrendingUp}
          color="text-red-500"
          breakdown={stats?.expenseBySource}
        />
        <BreakdownCard 
          title="Total Purchase" 
          value={`${stats?.totalPurchase.toFixed(3) || "0.000"} OMR`}
          icon={Package}
          color="text-orange-500"
          breakdown={stats?.purchaseByMethod}
        />
        <BreakdownCard
          title="Total Paymeter Paid"
          value={`${stats?.totalPaymeterPaid.toFixed(3) || "0.000"} OMR`}
          icon={OmanIcon}
          color="text-orange-500"
          breakdown={stats?.paymeterByName}
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
            <CardDescription>{t.nav.reports}</CardDescription>
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
    </div>
  );
}
