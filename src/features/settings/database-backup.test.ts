import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Prisma, type PrismaClient, type Prisma as PrismaTypes } from '@prisma/client'
import { availableBackups, backupPath, readSnapshot, restoreSnapshot, saveSnapshot, snapshotDatabase, deleteSnapshot } from './database-backup'

test('snapshots validate files and restore parents before children with a safety backup', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'garage-backup-test-'))
  const previous = process.env.BACKUP_DIRECTORY
  process.env.BACKUP_DIRECTORY = directory
  const statements: string[] = []
  const tables = Prisma.dmmf.datamodel.models.map(model => model.dbName ?? model.name)
  const tx = {
    $queryRawUnsafe: async (sql: string) => sql.includes('pg_constraint')
      ? [{ child: tables[0], parent: tables[1] }]
      : [{ row: { id: 'test', createdAt: '2026-10-04T00:00:00', amount: '123456.789' } }],
    $executeRawUnsafe: async (sql: string) => { statements.push(sql); return 1 },
  } as unknown as PrismaTypes.TransactionClient
  const db = { $transaction: async (callback: (client: PrismaTypes.TransactionClient) => unknown) => callback(tx) } as unknown as PrismaClient
  try {
    assert.throws(() => backupPath('../secret.json'), /Invalid/)
    const first = await saveSnapshot(tx)
    const second = await saveSnapshot(tx)
    assert.notEqual(first, second)
    assert.equal((await availableBackups()).length, 2)
    const snapshot = await readSnapshot(first)
    assert.deepEqual(snapshot.tables[tables[0]][0], { id: 'test', createdAt: '2026-10-04T00:00:00', amount: '123456.789' })
    const safety = await restoreSnapshot(db, first)
    assert.match(safety, /^safety_/)
    assert.match(statements[0], /^LOCK TABLE/)
    assert.match(statements[1], /^TRUNCATE TABLE/)
    assert.ok(statements.findIndex(sql => sql.startsWith(`INSERT INTO "${tables[1]}"`)) < statements.findIndex(sql => sql.startsWith(`INSERT INTO "${tables[0]}"`)))
    snapshot.schema = 'incompatible'
    await fs.writeFile(backupPath(first), JSON.stringify(snapshot))
    const count = statements.length
    await assert.rejects(() => restoreSnapshot(db, first), /incompatible/)
    assert.equal(statements.length, count)
  } finally {
    if (previous === undefined) delete process.env.BACKUP_DIRECTORY
    else process.env.BACKUP_DIRECTORY = previous
    await fs.rm(directory, { recursive: true, force: true })
  }
})

test('cleanup retains five snapshots, protects other files, and preserves recovery files on failure', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'garage-retention-test-'))
  const previous = process.env.BACKUP_DIRECTORY
  process.env.BACKUP_DIRECTORY = directory
  let failRestore = false
  let failBackup = false
  const tx = {
    $queryRawUnsafe: async () => {
      if (failBackup) throw new Error('Snapshot failed')
      return []
    },
    $executeRawUnsafe: async () => {
      if (failRestore) throw new Error('Restore failed')
      return 0
    },
  } as unknown as PrismaTypes.TransactionClient
  const db = { $transaction: async (callback: (client: PrismaTypes.TransactionClient) => unknown) => callback(tx) } as unknown as PrismaClient
  try {
    const seeded = Array.from({ length: 8 }, (_, index) => `${index % 2 ? 'safety' : 'backup'}_${1234567890000 + index}_abcdef.json`)
    for (const filename of seeded) await fs.writeFile(backupPath(filename), '{}')
    await fs.writeFile(path.join(directory, 'notes.txt'), 'keep')
    await fs.writeFile(path.join(directory, `${seeded[0]}.tmp`), 'keep')
    await fs.mkdir(backupPath('backup_1234567890999_abcdef.json'))
    assert.deepEqual(await availableBackups(), seeded.slice(3).reverse())
    assert.equal(await fs.readFile(path.join(directory, 'notes.txt'), 'utf8'), 'keep')
    assert.equal(await fs.readFile(path.join(directory, `${seeded[0]}.tmp`), 'utf8'), 'keep')
    assert.ok((await fs.stat(backupPath('backup_1234567890999_abcdef.json'))).isDirectory())

    const newest = await snapshotDatabase(db)
    const retained = await availableBackups()
    assert.equal(retained.length, 5)
    assert.ok(retained.includes(newest))
    assert.ok(!retained.includes(seeded[3]))
    const safety = await restoreSnapshot(db, newest)
    assert.equal((await availableBackups()).length, 5)
    assert.ok((await availableBackups()).includes(safety))

    // Seed excess snapshots to verify failures leave existing files untouched.
    await fs.writeFile(backupPath(seeded[0]), '{}')
    const before = (await fs.readdir(directory)).sort()
    failRestore = true
    await assert.rejects(() => restoreSnapshot(db, newest), /Restore failed/)
    assert.deepEqual((await fs.readdir(directory)).sort(), before)
    failBackup = true
    await assert.rejects(() => snapshotDatabase(db), /Snapshot failed/)
    assert.deepEqual((await fs.readdir(directory)).sort(), before)
    await assert.rejects(() => deleteSnapshot('../notes.txt'), /Invalid/)
    await deleteSnapshot(newest)
    await assert.rejects(() => fs.stat(backupPath(newest)), { code: 'ENOENT' })
    await deleteSnapshot(newest)
    assert.equal(await fs.readFile(path.join(directory, 'notes.txt'), 'utf8'), 'keep')
  } finally {
    if (previous === undefined) delete process.env.BACKUP_DIRECTORY
    else process.env.BACKUP_DIRECTORY = previous
    await fs.rm(directory, { recursive: true, force: true })
  }
})
