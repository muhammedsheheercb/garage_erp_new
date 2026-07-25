export const EMPLOYEE_EMAIL = "employee@garage.com"

export const PAGE_PERMISSIONS = [
  { key: "jobcards", label: "Job cards" },
  { key: "customers", label: "Customers" },
  { key: "vehicles", label: "Vehicles" },
  { key: "vehicle-companies", label: "Vehicle companies" },
  { key: "mechanics", label: "Mechanics" },
  { key: "services", label: "Services" },
  { key: "inventory", label: "Inventory" },
  { key: "invoices", label: "Invoices" },
  { key: "payments", label: "Payments" },
  { key: "purchases", label: "Purchases" },
  { key: "suppliers", label: "Suppliers" },
  { key: "paymeters", label: "Paymeters" },
  { key: "expenses", label: "Expenses" },
  { key: "reports", label: "Reports" },
] as const

export type PagePermission = (typeof PAGE_PERMISSIONS)[number]["key"]
export const PERMISSION_ACTIONS = ["view", "create", "edit", "delete"] as const
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number]
export type ModulePermissions = Partial<Record<PagePermission, PermissionAction[]>>

export function isPagePermission(value: string): value is PagePermission {
  return PAGE_PERMISSIONS.some((permission) => permission.key === value)
}

export function pathToPermission(pathname: string): PagePermission | null {
  const firstSegment = pathname.split("/").filter(Boolean)[0]
  return firstSegment && isPagePermission(firstSegment) ? firstSegment : null
}

export function parseModulePermissions(value: string): ModulePermissions {
  try {
    const parsed: unknown = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return Object.fromEntries(parsed.filter(isPagePermission).map((page) => [page, ["view", "create", "edit", "delete"]])) as ModulePermissions
    }
    if (!parsed || typeof parsed !== "object") return {}
    return Object.fromEntries(Object.entries(parsed).flatMap(([page, actions]) =>
      isPagePermission(page) && Array.isArray(actions)
        ? [[page, actions.filter((action): action is PermissionAction => typeof action === "string" && (PERMISSION_ACTIONS as readonly string[]).includes(action))]]
        : []
    )) as ModulePermissions
  } catch {
    return {}
  }
}

export function canUseModule(permission: ModulePermissions, page: PagePermission, action: PermissionAction) {
  return permission[page]?.includes(action) ?? false
}

export function pagesWithViewPermission(permission: ModulePermissions) {
  return PAGE_PERMISSIONS.filter(({ key }) => canUseModule(permission, key, "view")).map(({ key }) => key)
}
