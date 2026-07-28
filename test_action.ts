import { getPaymeters } from './src/features/paymeters/actions'

async function main() {
  const paymeters = await getPaymeters()
  console.log(JSON.stringify(paymeters, null, 2))
}

main().catch(console.error)
