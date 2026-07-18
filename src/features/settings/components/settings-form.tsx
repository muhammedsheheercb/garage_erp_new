"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { SettingsFormValues, settingsSchema } from "../schema"
import { getSettings, updateSettings, createDatabaseBackup, listBackups, restoreDatabase, updateAdminCredentials } from "../actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Save, Database, Download, RotateCcw, AlertTriangle, ShieldCheck, Eye, EyeOff } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { useState } from "react"

export function SettingsForm() {
  const queryClient = useQueryClient()
  
  // Security Form State
  const [currentPassword, setCurrentPassword] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  
  // Password visibility state
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

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
      toast.success("Settings saved successfully")
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save settings")
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
    if (window.confirm("WARNING: This will overwrite your current database with the backup. Any changes made since this backup will be lost. Continue?")) {
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
        <TabsList className="mb-4">
          <TabsTrigger value="general">General Configuration</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="security">Account Security</TabsTrigger>
          <TabsTrigger value="database">Database Management</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Update your garage details used in invoices and reports.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="garageName">Garage Name <span className="text-destructive">*</span></Label>
                    <Input id="garageName" {...register("garageName")} />
                    {errors.garageName && <p className="text-sm text-destructive">{errors.garageName.message}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="ownerName">Owner Name <span className="text-destructive">*</span></Label>
                    <Input id="ownerName" {...register("ownerName")} />
                    {errors.ownerName && <p className="text-sm text-destructive">{errors.ownerName.message}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number <span className="text-destructive">*</span></Label>
                    <Input id="phone" {...register("phone")} />
                    {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                    <Input id="email" type="email" {...register("email")} />
                    {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gstNumber">GST / Tax Number</Label>
                    <Input id="gstNumber" {...register("gstNumber")} />
                    {errors.gstNumber && <p className="text-sm text-destructive">{errors.gstNumber.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invoicePrefix">Invoice Prefix <span className="text-destructive">*</span></Label>
                    <Input id="invoicePrefix" {...register("invoicePrefix")} />
                    {errors.invoicePrefix && <p className="text-sm text-destructive">{errors.invoicePrefix.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address <span className="text-destructive">*</span></Label>
                  <Input id="address" {...register("address")} />
                  {errors.address && <p className="text-sm text-destructive">{errors.address.message}</p>}
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={!isDirty || mutation.isPending}>
                    {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance Settings</CardTitle>
              <CardDescription>Customize the look and feel of the application.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between border rounded-md p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">Toggle between light and dark themes.</p>
                </div>
                <div>
                  <ThemeToggle />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" /> Account Security
              </CardTitle>
              <CardDescription>Update your admin email and password securely.</CardDescription>
            </CardHeader>
            <CardContent>
              <form 
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!currentPassword || !newEmail) {
                    toast.error("Current password and new email are required")
                    return
                  }
                  securityMutation.mutate()
                }} 
                className="space-y-4 max-w-md"
              >
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Input 
                      id="currentPassword" 
                      type={showCurrentPassword ? "text" : "password"} 
                      placeholder="Enter your current password to verify"
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
                  <Label htmlFor="newEmail">New Email Address <span className="text-destructive">*</span></Label>
                  <Input 
                    id="newEmail" 
                    type="email" 
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">This is the email you will use to log in.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password (Optional)</Label>
                  <div className="relative">
                    <Input 
                      id="newPassword" 
                      type={showNewPassword ? "text" : "password"} 
                      placeholder="Leave blank to keep current password"
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
                    Update Credentials
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
                <AlertTriangle className="h-5 w-5" /> Database Management
              </CardTitle>
              <CardDescription>
                Backup and restore your local SQLite database. Please be careful as restoring a database is irreversible.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border p-4 rounded-md bg-muted/20">
                <div>
                  <h4 className="font-medium">Create Backup</h4>
                  <p className="text-sm text-muted-foreground mt-1">Create a snapshot of your current database state.</p>
                </div>
                <Button 
                  onClick={() => backupMutation.mutate()} 
                  disabled={backupMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  {backupMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Backup Now
                </Button>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Available Backups</h4>
                {backupsLoading ? (
                  <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading backups...</div>
                ) : !backups || backups.length === 0 ? (
                  <div className="text-sm border p-4 text-center rounded-md text-muted-foreground">No backups found</div>
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
                          <RotateCcw className="mr-2 h-4 w-4 hidden sm:inline" /> Restore
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
