import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase()
  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD
  if (!email || !initialPassword || initialPassword.length < 12) {
    throw new Error("Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD (at least 12 characters) to initialize the admin.")
  }
  const password = await bcrypt.hash(initialPassword, 12)

  const admin = await prisma.admin.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'System Admin',
      password,
    },
  })

  console.info("Administrator initialized:", admin.email)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
