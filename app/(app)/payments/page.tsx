"use client";
// /payments – outstanding balances (record a payment) and all payments.
import { useState } from "react";
import Link from "next/link";
import { api, fmtDate, money } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { Badge, Button, Card, Modal, PageHeader, Stat, Table } from "@/components/ui";
import PaymentForm from "@/components/PaymentForm";
import { useToast } from "@/components/Toast";

type Payment = { payment_id: number; payment_date: string; amount: number; booking_id: number; guest_name: string; room_number: string };
type Outstanding = { booking_id: number; guest_id: number; guest_name: string; room_number: string; check_in: string; check_out: string; total_amount: number; amount_paid: number; balance_due: number };

export default function PaymentsPage() {
  const toast = useToast();
  const { data, reload } = useApi<{ payments: Payment[]; outstanding: Outstanding[] }>("/api/payments");
  const [paying, setPaying] = useState<{ booking: Outstanding; existing: Payment | null } | null>(null);

  const totalReceived = data?.payments.reduce((t, p) => t + p.amount, 0) ?? 0;
  const totalDue = data?.outstanding.reduce((t, o) => t + o.balance_due, 0) ?? 0;

  async function remove(p: Payment) {
    if (!confirm(`Delete the ${money(p.amount)} payment for booking #${p.booking_id}?`)) return;
    try {
      await api(`/api/payments/${p.payment_id}`, { method: "DELETE" });
      toast.success("Payment deleted.");
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader title="Payments" subtitle="One payment per booking. The database blocks payments larger than the bill." />
      <div className="mb-6 grid max-w-2xl gap-4 sm:grid-cols-2">
        <Stat label="Received" value={money(totalReceived)} hint={`${data?.payments.length ?? 0} payments`} />
        <Stat label="Outstanding" value={money(totalDue)} hint={`${data?.outstanding.length ?? 0} bookings with a balance`} />
      </div>

      <Card title="Outstanding balances" className="mb-6">
        <Table head={["Booking", "Guest", "Stay", "Total", "Paid", "Due", ""]} empty={data?.outstanding.length === 0}>
          {data?.outstanding.map((o) => {
            const existing = data.payments.find((p) => p.booking_id === o.booking_id) ?? null;
            return (
              <tr key={o.booking_id}>
                <td><Link href={`/bookings/${o.booking_id}`} className="font-medium text-teal-700 hover:underline">#{o.booking_id}</Link> <span className="text-xs text-slate-400">room {o.room_number}</span></td>
                <td><Link href={`/guests/${o.guest_id}`} className="hover:underline">{o.guest_name}</Link></td>
                <td className="whitespace-nowrap">{fmtDate(o.check_in)} → {fmtDate(o.check_out)}</td>
                <td>{money(o.total_amount)}</td>
                <td>{money(o.amount_paid)}</td>
                <td><Badge color="amber">{money(o.balance_due)}</Badge></td>
                <td className="text-right">
                  <Button size="sm" onClick={() => setPaying({ booking: o, existing })}>{existing ? "Update payment" : "Record payment"}</Button>
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <Card title="All payments">
        <Table head={["Date", "Booking", "Guest", "Amount", ""]} empty={data?.payments.length === 0}>
          {data?.payments.map((p) => (
            <tr key={p.payment_id}>
              <td className="whitespace-nowrap">{fmtDate(p.payment_date)}</td>
              <td><Link href={`/bookings/${p.booking_id}`} className="text-teal-700 hover:underline">#{p.booking_id}</Link> <span className="text-xs text-slate-400">room {p.room_number}</span></td>
              <td>{p.guest_name}</td>
              <td className="font-medium">{money(p.amount)}</td>
              <td className="text-right"><Button size="sm" variant="danger" onClick={() => remove(p)}>Delete</Button></td>
            </tr>
          ))}
        </Table>
      </Card>

      <Modal title={`Payment for booking #${paying?.booking.booking_id}`} open={!!paying} onClose={() => setPaying(null)}>
        {paying && (
          <PaymentForm
            bookingId={paying.booking.booking_id}
            existing={paying.existing}
            suggested={paying.booking.total_amount}
            onSaved={() => { setPaying(null); reload(); }}
          />
        )}
      </Modal>
    </>
  );
}
