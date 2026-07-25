const fs = require('fs');
const file = 'src/features/purchases/actions.ts';
let code = fs.readFileSync(file, 'utf8');

const updatePurchaseCode = `
export async function updatePurchase(id: string, data: PurchaseFormValues) {
  const parsed = purchaseSchema.parse(data)
  const paymentMethodId = parsed.paymentSource === "PAYMETER" ? parsed.paymentMethodId! : null

  const existingPurchase = await prisma.purchase.findUnique({
    where: { id }
  })
  if (!existingPurchase) throw new Error("Purchase not found")

  // Calculate calculations
  let subTotal = 0
  const itemsData = parsed.items.map(item => {
    const total = item.quantity * item.purchasePrice
    subTotal += total
    return {
      inventoryId: item.inventoryId,
      quantity: item.quantity,
      purchasePrice: item.purchasePrice,
      sellingPrice: item.sellingPrice,
      itemTotal: total
    }
  })

  // Read active tax setting
  const activeTax = await prisma.taxSetting.findFirst({
    where: { isActive: true }
  })
  const taxRate = activeTax ? activeTax.percentage : 0
  const taxAmount = (subTotal - parsed.discount) * (taxRate / 100)
  const grandTotal = subTotal + taxAmount - parsed.discount
  const pendingAmount = grandTotal - parsed.paidAmount

  if (parsed.discount > subTotal) {
    throw new Error("Discount cannot exceed the purchase subtotal.")
  }

  if (parsed.paidAmount > grandTotal) {
    throw new Error("Paid amount cannot exceed the purchase grand total.")
  }

  const result = await prisma.$transaction(async (tx) => {
    const selectedPaymentMethodId = paymentMethodId || await getDirectPaymeterId(tx, parsed.directPaymentMethod!)
    
    // 1. Revert old paymeter spentAmount
    await tx.paymeter.update({
      where: { id: existingPurchase.paymentMethodId },
      data: { spentAmount: { decrement: existingPurchase.grandTotal } }
    })

    // 2. Delete old items, batches, payments
    await tx.purchaseItem.deleteMany({ where: { purchaseId: id } })
    await tx.inventoryBatch.deleteMany({ where: { purchaseId: id } })
    await tx.purchasePayment.deleteMany({ where: { purchaseId: id } })

    // 3. Update the purchase
    const purchase = await tx.purchase.update({
      where: { id },
      data: {
        purchaseDate: new Date(parsed.purchaseDate),
        supplierId: parsed.supplierId,
        paymentMethodId: selectedPaymentMethodId,
        subTotal,
        taxRate,
        taxAmount,
        discount: parsed.discount,
        grandTotal,
        paidAmount: parsed.paidAmount,
        pendingAmount,
        items: {
          create: itemsData
        }
      }
    })

    // 4. Record the new purchase against its selected ledger
    await tx.paymeter.update({
      where: { id: selectedPaymentMethodId },
      data: { spentAmount: { increment: grandTotal } }
    })

    // 5. If paidAmount > 0, create a PurchasePayment record
    if (parsed.paidAmount > 0) {
      await tx.purchasePayment.create({
        data: {
          purchaseId: purchase.id,
          paymeterId: selectedPaymentMethodId,
          amount: parsed.paidAmount,
          date: new Date(parsed.purchaseDate)
        }
      })
    }

    // 6. Create Inventory Batches
    for (const item of parsed.items) {
      await tx.inventoryBatch.create({
        data: {
          inventoryId: item.inventoryId,
          batchNumber: purchase.purchaseNumber,
          quantity: item.quantity,
          purchasePrice: item.purchasePrice,
          sellingPrice: item.sellingPrice,
          purchaseId: purchase.id
        }
      })
    }

    return purchase
  })

  revalidatePath('/purchases')
  revalidatePath('/inventory')
  revalidatePath('/paymeters')
  return result
}
`;

code += updatePurchaseCode;
fs.writeFileSync(file, code);
