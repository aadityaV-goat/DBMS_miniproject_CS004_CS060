// Temporary page used until Phase 4 builds the real screens.
import { getSession } from "@/lib/auth";
import LogoutButton from "./LogoutButton";

export default async function PlaceholderPage({ title }: { title: string }) {
  const user = await getSession();
  return (
    <main className="mx-auto max-w-xl p-10">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-slate-600">
        Logged in as <b>{user?.name}</b> ({user?.username}, role <b>{user?.role}</b>).
      </p>
      <p className="mt-1 text-sm text-slate-500">This page is built in Phase 4.</p>
      <LogoutButton className="mt-6" />
    </main>
  );
}
