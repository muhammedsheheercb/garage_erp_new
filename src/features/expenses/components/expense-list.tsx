"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getExpenses,
  deleteExpense,
  getMonthlyExpenseReport,
} from "../actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import {
  Pencil,
  Trash2,
  Plus,
  Search,
  Calendar as CalendarIcon,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ExpenseForm } from "./expense-form";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/i18n";

const getCategoryTranslationKey = (category: string): string => {
  const keyMap: Record<string, string> = {
    Rent: "categoryRent",
    Electricity: "categoryElectricity",
    Salary: "categorySalary",
    "Water Bill": "categoryWaterBill",
    "Other Expenses": "categoryOtherExpenses",
  };
  return keyMap[category] || category;
};

const getTranslatedCategory = (t: any, category: string): string => {
  const keyMap = getCategoryTranslationKey(category);
  return t.expensesMod[keyMap as keyof typeof t.expensesMod] || category;
};

export function ExpenseList() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);

  const currentDate = new Date();
  const [reportYear, setReportYear] = useState(currentDate.getFullYear());
  const [reportMonth, setReportMonth] = useState(currentDate.getMonth() + 1);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["expenses", page, search],
    queryFn: () => getExpenses(page, search),
  });

  const { data: reportData, isLoading: reportLoading } = useQuery({
    queryKey: ["monthly-expenses", reportYear, reportMonth],
    queryFn: () => getMonthlyExpenseReport(reportYear, reportMonth),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      toast.success(t.settings.taxTab.expenseDeleted);
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-expenses"] });
    },
    onError: (error: any) => {
      toast.error(error.message || t.common.somethingWrong);
    },
  });

  const handleDelete = (id: string) => {
    if (window.confirm(t.settings.taxTab.expenseDeleteConfirm)) {
      deleteMutation.mutate(id);
    }
  };

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const years = Array.from(
    { length: 5 },
    (_, i) => currentDate.getFullYear() - i,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight">{t.nav.expenses}</h2>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger
            render={
              <Button>
                <Plus className="mr-2 h-4 w-4" /> {t.dashboard.todaysExpense}
              </Button>
            }
          />
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{t.dashboard.todaysExpense}</DialogTitle>
            </DialogHeader>
            <ExpenseForm onSuccess={() => setIsAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="list">{t.nav.expenses}</TabsTrigger>
          <TabsTrigger value="report">{t.nav.reports}</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative w-full sm:w-[300px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.settings.taxTab.searchExpenses}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-8"
              />
            </div>
          </div>

          <div className="border rounded-md overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t.payments.date}</TableHead>
                  <TableHead>{t.services.category}</TableHead>
                  <TableHead>{t.common.description}</TableHead>
                  <TableHead className="text-right">
                    {t.payments.amount} (OMR)
                  </TableHead>
                  <TableHead className="text-right">
                    {t.common.actions}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10">
                      <div className="flex justify-center items-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : data?.data.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-10 text-muted-foreground"
                    >
                      {t.settings.taxTab.noExpenses}
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        {format(new Date(expense.date), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-1 bg-secondary text-secondary-foreground rounded-full text-xs font-medium">
                          {getTranslatedCategory(t, expense.category)}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {expense.description || "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-destructive">
                        -{expense.amount.toFixed(3)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog
                          open={editingExpense?.id === expense.id}
                          onOpenChange={(open) =>
                            !open && setEditingExpense(null)
                          }
                        >
                          <DialogTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingExpense(expense)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            }
                          />
                          <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                              <DialogTitle>{t.common.edit}</DialogTitle>
                            </DialogHeader>
                            {editingExpense?.id === expense.id && (
                              <ExpenseForm
                                initialData={expense}
                                onSuccess={() => setEditingExpense(null)}
                              />
                            )}
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDelete(expense.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {data?.meta && data.meta.totalPages > 1 && (
            <div className="flex justify-between items-center mt-4">
              <span className="text-sm text-muted-foreground">
                {t.common.page} {data.meta.page} {t.common.of}{" "}
                {data.meta.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  {t.common.previous}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((p) => Math.min(data.meta.totalPages, p + 1))
                  }
                  disabled={page === data.meta.totalPages}
                >
                  {t.common.next}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="report" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                {t.nav.reports}
              </CardTitle>
              <div className="flex gap-2 w-full sm:w-auto">
                <Select
                  value={reportMonth.toString()}
                  onValueChange={(v) => setReportMonth(parseInt(v as string))}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder={t.common.month} />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m, i) => (
                      <SelectItem key={m} value={(i + 1).toString()}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={reportYear.toString()}
                  onValueChange={(v) => setReportYear(parseInt(v as string))}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder={t.common.year} />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {reportLoading ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">
                        {t.nav.expenses}
                      </h3>
                      <div className="text-4xl font-bold text-destructive">
                        {reportData?.total.toFixed(3) || "0.000"}{" "}
                        <span className="text-lg font-medium text-muted-foreground">
                          OMR
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="font-semibold border-b pb-2">
                        {t.services.category}
                      </h3>
                      {Object.keys(reportData?.categoryTotals || {}).length ===
                      0 ? (
                        <p className="text-sm text-muted-foreground">
                          {t.settings.taxTab.noExpenses}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {Object.entries(reportData?.categoryTotals || {})
                            .sort(
                              ([, a], [, b]) => (b as number) - (a as number),
                            )
                            .map(([category, amount]) => {
                              const percentage = reportData?.total
                                ? ((amount as number) / reportData.total) * 100
                                : 0;
                              return (
                                <div key={category} className="space-y-1">
                                  <div className="flex justify-between text-sm">
                                    <span className="font-medium">
                                      {getTranslatedCategory(t, category)}
                                    </span>
                                    <span className="font-semibold">
                                      {(amount as number).toFixed(3)} OMR
                                    </span>
                                  </div>
                                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-primary transition-all"
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border rounded-md p-4">
                    <h3 className="font-semibold mb-4 border-b pb-2">
                      {t.nav.expenses}
                    </h3>
                    <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
                      {reportData?.expenses.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {t.settings.taxTab.noExpenses}
                        </p>
                      ) : (
                        reportData?.expenses.map((expense) => (
                          <div
                            key={expense.id}
                            className="flex justify-between items-start border-b pb-3 last:border-0 last:pb-0"
                          >
                            <div>
                              <div className="font-medium text-sm">
                                {getTranslatedCategory(t, expense.category)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(expense.date), "dd MMM")}{" "}
                                {expense.description &&
                                  `• ${expense.description}`}
                              </div>
                            </div>
                            <div className="font-semibold text-sm text-destructive">
                              -{expense.amount.toFixed(3)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
