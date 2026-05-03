"use client";

import { useState } from "react";

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "success"; key: string; keyId: string; limitGiB: number; note: string }
  | { phase: "unavailable"; message: string }
  | { phase: "error"; message: string };

export default function HomePage() {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [copied, setCopied] = useState(false);

  async function requestKey() {
    setState({ phase: "loading" });
    try {
      const res = await fetch("/api/issue-temp-key", {
        method: "POST",
        headers: { "Cache-Control": "no-store" },
      });
      const data: Record<string, string | number> = await res.json();

      if (!res.ok) {
        if (res.status === 400) {
          setState({ phase: "unavailable", message: String(data.error) });
        } else {
          setState({ phase: "error", message: String(data.error ?? "Unknown error") });
        }
        return;
      }

      setState({
        phase: "success",
        key: String(data.key),
        keyId: String(data.keyId),
        limitGiB: Number(data.limitGiB),
        note: String(data.note),
      });
    } catch {
      setState({ phase: "error", message: "Network error. Please try again." });
    }
  }

  async function copyKey(key: string) {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
            <ShieldIcon />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">
            VPN Backup
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Temporary access key while the main server is unavailable
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          {state.phase === "idle" && (
            <>
              <p className="mb-6 text-center text-sm text-slate-400">
                If the main server is down, click the button below to receive a
                temporary VLESS key (1.5 GiB limit). The key will be
                automatically revoked when the main server is restored.
              </p>
              <button
                onClick={requestKey}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                Get Temporary Key
              </button>
            </>
          )}

          {state.phase === "loading" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <SpinnerIcon />
              <p className="text-sm text-slate-400">Generating your key…</p>
            </div>
          )}

          {state.phase === "unavailable" && (
            <div className="text-center">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/10">
                <CheckCircleIcon className="h-5 w-5 text-sky-400" />
              </div>
              <p className="font-medium text-slate-200">Main server is online</p>
              <p className="mt-1 text-sm text-slate-400">{state.message}</p>
              <button
                onClick={() => setState({ phase: "idle" })}
                className="mt-5 text-xs text-slate-500 underline underline-offset-2 hover:text-slate-300"
              >
                Check again
              </button>
            </div>
          )}

          {state.phase === "error" && (
            <div className="text-center">
              <p className="font-medium text-red-400">Something went wrong</p>
              <p className="mt-1 text-sm text-slate-400">{state.message}</p>
              <button
                onClick={() => setState({ phase: "idle" })}
                className="mt-5 text-xs text-slate-500 underline underline-offset-2 hover:text-slate-300"
              >
                Try again
              </button>
            </div>
          )}

          {state.phase === "success" && (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10">
                  <KeyIcon />
                </div>
                <span className="text-sm font-medium text-emerald-400">
                  Key issued successfully
                </span>
              </div>

              <div className="mb-3 rounded-lg bg-slate-800 p-3">
                <p className="break-all font-mono text-xs text-slate-200">
                  {state.key}
                </p>
              </div>

              <button
                onClick={() => copyKey(state.key)}
                className="mb-4 w-full rounded-xl border border-slate-700 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
              >
                {copied ? "✓ Copied!" : "Copy Key"}
              </button>

              <div className="rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs text-amber-300">
                <strong>⚠ Important:</strong> {state.note}
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <span>Limit: {state.limitGiB} GiB</span>
                <span>·</span>
                <span>ID: {state.keyId.slice(0, 8)}…</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer links */}
        <div className="mt-6 flex justify-center gap-6 text-xs text-slate-600">
          <a href="/status" className="hover:text-slate-400 transition">
            Server Status
          </a>
        </div>
      </div>
    </main>
  );
}

// ── Inline icons ─────────────────────────────────────────────────────────────

function ShieldIcon() {
  return (
    <svg className="h-7 w-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="h-8 w-8 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
    </svg>
  );
}
