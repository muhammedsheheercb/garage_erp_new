import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Wrench, ArrowLeft } from "lucide-react"

export function NotFoundComponent() {
  return (
    <div className="flex h-[80vh] w-full flex-col items-center justify-center space-y-6 px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <Wrench className="h-10 w-10 text-primary" />
      </div>
      
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">404</h1>
        <h2 className="text-2xl font-semibold tracking-tight">Page not found</h2>
        <p className="max-w-[400px] text-muted-foreground">
          The page you are looking for doesn't exist, has been moved, or is temporarily unavailable.
        </p>
      </div>

      <Link href="/">
        <Button size="lg" className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </Link>
    </div>
  )
}

export default function NotFound() {
  return <NotFoundComponent />
}
