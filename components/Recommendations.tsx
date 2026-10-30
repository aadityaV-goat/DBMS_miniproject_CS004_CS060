"use client";
// "Recommended for this guest" panel. Data comes from Neo4j (see /api/graph/recommendations).
import { useApi } from "@/lib/useApi";
import { Card } from "./ui";

type Rec = { service: string; score: number; similarGuests: number };

export default function Recommendations({ guestId }: { guestId: number }) {
  const { data, error, loading } = useApi<Rec[]>(`/api/graph/recommendations/${guestId}`);

  return (
    <Card title="Recommended for this guest">
      <p className="mb-3 text-xs text-slate-400">From Neo4j: services used by guests who share services with this guest.</p>
      {loading && <p className="text-sm text-slate-400">Asking the graph…</p>}
      {error && <p className="text-sm text-amber-700">{error}</p>}
      {data && data.length === 0 && <p className="text-sm text-slate-400">No recommendations yet. Try syncing the graph on the Guest insights page.</p>}
      {data && data.length > 0 && (
        <ul className="space-y-2 text-sm">
          {data.map((r) => (
            <li key={r.service} className="flex items-center justify-between">
              <span>{r.service}</span>
              <span className="text-xs text-slate-500">{r.similarGuests} similar guest{r.similarGuests === 1 ? "" : "s"}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
