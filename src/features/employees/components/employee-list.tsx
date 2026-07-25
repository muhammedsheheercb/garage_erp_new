"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createEmployee, deleteEmployee, getEmployees, setEmployeeActive, updateEmployee } from "../actions"
import { PAGE_PERMISSIONS, PERMISSION_ACTIONS, type ModulePermissions, type PagePermission, type PermissionAction } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Edit, Eye, EyeOff, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

type Employee = { id: string; username: string | null; permissions: string; isActive: boolean }
type FormErrors = { username?: string; password?: string; permissions?: string }

function readPermissions(value?: string): ModulePermissions {
  try {
    const parsed: unknown = value ? JSON.parse(value) : {}
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as ModulePermissions : {}
  } catch { return {} }
}

function EmployeeForm({ employee, onDone }: { employee?: Employee; onDone: () => void }) {
  const [username, setUsername] = useState(employee?.username ?? "")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [permissions, setPermissions] = useState<ModulePermissions>(() => readPermissions(employee?.permissions))
  const [errors, setErrors] = useState<FormErrors>({})
  const mutation = useMutation({
    mutationFn: async () => {
      if (employee) await updateEmployee(employee.id, { username, password, permissions })
      else await createEmployee({ username, password, permissions })
    },
    onSuccess: () => { toast.success(employee ? "Employee updated" : "Employee created"); onDone() },
    onError: (error: Error) => toast.error(error.message || "Unable to save employee"),
  })
  const togglePermission = (page: PagePermission, action: PermissionAction) => setPermissions((current) => {
    const actions = current[page] ?? []
    return { ...current, [page]: actions.includes(action) ? actions.filter((item) => item !== action) : [...actions, action] }
  })
  const toggleAllPermissions = (page: PagePermission) => setPermissions((current) => {
    const actions = current[page] ?? []
    return { ...current, [page]: actions.length === PERMISSION_ACTIONS.length ? [] : [...PERMISSION_ACTIONS] }
  })
  const validate = () => {
    const nextErrors: FormErrors = {}
    if (username.trim().length < 2) nextErrors.username = "Username must be at least 2 characters."
    else if (!/^[a-z0-9._-]+$/.test(username.trim())) nextErrors.username = "Username cannot contain spaces. Use letters, numbers, dots, hyphens, or underscores."
    if ((!employee || password.length > 0) && password.length < 6) nextErrors.password = "Password must be at least 6 characters."
    if (!Object.values(permissions).some((actions) => actions.length > 0)) nextErrors.permissions = "Select at least one permission."
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  return <form className="space-y-5" noValidate onSubmit={(event) => { event.preventDefault(); if (validate()) mutation.mutate() }}>
    <div className="space-y-2"><Label htmlFor="employee-username">Login username</Label><Input id="employee-username" value={username} onChange={(event) => { setUsername(event.target.value.toLowerCase()); setErrors((current) => ({ ...current, username: undefined })) }} placeholder="e.g. john.m" minLength={2} aria-invalid={Boolean(errors.username)} required />{errors.username ? <p className="text-sm text-destructive">{errors.username}</p> : <p className="text-xs text-muted-foreground">At least 2 characters. Spaces are not allowed.</p>}</div>
    <div className="space-y-2"><Label htmlFor="employee-password">{employee ? "New password (optional)" : "Password"}</Label><div className="relative"><Input id="employee-password" type={showPassword ? "text" : "password"} minLength={6} value={password} onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: undefined })) }} aria-invalid={Boolean(errors.password)} required={!employee} className="pr-10" /><Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div>{errors.password ? <p className="text-sm text-destructive">{errors.password}</p> : employee && <p className="text-xs text-muted-foreground">Leave blank to keep the current password.</p>}</div>
    <fieldset className="space-y-3"><legend className="text-base font-semibold">Module permissions</legend><p className="text-sm text-muted-foreground">Choose what this employee can do in each module.</p><div className="space-y-2">{PAGE_PERMISSIONS.map((module) => { const selected = permissions[module.key] ?? []; const allSelected = selected.length === PERMISSION_ACTIONS.length; return <div key={module.key} className="rounded-lg border bg-muted/30 px-3 py-3 sm:flex sm:items-center sm:justify-between"><span className="font-medium">{module.label}</span><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 sm:mt-0"><label className="flex items-center gap-1.5 text-sm font-medium"><input type="checkbox" checked={allSelected} onChange={() => { toggleAllPermissions(module.key); setErrors((current) => ({ ...current, permissions: undefined })) }} />All</label>{PERMISSION_ACTIONS.map((action) => <label key={action} className="flex items-center gap-1.5 text-sm capitalize"><input type="checkbox" checked={selected.includes(action)} onChange={() => { togglePermission(module.key, action); setErrors((current) => ({ ...current, permissions: undefined })) }} />{action}</label>)}</div></div> })}</div>{errors.permissions && <p className="text-sm text-destructive">{errors.permissions}</p>}</fieldset>
    <Button type="submit" disabled={mutation.isPending} className="w-full">{mutation.isPending ? "Saving…" : employee ? "Save employee" : "Create employee"}</Button>
  </form>
}

export function EmployeeList() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | undefined>()
  const { data: employees = [], isLoading } = useQuery<Employee[]>({ queryKey: ["employees"], queryFn: getEmployees })
  const toggleActive = useMutation({ mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setEmployeeActive(id, isActive), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] }) })
  const removeEmployee = useMutation({ mutationFn: deleteEmployee, onSuccess: () => { toast.success("Employee deleted"); queryClient.invalidateQueries({ queryKey: ["employees"] }) }, onError: (error: Error) => toast.error(error.message || "Unable to delete employee") })
  const close = () => { setOpen(false); setEditing(undefined); queryClient.invalidateQueries({ queryKey: ["employees"] }) }
  return <div className="space-y-4"><div className="flex justify-end"><Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Add employee</Button></div><div className="overflow-x-auto rounded-md border bg-card"><Table><TableHeader><TableRow><TableHead>Username</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{isLoading ? <TableRow><TableCell colSpan={3} className="h-24 text-center">Loading…</TableCell></TableRow> : employees.length === 0 ? <TableRow><TableCell colSpan={3} className="h-24 text-center text-muted-foreground">No employees yet.</TableCell></TableRow> : employees.map((employee) => <TableRow key={employee.id}><TableCell className="font-medium">{employee.username ?? <span className="text-muted-foreground">Not set</span>}</TableCell><TableCell><Badge variant={employee.isActive ? "default" : "destructive"}>{employee.isActive ? "Active" : "Disabled"}</Badge></TableCell><TableCell className="text-right space-x-1"><Button variant="ghost" size="icon" onClick={() => { setEditing(employee); setOpen(true) }} title="Edit employee"><Edit className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => toggleActive.mutate({ id: employee.id, isActive: !employee.isActive })}>{employee.isActive ? "Disable" : "Enable"}</Button><AlertDialog><AlertDialogTrigger render={<Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={removeEmployee.isPending} title="Delete employee"><Trash2 className="h-4 w-4" /></Button>} /><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete employee?</AlertDialogTitle><AlertDialogDescription>Delete {employee.username ?? "this employee"}? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => removeEmployee.mutate(employee.id)}>Delete employee</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></TableCell></TableRow>)}</TableBody></Table></div><Dialog open={open} onOpenChange={(value) => { if (!value) close(); else setOpen(true) }}><DialogContent className="w-[calc(100vw-2rem)] lg:w-[70vw] lg:max-w-[70vw] max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editing ? "Edit employee" : "Add employee"}</DialogTitle></DialogHeader>{open && <EmployeeForm employee={editing} onDone={close} />}</DialogContent></Dialog></div>
}
