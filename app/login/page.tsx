"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";

function LoginForm() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const redirectTo = searchParams.get("redirect") || "/dashboard";

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setMessage(null);

		const timeoutMs = 15000; // 15s to avoid false timeouts on slow networks
		const startTime = Date.now();

		try {
			const result: any = await Promise.race([
				supabase.auth.signInWithPassword({ email, password }),
				new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), timeoutMs)),
			]);

			const endTime = Date.now();
			console.log(`[Login] Supabase Auth response time: ${endTime - startTime}ms`);
			console.log('[Login] Supabase Auth result:', result);

			const { data, error } = result;
			if (error) {
				console.error('Login error:', error);
				setMessage(error.message || 'Đăng nhập thất bại');
				setLoading(false);
				return;
			}

			if (!data || !data.session || !data.user) {
				console.error('No session or user returned', result);
				setMessage('Đăng nhập thất bại. Vui lòng thử lại.');
				setLoading(false);
				return;
			}

			console.log('✓ Login successful! User:', data.user?.email);
			// small delay for UX
			await new Promise((r) => setTimeout(r, 100));
			setLoading(false);
			router.push(redirectTo);
		} catch (err: any) {
			console.error('Login exception:', err);
			setMessage(err?.message || String(err));
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
					<button
						type="submit"
						className="w-full py-3 px-4 rounded-lg font-semibold transition disabled:opacity-50 hover:opacity-90 disabled:hover:opacity-50 focus:outline-none"
						style={{ background: 'var(--color-primary)', color: 'var(--color-text-inverse)' }}
						disabled={loading}
					>
						{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
					</button>
					{message && <p className="text-red-600 text-sm mt-2">{message}</p>}
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
