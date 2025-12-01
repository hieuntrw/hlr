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

		try {
			console.log("Attempting login with Supabase Auth...");
			
			// Simple: just use Supabase client auth directly
			const { data, error } = await supabase.auth.signInWithPassword({
				email,
				password,
			});

			if (error) {
				console.error("Login error:", error);
				setMessage(error.message);
				setLoading(false);
				return;
			}

			if (!data.session || !data.user) {
				console.error("No session or user returned");
				setMessage("Đăng nhập thất bại. Vui lòng thử lại.");
				setLoading(false);
				return;
			}

			console.log("✓ Login successful!");
			console.log("  User:", data.user.email);
			console.log("  Session:", data.session ? "created" : "missing");
			
			// Redirect to destination
			console.log("Redirecting to:", redirectTo);
			router.push(redirectTo);
		} catch (err: any) {
			console.error("Login exception:", err);
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
							className="mt-1 block w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
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
							className="mt-1 block w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
							type="password"
							required
							placeholder="••••••••"
						/>
					</div>
					<button
						type="submit"
						disabled={loading}
						className="w-full px-4 py-3 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-md"
					>
						{loading ? "Đang đăng nhập..." : "Đăng nhập"}
					</button>
				{message && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{message}</div>}
			</form>

			<p className="text-xs text-gray-500 text-center mt-6">
				Chưa có tài khoản? Liên hệ admin để được cấp quyền truy cập.
			</p>
			</div>
		</main>
	);
}

export default function LoginPage() {
	return (
		<Suspense fallback={
			<main className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
					<p className="text-gray-600">Đang tải...</p>
				</div>
			</main>
		}>
			<LoginForm />
		</Suspense>
	);
}
