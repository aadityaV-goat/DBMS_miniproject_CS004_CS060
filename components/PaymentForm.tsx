"use client";
// Record a new payment for a booking, or edit its existing one.
import { useState } from "react";
import { api, todayISO } from "@/lib/client";
import { Button, Field, Input } from "./ui";
import { useToast } from "./Toast";

type Existing = { payment_id: number; payment_date: string; amount: number } | null;

export default function PaymentForm({ bookingId, existing, suggested, onSaved }: {
  bookingId: number; existing: Existing; suggested?: number; onSaved: () => void;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState(String(existing?.amount ?? suggested ?? ""));
  const [date, setDate] = useState(existing?.payment_date ?? todayISO());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (existing) {
        await api(`/api/payments/${existing.payment_id}`, { method: "PUT", body: { amount, payment_date: date } });
      } else {
        await api("/api/payments", { method: "POST", body: { booking_id: bookingId, amount, payment_date: date } });
      }
      toast.success("Payment saved.");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message); // e.g. over the total, or already has a payment
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Amount (₹)" hint={suggested ? `Full amount to settle: ₹${suggested}` : undefined}>
        <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </Field>
      <Field label="Payment date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
      <div className="flex justify-end"><Button type="submit">Save payment</Button></div>
    </form>
  );
}
