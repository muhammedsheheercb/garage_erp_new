import { getJobCardById } from "@/features/jobcards/actions"
import { notFound } from "next/navigation"
import { JobCardPrintClient } from "./job-card-print-client"

export default async function PrintJobCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJobCardById(id)
  
  if (!job) {
    notFound()
  }

  return <JobCardPrintClient job={job} />
}
