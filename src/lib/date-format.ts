import { format } from "date-fns"

export function formatDisplayDate(value: Date | string | number, includeTime = false) {
  return format(new Date(value), includeTime ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy")
}
