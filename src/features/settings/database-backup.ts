import { Prisma, PrismaClient } from '@prisma/client'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'

const models = Prisma.dmmf.datamodel.models
const tables = models.map(model => model.dbName ?? model.name)
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`
const directory = () => process.env.BACKUP_DIRECTORY || path.join(os.homedir(), '.garage-erp', 'backups')
const schemaSignature = JSON.stringify(models.map(model => ({ name: model.dbName ?? model.name, fields: model.fields.filter(field => field.kind !== 'object').map(field => ({ name: field.dbName ?? field.name, type: field.type, required: field.isRequired, list: field.isList })) })))

type Snapshot = { format: 'garage-erp-postgresql'; version: 1; createdAt: string; schema: string; tables: Record<string, unknown[]> }

export function backupPath(filename: string) {
  if (!/^(backup|safety)_\d{13}_[a-f0-9-]+\.json$/.test(filename)) throw new Error('Invalid backup filename')
  return path.join(directory(), filename)
}

export async function deleteSnapshot(filename: string) {
  const filepath = backupPath(filename)
  try {
    await fs.unlink(filepath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

export async function readSnapshot(filename: string): Promise<Snapshot> {
  const snapshot = JSON.parse(await fs.readFile(backupPath(filename), 'utf8')) as Snapshot
  if (!snapshot || snapshot.format !== 'garage-erp-postgresql' || snapshot.version !== 1 || snapshot.schema !== schemaSignature || !snapshot.tables || Object.keys(snapshot.tables).length !== tables.length || tables.some(table => !Array.isArray(snapshot.tables[table]))) {
    throw new Error('This backup is incompatible with the current database schema')
  }
  return snapshot
}

export async function saveSnapshot(tx: Prisma.TransactionClient, prefix: 'backup' | 'safety' = 'backup') {
  const data: Snapshot = { format: 'garage-erp-postgresql', version: 1, createdAt: new Date().toISOString(), schema: schemaSignature, tables: {} }
  for (const table of tables) {
    const rows = await tx.$queryRawUnsafe<{ row: unknown }[]>(`SELECT row_to_json(t) AS row FROM ${quote(table)} t`)
    data.tables[table] = rows.map(result => result.row)
  }
  await fs.mkdir(directory(), { recursive: true, mode: 0o700 })
  const filename = `${prefix}_${Date.now()}_${randomUUID()}.json`
  const temporary = `${backupPath(filename)}.tmp`
  try {
    await fs.writeFile(temporary, JSON.stringify(data), { flag: 'wx', mode: 0o600 })
    await fs.rename(temporary, backupPath(filename))
  } catch (error) {
    await fs.unlink(temporary).catch(() => {})
    throw error
  }
  return filename
}

export async function snapshotDatabase(db: PrismaClient) {
  const filename = await db.$transaction(tx => saveSnapshot(tx), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 120000 })
  await cleanupBackups(filename)
  return filename
}

async function storedBackups() {
  try {
    const entries = await fs.readdir(directory(), { withFileTypes: true })
    return entries.filter(entry => entry.isFile() && /^(backup|safety)_\d{13}_[a-f0-9-]+\.json$/.test(entry.name)).map(entry => entry.name).sort((a, b) => b.split('_')[1].localeCompare(a.split('_')[1]) || b.localeCompare(a))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

export async function cleanupBackups(newest?: string) {
  const backups = await storedBackups()
  // Always retain the snapshot just saved, even if timestamps tie or the clock changes.
  const retained = new Set(backups.filter(filename => filename !== newest).slice(0, newest ? 4 : 5))
  if (newest) retained.add(newest)
  for (const filename of backups) {
    if (retained.has(filename)) continue
    try {
      await fs.unlink(backupPath(filename))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
}

export async function availableBackups() {
  await cleanupBackups()
  return storedBackups()
}

export async function restoreSnapshot(db: PrismaClient, filename: string) {
  const snapshot = await readSnapshot(filename)
  const safety = await db.$transaction(async tx => {
    // Lock all application tables so the safety snapshot and replacement are atomic.
    await tx.$executeRawUnsafe(`LOCK TABLE ${tables.map(quote).join(', ')} IN ACCESS EXCLUSIVE MODE`)
    const safety = await saveSnapshot(tx, 'safety')
    const dependencies = await tx.$queryRawUnsafe<{ child: string; parent: string }[]>(`SELECT child.relname AS child, parent.relname AS parent FROM pg_constraint c JOIN pg_class child ON child.oid = c.conrelid JOIN pg_class parent ON parent.oid = c.confrelid WHERE c.contype = 'f' AND child.relnamespace = current_schema()::regnamespace`)
    const pending = new Set(tables)
    const ordered: string[] = []
    while (pending.size) {
      const ready = [...pending].filter(table => !dependencies.some(dep => dep.child === table && dep.parent !== table && pending.has(dep.parent)))
      if (!ready.length) throw new Error('Cannot restore a database with circular foreign keys')
      for (const table of ready) { ordered.push(table); pending.delete(table) }
    }
    await tx.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map(quote).join(', ')} RESTART IDENTITY`)
    for (const table of ordered) {
      if (!snapshot.tables[table].length) continue
      await tx.$executeRawUnsafe(`INSERT INTO ${quote(table)} SELECT * FROM json_populate_recordset(NULL::${quote(table)}, $1::json)`, JSON.stringify(snapshot.tables[table]))
    }
    return safety
  }, { timeout: 120000 })
  // Prune only after the restore commits, keeping all existing recovery files on failure.
  await cleanupBackups(safety)
  return safety
}
