"use client";
// /services – list with usage. ADMIN can add, edit and delete.
import { useState } from "react";
import { api, money } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { Button, Card, Field, Input, Modal, PageHeader, Table } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { useUser } from "@/components/SessionContext";

type Service = { service_id: number; service_name: string; price: number; times_used: number; revenue: number };

export default function ServicesPage() {
  const { isAdmin } = useUser();
  const toast = useToast();
  const { data, reload } = useApi<Service[]>("/api/services");
  const [form, setForm] = useState<Partial<Service> | null>(null);

  async function remove(s: Service) {
    if (!confirm(`Delete ${s.service_name}?`)) return;
    try {
      await api(`/api/services/${s.service_id}`, { method: "DELETE" });
      toast.success("Service deleted.");
      reload();
    } catch (err) {
      toast.error((err as Error).message); // FK RESTRICT if it's on a booking
    }
  }

  return (
    <>
      <PageHeader
        title="Services"
        subtitle="Add-ons guests can book with a stay."
        actions={isAdmin && <Button onClick={() => setForm({})}>+ Add service</Button>}
      />
      <Card>
        <Table head={["Service", "Price", "Times booked", "Revenue", ...(isAdmin ? [""] : [])]} empty={data?.length === 0}>
          {data?.map((s) => (
            <tr key={s.service_id}>
              <td className="font-medium">{s.service_name}</td>
              <td>{money(s.price)}</td>
              <td>{s.times_used}</td>
              <td>{money(s.revenue)}</td>
              {isAdmin && (
                <td className="whitespace-nowrap text-right">
                  <Button size="sm" variant="ghost" onClick={() => setForm(s)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => remove(s)}>Delete</Button>
                </td>
              )}
            </tr>
          ))}
        </Table>
      </Card>

      <Modal title={form?.service_id ? "Edit service" : "Add service"} open={!!form} onClose={() => setForm(null)}>
        {form && <ServiceForm initial={form} onSaved={() => { setForm(null); reload(); }} />}
      </Modal>
    </>
  );
}

function ServiceForm({ initial, onSaved }: { initial: Partial<Service>; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(initial.service_name ?? "");
  const [price, setPrice] = useState(String(initial.price ?? ""));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(initial.service_id ? `/api/services/${initial.service_id}` : "/api/services", {
        method: initial.service_id ? "PUT" : "POST",
        body: { service_name: name, price },
      });
      toast.success("Service saved.");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} /></Field>
      <Field label="Price (₹)" hint="CHECK (price >= 0)"><Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required /></Field>
      <div className="flex justify-end"><Button type="submit">Save service</Button></div>
    </form>
  );
}
