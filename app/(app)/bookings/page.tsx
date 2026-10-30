"use client";
// /bookings – list with filters (date range, guest, room).
import { useState } from "react";
import Link from "next/link";
import { fmtDate, money, qs } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { Badge, Button, Card, Field, Input, LinkButton, PageHeader, Select, Table } from "@/components/ui";

type Row = {
  booking_id: number; guest_id: number; guest_name: string; room_number: string; type_name: string;
  check_in: string; check_out: string; num_nights: number; total_amount: number; amount_paid: number; balance_due: number;
  status: "Upcoming" | "In house" | "Completed";
};

const STATUS_COLOR = { Upcoming: "blue", "In house": "green", Completed: "gray" } as const;

export default function BookingsPage() {
  const [filters, setFilters] = useState({ from: "", to: "", guest_id: "", room_id: "" });
  const set = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFilters({ ...filters, [k]: e.target.value });

  const { data: rows, loading } = useApi<Row[]>(`/api/bookings${qs(filters)}`);
  const guests = useApi<{ guest_id: number; first_name: string; last_name: string }[]>("/api/guests");
  const rooms = useApi<{ rooms: { room_id: number; room_number: string }[] }>("/api/rooms");

  return (
    <>
      <PageHeader title="Bookings" subtitle="Every stay, with its bill from the v_booking_bill view." actions={<LinkButton href="/bookings/new">+ New booking</LinkButton>} />
      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-5">
          <Field label="From"><Input type="date" value={filters.from} onChange={set("from")} /></Field>
          <Field label="To"><Input type="date" value={filters.to} onChange={set("to")} /></Field>
          <Field label="Guest">
            <Select value={filters.guest_id} onChange={set("guest_id")}>
              <option value="">All guests</option>
              {guests.data?.map((g) => <option key={g.guest_id} value={g.guest_id}>{g.first_name} {g.last_name}</option>)}
            </Select>
          </Field>
          <Field label="Room">
            <Select value={filters.room_id} onChange={set("room_id")}>
              <option value="">All rooms</option>
              {rooms.data?.rooms.map((r) => <option key={r.room_id} value={r.room_id}>{r.room_number}</option>)}
            </Select>
          </Field>
          <div className="flex items-end">
            <Button variant="secondary" onClick={() => setFilters({ from: "", to: "", guest_id: "", room_id: "" })}>Clear</Button>
          </div>
        </div>

        <Table head={["#", "Guest", "Room", "Stay", "Status", "Total", "Due"]} empty={!loading && rows?.length === 0}>
          {rows?.map((b) => (
            <tr key={b.booking_id} className="hover:bg-slate-50">
              <td><Link href={`/bookings/${b.booking_id}`} className="font-medium text-teal-700 hover:underline">#{b.booking_id}</Link></td>
              <td><Link href={`/guests/${b.guest_id}`} className="hover:underline">{b.guest_name}</Link></td>
              <td>{b.room_number} <span className="text-xs text-slate-400">{b.type_name}</span></td>
              <td className="whitespace-nowrap">{fmtDate(b.check_in)} → {fmtDate(b.check_out)} <span className="text-xs text-slate-400">({b.num_nights}n)</span></td>
              <td><Badge color={STATUS_COLOR[b.status]}>{b.status}</Badge></td>
              <td>{money(b.total_amount)}</td>
              <td>{b.balance_due > 0 ? <Badge color="amber">{money(b.balance_due)}</Badge> : b.balance_due < 0 ? <Badge color="blue">Refund</Badge> : <Badge color="green">Paid</Badge>}</td>
            </tr>
          ))}
        </Table>
        {loading && <p className="py-4 text-sm text-slate-400">Loading…</p>}
      </Card>
    </>
  );
}
