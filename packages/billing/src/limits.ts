/**
 * Which clients stay active under a client limit. Deterministic so webhook
 * replays produce the same result: explicitly kept clients first (in the
 * order given), then most recently active, ties broken by id. Everything
 * past the limit is locked (read-only, never deleted).
 */
export type LimitCandidate = { id: string; lastActiveAt: Date };

export function selectClientsToKeep(
  clients: LimitCandidate[],
  limit: number | null,
  preferredKeep: readonly string[] = [],
): { keep: string[]; lock: string[] } {
  if (limit === null || clients.length <= limit) {
    return { keep: clients.map((client) => client.id), lock: [] };
  }
  const known = new Set(clients.map((client) => client.id));
  const preferred = [...new Set(preferredKeep)].filter((id) => known.has(id));
  const rest = clients
    .filter((client) => !preferred.includes(client.id))
    .sort(
      (a, b) =>
        b.lastActiveAt.getTime() - a.lastActiveAt.getTime() ||
        a.id.localeCompare(b.id),
    )
    .map((client) => client.id);
  const ordered = [...preferred, ...rest];
  return { keep: ordered.slice(0, limit), lock: ordered.slice(limit) };
}
