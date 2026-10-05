import type { Prisma } from '@prisma/client'

type Receipt = { id: string; amount: number }
type InvoiceTotals = {
  serviceCharge: number; partsCost: number; labourCharge: number; otherCharges: string | null;
  tax: number; discount: number; payments: Receipt[];
  jobCard: { serviceTotal: number; partsTotal: number; payments: Receipt[] }
}

export function currentInvoiceTotals(invoice: InvoiceTotals) {
  let charges: unknown = []
  if (invoice.otherCharges) {
    try { charges = JSON.parse(invoice.otherCharges) } catch { /* Retain support for older non-JSON charge notes. */ }
  }
  const otherTotal = Array.isArray(charges) ? charges.reduce((sum, charge) => sum + Math.max(0, Number(charge.amount) || 0), 0) : 0
  const serviceCharge = invoice.jobCard.serviceTotal
  const partsCost = invoice.jobCard.partsTotal
  const subTotal = serviceCharge + partsCost + invoice.labourCharge + otherTotal
  const grandTotal = Math.max(0, subTotal + invoice.tax - invoice.discount)
  const totalPaid = [...new Map([...invoice.payments, ...invoice.jobCard.payments].map(p => [p.id, p.amount])).values()].reduce((sum, amount) => sum + amount, 0)
  return { serviceCharge, partsCost, subTotal, grandTotal, amount: grandTotal,
    status: totalPaid >= grandTotal ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID' }
}

export async function syncJobCardInvoice(tx: Prisma.TransactionClient, jobCardId: string) {
  const invoice = await tx.invoice.findUnique({ where: { jobCardId }, include: { payments: true, jobCard: { include: { payments: true, services: { include: { service: true } }, parts: { include: { inventory: true, batch: { include: { inventory: true } } } } } } } })
  if (invoice) await tx.invoice.update({ where: { id: invoice.id }, data: { ...currentInvoiceTotals(invoice), ...currentInvoiceDetails(invoice.jobCard) } })
}

export function currentInvoiceDetails(job: {
  services?: Array<{ quantity: number; service: { name: string } }>;
  parts?: Array<{ quantity: number; isPending: boolean; inventory?: { itemName: string } | null; batch?: { inventory: { itemName: string } } | null }>;
}) {
  return {
    ...(job.services ? { servicesDetails: job.services.map(s => `${s.service.name} (Qty: ${s.quantity})`).join(", ") } : {}),
    ...(job.parts ? { partsDetails: job.parts.map(p => `${p.batch?.inventory.itemName || p.inventory?.itemName || "Unknown part"} (Qty: ${p.quantity})${p.isPending ? " — Pending purchase" : ""}`).join(", ") } : {}),
  }
}
