"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import Image from "next/image";

interface Challenge {
  id: string;
  title: string;
  description?: string | null;
  start_date: string;
  end_date: string;
  status: "Open" | "Closed";
  is_locked?: boolean;
  min_pace_seconds: number;
  max_pace_seconds: number;
  target_km_options?: number[];
}

interface Participant {
  user_id: string;
  target_km: number;
  actual_km: number;
  avg_pace_seconds?: number | null;
  total_activities?: number | null;
  status?: string | null;
  profile?: { full_name?: string | null; avatar_url?: string | null } | null;
}

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("vi-VN");
  } catch {
    return d;
  }
}
function formatPace(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}/km`;
}

function getChallengeStatus(start?: string, end?: string) {
  try {
    const now = new Date();
    const s = start ? new Date(start) : null;
    const e = end ? new Date(end) : null;
    if (e && !isNaN(e.getTime()) && e.getTime() < now.getTime()) return 'Đã diễn ra';
    if (s && !isNaN(s.getTime()) && s.getTime() > now.getTime()) return 'Chưa diễn ra';
    return 'Đang diễn ra';
  } catch {
    return '—';
  }
}

export default function ChallengePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { sessionChecked, user } = useAuth();
  const [creatorProfile, setCreatorProfile] = useState<{ full_name?: string | null } | null>(null);

  
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const chRes = await fetch(`/api/challenges/${id}`, { credentials: 'same-origin', cache: 'no-store' });
        if (!chRes.ok) throw new Error(`Failed to load challenge (${chRes.status})`);
        const chJson = await chRes.json().catch(() => null);
        const ch = chJson?.challenge ?? null;
        if (mounted) setChallenge(ch);

        const pRes = await fetch(`/api/challenges/${id}/participants`, { credentials: 'same-origin', cache: 'no-store' });
        if (!pRes.ok) throw new Error(`Failed to load participants (${pRes.status})`);
        const pJson = await pRes.json().catch(() => null);
        const parts = (pJson?.participants || []) as Participant[];
        if (mounted) setParticipants(parts);
          // fetch creator profile if challenge has created_by
          try {
            const createdBy = ch?.created_by;
            if (createdBy && mounted) {
              fetch(`/api/profiles/${createdBy}`, { credentials: 'same-origin' })
                .then((r) => r.ok ? r.json().catch(() => null) : null)
                .then((json) => {
                  if (!mounted) return;
                  const cp = json?.profile ?? null;
                  setCreatorProfile(cp);
                })
                .catch(() => {});
            }
          } catch {}
      } catch (err: unknown) {
        console.error('[challenge.page] fetch error', String(err));
        if (mounted) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    // ensure server-side session reconstruction (if any) has been attempted
    if (sessionChecked) fetchData();

    return () => { mounted = false; };
  }, [id, sessionChecked]);

  // derived values (keep only those used in the UI)

  const userParticipation = useMemo(() => participants.find(pp => pp.user_id === user?.id) ?? null, [participants, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ background: "var(--color-bg-secondary)" }}>
        <div className="text-center">
          <p style={{ color: "var(--color-text-secondary)" }}>Đang tải dữ liệu thử thách…</p>
            <div>
              <span className="font-semibold">Người tạo:</span>{' '}
              <span>{creatorProfile?.full_name ?? '—'}</span>
            </div>

        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ background: "var(--color-bg-secondary)" }}>
        <div className="text-center">
          <p className="text-red-600">Lỗi: {error}</p>
          <Link href="/challenges" className="mt-4 inline-block hover:underline" style={{ color: "var(--color-primary)" }}>
            ← Quay lại danh sách thử thách
          </Link>
        </div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ background: "var(--color-bg-secondary)" }}>
        <div className="text-center">
          <p>Không tìm thấy thử thách</p>
          <Link href="/challenges" className="mt-4 inline-block hover:underline" style={{ color: "var(--color-primary)" }}>
            ← Quay lại danh sách thử thách
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg-secondary)" }}>
      <div className="py-8 px-4 gradient-theme-primary">
        <div className="max-w-7xl mx-auto">
          <div>
            <Link href="/challenges" className="mb-4 inline-block hover:opacity-80" style={{ color: "var(--color-text-inverse)" }}>
              ← Quay lại
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold mb-2" style={{ color: "var(--color-text-inverse)" }}>{challenge.title}</h1>
            <p style={{ color: "var(--color-text-inverse)", opacity: 0.9 }}>
            {formatDate(challenge.start_date)} - {formatDate(challenge.end_date)}
          </p>

          {/* Compact info row under title: small black text */}
          <div className="mt-3 text-sm text-black flex flex-wrap gap-4">
            <div>
              <span className="font-semibold">Người tạo:</span>{' '}
              <span>{creatorProfile?.full_name ?? '—'}</span>
            </div>
            <div>
              <span className="font-semibold">Trạng thái:</span>{' '}
              <span>{getChallengeStatus(challenge.start_date, challenge.end_date)}</span>
            </div>
            <div>
              <span className="font-semibold">Pace yêu cầu:</span>{' '}
              <span>{formatPace(challenge.min_pace_seconds)} - {formatPace(challenge.max_pace_seconds)}</span>
            </div>
            <div>
              <span className="font-semibold">Mục tiêu:</span>{' '}
              <span>{userParticipation ? `${userParticipation.target_km} km` : '—'}</span>
            </div>
            <div>
              <span className="font-semibold">Đã thực hiện:</span>{' '}
              <span>{userParticipation ? `${userParticipation.actual_km ?? 0} km` : '—'}</span>
            </div>
            <div>
              <span className="font-semibold">Hoạt động hợp lệ:</span>{' '}
              <span>{userParticipation ? `${userParticipation.total_activities ?? 0}` : '—'}</span>
            </div>
            <div>
              <span className="font-semibold">Pace trung bình:</span>{' '}
              <span>{userParticipation && userParticipation.avg_pace_seconds ? formatPace(userParticipation.avg_pace_seconds) : '—'}</span>
            </div>
            <div>
              <span className="font-semibold">% Hoàn thành:</span>{' '}
              <span>{userParticipation && userParticipation.target_km ? `${Math.round(((userParticipation.actual_km ?? 0) / userParticipation.target_km) * 10000) / 100}%` : '—'}</span>
            </div>
            <div>
              {user && userParticipation && challenge?.is_locked && (
                <div
                  className="ml-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-gray-600"
                  title="Thử thách đã khoá — không thể thực hiện thao tác này."
                >
                  <span className="text-sm">🔒</span>
                  <span>Thử thách đã khoá</span>
                </div>
              )}
            </div>
          </div>
            
          </div>

      
          
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-2xl font-bold mb-4">📊 Bảng Xếp Hạng</h3>
              {participants.length === 0 ? (
                <p className="text-gray-500">Chưa có thành viên tham gia.</p>
              ) : (
                <div className="overflow-hidden rounded-md border">
                  <div className="grid grid-cols-12 items-center text-sm text-gray-600 px-4 py-2 border-b">
                    <div className="col-span-1 font-semibold">#</div>
                    <div className="col-span-4 font-semibold">Thành viên</div>
                    <div className="col-span-3 text-right font-semibold">KM</div>
                    <div className="col-span-2 text-right font-semibold">Pace</div>
                    <div className="col-span-2 text-right font-semibold">Tỉ lệ %</div>
                  </div>

                  <div>
                    {participants
                      .slice()
                      .sort((a, b) => (b.actual_km || 0) - (a.actual_km || 0))
                      .map((p, idx) => {
                        const rank = idx + 1;
                        const percent = p.target_km ? Math.min(100, Math.round(((p.actual_km || 0) / p.target_km) * 100)) : 0;
                        const percentColor = percent >= 100 ? 'text-green-600' : 'text-red-600';
                        const rankBg = rank === 1 ? 'bg-yellow-300' : rank === 2 ? 'bg-gray-300' : rank === 3 ? 'bg-orange-200' : 'bg-gray-100';
                        const rankText = rank <= 3 ? (rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉') : String(rank);
                        return (
                          <div key={p.user_id} className="grid grid-cols-12 items-center gap-3 py-3 px-4 border-b last:border-b-0">
                            <div className="col-span-1 flex items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${rankBg}`}>{rankText}</div>
                            </div>

                            <div className="col-span-4 flex items-center gap-3">
                              <Image src={p.profile?.avatar_url || '/media/avatars/placeholder-avatar.png'} alt="avatar" width={40} height={40} className="w-10 h-10 rounded-full object-cover" />
                              <div>
                                <div className="font-medium">{p.profile?.full_name ?? p.user_id}</div>
                              </div>
                            </div>

                            <div className="col-span-3 text-right">
                              <div className="font-bold text-[var(--color-primary)]">{p.actual_km ?? 0} km</div>
                              <div className="text-xs text-gray-500">Mục tiêu: {p.target_km} km</div>
                            </div>
                            <div className="col-span-2 text-right text-sm text-gray-700">{p.avg_pace_seconds ? `${Math.floor((p.avg_pace_seconds || 0) / 60)}:${String((p.avg_pace_seconds || 0) % 60).padStart(2, '0')}/km` : '—'}</div>

                            <div className="col-span-2 text-right flex flex-col items-end">
                              <div className={`text-sm font-semibold ${percentColor}`}>{percent}%</div>
                              <div className="mt-2 w-full max-w-[160px] h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div className={`${percent >= 100 ? 'bg-green-500' : 'bg-red-400'} h-2`} style={{ width: `${percent}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
