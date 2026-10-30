"use client";
// /bookings/new – New Booking form. Saving calls POST /api/bookings, which runs
// the stored procedure sp_create_booking inside one transaction.
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addDays, api, money, qs, todayISO } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { Button, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { useToast } from "@/components/Toast";

type FreeRoom = { room_id: number; room_number: string; floor: number; type_name: string; base_rate: number; stay_cost: number };
type Service = { service_id: number; service_name: string; price: number };

function NewBookingForm() {
  const router = useRouter();
  const toast = useToast();
  const sp = useSearchParams();

  const [guestId, setGuestId] = useState(sp.get("guest_id") ?? "");
  const [checkIn, setCheckIn] = useState(sp.get("check_in") ?? todayISO());
  const [checkOut, setCheckOut] = useState(sp.get("check_out") ?? addDays(todayISO(), 2));
  const [roomId, setRoomId] = useState(sp.get("room_id") ?? "");
  const [serviceIds, setServiceIds] = useState<number[]>([]);
  const [payNow, setPayNow] = useState("");
  const [payDate, setPayDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const guests = useApi<{ guest_id: number; first_name: string; last_name: string; email: string | null }[]>("/api/guests");
  const services = useApi<Service[]>("/api/services");

  // Only rooms that are free for the chosen dates are offered (NOT EXISTS query).
  const datesValid = checkOut > checkIn;
  const free = useApi<{ rows: FreeRoom[] }>(datesValid ? `/api/rooms/availability${qs({ check_in: checkIn, check_out: checkOut })}` : null);

  // If the dates change and the picked room is no longer free, clear it.
  useEffect(() => {
    if (free.data && roomId && !free.data.rows.some((r) => String(r.room_id) === roomId)) setRoomId("");
  }, [free.data, roomId]);

  const room = free.data?.rows.find((r) => String(r.room_id) === roomId);
  const servicesTotal = useMemo(
    () => (services.data ?? []).filter((s) => serviceIds.includes(s.service_id)).reduce((t, s) => t + s.price, 0),
    [services.data, serviceIds],
  );
  const estimate = (room?.stay_cost ?? 0) + servicesTotal;

  function toggleService(id: number) {
    setServiceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { booking_id } = await api<{ booking_id: number }>("/api/bookings", {
        method: "POST",
        body: {
          guest_id: guestId,
          room_id: roomId,
          check_in: checkIn,
          check_out: checkOut,
          service_ids: serviceIds,
          payment_amount: payNow ? Number(payNow) : null,
          payment_date: payNow ? payDate : null,
        },
      });
      toast.success(`Booking #${booking_id} created.`);
      router.push(`/bookings/${booking_id}`);
    } catch (err) {
      // Whatever failed, the procedure rolled everything back: nothing half-saved.
      toast.error((err as Error).message);
      free.reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card title="1. Guest and dates">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Guest">
              <Select value={guestId} onChange={(e) => setGuestId(e.target.value)} required>
                <option value="">Choose a guest…</option>
                {guests.data?.map((g) => <option key={g.guest_id} value={g.guest_id}>{g.first_name} {g.last_name}</option>)}
              </Select>
            </Field>
            <Field label="Check-in"><Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required /></Field>
            <Field label="Check-out"><Input type="date" value={checkOut} min={addDays(checkIn, 1)} onChange={(e) => setCheckOut(e.target.value)} required /></Field>
          </div>
          {!datesValid && <p className="mt-2 text-sm text-red-700">Check-out must be after check-in.</p>}
        </Card>

        <Card title="2. Room (only rooms free for these dates)">
          {free.loading && datesValid && <p className="text-sm text-slate-400">Checking availability…</p>}
          {free.data && free.data.rows.length === 0 && <p className="text-sm text-amber-700">No rooms are free for these dates.</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            {free.data?.rows.map((r) => (
              <label key={r.room_id} className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm ring-1 ${String(r.room_id) === roomId ? "bg-teal-50 ring-teal-600" : "ring-slate-200 hover:bg-slate-50"}`}>
                <span className="flex items-center gap-2">
                  <input type="radio" name="room" value={r.room_id} checked={String(r.room_id) === roomId} onChange={() => setRoomId(String(r.room_id))} required />
                  <span><b>{r.room_number}</b> · {r.type_name} <span className="text-xs text-slate-400">floor {r.floor}</span></span>
                </span>
                <span className="text-slate-500">{money(r.base_rate)}/night</span>
              </label>
            ))}
          </div>
        </Card>

        <Card title="3. Add-on services (optional)">
          <div className="grid gap-2 sm:grid-cols-2">
            {services.data?.map((s) => (
              <label key={s.service_id} className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm ring-1 ring-slate-200 hover:bg-slate-50">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={serviceIds.includes(s.service_id)} onChange={() => toggleService(s.service_id)} />
                  {s.service_name}
                </span>
                <span className="text-slate-500">{money(s.price)}</span>
              </label>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="4. Payment now (optional)">
          <div className="space-y-3">
            <Field label="Amount (₹)" hint="Can't be more than the total (trigger trg_payment_limit_bi).">
              <Input type="number" min={0} step="0.01" value={payNow} onChange={(e) => setPayNow(e.target.value)} placeholder="0" />
            </Field>
            {payNow && <Field label="Payment date"><Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></Field>}
          </div>
        </Card>

        <Card title="Summary">
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Nights</dt><dd>{datesValid ? Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86400000) : "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Room</dt><dd>{money(room?.stay_cost)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Services</dt><dd>{money(servicesTotal)}</dd></div>
            <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold"><dt>Estimated total</dt><dd>{money(estimate)}</dd></div>
          </dl>
          <Button type="submit" className="mt-4 w-full" disabled={saving || !roomId || !guestId || !datesValid}>
            {saving ? "Saving…" : "Create booking"}
          </Button>
          <p className="mt-2 text-xs text-slate-400">Saved by the stored procedure sp_create_booking as one transaction.</p>
        </Card>
      </div>
    </form>
  );
}

export default function NewBookingPage() {
  return (
    <>
      <PageHeader title="New booking" subtitle="Pick a guest and dates, then a free room." />
      <Suspense>
        <NewBookingForm />
      </Suspense>
    </>
  );
}
