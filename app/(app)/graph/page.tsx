"use client";
// /graph – Neo4j insights: guest recommendations, similar guests, popular
// service pairs, and what each room type's guests use. Admin can re-sync.
import { useState } from "react";
import Link from "next/link";
import { api, money } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { Badge, Button, Card, Field, PageHeader, Select, SqlBox, Stat, Table } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { useUser } from "@/components/SessionContext";

type Insights = {
  overview: { kind: string; n: number }[];
  combos: { first: string; second: string; guests: number }[];
  roomTypeServices: { roomType: string; top: { service: string; guests: number }[] }[];
  syncedAt: string | null;
  cypher: Record<"combos" | "roomTypeServices" | "recommend" | "similar", string>;
};
type GuestRecs = {
  recommendations: { service: string; price: number; similarGuests: number; score: number }[];
  similar: { guestId: number; name: string; sharedServices: number; services: string[] }[];
};

export default function GraphPage() {
  const { isAdmin } = useUser();
  const toast = useToast();
  const insights = useApi<Insights>("/api/graph/insights");
  const guests = useApi<{ guest_id: number; first_name: string; last_name: string }[]>("/api/guests");
  const [guestId, setGuestId] = useState("2");
  const recs = useApi<GuestRecs>(guestId ? `/api/graph/recommendations/${guestId}?similar=1` : null);
  const [syncing, setSyncing] = useState(false);

  async function sync() {
    setSyncing(true);
    try {
      const r = await api<{ guests: number; stays: number; serviceUses: number; ms: number }>("/api/graph/sync", { method: "POST" });
      toast.success(`Synced ${r.guests} guests, ${r.stays} stays, ${r.serviceUses} service links in ${(r.ms / 1000).toFixed(1)}s.`);
      insights.reload();
      recs.reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  const count = (kind: string) => insights.data?.overview.find((o) => o.kind === kind)?.n ?? 0;
  const synced = insights.data?.syncedAt ? new Date(insights.data.syncedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "never";

  return (
    <>
      <PageHeader
        title="Guest insights"
        subtitle={`From the Neo4j graph, a copy of MySQL shaped for relationship questions. Last synced: ${synced}.`}
        actions={isAdmin && <Button onClick={sync} disabled={syncing}>{syncing ? "Syncing…" : "↻ Sync from MySQL"}</Button>}
      />

      {insights.error && (
        <p role="alert" className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">{insights.error}</p>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Guest nodes" value={count("Guest")} />
        <Stat label="Service nodes" value={count("Service")} />
        <Stat label="STAYED_IN relationships" value={count("STAYED_IN")} hint="one per booking" />
        <Stat label="USED relationships" value={count("USED")} hint="guest → service, with a count" />
      </div>

      <Card title="Recommend services for a guest" className="mb-6">
        <Field label="Guest">
          <Select value={guestId} onChange={(e) => setGuestId(e.target.value)} className="max-w-xs">
            {guests.data?.map((g) => <option key={g.guest_id} value={g.guest_id}>{g.first_name} {g.last_name}</option>)}
          </Select>
        </Field>
        {recs.error && <p className="mt-3 text-sm text-amber-700">{recs.error}</p>}
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Guests like them also enjoyed</h3>
            <Table head={["Service", "Price", "Similar guests", "Score"]} empty={recs.data?.recommendations.length === 0}>
              {recs.data?.recommendations.map((r) => (
                <tr key={r.service}>
                  <td className="font-medium">{r.service}</td>
                  <td>{money(r.price)}</td>
                  <td>{r.similarGuests}</td>
                  <td><Badge color="blue">{r.score}</Badge></td>
                </tr>
              ))}
            </Table>
            <SqlBox label="Show Cypher" sql={insights.data?.cypher.recommend ?? ""} params={[{ guestId: Number(guestId) }]} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Most similar guests (shared services)</h3>
            <Table head={["Guest", "Shared", "Services in common"]} empty={recs.data?.similar.length === 0}>
              {recs.data?.similar.map((s) => (
                <tr key={s.guestId}>
                  <td><Link href={`/guests/${s.guestId}`} className="font-medium text-teal-700 hover:underline">{s.name}</Link></td>
                  <td>{s.sharedServices}</td>
                  <td className="text-xs text-slate-500">{s.services.join(", ")}</td>
                </tr>
              ))}
            </Table>
            <SqlBox label="Show Cypher" sql={insights.data?.cypher.similar ?? ""} />
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Score = for each similar guest, how many services they share with this guest, added up across everyone who used the recommended service.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Popular service combinations">
          <Table head={["Service", "Together with", "Guests"]} empty={insights.data?.combos.length === 0}>
            {insights.data?.combos.map((c) => (
              <tr key={c.first + c.second}>
                <td>{c.first}</td>
                <td>{c.second}</td>
                <td>{c.guests}</td>
              </tr>
            ))}
          </Table>
          <SqlBox label="Show Cypher" sql={insights.data?.cypher.combos ?? ""} />
        </Card>

        <Card title="Top services by room type">
          <Table head={["Room type", "Most used by its guests"]} empty={insights.data?.roomTypeServices.length === 0}>
            {insights.data?.roomTypeServices.map((r) => (
              <tr key={r.roomType}>
                <td className="font-medium">{r.roomType}</td>
                <td className="text-slate-600">{r.top.map((t) => `${t.service} (${t.guests})`).join(", ")}</td>
              </tr>
            ))}
          </Table>
          <SqlBox label="Show Cypher" sql={insights.data?.cypher.roomTypeServices ?? ""} />
        </Card>
      </div>

      <Card title="Why a graph database for this?" className="mt-6">
        <div className="space-y-2 text-sm text-slate-600">
          <p>
            Bookings, payments and room availability need strict rules (no double bookings, no over-payment, transactions), so they live in
            <b> MySQL</b>, which remains the source of truth.
          </p>
          <p>
            Questions like &ldquo;guests who used what you used also used…&rdquo; follow chains of relationships
            (guest → service → other guest → other service). In SQL that means joining BOOKING_SERVICE to itself again and again; in
            <b> Neo4j</b> it is one path pattern, and adding another hop (e.g. through room type) is one more arrow.
          </p>
          <pre className="overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{"(:Guest)-[:STAYED_IN]->(:Room)-[:OF_TYPE]->(:RoomType)\n(:Guest)-[:USED {times}]->(:Service)"}</pre>
        </div>
      </Card>
    </>
  );
}
