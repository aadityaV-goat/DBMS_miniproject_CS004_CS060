"use client";
// Add / edit guest form (used in a Modal on the guests pages).
import { useState } from "react";
import { api } from "@/lib/client";
import { Button, Field, Input } from "./ui";
import { useToast } from "./Toast";

export type GuestFields = { guest_id?: number; first_name: string; last_name: string; phone: string | null; email: string | null };

export default function GuestForm({ initial, onSaved }: { initial?: GuestFields; onSaved: (id: number) => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    first_name: initial?.first_name ?? "",
    last_name: initial?.last_name ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (initial?.guest_id) {
        await api(`/api/guests/${initial.guest_id}`, { method: "PUT", body: form });
        toast.success("Guest updated.");
        onSaved(initial.guest_id);
      } else {
        const { guest_id } = await api<{ guest_id: number }>("/api/guests", { method: "POST", body: form });
        toast.success("Guest added.");
        onSaved(guest_id);
      }
    } catch (err) {
      toast.error((err as Error).message); // e.g. "That email address is already used by someone else."
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name"><Input value={form.first_name} onChange={set("first_name")} required maxLength={50} /></Field>
        <Field label="Last name"><Input value={form.last_name} onChange={set("last_name")} required maxLength={50} /></Field>
      </div>
      <Field label="Phone"><Input value={form.phone} onChange={set("phone")} required maxLength={20} inputMode="tel" /></Field>
      <Field label="Email" hint="Must be unique (UNIQUE constraint)."><Input type="email" value={form.email} onChange={set("email")} required maxLength={120} /></Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save guest"}</Button>
      </div>
    </form>
  );
}
