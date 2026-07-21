"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getServicesList } from "../actions"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus } from "lucide-react"
import { useTranslation } from "@/i18n"

interface ServiceSelectionModalProps {
  onSelect: (service: any) => void
}

export function ServiceSelectionModal({ onSelect }: ServiceSelectionModalProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const { t } = useTranslation()

  const { data: services, isLoading } = useQuery({
    queryKey: ['services-list', search],
    queryFn: () => getServicesList(search)
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="outline" size="sm" type="button">
          <Plus className="h-4 w-4 mr-2" /> {t.jobcards.addService}
        </Button>
      } />
      <DialogContent className="max-w-3xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t.jobcards.selectService}</DialogTitle>
        </DialogHeader>
        
        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder={t.jobcards.searchServices}
            className="pl-8" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="border rounded-md max-h-80 overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>{t.services.serviceName}</TableHead>
                <TableHead>{t.services.category}</TableHead>
                <TableHead>{t.services.estTime}</TableHead>
                <TableHead className="text-right">{t.services.defaultPrice}</TableHead>
                <TableHead className="w-[100px] text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center">{t.common.loading}</TableCell></TableRow>
              ) : services?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center">{t.jobcards.noServicesFound}</TableCell></TableRow>
              ) : (
                services?.map((service: any) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell>{service.category || '-'}</TableCell>
                    <TableCell>{service.estimatedTime || '-'}</TableCell>
                    <TableCell className="text-right">{service.price.toFixed(3)} OMR</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" type="button" onClick={() => {
                        onSelect(service)
                        setOpen(false)
                      }}>{t.jobcards.select}</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
