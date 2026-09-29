"use server"

import prisma from "@/lib/prisma"
import { CustomerFormValues, customerSchema } from "./schema"
import { revalidatePath } from "next/cache"

export async function getCustomers(page = 1, search = "", fromDate?: string, toDate?: string) {
  const limit = 5;
  const skip = (page - 1) * limit;

  const where: any = {
    OR: [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ]
  };

  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(fromDate);
    if (toDate) where.createdAt.lte = new Date(toDate);
  }

  const [data, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.customer.count({ where })
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  }
}

export async function getCustomer(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: { vehicles: true }
  })
}

export async function createCustomer(data: CustomerFormValues) {
  const parsed = customerSchema.parse(data)
  
  if (parsed.phone) {
    const existingPhone = await prisma.customer.findFirst({
      where: { phone: parsed.phone }
    })
    if (existingPhone) {
      return { success: false as const, message: "A customer with this mobile number already exists." }
    }
  }

  const customer = await prisma.customer.create({
    data: {
      name: parsed.name,
      email: parsed.email || null,
      phone: parsed.phone,
      address: parsed.address,
    }
  })
  
  revalidatePath('/customers')
  return customer
}

export async function updateCustomer(id: string, data: CustomerFormValues) {
  const parsed = customerSchema.parse(data)
  
  if (parsed.phone) {
    const existingPhone = await prisma.customer.findFirst({
      where: { 
        phone: parsed.phone,
        id: { not: id }
      }
    })
    if (existingPhone) {
      return { success: false as const, message: "A customer with this mobile number already exists." }
    }
  }

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      name: parsed.name,
      email: parsed.email || null,
      phone: parsed.phone,
      address: parsed.address,
    }
  })
  
  revalidatePath('/customers')
  return customer
}

export async function deleteCustomer(id: string) {
  const [vehicleCount, jobCardCount, invoiceCount] = await Promise.all([
    prisma.vehicle.count({ where: { customerId: id } }),
    prisma.jobCard.count({ where: { customerId: id } }),
    prisma.invoice.count({ where: { customerId: id } }),
  ])

  if (vehicleCount || jobCardCount || invoiceCount) {
    throw new Error("This customer cannot be deleted because it has saved vehicles, job cards, or invoices.")
  }

  await prisma.customer.delete({
    where: { id }
  })
  
  revalidatePath('/customers')
  return { success: true }
}

export async function getCustomerFullDetails(id: string, fromDate?: string, toDate?: string) {
  const jobCardWhere: any = {};
  const paymentWhere: any = {
    OR: [
      { jobCard: { customerId: id } },
      { invoice: { customerId: id } },
    ],
  };
  if (fromDate || toDate) {
    jobCardWhere.createdAt = {};
    if (fromDate) jobCardWhere.createdAt.gte = new Date(fromDate);
    if (toDate) jobCardWhere.createdAt.lte = new Date(toDate);

    paymentWhere.paymentDate = {};
    if (fromDate) paymentWhere.paymentDate.gte = new Date(fromDate);
    if (toDate) paymentWhere.paymentDate.lte = new Date(toDate);
  }

  const [customer, payments] = await Promise.all([
    prisma.customer.findUnique({
    where: { id },
    include: {
      vehicles: {
        include: {
          jobCards: {
            where: jobCardWhere,
            orderBy: { createdAt: 'desc' },
            include: {
              services: {
                include: { service: true }
              },
              parts: {
                include: { batch: { include: { inventory: true } } }
              },
              invoice: {
                include: { payments: true }
              },
              payments: true,
            }
          }
        }
      }
    }
  }),
    prisma.payment.findMany({
      where: paymentWhere,
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
      include: {
        jobCard: { select: { id: true, vehicle: { select: { id: true, plateNumber: true } } } },
        invoice: { select: { jobCard: { select: { id: true, vehicle: { select: { id: true, plateNumber: true } } } } } },
      },
    }),
  ]);

  if (!customer) return null;

  let totalPaid = 0;
  let totalPending = 0;

  const vehiclesWithStats = customer.vehicles.map(vehicle => {
    let vPaid = 0;
    let vPending = 0;

    const jobCardsWithStats = vehicle.jobCards.map(jc => {
      // Payments created before job cards became directly payable can belong to
      // the invoice, while current payments belong to the job card. Combine the
      // two sets (without counting a linked payment twice) for this ledger row.
      const payments = Array.from(
        new Map(
          [...jc.payments, ...(jc.invoice?.payments ?? [])].map((payment) => [payment.id, payment])
        ).values()
      );
      const recordedAdvance = payments
        .filter((payment) => payment.method === "ADVANCE")
        .reduce((sum, payment) => sum + payment.amount, 0);
      const laterPayments = payments
        .filter((payment) => payment.method !== "ADVANCE")
        .reduce((sum, payment) => sum + payment.amount, 0);

      // Keep the full job-card advance as customer credit, including for legacy
      // job cards where it was saved on the card without a payment record.
      const advance = Math.max(jc.advancePaid ?? 0, recordedAdvance);
      const paid = advance + laterPayments;
      const total = jc.invoice?.grandTotal ?? jc.grandTotal ?? 0;
      const pending = Math.max(0, total - paid);
      vPaid += paid;
      vPending += pending;
      return { ...jc, paidAmount: paid, pendingAmount: pending };
    });

    totalPaid += vPaid;
    totalPending += vPending;

    return {
      ...vehicle,
      jobCards: jobCardsWithStats,
      totalPaid: vPaid,
      totalPending: vPending,
    };
  });

  return {
    ...customer,
    vehicles: vehiclesWithStats,
    overallTotalPaid: totalPaid,
    overallTotalPending: totalPending,
    // Current payments link to a job card; older records can link through its
    // invoice. Normalize both forms for a single complete ledger history.
    paymentHistory: payments.map((payment) => {
      const jobCard = payment.jobCard ?? payment.invoice?.jobCard;

      return {
        id: payment.id,
        amount: payment.amount,
        method: payment.method,
        paymentDate: payment.paymentDate,
        createdAt: payment.createdAt,
        createdBy: payment.createdBy,
        jobCardId: jobCard?.id ?? null,
        vehicleId: jobCard?.vehicle.id ?? null,
        vehiclePlateNumber: jobCard?.vehicle.plateNumber ?? null,
      };
    }),
  };
}
