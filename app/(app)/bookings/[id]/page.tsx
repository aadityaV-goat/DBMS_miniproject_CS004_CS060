"use client";
// /bookings/:id – booking details, the bill, services (add/remove), payment,
// change dates/room, cancel.
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, fmtDate, money } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Table } from "@/components/ui";
import PaymentForm from "@/components/PaymentForm";
import { useToast } from "@/components/Toast";

type Detail = {
  details: {
    booking_id: number; check_in: string; check_out: string; num_nights: number; status: string;
    guest_id: number; guest_name: string; guest_email: string | null; guest_phone: string | null;
    room_id: number; room_number: string; floor: number; type_name: string; base_rate: number;
    employee_name: string; employee_role: string;
  };
  bill: { room_cost: number; services_total: number; total_amount: number; amount_paid: number; balance_due: number };
  services: { service_id: number; service_name: string; price: number }[];
  payment: { payment_id: number; payment_date: string; amount: number } | null;
  fn_total: number;
};

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { data, error, reload } = useApi<Detail>(`/api/bookings/${id}`);
  const allServices = useApi<{ service_id: number; service_name: string; price: number }[]>("/api/services");
  const [addId, setAddId] = useState("");
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);

  if (error) return <p className="text-red-700">{error}</p>;
  if (!data) return <p className="text-slate-400">Loading…</p>;
  const { details: d, bill, services, payment } = data;

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      toast.success(success);
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function cancel() {
    if (!confirm(`Cancel booking #${d.booking_id}? Its services and payment are removed too (ON DELETE CASCADE).`)) return;
    try {
      await api(`/api/bookings/${d.booking_id}`, { method: "DELETE" });
      toast.success("Booking cancelled.");
      router.push("/bookings");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const unused = allServices.data?.filter((s) => !services.some((x) => x.service_id === s.service_id)) ?? [];

  return (
    <>
      <PageHeader
        title={`Booking #${d.booking_id}`}
        subtitle={`${d.guest_name} · Room ${d.room_number} (${d.type_name}) · handled by ${d.employee_name}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => router.push("/bookings")}>← All bookings</Button>
            <Button variant="secondary" onClick={() => setEditing(true)}>Change dates / room</Button>
            <Button variant="danger" onClick={cancel}>Cancel booking</Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Stay">
            <dl className="grid gap-4 text-sm sm:grid-cols-4">
              <div><dt className="text-slate-500">Check-in</dt><dd className="font-medium">{fmtDate(d.check_in)}</dd></div>
              <div><dt className="text-slate-500">Check-out</dt><dd className="font-medium">{fmtDate(d.check_out)}</dd></div>
              <div><dt className="text-slate-500">Nights</dt><dd className="font-medium">{d.num_nights} <span className="text-xs text-slate-400">(set by trigger)</span></dd></div>
              <div><dt className="text-slate-500">Status</dt><dd><Badge color={d.status === "In house" ? "green" : d.status === "Upcoming" ? "blue" : "gray"}>{d.status}</Badge></dd></div>
              <div className="sm:col-span-2"><dt className="text-slate-500">Guest</dt><dd><Link href={`/guests/${d.guest_id}`} className="font-medium text-teal-700 hover:underline">{d.guest_name}</Link> <span className="text-slate-400">{d.guest_email}</span></dd></div>
              <div className="sm:col-span-2"><dt className="text-slate-500">Room</dt><dd className="font-medium">{d.room_number}, floor {d.floor} · {money(d.base_rate)}/night</dd></div>
            </dl>
          </Card>

          <Card title="Add-on services">
            <Table head={["Service", "Price", ""]} empty={services.length === 0}>
              {services.map((s) => (
                <tr key={s.service_id}>
                  <td>{s.service_name}</td>
                  <td>{money(s.price)}</td>
                  <td className="text-right">
                    <Button size="sm" variant="danger" onClick={() => run(() => api(`/api/bookings/${d.booking_id}/services?service_id=${s.service_id}`, { method: "DELETE" }), "Service removed.")}>Remove</Button>
                  </td>
                </tr>
              ))}
            </Table>
            {unused.length > 0 && (
              <form
                className="mt-4 flex gap-2"
                onSubmit={(e) => { e.preventDefault(); if (addId) run(() => api(`/api/bookings/${d.booking_id}/services`, { method: "POST", body: { service_id: addId } }), "Service added.").then(() => setAddId("")); }}
              >
                <Select value={addId} onChange={(e) => setAddId(e.target.value)} aria-label="Service to add" className="max-w-xs">
                  <option value="">Add a service…</option>
                  {unused.map((s) => <option key={s.service_id} value={s.service_id}>{s.service_name} ({money(s.price)})</option>)}
                </Select>
                <Button type="submit" variant="secondary" disabled={!addId}>Add</Button>
              </form>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Bill">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Room ({d.num_nights} × {money(d.base_rate)})</dt><dd>{money(bill.room_cost)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Services</dt><dd>{money(bill.services_total)}</dd></div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold"><dt>Total</dt><dd>{money(bill.total_amount)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Paid</dt><dd>{money(bill.amount_paid)}</dd></div>
              <div className="flex justify-between font-semibold">
                <dt>{bill.balance_due < 0 ? "Refund due" : "Balance due"}</dt>
                <dd className={bill.balance_due > 0 ? "text-amber-700" : bill.balance_due < 0 ? "text-sky-700" : "text-emerald-700"}>{money(Math.abs(bill.balance_due))}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-slate-400">
              From view v_booking_bill. Stored function fn_booking_total({d.booking_id}) = {money(data.fn_total)}.
            </p>
          </Card>

          <Card title="Payment">
            {payment ? (
              <div className="text-sm">
                <p><b>{money(payment.amount)}</b> on {fmtDate(payment.payment_date)}</p>
                <Button size="sm" variant="secondary" className="mt-3" onClick={() => setPaying(true)}>Edit payment</Button>
              </div>
            ) : (
              <>
                <p className="mb-3 text-sm text-slate-500">No payment yet. One payment per booking (booking_id is UNIQUE in PAYMENT).</p>
                <Button size="sm" onClick={() => setPaying(true)}>Record payment</Button>
              </>
            )}
          </Card>
        </div>
      </div>

      <Modal title="Change dates / room" open={editing} onClose={() => setEditing(false)}>
        <EditStayForm booking={d} onSaved={() => { setEditing(false); reload(); }} />
      </Modal>
      <Modal title={payment ? "Edit payment" : "Record payment"} open={paying} onClose={() => setPaying(false)}>
        <PaymentForm bookingId={d.booking_id} existing={payment} suggested={bill.balance_due > 0 ? bill.balance_due + (payment?.amount ?? 0) : undefined} onSaved={() => { setPaying(false); reload(); }} />
      </Modal>
    </>
  );
}

function EditStayForm({ booking, onSaved }: { booking: Detail["details"]; onSaved: () => void }) {
  const toast = useToast();
  const rooms = useApi<{ rooms: { room_id: number; room_number: string; type_name: string }[] }>("/api/rooms");
  const [form, setForm] = useState({ room_id: String(booking.room_id), check_in: booking.check_in, check_out: booking.check_out });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(`/api/bookings/${booking.booking_id}`, { method: "PUT", body: form });
      toast.success("Booking updated.");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message); // overlap → message from trg_booking_no_overlap_bu
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-slate-500">The database re-checks for clashes and recalculates the nights (BEFORE UPDATE triggers).</p>
      <Field label="Room">
        <Select value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })}>
          {rooms.data?.rooms.map((r) => <option key={r.room_id} value={r.room_id}>{r.room_number} · {r.type_name}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Check-in"><Input type="date" value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value })} required /></Field>
        <Field label="Check-out"><Input type="date" value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} required /></Field>
      </div>
      <div className="flex justify-end"><Button type="submit">Save changes</Button></div>
    </form>
  );
}
