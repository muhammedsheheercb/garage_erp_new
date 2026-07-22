"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { SettingsFormValues, settingsSchema } from "../schema"
import { 
  getSettings, 
  updateSettings, 
  createDatabaseBackup, 
  listBackups, 
  restoreDatabase, 
  updateAdminCredentials,
  getTaxSettings,
  createTaxSetting,
  updateTaxSetting,
  activateTaxSetting,
  deleteTaxSetting
} from "../actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Save, Database, Download, RotateCcw, AlertTriangle, ShieldCheck, Eye, EyeOff, Plus, Check, Trash2, Edit } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/language-toggle"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import { useTranslation } from "@/i18n"

export function SettingsForm() {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  
  // Security Form State
  const [currentPassword, setCurrentPassword] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  
  // Password visibility state
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  // Tax settings form states
  const [taxName, setTaxName] = useState("")
  const [taxPercentage, setTaxPercentage] = useState<string>("")
  const [editingTaxId, setEditingTaxId] = useState<string | null>(null)

  const { data: taxSettings = [], isLoading: taxSettingsLoading } = useQuery({
    queryKey: ['tax-settings'],
    queryFn: () => getTaxSettings()
  })

  const createTaxMutation = useMutation({
    mutationFn: (data: { name: string, percentage: number }) => createTaxSetting(data.name, data.percentage),
    onSuccess: () => {
      toast.success(t.settings.taxCreated)
      setTaxName("")
      setTaxPercentage("")
      queryClient.invalidateQueries({ queryKey: ['tax-settings'] })
    },
    onError: (error: any) => toast.error(error.message)
  })

  const updateTaxMutation = useMutation({
    mutationFn: (data: { id: string, name: string, percentage: number }) => updateTaxSetting(data.id, data.name, data.percentage),
    onSuccess: () => {
      toast.success(t.settings.taxUpdated)
      setTaxName("")
      setTaxPercentage("")
      setEditingTaxId(null)
      queryClient.invalidateQueries({ queryKey: ['tax-settings'] })
    },
    onError: (error: any) => toast.error(error.message)
  })

  const activateTaxMutation = useMutation({
    mutationFn: (id: string) => activateTaxSetting(id),
    onSuccess: () => {
      toast.success(t.settings.taxActivated)
      queryClient.invalidateQueries({ queryKey: ['tax-settings'] })
    },
    onError: (error: any) => toast.error(error.message)
  })

  const deleteTaxMutation = useMutation({
    mutationFn: (id: string) => deleteTaxSetting(id),
    onSuccess: () => {
      toast.success(t.settings.taxDeleted)
      queryClient.invalidateQueries({ queryKey: ['tax-settings'] })
    },
    onError: (error: any) => toast.error(error.message)
  })

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => getSettings()
  })

  const { data: backups, isLoading: backupsLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: () => listBackups()
  })

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    values: settings || {
      garageName: "",
      ownerName: "",
      phone: "",
      email: "",
      address: "",
      gstNumber: "",
      invoicePrefix: "INV",
    }
  })

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      toast.success(t.settings.settingsSaved)
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (error: any) => {
      toast.error(error.message || t.settings.failedToSave)
    }
  })

  const backupMutation = useMutation({
    mutationFn: createDatabaseBackup,
    onSuccess: (res) => {
      toast.success(res.message)
      queryClient.invalidateQueries({ queryKey: ['backups'] })
    },
    onError: (error: any) => toast.error(error.message)
  })

  const restoreMutation = useMutation({
    mutationFn: restoreDatabase,
    onSuccess: (res) => {
      toast.success(res.message)
      // Force reload to pick up new DB state
      setTimeout(() => window.location.reload(), 2000)
    },
    onError: (error: any) => toast.error(error.message)
  })

  const securityMutation = useMutation({
    mutationFn: () => updateAdminCredentials(currentPassword, newEmail, newPassword),
    onSuccess: (res) => {
      toast.success(res.message)
      setCurrentPassword("")
      setNewPassword("")
      // Email stays updated in the input
    },
    onError: (error: any) => toast.error(error.message)
  })

  const onSubmit = (data: SettingsFormValues) => {
    mutation.mutate(data)
  }

  const handleRestore = (filename: string) => {
    if (window.confirm(t.settings.restoreWarning)) {
      restoreMutation.mutate(filename)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="w-full">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-4 flex w-full justify-start overflow-x-auto h-auto p-1">
          <TabsTrigger value="general">{t.settings.generalConfig}</TabsTrigger>
          <TabsTrigger value="appearance">{t.settings.appearance}</TabsTrigger>
          <TabsTrigger value="tax">{t.settings.taxSettings}</TabsTrigger>
          <TabsTrigger value="security">{t.settings.accountSecurity}</TabsTrigger>
          <TabsTrigger value="database">{t.settings.databaseManagement}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>{t.settings.generalSettings}</CardTitle>
              <CardDescription>{t.settings.generalDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="garageName">{t.settings.garageName} <span className="text-destructive">*</span></Label>
                    <Input id="garageName" {...register("garageName")} />
                    {errors.garageName && <p className="text-sm text-destructive">{errors.garageName.message}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="ownerName">{t.settings.ownerName} <span className="text-destructive">*</span></Label>
                    <Input id="ownerName" {...register("ownerName")} />
                    {errors.ownerName && <p className="text-sm text-destructive">{errors.ownerName.message}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t.settings.phoneNumber} <span className="text-destructive">*</span></Label>
                    <Input id="phone" {...register("phone")} />
                    {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">{t.common.email} <span className="text-destructive">*</span></Label>
                    <Input id="email" type="email" {...register("email")} />
                    {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gstNumber">{t.settings.gstNumber}</Label>
                    <Input id="gstNumber" {...register("gstNumber")} />
                    {errors.gstNumber && <p className="text-sm text-destructive">{errors.gstNumber.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invoicePrefix">{t.settings.invoicePrefix} <span className="text-destructive">*</span></Label>
                    <Input id="invoicePrefix" {...register("invoicePrefix")} />
                    {errors.invoicePrefix && <p className="text-sm text-destructive">{errors.invoicePrefix.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">{t.common.address} <span className="text-destructive">*</span></Label>
                  <Input id="address" {...register("address")} />
                  {errors.address && <p className="text-sm text-destructive">{errors.address.message}</p>}
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={!isDirty || mutation.isPending}>
                    {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {t.settings.saveChanges}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>{t.settings.appearanceSettings}</CardTitle>
              <CardDescription>{t.settings.appearanceDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between border rounded-md p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">{t.settings.darkMode}</Label>
                  <p className="text-sm text-muted-foreground">{t.settings.darkModeDescription}</p>
                </div>
                <div>
                  <ThemeToggle />
                </div>
              </div>
              <div className="flex items-center justify-between border rounded-md p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">{t.settings.language}</Label>
                  <p className="text-sm text-muted-foreground">{t.settings.languageDescription}</p>
                </div>
                <div>
                  <LanguageToggle />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" /> {t.settings.accountSecurity}
              </CardTitle>
              <CardDescription>{t.settings.securityDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <form 
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!currentPassword || !newEmail) {
                    toast.error(t.settings.currentPasswordRequired)
                    return
                  }
                  securityMutation.mutate()
                }} 
                className="space-y-4 max-w-md"
              >
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">{t.settings.currentPassword} <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Input 
                      id="currentPassword" 
                      type={showCurrentPassword ? "text" : "password"} 
                      placeholder={t.settings.currentPasswordPlaceholder}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="newEmail">{t.settings.newEmailAddress} <span className="text-destructive">*</span></Label>
                  <Input 
                    id="newEmail" 
                    type="email" 
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">{t.settings.newEmailDescription}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">{t.settings.newPassword}</Label>
                  <div className="relative">
                    <Input 
                      id="newPassword" 
                      type={showNewPassword ? "text" : "password"} 
                      placeholder={t.settings.newPasswordPlaceholder}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex pt-4">
                  <Button type="submit" disabled={securityMutation.isPending || !currentPassword || !newEmail}>
                    {securityMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {t.settings.updateCredentials}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database">
          <Card className="mb-4 border-destructive/20">
            <CardHeader className="bg-destructive/5 border-b border-destructive/10">
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> {t.settings.databaseManagement}
              </CardTitle>
              <CardDescription>
                {t.settings.databaseDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border p-4 rounded-md bg-muted/20">
                <div>
                  <h4 className="font-medium">{t.settings.createBackup}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{t.settings.createBackupDescription}</p>
                </div>
                <Button 
                  onClick={() => backupMutation.mutate()} 
                  disabled={backupMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  {backupMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  {t.settings.backupNow}
                </Button>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">{t.settings.availableBackups}</h4>
                {backupsLoading ? (
                  <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t.settings.loadingBackups}</div>
                ) : !backups || backups.length === 0 ? (
                  <div className="text-sm border p-4 text-center rounded-md text-muted-foreground">{t.settings.noBackups}</div>
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    {backups.map((filename: string, index: number) => (
                      <div key={filename} className={`flex items-center justify-between p-3 sm:p-4 ${index !== backups.length - 1 ? 'border-b' : ''}`}>
                        <div className="flex items-center gap-3 overflow-hidden">
                          <Database className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-sm font-medium truncate">{filename}</span>
                        </div>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleRestore(filename)}
                          disabled={restoreMutation.isPending}
                          className="shrink-0 ml-4"
                        >
                          <RotateCcw className="mr-2 h-4 w-4 hidden sm:inline" /> {t.common.restore}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax">
          <Card>
            <CardHeader>
              <CardTitle>{t.settings.taxSettings}</CardTitle>
              <CardDescription>{t.settings.taxDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Form to Create/Edit Tax Rate */}
              <div className="border p-4 rounded-md bg-muted/20 space-y-4">
                <h4 className="font-semibold text-sm">{editingTaxId ? t.settings.editTaxRate : t.settings.addNewTaxRate}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div className="space-y-2">
                    <Label htmlFor="taxName">{t.common.name}</Label>
                    <Input 
                      id="taxName" 
                      placeholder="e.g. VAT 5%" 
                      value={taxName}
                      onChange={(e) => setTaxName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxPercentage">{t.settings.percentage}</Label>
                    <Input 
                      id="taxPercentage" 
                      type="number"
                      step="0.01"
                      placeholder="e.g. 5" 
                      value={taxPercentage}
                      onChange={(e) => setTaxPercentage(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      onClick={() => {
                        if (!taxName || taxPercentage === "") {
                          toast.error(t.settings.fillAllFields)
                          return
                        }
                        const pct = parseFloat(taxPercentage)
                        if (isNaN(pct) || pct < 0) {
                          toast.error(t.settings.validPercentage)
                          return
                        }
                        if (editingTaxId) {
                          updateTaxMutation.mutate({ id: editingTaxId, name: taxName, percentage: pct })
                        } else {
                          createTaxMutation.mutate({ name: taxName, percentage: pct })
                        }
                      }}
                      disabled={createTaxMutation.isPending || updateTaxMutation.isPending}
                    >
                      {editingTaxId ? t.common.update : t.settings.addRate}
                    </Button>
                    {editingTaxId && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setEditingTaxId(null)
                          setTaxName("")
                          setTaxPercentage("")
                        }}
                      >
                        {t.common.cancel}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Table of Tax Rates */}
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.common.name}</TableHead>
                      <TableHead>{t.settings.percentage}</TableHead>
                      <TableHead>{t.common.status}</TableHead>
                      <TableHead className="text-right">{t.common.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taxSettingsLoading ? (
                      <TableRow><TableCell colSpan={4} className="text-center">{t.settings.loadingTaxSettings}</TableCell></TableRow>
                    ) : taxSettings.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t.settings.noTaxRates}</TableCell></TableRow>
                    ) : (
                      taxSettings.map((tax: any) => (
                        <TableRow key={tax.id}>
                          <TableCell className="font-medium">{tax.name}</TableCell>
                          <TableCell>{tax.percentage}%</TableCell>
                          <TableCell>
                            {tax.isActive ? (
                              <Badge className="bg-green-500 hover:bg-green-600">{t.common.active}</Badge>
                            ) : (
                              <Badge variant="secondary">{t.common.inactive}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            {!tax.isActive && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => activateTaxMutation.mutate(tax.id)}
                                disabled={activateTaxMutation.isPending}
                              >
                                <Check className="mr-1 h-3.5 w-3.5" /> {t.settings.activate}
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => {
                                setEditingTaxId(tax.id)
                                setTaxName(tax.name)
                                setTaxPercentage(String(tax.percentage))
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                if (window.confirm(t.settings.deleteTaxConfirm)) {
                                  deleteTaxMutation.mutate(tax.id)
                                }
                              }}
                              disabled={deleteTaxMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
