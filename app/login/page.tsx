"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
	const searchParams = useSearchParams();
	// router removed — navigation uses window.location for login flow
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const redirectTo = searchParams.get("redirect") || "/dashboard";

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setMessage(null);
		try {
			const res = await fetch(`/api/auth/email-login?redirect=${encodeURIComponent(redirectTo)}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({ email, password }),
			});

			let json: unknown = null;
			try { json = await res.json(); } catch { json = null; }

			if (!res.ok) {
				const jRec = json as Record<string, unknown> | null;
				const errMsg = jRec && jRec.error ? String(jRec.error) : `Lỗi đăng nhập (${res.status})`;
				setMessage(errMsg);
				setLoading(false);
				return;
			}

			// Success: server should set HttpOnly cookies on this response. Navigate to redirect.
			// Wait for server-side session to be available (whoami) before navigating.

			// Cache minimal profile in localStorage so AuthContext can detect
			// a logged-in user immediately (helps when server-side whoami
			// reconstruction is delayed or not available during SPA nav).
			try {
				const jRec = json as Record<string, unknown> | null;
				if (jRec && (jRec as Record<string, unknown>)['ok'] && (jRec as Record<string, unknown>)['user']) {
					const u = (jRec as Record<string, unknown>)['user'] as Record<string, unknown>;
					const cached = {
						profile: {
							id: (u['id'] as string) || '',
							full_name: (u['full_name'] as string) || ((u['user_metadata'] as Record<string, unknown> | undefined)?.['fullName'] as string) || null,
							role: (u['role'] as string) || ((u['app_metadata'] as Record<string, unknown> | undefined)?.['role'] as string) || 'member'
						},
						expiresAt: Date.now() + 5 * 60 * 1000
					};
					try { localStorage.setItem('hlr_auth_cache_v1', JSON.stringify(cached)); } catch { }
				}
			} catch {
			}
			// Immediately navigate — AuthContext reads cached profile so UI becomes authenticated
			window.location.href = redirectTo;
		} catch (err: unknown) {
			console.error('Login request failed', err);
			setMessage(err instanceof Error ? err.message : String(err));
			setLoading(false);
		}
	};

	return (
		<main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
			<div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 border border-gray-200">
				<h1 className="text-3xl font-bold mb-2 text-gray-900">Đăng nhập</h1>
				<p className="text-sm text-gray-600 mb-6">Nhập email và mật khẩu thành viên của CLB HLR.</p>
				<form onSubmit={submit} className="space-y-4">
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
						<input
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="mt-1 block w-full border border-gray-300 rounded-lg px-4 py-3  transition"
							type="email"
							required
							placeholder="example@gmail.com"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
						<input
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="mt-1 block w-full border border-gray-300 rounded-lg px-4 py-3  transition"
							type="password"
							required
							placeholder="••••••••"
						/>
					</div>
					{message && <p className="text-red-600 text-sm mb-2">{message}</p>}
					<button
						type="submit"
						className="w-full py-3 px-4 rounded-lg font-semibold transition disabled:opacity-50 hover:opacity-90 disabled:hover:opacity-50 focus:outline-none"
						style={{ background: 'var(--color-primary)', color: 'var(--color-text-inverse)' }}
						disabled={loading}
					>
						{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
					</button>
				</form>
			</div>
		</main>
	);
}
export default function LoginPage() {
	return (
		<Suspense fallback={
			<main className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: "var(--color-primary)" }}></div>
					<p className="text-gray-600">Đang tải...</p>
				</div>
			</main>
		}>
			<LoginForm />
		</Suspense>
	);
}
