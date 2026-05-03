"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Server {
  id: string;
  name: string;
  country: string;
  type: string;
  status: string;
  uptimeMonitorId: string | null;
  xuiPanelId: string | null;
  xuiInboundId: number | null;
  lastCheckedAt: string;
  createdAt: string;
}

interface Panel {
  id: string;
  name: string;
  baseUrl: string;
  username: string;
  isActive: boolean;
  createdAt: string;
}

interface TempKey {
  id: string;
  serverId: string;
  panelId: string;
  clientEmail: string;
  vlessUri: string;
  revoked: boolean;
  revokedAt: string | null;
  createdAt: string;
  server?: { name: string };
  panel?: { name: string };
}

type Tab = "servers" | "panels" | "keys";

// ── Admin panel shell ─────────────────────────────────────────────────────────

function AdminContent() {
  const searchParams = useSearchParams();
  const showLogin = searchParams.get("login") === "1";

  const [authed, setAuthed] = useState(!showLogin);
  const [tab, setTab] = useState<Tab>("servers");
  const [loginError, setLoginError] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setAuthed(true);
        setPassword("");
      } else {
        const d = await res.json() as { error: string };
        setLoginError(d.error ?? "Invalid password");
      }
    } catch {
      setLoginError("Network error");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    setAuthed(false);
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-slate-100">Admin Login</h1>
            <p className="mt-1 text-sm text-slate-400">VPN Backup Control Panel</p>
          </div>
          <form
            onSubmit={handleLogin}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
          >
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              placeholder="Enter admin password"
              autoFocus
              required
            />
            {loginError && (
              <p className="mt-2 text-xs text-red-400">{loginError}</p>
            )}
            <button
              type="submit"
              disabled={loginLoading}
              className="mt-4 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {loginLoading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold text-slate-200">VPN Admin</span>
            <nav className="flex gap-1">
              {(["servers", "panels", "keys"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                    tab === t
                      ? "bg-slate-700 text-slate-100"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {t}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="text-xs text-slate-500 hover:text-slate-300 transition">
              ← Site
            </a>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {tab === "servers" && <ServersTab />}
        {tab === "panels" && <PanelsTab />}
        {tab === "keys" && <KeysTab />}
      </main>
    </div>
  );
}

// ── Servers tab ───────────────────────────────────────────────────────────────

function ServersTab() {
  const [servers, setServers] = useState<Server[]>([]);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Server | null>(null);
  const empty: Omit<Server, "id" | "status" | "lastCheckedAt" | "createdAt"> = {
    name: "", country: "", type: "main", uptimeMonitorId: "", xuiPanelId: null, xuiInboundId: null,
  };
  const [form, setForm] = useState(empty);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sr, pr] = await Promise.all([
        fetch("/api/admin/servers").then((r) => r.json()) as Promise<Server[]>,
        fetch("/api/admin/panels").then((r) => r.json()) as Promise<Panel[]>,
      ]);
      setServers(sr);
      setPanels(pr);
    } catch {
      setError("Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function startEdit(s: Server) {
    setEditing(s);
    setForm({
      name: s.name, country: s.country, type: s.type,
      uptimeMonitorId: s.uptimeMonitorId ?? "",
      xuiPanelId: s.xuiPanelId ?? null,
      xuiInboundId: s.xuiInboundId ?? null,
    });
    setShowForm(true);
  }

  function startCreate() {
    setEditing(null);
    setForm(empty);
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, xuiInboundId: form.xuiInboundId ? Number(form.xuiInboundId) : null };
    const url = editing ? `/api/admin/servers/${editing.id}` : "/api/admin/servers";
    const method = editing ? "PUT" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setShowForm(false);
    void load();
  }

  async function del(id: string) {
    if (!confirm("Delete this server?")) return;
    await fetch(`/api/admin/servers/${id}`, { method: "DELETE" });
    void load();
  }

  const statusDot: Record<string, string> = {
    up: "bg-emerald-500", down: "bg-red-500", unknown: "bg-slate-500",
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">Servers</h2>
        <button onClick={startCreate} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition">
          + Add Server
        </button>
      </div>

      {error && <p className="mb-4 text-xs text-red-400">{error}</p>}

      {showForm && (
        <form onSubmit={save} className="mb-6 rounded-xl border border-slate-700 bg-slate-900 p-5 space-y-3">
          <h3 className="text-sm font-medium text-slate-200">{editing ? "Edit Server" : "New Server"}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <Field label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Type" value={form.type} onChange={(v) => setForm({ ...form, type: v })} options={[["main", "Main"], ["reserve", "Reserve"]]} />
            <Field label="Uptime Monitor ID/Name" value={form.uptimeMonitorId ?? ""} onChange={(v) => setForm({ ...form, uptimeMonitorId: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Panel (for reserve only)"
              value={form.xuiPanelId ?? ""}
              onChange={(v) => setForm({ ...form, xuiPanelId: v || null })}
              options={[["", "— none —"], ...panels.map((p): [string, string] => [p.id, p.name])]}
            />
            <Field label="Inbound ID" type="number" value={String(form.xuiInboundId ?? "")} onChange={(v) => setForm({ ...form, xuiInboundId: v ? Number(v) : null })} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500">Save</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-700 px-4 py-1.5 text-xs text-slate-400 hover:text-slate-200">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-xs text-slate-500">
                <th className="px-4 py-2.5 text-left">Name</th>
                <th className="px-4 py-2.5 text-left">Country</th>
                <th className="px-4 py-2.5 text-left">Type</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Monitor ID</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {servers.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-600">No servers</td></tr>
              )}
              {servers.map((s) => (
                <tr key={s.id} className="border-b border-slate-800/50 hover:bg-slate-900/30">
                  <td className="px-4 py-2.5 text-slate-200 font-medium">{s.name}</td>
                  <td className="px-4 py-2.5 text-slate-400">{s.country || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-400 capitalize">{s.type}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${statusDot[s.status] ?? "bg-slate-500"}`} />
                      <span className="text-xs text-slate-400 capitalize">{s.status}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{s.uptimeMonitorId || "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => startEdit(s)} className="mr-2 text-xs text-slate-400 hover:text-slate-200">Edit</button>
                    <button onClick={() => del(s.id)} className="text-xs text-red-500 hover:text-red-400">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Panels tab ────────────────────────────────────────────────────────────────

function PanelsTab() {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Panel | null>(null);
  const empty = { name: "", baseUrl: "", username: "", password: "", isActive: true };
  const [form, setForm] = useState(empty);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetch("/api/admin/panels").then((r) => r.json()) as Panel[];
    setPanels(data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  function startEdit(p: Panel) {
    setEditing(p);
    setForm({ name: p.name, baseUrl: p.baseUrl, username: p.username, password: "", isActive: p.isActive });
    setShowForm(true);
  }

  function startCreate() {
    setEditing(null);
    setForm(empty);
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = { name: form.name, baseUrl: form.baseUrl, username: form.username, isActive: form.isActive };
    if (form.password) payload.password = form.password;
    const url = editing ? `/api/admin/panels/${editing.id}` : "/api/admin/panels";
    const method = editing ? "PUT" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setShowForm(false);
    void load();
  }

  async function del(id: string) {
    if (!confirm("Delete this panel?")) return;
    await fetch(`/api/admin/panels/${id}`, { method: "DELETE" });
    void load();
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">3x-ui Panels</h2>
        <button onClick={startCreate} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition">
          + Add Panel
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="mb-6 rounded-xl border border-slate-700 bg-slate-900 p-5 space-y-3">
          <h3 className="text-sm font-medium text-slate-200">{editing ? "Edit Panel" : "New Panel"}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <Field label="Base URL" value={form.baseUrl} onChange={(v) => setForm({ ...form, baseUrl: v })} placeholder="https://panel.example.com:2053" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} required />
            <Field label={editing ? "New Password (leave blank to keep)" : "Password"} type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required={!editing} />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
            Active
          </label>
          <div className="flex gap-2 pt-1">
            <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500">Save</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-700 px-4 py-1.5 text-xs text-slate-400 hover:text-slate-200">Cancel</button>
          </div>
        </form>
      )}

      {loading ? <p className="text-sm text-slate-500">Loading…</p> : (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-xs text-slate-500">
                <th className="px-4 py-2.5 text-left">Name</th>
                <th className="px-4 py-2.5 text-left">Base URL</th>
                <th className="px-4 py-2.5 text-left">Username</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {panels.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-slate-600">No panels</td></tr>
              )}
              {panels.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-900/30">
                  <td className="px-4 py-2.5 text-slate-200 font-medium">{p.name}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{p.baseUrl}</td>
                  <td className="px-4 py-2.5 text-slate-400">{p.username}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium ${p.isActive ? "text-emerald-400" : "text-slate-500"}`}>
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => startEdit(p)} className="mr-2 text-xs text-slate-400 hover:text-slate-200">Edit</button>
                    <button onClick={() => del(p.id)} className="text-xs text-red-500 hover:text-red-400">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Keys tab ──────────────────────────────────────────────────────────────────

function KeysTab() {
  const [keys, setKeys] = useState<TempKey[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetch("/api/admin/keys").then((r) => r.json()) as TempKey[];
    setKeys(data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function revoke(id: string) {
    if (!confirm("Revoke this key? It will be deleted from 3x-ui.")) return;
    await fetch(`/api/admin/keys/${id}`, { method: "DELETE" });
    void load();
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">Issued Keys</h2>
        <button onClick={load} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition">
          Refresh
        </button>
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading…</p> : (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-xs text-slate-500">
                <th className="px-4 py-2.5 text-left">Email</th>
                <th className="px-4 py-2.5 text-left">Server</th>
                <th className="px-4 py-2.5 text-left">Panel</th>
                <th className="px-4 py-2.5 text-left">Created</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-600">No keys issued</td></tr>
              )}
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-slate-800/50 hover:bg-slate-900/30">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-300">{k.clientEmail}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{k.server?.name ?? k.serverId.slice(0, 8)}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{k.panel?.name ?? k.panelId.slice(0, 8)}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{new Date(k.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2.5">
                    {k.revoked
                      ? <span className="text-xs text-slate-500">Revoked</span>
                      : <span className="text-xs font-medium text-emerald-400">Active</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {!k.revoked && (
                      <button onClick={() => revoke(k.id)} className="text-xs text-red-500 hover:text-red-400">Revoke</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Shared form components ────────────────────────────────────────────────────

function Field({
  label, value, onChange, type = "text", placeholder, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
      />
    </div>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-400 text-sm">Loading…</div>}>
      <AdminContent />
    </Suspense>
  );
}
