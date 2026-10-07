// Uses temporary fixtures in a transaction that always rolls back.
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { PrismaClient } from "@prisma/client"
import { reversePurchase, PurchaseCancellationError } from "../src/features/purchases/cancellation"
import { restoreCancelledPurchase } from "../src/features/purchases/restoration"

const prisma = new PrismaClient()
const rollback = new Error("Cancellation checks complete; roll back fixtures")

async function main() {
  try {
    await prisma.$transaction(async tx => {
      const suffix = randomUUID()
      const supplier = await tx.supplier.create({ data: { name: `Cancellation check ${suffix}`, contact: "test" } })
      const inventory = await tx.inventory.create({ data: { itemName: "Cancellation check", partNumber: suffix } })
      const initial = await tx.paymeter.create({ data: { name: `Cancellation initial ${suffix}`, spentAmount: 50 } })
      const later = await tx.paymeter.create({ data: { name: `Cancellation later ${suffix}`, spentAmount: 25 } })
      const customer = await tx.customer.create({ data: { name: "Cancellation check" } })
      const vehicle = await tx.vehicle.create({ data: { brand: "Test", model: "Test", plateNumber: suffix, customerId: customer.id } })
      const mechanic = await tx.mechanic.create({ data: { name: "Cancellation check" } })
      const job = await tx.jobCard.create({ data: { customerId: customer.id, vehicleId: vehicle.id, mechanicId: mechanic.id, complaint: "test", partsTotal: 120, grandTotal: 120 } })
      for (const type of ["STOCK", "VEHICLE", "PENDING_PARTS"]) {
        await tx.paymeter.update({ where: { id: initial.id }, data: { spentAmount: 50 } })
        await tx.paymeter.update({ where: { id: later.id }, data: { spentAmount: 25 } })
        const p = await tx.purchase.create({ data: {
          purchaseNumber: `CHECK-${type}-${suffix}`, purchaseType: type, supplierId: supplier.id,
          paymentMethodId: initial.id, jobCardId: type === "STOCK" ? null : job.id,
          grandTotal: 100, subTotal: 100, paidAmount: 75, pendingAmount: 25,
          items: { create: { inventoryId: inventory.id, quantity: 2, purchasePrice: 50, sellingPrice: 60, itemTotal: 100 } },
          purchasePayments: { create: [
            { paymeterId: initial.id, amount: 50 }, { paymeterId: later.id, amount: 25, pendingAmount: 25 },
          ] },
          batches: { create: { inventoryId: inventory.id, batchNumber: "check", quantity: 2, purchasePrice: 50, sellingPrice: 60 } },
        }, include: { batches: true } })
        if (type !== "STOCK") await tx.jobCardPart.create({ data: { jobCardId: job.id, batchId: p.batches[0].id, inventoryId: inventory.id, quantity: 2, price: 60 } })
        await reversePurchase(tx, p.id, "Cancellation check")
        assert.equal(await tx.purchase.count({ where: { id: p.id } }), 0)
        assert.equal(await tx.purchasePayment.count({ where: { purchaseId: p.id } }), 0)
        assert.equal(await tx.inventoryBatch.count({ where: { purchaseId: p.id } }), 0)
        assert.equal((await tx.paymeter.findUniqueOrThrow({ where: { id: initial.id } })).spentAmount, 0)
        assert.equal((await tx.paymeter.findUniqueOrThrow({ where: { id: later.id } })).spentAmount, 0)
        const archive = await tx.purchaseCancellation.findUniqueOrThrow({ where: { id: p.id } })
        assert.equal(archive.paidAmount, 75)
        assert.equal(archive.pendingAmount, 25)
        await reversePurchase(tx, p.id, "Repeated click")
        assert.equal(await tx.purchaseCancellation.count({ where: { id: p.id } }), 1)
        if (type === "VEHICLE") {
          assert.equal(await tx.jobCardPart.count({ where: { jobCardId: job.id } }), 0)
          assert.equal((await tx.jobCard.findUniqueOrThrow({ where: { id: job.id } })).partsTotal, 0)
        }
        if (type === "PENDING_PARTS") {
          const part = await tx.jobCardPart.findFirstOrThrow({ where: { jobCardId: job.id } })
          assert.equal(part.isPending, true)
          assert.equal(part.batchId, null)
          assert.equal(part.inventoryId, inventory.id)
          await tx.jobCardPart.update({ where: { id: part.id }, data: { quantity: 3 } })
          await assert.rejects(restoreCancelledPurchase(tx, p.id, "check"), /pending parts have been changed/)
          assert.equal(await tx.purchase.count({ where: { id: p.id } }), 0)
          await tx.jobCardPart.update({ where: { id: part.id }, data: { quantity: 2 } })
        }
        await restoreCancelledPurchase(tx, p.id, "Restoration check")
        const restored = await tx.purchase.findUniqueOrThrow({ where: { id: p.id }, include: { purchasePayments: true, batches: true, items: true } })
        assert.equal(restored.grandTotal, 100)
        assert.equal(restored.paidAmount, 75)
        assert.equal(restored.pendingAmount, 25)
        assert.equal(restored.purchasePayments.length, 2)
        assert.equal(restored.items.length, 1)
        assert.equal(restored.batches[0].id, p.batches[0].id)
        assert.equal(restored.batches[0].quantity, 2)
        assert.equal((await tx.paymeter.findUniqueOrThrow({ where: { id: initial.id } })).spentAmount, 50)
        assert.equal((await tx.paymeter.findUniqueOrThrow({ where: { id: later.id } })).spentAmount, 25)
        assert.ok((await tx.purchaseCancellation.findUniqueOrThrow({ where: { id: p.id } })).restoredAt)
        await restoreCancelledPurchase(tx, p.id, "Repeated restore")
        assert.equal((await tx.paymeter.findUniqueOrThrow({ where: { id: initial.id } })).spentAmount, 50)
        assert.equal(await tx.purchasePayment.count({ where: { purchaseId: p.id } }), 2)
        if (type !== "STOCK") {
          const restoredPart = await tx.jobCardPart.findFirstOrThrow({ where: { batchId: p.batches[0].id } })
          assert.equal(restoredPart.isPending, false)
          assert.equal((await tx.jobCard.findUniqueOrThrow({ where: { id: job.id } })).partsTotal, 120)
        }
        await reversePurchase(tx, p.id, "Cancel restored purchase")
        assert.equal((await tx.purchaseCancellation.findUniqueOrThrow({ where: { id: p.id } })).restoredAt, null)
      }
      const totals = await tx.purchase.aggregate({ where: { supplierId: supplier.id }, _sum: { grandTotal: true, paidAmount: true, pendingAmount: true } })
      assert.equal(totals._sum.grandTotal, null)
      assert.equal(totals._sum.paidAmount, null)
      assert.equal(totals._sum.pendingAmount, null)
      const blocked = await tx.purchase.create({ data: {
        purchaseNumber: `CHECK-BLOCKED-${suffix}`, supplierId: supplier.id, paymentMethodId: initial.id,
        grandTotal: 100, paidAmount: 50, pendingAmount: 50,
        items: { create: { inventoryId: inventory.id, quantity: 2, purchasePrice: 50, sellingPrice: 60, itemTotal: 100 } },
        batches: { create: { inventoryId: inventory.id, batchNumber: "used", quantity: 1, purchasePrice: 50, sellingPrice: 60 } },
      } })
      await assert.rejects(reversePurchase(tx, blocked.id, "check"), PurchaseCancellationError)
      assert.equal(await tx.purchase.count({ where: { id: blocked.id } }), 1)
      assert.equal(await tx.purchaseCancellation.count({ where: { id: blocked.id } }), 0)
      throw rollback
    }, { timeout: 120_000, isolationLevel: "Serializable" })
  } catch (error) {
    if (error !== rollback) throw error
  }
  console.log("Cancellation and restoration database checks passed; all temporary records rolled back.")
}

main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
