import fs from 'node:fs/promises'
import { isBackupAdmin } from '@/features/settings/backup-auth'
import { backupPath } from '@/features/settings/database-backup'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  if (!await isBackupAdmin()) return Response.json({ error: 'Administrator access required' }, { status: 403 })
  const filename = new URL(request.url).searchParams.get('filename') ?? ''
  let filepath: string
  try {
    filepath = backupPath(filename)
  } catch {
    return Response.json({ error: 'Invalid backup filename' }, { status: 400 })
  }
  try {
    const contents = await fs.readFile(filepath)
    return new Response(contents, { headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return Response.json({ error: 'Backup not found' }, { status: 404 })
    console.error('Backup download failed', error)
    return Response.json({ error: 'Unable to download backup' }, { status: 500 })
  }
}
