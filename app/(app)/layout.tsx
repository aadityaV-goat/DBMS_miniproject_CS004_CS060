// Shared frame for every page after login: sidebar on the left, page on the right.
// "(app)" in the folder name is a route group: it adds this layout without
// adding "/app" to the URLs.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import { SessionProvider } from "@/components/SessionContext";
import { ToastProvider } from "@/components/Toast";
import DeniedNotice from "@/components/DeniedNotice";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login"); // middleware already does this; belt and braces

  return (
    <SessionProvider user={user}>
      <ToastProvider>
        <div className="min-h-screen md:flex">
          <Sidebar />
          <main className="flex-1 p-4 md:ml-60 md:p-8">
            <DeniedNotice />
            {children}
          </main>
        </div>
      </ToastProvider>
    </SessionProvider>
  );
}
