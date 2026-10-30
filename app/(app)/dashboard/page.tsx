"use client";
// /dashboard – KPI cards, revenue by month, revenue by room type (GROUP BY),
// services used more than once (HAVING), and arrivals in the next 7 days.
import Link from "next/link";
import { fmtDate, money, todayISO } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { Card, LinkButton, PageHeader, SqlBox, Stat, Table } from "@/components/ui";
import BarChart from "@/components/BarChart";

type Dashboard = {
  kpis: {
    total_guests: number; total_rooms: number; rooms_occupied_today: number;
    upcoming_checkins: number; revenue_this_month: number; outstanding: number;
  };
  revenueByMonth: { month: string; revenue: number; payments: number }[];
  revenueByRoomType: { type_name: string; bookings: number; nights: number; revenue: number }[];
  popularServices: { service_name: string; times_used: number; revenue: number }[];
  upcoming: { booking_id: number; guest_id: number; guest_name: string; room_number: string; check_in: string; num_nights: number }[];
  sql: Record<"kpis" | "revenueByMonth" | "revenueByRoomType" | "popularServices", string>;
};

// '2026-08' → 'Aug 26'
const monthLabel = (m: string) =>
  new Date(m + "-01T00:00:00Z").toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });

export default function DashboardPage() {
  const { data, error } = useApi<Dashboard>("/api/dashboard");

  if (error) return <p className="text-red-700">{error}</p>;
  if (!data) return <p className="text-slate-400">Loading…</p>;
  const k = data.kpis;
  const occupancy = k.total_rooms ? Math.round((k.rooms_occupied_today / k.total_rooms) * 100) : 0;

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Today is ${fmtDate(todayISO())}.`} actions={<LinkButton href="/bookings/new">+ New booking</LinkButton>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total guests" value={k.total_guests} />
        <Stat label="Rooms occupied today" value={`${k.rooms_occupied_today} / ${k.total_rooms}`} hint={`${occupancy}% occupancy`} />
        <Stat label="Check-ins in the next 7 days" value={k.upcoming_checkins} />
        <Stat label="Revenue this month" value={money(k.revenue_this_month)} hint={`${money(k.outstanding)} still outstanding`} />
      </div>
      <SqlBox sql={data.sql.kpis} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Revenue by month (payments received)">
          <BarChart
            label="Column chart of payments received per month"
            data={data.revenueByMonth.map((r) => ({ label: monthLabel(r.month), value: r.revenue, detail: `${r.payments} payment(s)` }))}
            format={money}
          />
          <SqlBox sql={data.sql.revenueByMonth} />
        </Card>

        <Card title="Revenue by room type (billed)">
          <BarChart
            orientation="horizontal"
            label="Bar chart of billed revenue per room type"
            data={data.revenueByRoomType.map((r) => ({ label: r.type_name, value: r.revenue, detail: `${r.bookings} booking(s), ${r.nights} nights` }))}
            format={money}
          />
          <SqlBox sql={data.sql.revenueByRoomType} />
        </Card>

        <Card title="Services used more than once">
          <Table head={["Service", "Times used", "Revenue"]} empty={data.popularServices.length === 0}>
            {data.popularServices.map((s) => (
              <tr key={s.service_name}>
                <td>{s.service_name}</td>
                <td>{s.times_used}</td>
                <td>{money(s.revenue)}</td>
              </tr>
            ))}
          </Table>
          <SqlBox sql={data.sql.popularServices} />
        </Card>

        <Card title="Arrivals in the next 7 days">
          <Table head={["Date", "Guest", "Room", "Nights"]} empty={data.upcoming.length === 0}>
            {data.upcoming.map((u) => (
              <tr key={u.booking_id}>
                <td className="whitespace-nowrap">{fmtDate(u.check_in)}</td>
                <td><Link href={`/bookings/${u.booking_id}`} className="text-teal-700 hover:underline">{u.guest_name}</Link></td>
                <td>{u.room_number}</td>
                <td>{u.num_nights}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  );
}
