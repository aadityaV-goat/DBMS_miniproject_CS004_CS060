"use client";
// /employees – ADMIN only (middleware + API). Employees and their app logins.
import { useState } from "react";
import { api } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Table } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { useUser } from "@/components/SessionContext";

type Employee = {
  employee_id: number; first_name: string; last_name: string; role: string; phone: string | null; email: string | null;
  bookings_handled: number; username: string | null; app_role: "ADMIN" | "STAFF" | null;
};
type AppUser = { user_id: number; username: string; role: "ADMIN" | "STAFF"; employee_id: number; employee_name: string; job_title: string };

export default function EmployeesPage() {
  const toast = useToast();
  const me = useUser();
  const employees = useApi<Employee[]>("/api/employees");
  const users = useApi<AppUser[]>("/api/users");
  const [empForm, setEmpForm] = useState<Partial<Employee> | null>(null);
  const [newLogin, setNewLogin] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);

  const reloadAll = () => { employees.reload(); users.reload(); };

  async function remove(url: string, label: string) {
    if (!confirm(`Delete ${label}?`)) return;
    try {
      await api(url, { method: "DELETE" });
      toast.success(`${label} deleted.`);
      reloadAll();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle="Admin only. Staff logins store a bcrypt hash, never the password."
        actions={
          <>
            <Button variant="secondary" onClick={() => setNewLogin(true)}>+ Create login</Button>
            <Button onClick={() => setEmpForm({})}>+ Add employee</Button>
          </>
        }
      />

      <Card title="Employees" className="mb-6">
        <Table head={["Name", "Job", "Contact", "Bookings handled", "Login", ""]} empty={employees.data?.length === 0}>
          {employees.data?.map((e) => (
            <tr key={e.employee_id}>
              <td className="font-medium">{e.first_name} {e.last_name}</td>
              <td>{e.role}</td>
              <td className="text-slate-600">{e.email ?? "—"}<br /><span className="text-xs text-slate-400">{e.phone}</span></td>
              <td>{e.bookings_handled}</td>
              <td>{e.username ? <span>{e.username} <Badge color={e.app_role === "ADMIN" ? "red" : "blue"}>{e.app_role}</Badge></span> : <span className="text-slate-400">—</span>}</td>
              <td className="whitespace-nowrap text-right">
                <Button size="sm" variant="ghost" onClick={() => setEmpForm(e)}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => remove(`/api/employees/${e.employee_id}`, `${e.first_name} ${e.last_name}`)}>Delete</Button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="App logins">
        <Table head={["Username", "Employee", "Role", ""]} empty={users.data?.length === 0}>
          {users.data?.map((u) => (
            <tr key={u.user_id}>
              <td className="font-medium">{u.username}{u.user_id === me.userId && <span className="ml-1 text-xs text-slate-400">(you)</span>}</td>
              <td>{u.employee_name} <span className="text-xs text-slate-400">{u.job_title}</span></td>
              <td><Badge color={u.role === "ADMIN" ? "red" : "blue"}>{u.role}</Badge></td>
              <td className="whitespace-nowrap text-right">
                <Button size="sm" variant="ghost" onClick={() => setEditUser(u)}>Role / password</Button>
                {u.user_id !== me.userId && <Button size="sm" variant="danger" onClick={() => remove(`/api/users/${u.user_id}`, `login "${u.username}"`)}>Delete</Button>}
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Modal title={empForm?.employee_id ? "Edit employee" : "Add employee"} open={!!empForm} onClose={() => setEmpForm(null)}>
        {empForm && <EmployeeForm initial={empForm} onSaved={() => { setEmpForm(null); reloadAll(); }} />}
      </Modal>
      <Modal title="Create login" open={newLogin} onClose={() => setNewLogin(false)}>
        <NewLoginForm employees={(employees.data ?? []).filter((e) => !e.username)} onSaved={() => { setNewLogin(false); reloadAll(); }} />
      </Modal>
      <Modal title={`Login: ${editUser?.username}`} open={!!editUser} onClose={() => setEditUser(null)}>
        {editUser && <EditLoginForm user={editUser} onSaved={() => { setEditUser(null); reloadAll(); }} />}
      </Modal>
    </>
  );
}

function EmployeeForm({ initial, onSaved }: { initial: Partial<Employee>; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    first_name: initial.first_name ?? "", last_name: initial.last_name ?? "", role: initial.role ?? "",
    phone: initial.phone ?? "", email: initial.email ?? "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(initial.employee_id ? `/api/employees/${initial.employee_id}` : "/api/employees", { method: initial.employee_id ? "PUT" : "POST", body: f });
      toast.success("Employee saved.");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name"><Input value={f.first_name} onChange={set("first_name")} required /></Field>
        <Field label="Last name"><Input value={f.last_name} onChange={set("last_name")} required /></Field>
      </div>
      <Field label="Job title"><Input value={f.role} onChange={set("role")} required placeholder="Receptionist, Chef…" /></Field>
      <Field label="Phone"><Input value={f.phone} onChange={set("phone")} required maxLength={20} /></Field>
      <Field label="Email" hint="Unique"><Input type="email" value={f.email} onChange={set("email")} required maxLength={120} /></Field>
      <div className="flex justify-end"><Button type="submit">Save employee</Button></div>
    </form>
  );
}

function NewLoginForm({ employees, onSaved }: { employees: Employee[]; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ employee_id: "", username: "", password: "", role: "STAFF" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/users", { method: "POST", body: f });
      toast.success(`Login "${f.username}" created.`);
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (employees.length === 0) return <p className="text-sm text-slate-500">Every employee already has a login. Add an employee first.</p>;

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Employee">
        <Select value={f.employee_id} onChange={(e) => setF({ ...f, employee_id: e.target.value })} required>
          <option value="">Choose…</option>
          {employees.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.first_name} {e.last_name} ({e.role})</option>)}
        </Select>
      </Field>
      <Field label="Username"><Input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required minLength={3} autoComplete="off" /></Field>
      <Field label="Password" hint="At least 8 characters. Stored only as a bcrypt hash.">
        <Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={8} autoComplete="new-password" />
      </Field>
      <Field label="Role">
        <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          <option value="STAFF">STAFF (receptionist)</option>
          <option value="ADMIN">ADMIN (manager)</option>
        </Select>
      </Field>
      <div className="flex justify-end"><Button type="submit">Create login</Button></div>
    </form>
  );
}

function EditLoginForm({ user, onSaved }: { user: AppUser; onSaved: () => void }) {
  const toast = useToast();
  const [role, setRole] = useState(user.role);
  const [password, setPassword] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(`/api/users/${user.user_id}`, { method: "PUT", body: { role, password: password || undefined } });
      toast.success("Login updated.");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Role">
        <Select value={role} onChange={(e) => setRole(e.target.value as AppUser["role"])}>
          <option value="STAFF">STAFF</option>
          <option value="ADMIN">ADMIN</option>
        </Select>
      </Field>
      <Field label="New password" hint="Leave empty to keep the current one.">
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete="new-password" />
      </Field>
      <div className="flex justify-end"><Button type="submit">Save</Button></div>
    </form>
  );
}
