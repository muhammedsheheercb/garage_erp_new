import type { PrismaClient } from '@prisma/client'
import { cleanupBackups, saveSnapshot } from './database-backup'

export const defaultBackupTimezone = 'Asia/Muscat'
const scheduleKey = 'system.weeklyBackup.completedWeek'

// Return the local Friday's date only once noon has arrived.
export function dueBackupWeek(now: Date, timezone = defaultBackupTimezone): string | null {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const value = (name: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === name)?.value
  if (value('weekday') !== 'Fri' || Number(value('hour')) < 12) return null
  return `${value('year')}-${value('month')}-${value('day')}`
}

export async function runWeeklyBackup(db: PrismaClient, week: string): Promise<boolean> {
  const result = await db.$transaction(async tx => {
    // Transaction-scoped locking works with pooled PostgreSQL connections and multiple servers.
    const locks = await tx.$queryRawUnsafe<{ locked: boolean }[]>(
      'SELECT pg_try_advisory_xact_lock(714205, 1) AS locked',
    )
    if (!locks[0]?.locked) return null
    const completed = await tx.setting.findUnique({ where: { key: scheduleKey } })
    if (completed?.value === week) return { filename: null }
    const filename = await saveSnapshot(tx)
    await tx.setting.upsert({
      where: { key: scheduleKey },
      create: { key: scheduleKey, value: week },
      update: { value: week },
    })
    return { filename }
  }, { isolationLevel: 'RepeatableRead', timeout: 120000 })
  if (!result) return false
  // Never delete older snapshots until the new backup transaction succeeds.
  await cleanupBackups(result.filename ?? undefined)
  if (result.filename) console.info(`Weekly database backup saved: ${result.filename}`)
  return true
}

const schedulerGlobal = globalThis as typeof globalThis & { garageBackupTimer?: ReturnType<typeof setInterval> }

export function startWeeklyBackupScheduler(db: PrismaClient) {
  if (schedulerGlobal.garageBackupTimer || process.env.WEEKLY_BACKUP_ENABLED === 'false') return
  const timezone = process.env.BACKUP_TIMEZONE || defaultBackupTimezone
  // Validate configuration at startup rather than failing silently every Friday.
  dueBackupWeek(new Date(), timezone)
  let running = false
  let completedWeek: string | null = null
  const tick = async () => {
    const week = dueBackupWeek(new Date(), timezone)
    if (!week || week === completedWeek || running) return
    running = true
    try {
      if (await runWeeklyBackup(db, week)) completedWeek = week
    } catch (error) {
      console.error('Weekly database backup failed; will retry in one minute', error)
    } finally {
      running = false
    }
  }
  schedulerGlobal.garageBackupTimer = setInterval(() => { void tick() }, 60_000)
  schedulerGlobal.garageBackupTimer.unref()
  void tick()
}
