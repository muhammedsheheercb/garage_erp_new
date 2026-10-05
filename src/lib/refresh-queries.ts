import type { QueryClient } from "@tanstack/react-query"

export async function refreshQueries(client: QueryClient, prefixes: readonly string[]) {
  await Promise.all(prefixes.map(prefix => client.invalidateQueries({ queryKey: [prefix] })))
}
