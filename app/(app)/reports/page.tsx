"use client";
// /reports – ADMIN only. The "important queries" from the problem statement.
// Each card: inputs → Run → result table, plus the exact SQL for the viva.
import { useState } from "react";
import { api, money, qs } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { Badge, Button, Card, Field, Input, PageHeader, Select, SqlBox, Table } from "@/components/ui";
import { useToast } from "@/components/Toast";

type ParamDef = { name: string; label: string; type: "date" | "guest" | "number"; default?: string };
type ReportDef = { key: string; title: string; description: string; concepts: string[]; params: ParamDef[]; sql: string };
type Guest = { guest_id: number; first_name: string; last_name: string };

export default function ReportsPage() {
  const { data: reports } = useApi<ReportDef[]>("/api/reports");
  const { data: guests } = useApi<Guest[]>("/api/guests");

  return (
    <>
      <PageHeader title="Reports" subtitle="Admin only. Each report shows its result and the exact SQL that produced it." />
      <div className="space-y-6">
        {reports?.map((r) => <ReportCard key={r.key} report={r} guests={guests ?? []} />)}
      </div>
    </>
  );
}

function ReportCard({ report, guests }: { report: ReportDef; guests: Guest[] }) {
  const toast = useToast();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(report.params.map((p) => [p.name, p.default ?? ""])),
  );
  const [result, setResult] = useState<{ sql: string; params: unknown[]; rows: Record<string, unknown>[] } | null>(null);
  const [running, setRunning] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    try {
      setResult(await api(`/api/reports/${report.key}${qs(values)}`));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const columns = result?.rows[0] ? Object.keys(result.rows[0]) : [];

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{report.title}</h2>
          <p className="text-sm text-slate-500">{report.description}</p>
        </div>
        <div className="flex flex-wrap gap-1">{report.concepts.map((c) => <Badge key={c} color="blue">{c}</Badge>)}</div>
      </div>

      <form onSubmit={run} className="flex flex-wrap items-end gap-3">
        {report.params.map((p) => (
          <Field key={p.name} label={p.label}>
            {p.type === "guest" ? (
              <Select value={values[p.name]} onChange={(e) => setValues({ ...values, [p.name]: e.target.value })} className="!w-48">
                {guests.map((g) => <option key={g.guest_id} value={g.guest_id}>{g.first_name} {g.last_name}</option>)}
              </Select>
            ) : (
              <Input type={p.type} value={values[p.name]} onChange={(e) => setValues({ ...values, [p.name]: e.target.value })} className="!w-44" />
            )}
          </Field>
        ))}
        <Button type="submit" disabled={running}>{running ? "Running…" : "Run"}</Button>
      </form>

      {result && (
        <div className="mt-4">
          <Table head={columns} empty={result.rows.length === 0}>
            {result.rows.map((row, i) => (
              <tr key={i}>
                {columns.map((c) => <td key={c} className="whitespace-nowrap">{formatCell(c, row[c])}</td>)}
              </tr>
            ))}
          </Table>
        </div>
      )}
      <SqlBox sql={result?.sql ?? report.sql} params={result?.params} />
    </Card>
  );
}

// Money-looking columns get ₹ formatting; everything else is shown as-is.
function formatCell(column: string, value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number" && /cost|total|paid|due|revenue|amount|rate|payment$/.test(column) && !/^payments$/.test(column)) return money(value);
  return String(value);
}
