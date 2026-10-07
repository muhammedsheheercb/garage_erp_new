import { test } from "node:test"
import assert from "node:assert/strict"
import { planPurchaseCancellation } from "./cancellation"

function purchase() {
  return { purchaseType: "STOCK", jobCardId: null as string | null, paymentMethodId: "initial",
    paidAmount: 50, paymeterReimbursed: 0,
    items: [{ inventoryId: "item", quantity: 2, purchasePrice: 50, sellingPrice: 60 }],
    purchasePayments: [{ paymeterId: "initial", amount: 50, paidAmount: 0, pendingAmount: 0 }],
    batches: [{ id: "batch", inventoryId: "item", quantity: 2, purchasePrice: 50, sellingPrice: 60,
      directSaleItems: [] as unknown[], jobCardParts: [] as Array<{ id: string; jobCardId: string; jobCard: { status: string } }> }],
  }
}

test("partial payment is reversed once, while unpaid purchases need no ledger debit", () => {
  assert.deepEqual(planPurchaseCancellation(purchase()), [["initial", 50]])
  const p = purchase(); p.paidAmount = 0; p.purchasePayments = []
  assert.deepEqual(planPurchaseCancellation(p), [["initial", 0]])
})

test("later supplier payments reverse their own ledgers, including shared ledgers", () => {
  const p = purchase(); p.paidAmount = 90
  p.purchasePayments.push({ paymeterId: "later", amount: 30, paidAmount: 0, pendingAmount: 30 },
    { paymeterId: "initial", amount: 10, paidAmount: 0, pendingAmount: 10 })
  assert.deepEqual(planPurchaseCancellation(p), [["initial", 60], ["later", 30]])
})

test("used, sold and externally reserved stock blocks cancellation", () => {
  const p = purchase(); p.batches[0].quantity = 1
  assert.throws(() => planPurchaseCancellation(p), /used or changed/)
  p.batches[0].quantity = 2; p.batches[0].directSaleItems.push({})
  assert.throws(() => planPurchaseCancellation(p), /sold/)
  p.batches[0].directSaleItems = []
  p.batches[0].jobCardParts.push({ id: "part", jobCardId: "other", jobCard: { status: "PENDING" } })
  assert.throws(() => planPurchaseCancellation(p), /another job card/)
})

test("own active vehicle and pending allocations can reverse, completed work cannot", () => {
  const p = purchase(); p.jobCardId = "job"
  p.batches[0].jobCardParts.push({ id: "part", jobCardId: "job", jobCard: { status: "PENDING" } })
  for (const type of ["VEHICLE", "PENDING_PARTS"]) {
    p.purchaseType = type
    assert.deepEqual(planPurchaseCancellation(p), [["initial", 50]])
  }
  p.batches[0].jobCardParts[0].jobCard.status = "COMPLETED"
  assert.throws(() => planPurchaseCancellation(p), /completed/)
})

test("reimbursed payments and inconsistent stock/payment history block cancellation", () => {
  const p = purchase(); p.paymeterReimbursed = 10
  assert.throws(() => planPurchaseCancellation(p), /reimbursed/)
  p.paymeterReimbursed = 0; p.purchasePayments[0].paidAmount = 10
  assert.throws(() => planPurchaseCancellation(p), /reimbursed/)
  p.purchasePayments[0].paidAmount = 0; p.purchasePayments[0].pendingAmount = 60; p.purchasePayments[0].amount = 60
  assert.throws(() => planPurchaseCancellation(p), /payment history/)
  p.purchasePayments = []; p.batches = []
  assert.throws(() => planPurchaseCancellation(p), /used or changed/)
})
