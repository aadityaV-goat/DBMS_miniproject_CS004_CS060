"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";
import { useUser } from "./SessionContext";

// adminOnly links are hidden for STAFF. The middleware blocks those pages
// anyway; hiding them just avoids showing buttons that would be refused.
const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/bookings", label: "Bookings", icon: "🗓️" },
  { href: "/guests", label: "Guests", icon: "🧳" },
  { href: "/rooms", label: "Rooms", icon: "🛏️" },
  { href: "/payments", label: "Payments", icon: "💳" },
  { href: "/services", label: "Services", icon: "🧖" },
  { href: "/graph", label: "Guest insights", icon: "🕸️" },
  { href: "/employees", label: "Employees", icon: "👥", adminOnly: true },
  { href: "/reports", label: "Reports", icon: "📑", adminOnly: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const user = useUser();

  return (
    <aside className="flex w-full flex-col bg-slate-900 text-slate-200 md:fixed md:inset-y-0 md:w-60">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-lg">🌴</span>
        <div className="leading-tight">
          <p className="font-semibold text-white">Resort Manager</p>
          <p className="text-xs text-slate-400">Management System</p>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible">
        {NAV.filter((item) => !item.adminOnly || user.isAdmin).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                active ? "bg-teal-600/20 font-medium text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="hidden border-t border-slate-800 px-5 py-4 md:block">
        <p className="text-sm font-medium text-white">{user.name}</p>
        <p className="mb-2 text-xs text-slate-400">
          {user.username} · {user.role === "ADMIN" ? "Admin" : "Staff"}
        </p>
        <LogoutButton className="!text-slate-400 hover:!text-white" />
      </div>
    </aside>
  );
}
