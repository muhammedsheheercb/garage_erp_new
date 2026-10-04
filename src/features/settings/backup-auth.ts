import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'

export async function isBackupAdmin() {
  const session = await getSession()
  return Boolean(session?.role === 'ADMIN' && await prisma.admin.findUnique({ where: { id: session.userId } }))
}
