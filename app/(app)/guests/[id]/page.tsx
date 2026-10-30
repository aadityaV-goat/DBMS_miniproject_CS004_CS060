"use client";
// /guests/:id – one guest: details, every booking with its bill, services used,
// and Neo4j "recommended for this guest".
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmtDate, money } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { Badge, Button, Card, LinkButton, Modal, PageHeader, Stat, Table } from "@/components/ui";
import GuestForm, { type GuestFields } from "@/components/GuestForm";
import Recommendations from "@/components/Recommendations";

type Bill = {
  booking_id: number; room_number: string; type_name: string; check_in: string; check_out: string; num_nights: number;
  room_cost: number; services_total: number; total_amount: number; amount_paid: number; balance_due: number;
};
type Detail = {
  guest: Required<GuestFields>;
  bookings: Bill[];
  services: { service_id: number; service_name: string; times: number }[];
};

export default function GuestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, error, reload } = useApi<Detail>(`/api/guests/${id}`);
  const [editing, setEditing] = useState(false);

  if (error) return <p className="text-red-700">{error}</p>;
  if (!data) return <p className="text-slate-400">Loading…</p>;

  const { guest, bookings, services } = data;
  const totals = bookings.reduce(
    (t, b) => ({ billed: t.billed + b.total_amount, paid: t.paid + b.amount_paid, due: t.due + b.balance_due }),
    { billed: 0, paid: 0, due: 0 },
  );

  return (
    <>
      <PageHeader
        title={`${guest.first_name} ${guest.last_name}`}
        subtitle={[guest.email, guest.phone].filter(Boolean).join(" · ") || "No contact details"}
        actions={
          <>
            <Button variant="secondary" onClick={() => router.push("/guests")}>← All guests</Button>
            <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
            <LinkButton href={`/bookings/new?guest_id=${guest.guest_id}`}>+ New booking</LinkButton>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Total billed" value={money(totals.billed)} hint={`${bookings.length} booking(s), room + services`} />
        <Stat label="Paid" value={money(totals.paid)} />
        <Stat label="Balance due" value={money(totals.due)} hint="From the v_booking_bill view" />
      </div>

      <Card title="Bookings and bills" className="mb-6">
        <Table head={["#", "Room", "Dates", "Room cost", "Services", "Total", "Paid", "Due"]} empty={bookings.length === 0}>
          {bookings.map((b) => (
            <tr key={b.booking_id} className="hover:bg-slate-50">
              <td><Link href={`/bookings/${b.booking_id}`} className="font-medium text-teal-700 hover:underline">#{b.booking_id}</Link></td>
              <td>{b.room_number} <span className="text-xs text-slate-400">{b.type_name}</span></td>
              <td className="whitespace-nowrap">{fmtDate(b.check_in)} → {fmtDate(b.check_out)} <span className="text-xs text-slate-400">({b.num_nights}n)</span></td>
              <td>{money(b.room_cost)}</td>
              <td>{money(b.services_total)}</td>
              <td className="font-medium">{money(b.total_amount)}</td>
              <td>{money(b.amount_paid)}</td>
              <td>{b.balance_due > 0 ? <Badge color="amber">{money(b.balance_due)}</Badge> : b.balance_due < 0 ? <Badge color="blue">Refund {money(-b.balance_due)}</Badge> : <Badge color="green">Paid</Badge>}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Services used">
          {services.length === 0 ? (
            <p className="text-sm text-slate-400">No add-on services yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {services.map((s) => (
                <li key={s.service_id} className="flex justify-between">
                  <span>{s.service_name}</span>
                  <span className="text-slate-400">×{s.times}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Recommendations guestId={guest.guest_id} />
      </div>

      <Modal title="Edit guest" open={editing} onClose={() => setEditing(false)}>
        <GuestForm initial={guest} onSaved={() => { setEditing(false); reload(); }} />
      </Modal>
    </>
  );
}
