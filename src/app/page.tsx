import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Wrench, LogOut, Users, Car, CheckCircle2, Clock, CalendarDays, PlusCircle, FileText, Activity, Briefcase, CreditCard, Package, Truck } from "lucide-react";
import { getSession } from "@/lib/session";
import { SignOutButton } from "@/components/sign-out-button";
import { Currency, OmanIcon } from "@/components/currency";
import Link from "next/link";
import { getDashboardStats, getRecentActivities } from "@/features/reports/actions";

import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getSession();
  
  if (!session) {
    redirect("/login");
  }
  
  // Fetch real data from the database
  const realStats = await getDashboardStats();
  const recentActivities = await getRecentActivities();

  const stats = [
    { title: "Today's Income", value: <Currency amount={realStats.dailyRevenue} size={1.2} />, icon: () => <OmanIcon size={1.2} className="text-muted-foreground" />, description: "Payments received today" },
    { title: "Today's Expense", value: <Currency amount={realStats.dailyExpense} size={1.2} />, icon: () => <OmanIcon size={1.2} className="text-muted-foreground" />, description: "Expenses + Purchases today" },
    { title: "Today's Revenue", value: <Currency amount={realStats.dailyProfit} size={1.2} />, icon: () => <OmanIcon size={1.2} className="text-muted-foreground" />, description: "Income − Expense" },
    { title: "Pending Jobs", value: realStats.pendingJobs.toString(), icon: Clock, description: "Needs attention" },
    { title: "Completed Jobs (Month)", value: realStats.completedJobs.toString(), icon: CheckCircle2, description: "This month" },
    { title: "Monthly Profit", value: <Currency amount={realStats.profit} size={1.2} />, icon: Activity, description: "Income − All expenses" },
  ];



  return (
    <div className="min-h-screen flex flex-col bg-muted/40 text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 max-w-screen-2xl items-center mx-auto px-4">
          <div className="flex items-center gap-2 mr-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <Wrench className="h-5 w-5 text-primary" />
            </div>
            <span className="font-bold text-xl tracking-tight hidden sm:inline-block">Garage ERP</span>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-4">
            <nav className="flex items-center space-x-2">
              <ThemeToggle />
              <SignOutButton />
            </nav>
          </div>
        </div>
      </header>
      
      {/* Main Dashboard Content */}
      <main className="flex-1 p-4 md:p-8 max-w-screen-2xl mx-auto w-full space-y-8">
        
        {/* Welcome & Quick Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back, <span className="font-medium text-foreground">{session?.email || 'Admin'}</span>. Here is what's happening today.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <Link href="/jobcards" passHref className="flex-1 md:flex-auto">
              <Button size="sm" className="gap-1.5 w-full">
                <Wrench className="h-4 w-4" /> Create Job Card
              </Button>
            </Link>
            <Link href="/customers" passHref className="flex-1 md:flex-auto">
              <Button size="sm" variant="secondary" className="gap-1.5 w-full">
                <Users className="h-4 w-4" /> Add Customer
              </Button>
            </Link>
            <Link href="/vehicles" passHref className="flex-1 md:flex-auto">
              <Button size="sm" variant="secondary" className="gap-1.5 w-full">
                <Car className="h-4 w-4" /> Add Vehicle
              </Button>
            </Link>
            <Link href="/mechanics" passHref className="flex-1 md:flex-auto">
              <Button size="sm" variant="outline" className="gap-1.5 w-full border-dashed">
                <Briefcase className="h-4 w-4" /> Mechanics
              </Button>
            </Link>
            <Link href="/invoices" passHref className="flex-1 md:flex-auto">
              <Button size="sm" variant="outline" className="gap-1.5 w-full border-dashed">
                <FileText className="h-4 w-4" /> Invoices
              </Button>
            </Link>
            <Link href="/services" passHref className="flex-1 md:flex-auto">
              <Button size="sm" variant="outline" className="gap-1.5 w-full border-dashed">
                <Activity className="h-4 w-4" /> Service Catalog
              </Button>
            </Link>
            <Link href="/payments" passHref className="flex-1 md:flex-auto">
              <Button size="sm" variant="outline" className="gap-1.5 w-full border-dashed">
                <CreditCard className="h-4 w-4" /> Payments
              </Button>
            </Link>
            <Link href="/inventory" passHref className="flex-1 md:flex-auto">
              <Button size="sm" variant="outline" className="gap-1.5 w-full border-dashed">
                <Package className="h-4 w-4" /> Inventory
              </Button>
            </Link>
            <Link href="/suppliers" passHref className="flex-1 md:flex-auto">
              <Button size="sm" variant="outline" className="gap-1.5 w-full border-dashed">
                <Truck className="h-4 w-4" /> Suppliers
              </Button>
            </Link>
            <Link href="/expenses" passHref className="flex-1 md:flex-auto">
              <Button size="sm" variant="outline" className="gap-1.5 w-full border-dashed">
                <CreditCard className="h-4 w-4" /> Expenses
              </Button>
            </Link>
            <Link href="/paymeters" passHref className="flex-1 md:flex-auto">
              <Button size="sm" variant="outline" className="gap-1.5 w-full border-dashed">
                <CreditCard className="h-4 w-4" /> Paymeters
              </Button>
            </Link>
            <Link href="/purchases" passHref className="flex-1 md:flex-auto">
              <Button size="sm" variant="outline" className="gap-1.5 w-full border-dashed">
                <Package className="h-4 w-4" /> Purchases
              </Button>
            </Link>
            <Link href="/reports" passHref className="flex-1 md:flex-auto">
              <Button size="sm" variant="outline" className="gap-1.5 w-full border-dashed bg-primary/5 border-primary/20 hover:bg-primary/10">
                <Activity className="h-4 w-4 text-primary" /> Reports
              </Button>
            </Link>
            <Link href="/settings" passHref className="flex-1 md:flex-auto">
              <Button size="sm" variant="outline" className="gap-1.5 w-full border-dashed">
                <Wrench className="h-4 w-4" /> Settings
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <Card 
                key={i} 
                className="shadow-sm hover:shadow-md transition-all duration-500 animate-in fade-in slide-in-from-bottom-4"
                style={{ animationFillMode: 'both', animationDelay: `${i * 100}ms` }}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Recent Activities */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500 fill-mode-both">
          <Card className="lg:col-span-4 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <CardTitle>Recent Activities</CardTitle>
              </div>
              <CardDescription>
                Latest actions performed in the system today.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentActivities.map((activity) => (
                      <TableRow key={activity.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">{activity.action}</TableCell>
                        <TableCell>{activity.customer}</TableCell>
                        <TableCell>
                          <Badge variant={activity.status === 'COMPLETED' || activity.status === 'PAID' ? 'default' : 'secondary'} className="rounded-md font-normal">
                            {activity.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground text-sm">
                          {activity.time}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          
          <Card className="lg:col-span-3 shadow-sm flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4 transition-transform hover:scale-110 duration-300">
              <OmanIcon size={2.5} className="text-primary" />
            </div>
            <h3 className="text-2xl font-bold tracking-tight">Ready to boost income?</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-[250px]">
              You have {realStats.pendingJobs} pending jobs right now. Complete them to increase today's revenue.
            </p>
            <Link href="/jobcards" passHref className="mt-6 w-full max-w-[200px]">
              <Button className="w-full">View Pending Jobs</Button>
            </Link>
          </Card>
        </div>
      </main>
    </div>
  );
}
