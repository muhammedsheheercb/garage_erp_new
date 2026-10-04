export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build') {
    const [{ default: prisma }, { startWeeklyBackupScheduler }] = await Promise.all([
      import('./lib/prisma'),
      import('./features/settings/weekly-backup'),
    ])
    startWeeklyBackupScheduler(prisma)
  }
}
