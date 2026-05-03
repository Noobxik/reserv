import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Server Status – VPN Backup",
  robots: { index: false, follow: false },
};

// Revalidate every 30 seconds
export const revalidate = 30;

interface ServerInfo {
  id: string;
  name: string;
  country: string;
  type: string;
  status: string;
  lastCheckedAt: string;
}

interface StatusData {
  servers: ServerInfo[];
  backupMode: boolean;
  mainDown: boolean;
  reserveAvailable: boolean;
}

async function fetchStatus(): Promise<StatusData | null> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const res = await fetch(`${baseUrl}/api/status`, {
      next: { revalidate: 30 },
      headers: { "Cache-Control": "no-store" },
    });
    if (!res.ok) return null;
    return res.json() as Promise<StatusData>;
  } catch {
    return null;
  }
}

const statusConfig: Record<string, { label: string; dot: string; text: string }> = {
  up:      { label: "Online",  dot: "bg-emerald-500", text: "text-emerald-400" },
  down:    { label: "Offline", dot: "bg-red-500",     text: "text-red-400"     },
  unknown: { label: "Unknown", dot: "bg-slate-500",   text: "text-slate-400"   },
};

export default async function StatusPage() {
  const data = await fetchStatus();

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      {/* Header */}
      <div className="mb-10">
        <a href="/" className="mb-6 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition">
          ← Back
        </a>
        <h1 className="text-2xl font-bold text-slate-100">Server Status</h1>
        <p className="mt-1 text-sm text-slate-400">
          Real-time status of all monitored servers
        </p>
      </div>

      {/* Backup mode banner */}
      {data?.backupMode && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          🔶 Backup mode active — main server is down. Temporary keys are available.
        </div>
      )}

      {!data?.mainDown && data && (
        <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          ✅ All main servers are online.
        </div>
      )}

      {/* Server list */}
      {data ? (
        <div className="space-y-3">
          {data.servers.length === 0 ? (
            <p className="text-center text-sm text-slate-500">No servers configured.</p>
          ) : (
            data.servers.map((s) => {
              const cfg = statusConfig[s.status] ?? statusConfig.unknown;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${cfg.dot} ring-2 ring-offset-1 ring-offset-slate-900 ring-current`}
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        {s.name}
                        <span className="ml-2 text-xs text-slate-500">
                          {s.country}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500 capitalize">
                        {s.type} server
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold ${cfg.text}`}>
                    {cfg.label}
                  </span>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <p className="text-center text-sm text-slate-500">
          Could not load server data.
        </p>
      )}

      {/* Updated timestamp */}
      {data && (
        <p className="mt-8 text-center text-xs text-slate-600">
          Page refreshes every 30 seconds
        </p>
      )}
    </main>
  );
}
