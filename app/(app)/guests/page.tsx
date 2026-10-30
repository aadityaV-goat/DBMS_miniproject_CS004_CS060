"use client";
// /guests – full-text search, add, edit, delete.
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, money, qs } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { Badge, Button, Card, Input, Modal, PageHeader, Table } from "@/components/ui";
import GuestForm, { type GuestFields } from "@/components/GuestForm";
import { useToast } from "@/components/Toast";

type GuestRow = GuestFields & { guest_id: number; booking_count: number; total_spent: number };

export default function GuestsPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [editing, setEditing] = useState<GuestFields | null>(null);
  const [adding, setAdding] = useState(false);

  // Wait until typing pauses for 300 ms before querying.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: guests, loading, reload } = useApi<GuestRow[]>(`/api/guests${qs({ q: debounced })}`);

  async function remove(g: GuestRow) {
    if (!confirm(`Delete ${g.first_name} ${g.last_name}?`)) return;
    try {
      await api(`/api/guests/${g.guest_id}`, { method: "DELETE" });
      toast.success("Guest deleted.");
      reload();
    } catch (err) {
      toast.error((err as Error).message); // FK RESTRICT message if they have bookings
    }
  }

  return (
    <>
      <PageHeader
        title="Guests"
        subtitle="Search uses MySQL FULLTEXT (MATCH … AGAINST) on name and email."
        actions={<Button onClick={() => setAdding(true)}>+ Add guest</Button>}
      />
      <Card>
        <Input
          type="search"
          placeholder="Search by name, email or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 max-w-md"
          aria-label="Search guests"
        />
        <Table head={["Name", "Email", "Phone", "Bookings", "Paid so far", ""]} empty={!loading && guests?.length === 0}>
          {guests?.map((g) => (
            <tr key={g.guest_id} className="hover:bg-slate-50">
              <td>
                <Link href={`/guests/${g.guest_id}`} className="font-medium text-teal-700 hover:underline">
                  {g.first_name} {g.last_name}
                </Link>
              </td>
              <td className="text-slate-600">{g.email ?? "—"}</td>
              <td className="text-slate-600">{g.phone ?? "—"}</td>
              <td>{g.booking_count > 0 ? <Badge color="blue">{g.booking_count}</Badge> : <Badge>0</Badge>}</td>
              <td>{money(g.total_spent)}</td>
              <td className="whitespace-nowrap text-right">
                <Button size="sm" variant="ghost" onClick={() => setEditing(g)}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => remove(g)}>Delete</Button>
              </td>
            </tr>
          ))}
        </Table>
        {loading && <p className="py-4 text-sm text-slate-400">Loading…</p>}
      </Card>

      <Modal title="Add guest" open={adding} onClose={() => setAdding(false)}>
        <GuestForm onSaved={() => { setAdding(false); reload(); }} />
      </Modal>
      <Modal title="Edit guest" open={!!editing} onClose={() => setEditing(null)}>
        {editing && <GuestForm initial={editing} onSaved={() => { setEditing(null); reload(); }} />}
      </Modal>
    </>
  );
}
