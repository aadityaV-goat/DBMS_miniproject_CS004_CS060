"use client";
// /rooms – availability checker, rooms list with filters, room types.
// Add / edit / delete buttons appear only for ADMIN (the API enforces it too).
import { useState } from "react";
import Link from "next/link";
import { addDays, api, money, qs, todayISO } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, SqlBox, Table } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { useUser } from "@/components/SessionContext";

type Room = { room_id: number; room_number: string; floor: number; type_id: number; type_name: string; base_rate: number; occupied_today: 0 | 1 };
type RoomType = { type_id: number; type_name: string; base_rate: number; room_count: number };
type FreeRoom = { room_id: number; room_number: string; floor: number; type_name: string; base_rate: number; stay_cost: number };

export default function RoomsPage() {
  const { isAdmin } = useUser();
  const toast = useToast();
  const [typeFilter, setTypeFilter] = useState("");
  const [floorFilter, setFloorFilter] = useState("");
  const rooms = useApi<{ rooms: Room[]; floors: number[] }>(`/api/rooms${qs({ type_id: typeFilter, floor: floorFilter })}`);
  const types = useApi<RoomType[]>("/api/room-types");

  const [roomForm, setRoomForm] = useState<Partial<Room> | null>(null);
  const [typeForm, setTypeForm] = useState<Partial<RoomType> | null>(null);

  async function remove(url: string, label: string, after: () => void) {
    if (!confirm(`Delete ${label}?`)) return;
    try {
      await api(url, { method: "DELETE" });
      toast.success(`${label} deleted.`);
      after();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Rooms"
        subtitle="Check availability, browse rooms and manage room types."
        actions={isAdmin && <Button onClick={() => setRoomForm({})}>+ Add room</Button>}
      />

      <AvailabilityChecker types={types.data ?? []} />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="All rooms" className="lg:col-span-2"
          actions={
            <div className="flex gap-2">
              <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter by type" className="!w-40">
                <option value="">All types</option>
                {types.data?.map((t) => <option key={t.type_id} value={t.type_id}>{t.type_name}</option>)}
              </Select>
              <Select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)} aria-label="Filter by floor" className="!w-32">
                <option value="">All floors</option>
                {rooms.data?.floors.map((f) => <option key={f} value={f}>Floor {f}</option>)}
              </Select>
            </div>
          }
        >
          <Table head={["Room", "Floor", "Type", "Rate / night", "Today", ...(isAdmin ? [""] : [])]} empty={rooms.data?.rooms.length === 0}>
            {rooms.data?.rooms.map((r) => (
              <tr key={r.room_id}>
                <td className="font-medium">{r.room_number}</td>
                <td>{r.floor}</td>
                <td>{r.type_name}</td>
                <td>{money(r.base_rate)}</td>
                <td>{r.occupied_today ? <Badge color="amber">Occupied</Badge> : <Badge color="green">Free</Badge>}</td>
                {isAdmin && (
                  <td className="whitespace-nowrap text-right">
                    <Button size="sm" variant="ghost" onClick={() => setRoomForm(r)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => remove(`/api/rooms/${r.room_id}`, `Room ${r.room_number}`, rooms.reload)}>Delete</Button>
                  </td>
                )}
              </tr>
            ))}
          </Table>
        </Card>

        <Card title="Room types" actions={isAdmin && <Button size="sm" variant="secondary" onClick={() => setTypeForm({})}>+ Add type</Button>}>
          <ul className="divide-y divide-slate-100 text-sm">
            {types.data?.map((t) => (
              <li key={t.type_id} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">{t.type_name}</p>
                  <p className="text-xs text-slate-400">{money(t.base_rate)} / night · {t.room_count} room(s)</p>
                </div>
                {isAdmin && (
                  <div className="whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setTypeForm(t)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => remove(`/api/room-types/${t.type_id}`, t.type_name, () => { types.reload(); rooms.reload(); })}>✕</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Modal title={roomForm?.room_id ? "Edit room" : "Add room"} open={!!roomForm} onClose={() => setRoomForm(null)}>
        {roomForm && <RoomForm initial={roomForm} types={types.data ?? []} onSaved={() => { setRoomForm(null); rooms.reload(); types.reload(); }} />}
      </Modal>
      <Modal title={typeForm?.type_id ? "Edit room type" : "Add room type"} open={!!typeForm} onClose={() => setTypeForm(null)}>
        {typeForm && <RoomTypeForm initial={typeForm} onSaved={() => { setTypeForm(null); types.reload(); rooms.reload(); }} />}
      </Modal>
    </>
  );
}

function AvailabilityChecker({ types }: { types: RoomType[] }) {
  const [checkIn, setCheckIn] = useState(todayISO());
  const [checkOut, setCheckOut] = useState(addDays(todayISO(), 2));
  const [typeId, setTypeId] = useState("");
  const [result, setResult] = useState<{ sql: string; params: unknown[]; rows: FreeRoom[] } | null>(null);
  const toast = useToast();

  async function check(e: React.FormEvent) {
    e.preventDefault();
    try {
      setResult(await api(`/api/rooms/availability${qs({ check_in: checkIn, check_out: checkOut, type_id: typeId })}`));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Card title="Availability checker">
      <form onSubmit={check} className="grid items-end gap-3 sm:grid-cols-4">
        <Field label="Check-in"><Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required /></Field>
        <Field label="Check-out"><Input type="date" value={checkOut} min={addDays(checkIn, 1)} onChange={(e) => setCheckOut(e.target.value)} required /></Field>
        <Field label="Room type">
          <Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">Any</option>
            {types.map((t) => <option key={t.type_id} value={t.type_id}>{t.type_name}</option>)}
          </Select>
        </Field>
        <Button type="submit">Find free rooms</Button>
      </form>

      {result && (
        <div className="mt-5">
          <p className="mb-2 text-sm text-slate-600"><b>{result.rows.length}</b> room(s) free for these dates.</p>
          <Table head={["Room", "Floor", "Type", "Rate / night", "Stay cost", ""]} empty={result.rows.length === 0}>
            {result.rows.map((r) => (
              <tr key={r.room_id}>
                <td className="font-medium">{r.room_number}</td>
                <td>{r.floor}</td>
                <td>{r.type_name}</td>
                <td>{money(r.base_rate)}</td>
                <td>{money(r.stay_cost)}</td>
                <td className="text-right">
                  <Link className="text-sm font-medium text-teal-700 hover:underline" href={`/bookings/new${qs({ room_id: r.room_id, check_in: checkIn, check_out: checkOut })}`}>Book →</Link>
                </td>
              </tr>
            ))}
          </Table>
          <SqlBox sql={result.sql} params={result.params} />
        </div>
      )}
    </Card>
  );
}

function RoomForm({ initial, types, onSaved }: { initial: Partial<Room>; types: RoomType[]; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    room_number: initial.room_number ?? "",
    floor: String(initial.floor ?? 1),
    type_id: String(initial.type_id ?? types[0]?.type_id ?? ""),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(initial.room_id ? `/api/rooms/${initial.room_id}` : "/api/rooms", { method: initial.room_id ? "PUT" : "POST", body: form });
      toast.success("Room saved.");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Room number" hint="Unique"><Input value={form.room_number} onChange={(e) => setForm({ ...form, room_number: e.target.value })} required maxLength={10} /></Field>
        <Field label="Floor"><Input type="number" min={0} value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} required /></Field>
      </div>
      <Field label="Room type">
        <Select value={form.type_id} onChange={(e) => setForm({ ...form, type_id: e.target.value })} required>
          {types.map((t) => <option key={t.type_id} value={t.type_id}>{t.type_name} ({money(t.base_rate)})</option>)}
        </Select>
      </Field>
      <div className="flex justify-end"><Button type="submit">Save room</Button></div>
    </form>
  );
}

function RoomTypeForm({ initial, onSaved }: { initial: Partial<RoomType>; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ type_name: initial.type_name ?? "", base_rate: String(initial.base_rate ?? "") });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(initial.type_id ? `/api/room-types/${initial.type_id}` : "/api/room-types", { method: initial.type_id ? "PUT" : "POST", body: form });
      toast.success("Room type saved.");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name"><Input value={form.type_name} onChange={(e) => setForm({ ...form, type_name: e.target.value })} required maxLength={50} /></Field>
      <Field label="Base rate per night (₹)" hint="CHECK (base_rate >= 0)"><Input type="number" step="0.01" value={form.base_rate} onChange={(e) => setForm({ ...form, base_rate: e.target.value })} required /></Field>
      <div className="flex justify-end"><Button type="submit">Save type</Button></div>
    </form>
  );
}
