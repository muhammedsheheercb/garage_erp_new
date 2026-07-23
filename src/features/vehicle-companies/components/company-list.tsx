"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Edit, Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { getVehicleCompanies, deleteVehicleCompany, deleteVehicleModel } from "../actions"
import { CompanyForm } from "./company-form"
import { ModelForm } from "./model-form"
import { toast } from "sonner"
import { useTranslation } from "@/i18n"

export function CompanyList() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [addingCompany, setAddingCompany] = useState(false)
  const [editingCompany, setEditingCompany] = useState<any>(null)
  const [addingModelFor, setAddingModelFor] = useState<any>(null)
  const [editingModel, setEditingModel] = useState<{ companyId: string; model: any } | null>(null)
  const { data: companies = [], isLoading } = useQuery({ queryKey: ["vehicle-companies"], queryFn: getVehicleCompanies })
  const companyDelete = useMutation({ mutationFn: deleteVehicleCompany, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["vehicle-companies"] }); queryClient.invalidateQueries({ queryKey: ["vehicle-catalog"] }); toast.success(t.vehicles.companyDeleted) }, onError: (e: Error) => toast.error(e.message || t.common.somethingWrong) })
  const modelDelete = useMutation({ mutationFn: deleteVehicleModel, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["vehicle-companies"] }); queryClient.invalidateQueries({ queryKey: ["vehicle-catalog"] }); toast.success(t.vehicles.modelDeleted) }, onError: (e: Error) => toast.error(e.message || t.common.somethingWrong) })

  return <div className="space-y-4">
    <div className="flex justify-end">
      <Dialog open={addingCompany} onOpenChange={setAddingCompany}><DialogTrigger render={<Button><Plus className="mr-2 h-4 w-4" />{t.vehicles.addCompany}</Button>} /><DialogContent><DialogHeader><DialogTitle>{t.vehicles.addCompany}</DialogTitle></DialogHeader><CompanyForm onSuccess={() => setAddingCompany(false)} /></DialogContent></Dialog>
    </div>
    {isLoading ? <p className="py-12 text-center text-muted-foreground">{t.common.loading}</p> : companies.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground">{t.common.noResults}</CardContent></Card> : <div className="grid gap-4 md:grid-cols-2">
      {companies.map((company) => <Card key={company.id}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0"><CardTitle>{company.name}</CardTitle><div className="flex gap-1">
          <Dialog open={editingCompany?.id === company.id} onOpenChange={(open) => !open && setEditingCompany(null)}><DialogTrigger render={<Button variant="ghost" size="icon" onClick={() => setEditingCompany(company)}><Edit className="h-4 w-4" /></Button>} />{editingCompany?.id === company.id && <DialogContent><DialogHeader><DialogTitle>{t.vehicles.editCompany}</DialogTitle></DialogHeader><CompanyForm company={company} onSuccess={() => setEditingCompany(null)} /></DialogContent>}</Dialog>
          <AlertDialog><AlertDialogTrigger render={<Button variant="ghost" size="icon" className="text-destructive"><Trash className="h-4 w-4" /></Button>} /><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t.vehicles.deleteCompany}</AlertDialogTitle><AlertDialogDescription>{t.vehicles.deleteConfirm}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t.common.cancel}</AlertDialogCancel><AlertDialogAction onClick={() => companyDelete.mutate(company.id)} className="bg-destructive text-destructive-foreground">{t.common.delete}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </div></CardHeader>
        <CardContent className="space-y-2"><div className="flex justify-between items-center"><p className="text-sm font-medium">{t.vehicles.model}</p><Dialog open={addingModelFor?.id === company.id} onOpenChange={(open) => !open && setAddingModelFor(null)}><DialogTrigger render={<Button size="sm" variant="outline" onClick={() => setAddingModelFor(company)}><Plus className="mr-1 h-3.5 w-3.5" />{t.vehicles.addModel}</Button>} />{addingModelFor?.id === company.id && <DialogContent><DialogHeader><DialogTitle>{t.vehicles.addModel}</DialogTitle></DialogHeader><ModelForm companyId={company.id} onSuccess={() => setAddingModelFor(null)} /></DialogContent>}</Dialog></div>
          {company.models.length === 0 ? <p className="text-sm text-muted-foreground">{t.vehicles.noModels}</p> : <div className="divide-y rounded-md border">{company.models.map((model) => <div key={model.id} className="flex items-center justify-between px-3 py-2 text-sm"><span>{model.name}</span><div className="flex gap-1"><Dialog open={editingModel?.model.id === model.id} onOpenChange={(open) => !open && setEditingModel(null)}><DialogTrigger render={<Button size="icon" variant="ghost" onClick={() => setEditingModel({ companyId: company.id, model })}><Edit className="h-3.5 w-3.5" /></Button>} />{editingModel?.model.id === model.id && <DialogContent><DialogHeader><DialogTitle>{t.vehicles.editModel}</DialogTitle></DialogHeader><ModelForm companyId={company.id} model={model} onSuccess={() => setEditingModel(null)} /></DialogContent>}</Dialog><AlertDialog><AlertDialogTrigger render={<Button size="icon" variant="ghost" className="text-destructive"><Trash className="h-3.5 w-3.5" /></Button>} /><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t.vehicles.deleteModel}</AlertDialogTitle><AlertDialogDescription>{t.vehicles.deleteConfirm}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t.common.cancel}</AlertDialogCancel><AlertDialogAction onClick={() => modelDelete.mutate(model.id)} className="bg-destructive text-destructive-foreground">{t.common.delete}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></div>)}</div>}
        </CardContent>
      </Card>)}
    </div>}
  </div>
}
