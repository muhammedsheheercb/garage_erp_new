import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { PrismaClient, Prisma } from '@prisma/client'
import { dueBackupWeek, runWeeklyBackup } from './weekly-backup'

test('Friday noon uses Oman time and never runs before the scheduled time', () => {
  assert.equal(dueBackupWeek(new Date('2026-10-09T07:59:59Z')), null)
  assert.equal(dueBackupWeek(new Date('2026-10-09T08:00:00Z')), '2026-10-09')
  assert.equal(dueBackupWeek(new Date('2026-10-09T19:59:59Z')), '2026-10-09')
  assert.equal(dueBackupWeek(new Date('2026-10-09T20:00:00Z')), null)
  assert.equal(dueBackupWeek(new Date('2026-10-08T08:00:00Z')), null)
  assert.equal(dueBackupWeek(new Date('2026-10-16T08:00:00Z')), '2026-10-16')
  assert.equal(dueBackupWeek(new Date('2026-10-09T07:00:00Z'), 'Asia/Kolkata'), '2026-10-09')
  assert.throws(() => dueBackupWeek(new Date(), 'Invalid/Timezone'), RangeError)
})

test('scheduled backups retry failures, run once per week, and retain five files', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'garage-weekly-test-'))
  const previous = process.env.BACKUP_DIRECTORY
  process.env.BACKUP_DIRECTORY = directory
  let locked = false
  let failSnapshot = false
  let completedWeek: string | null = null
  const tx = {
    $queryRawUnsafe: async (sql: string) => {
      if (sql.includes('advisory')) return [{ locked }]
      if (failSnapshot) throw new Error('Database unavailable')
      return []
    },
    setting: {
      findUnique: async () => completedWeek ? { value: completedWeek } : null,
      upsert: async (args: { update: { value: string } }) => { completedWeek = args.update.value },
    },
  } as unknown as Prisma.TransactionClient
  const db = { $transaction: async (callback: (client: Prisma.TransactionClient) => unknown) => callback(tx) } as unknown as PrismaClient
  try {
    assert.equal(await runWeeklyBackup(db, '2026-10-09'), false)
    assert.deepEqual(await fs.readdir(directory), [])
    locked = true
    failSnapshot = true
    await assert.rejects(() => runWeeklyBackup(db, '2026-10-09'), /Database unavailable/)
    assert.equal(completedWeek, null)
    assert.deepEqual(await fs.readdir(directory), [])
    failSnapshot = false
    assert.equal(await runWeeklyBackup(db, '2026-10-09'), true)
    const firstFiles = await fs.readdir(directory)
    assert.equal(firstFiles.length, 1)
    assert.equal(await runWeeklyBackup(db, '2026-10-09'), true)
    assert.deepEqual(await fs.readdir(directory), firstFiles)
    for (const week of ['2026-10-16', '2026-10-23', '2026-10-30', '2026-11-06', '2026-11-13']) {
      await runWeeklyBackup(db, week)
    }
    assert.equal((await fs.readdir(directory)).length, 5)
    assert.equal(completedWeek, '2026-11-13')
  } finally {
    if (previous === undefined) delete process.env.BACKUP_DIRECTORY
    else process.env.BACKUP_DIRECTORY = previous
    await fs.rm(directory, { recursive: true, force: true })
  }
})
