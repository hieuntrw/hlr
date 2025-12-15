"use client";

import { useState } from "react";

export default function DebugLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Use actual auth endpoint so HttpOnly cookies are set on response
      const res = await fetch(`/api/auth/email-login?redirect=${encodeURIComponent(
        "/profile"
      )}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(body?.error || "Login failed");
      } else {
        setMessage("Login successful — redirecting...");
        setTimeout(() => {
          window.location.href = "/profile";
        }, 800);
      }
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Debug Login (Dev only)</h1>
      <p className="mb-4 text-sm text-gray-600">Enable with <code>ALLOW_DEBUG_LOGIN=1</code> in `.env.local`.</p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full border rounded px-3 py-2"
            type="email"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full border rounded px-3 py-2"
            type="password"
            required
          />
        </div>
        <div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            {loading ? "Signing in..." : "Sign in (debug)"}
          </button>
        </div>
        {message && <div className="text-sm text-gray-700">{message}</div>}
      </form>
    </main>
  );
}
