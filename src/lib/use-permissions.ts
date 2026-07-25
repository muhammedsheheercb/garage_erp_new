"use client"

import { useQuery } from "@tanstack/react-query"
import { getRoleAndPermissions } from "@/app/actions/auth"
import { type PagePermission, type PermissionAction } from "@/lib/permissions"

export function usePermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ["user-permissions"],
    queryFn: () => getRoleAndPermissions(),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  })

  const can = (page: PagePermission, action: PermissionAction): boolean => {
    if (isLoading) return false
    if (!data) return false
    if (data.role === "ADMIN") return true
    
    const pagePerms = (data.permissions as any)?.[page]
    return Array.isArray(pagePerms) && pagePerms.includes(action)
  }

  return { can, isLoading, role: data?.role }
}
