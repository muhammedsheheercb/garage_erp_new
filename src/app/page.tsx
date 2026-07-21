import { getSession } from "@/lib/session";
import { getDashboardStats, getRecentActivities } from "@/features/reports/actions";
import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard-client";

export default async function DashboardPage() {
  const session = await getSession();
  
  if (!session) {
    redirect("/login");
  }
  
  // Fetch real data from the database
  const realStats = await getDashboardStats();
  const recentActivities = await getRecentActivities();

  return (
    <DashboardClient 
      session={session}
      realStats={realStats}
      recentActivities={recentActivities}
    />
  );
}
