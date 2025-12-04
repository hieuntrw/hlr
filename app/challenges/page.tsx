"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar, CheckCircle, Lock, List, User } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";

interface Challenge {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  status: "Open" | "Closed";
  is_locked: boolean;
  created_at?: string;
}

interface ChallengeWithParticipation extends Challenge {
  user_participates?: boolean;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getStatusBadge(challenge: Challenge) {
  const now = new Date();
  const start = new Date(challenge.start_date);
  const end = new Date(challenge.end_date);

  if (now < start) return <span className="px-2 py-1 rounded-full text-sm" style={{ background: "var(--color-info-bg)", color: "var(--color-info)" }}>Sắp diễn ra</span>;
  if (now >= start && now <= end && challenge.status === "Open") return <span className="px-2 py-1 rounded-full text-sm bg-green-100 text-green-800">Đang chạy</span>;
  return <span className="px-2 py-1 rounded-full text-sm" style={{ background: "var(--color-bg-primary)", color: "var(--color-text-secondary)" }}>Đã kết thúc</span>;
}

function ChallengeListItem({ challenge }: { challenge: ChallengeWithParticipation }) {
  return (
    <li>
      <Link href={`/challenges/${challenge.id}`}>
        <div className="w-full flex items-center justify-between p-4 rounded-md hover:shadow-md transition-colors" style={{ background: "var(--color-bg-secondary)" }}>
          <div className="flex-1">
            <h3 className="text-lg font-semibold" style={{ color: "var(--color-primary)" }}>{challenge.title}</h3>
            <div className="text-sm text-[var(--color-text-secondary)] mt-1">
              <span className="inline-flex items-center gap-2 mr-4"><Calendar size={14} /> {formatDate(challenge.start_date)} - {formatDate(challenge.end_date)}</span>
              {challenge.is_locked && <span className="inline-flex items-center gap-1 text-xs text-red-600 font-semibold"><Lock size={12} /> Đã khóa</span>}
            </div>
          </div>

          <div className="ml-4 flex flex-col items-end gap-2">
            {challenge.user_participates && (
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded flex items-center gap-1">
                <CheckCircle size={14} /> Đã tham gia
              </span>
            )}
            <div>{getStatusBadge(challenge)}</div>
          </div>
        </div>
      </Link>
    </li>
  );
}

export default function ChallengesPage() {
  // Temporarily disable pagination by requesting a large page size.
  // This returns the full list for both 'my' and 'all' tabs in most cases.
  const PAGE_SIZE = 10000;
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('my');
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<ChallengeWithParticipation[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  // no auth prompt needed: page requires auth to access

  const currentUser = user?.id || null;

  useEffect(() => {
    if (authLoading) return;
    // reset when tab or user changes
    setPage(0);
    setItems([]);
    setHasMore(false);
    setTotal(null);
    setTotalPages(null);
    
    if (activeTab === 'my' && !currentUser) {
      setLoading(false);
      return;
    }
    fetchPage(0, false);
  }, [activeTab, currentUser, authLoading]);

  async function fetchPage(requestPage = 0, append = false) {
    setLoading(true);
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      const params = new URLSearchParams();
      params.set('page', String(requestPage));
      params.set('pageSize', String(PAGE_SIZE));
      // Do not send an explicit `my=true` parameter. If the user is signed-in
      // we keep `credentials: 'same-origin'` so the server can detect the
      // session and return the personal list without an explicit param.
      const resp = await fetch(`${base}/api/challenges?${params.toString()}`, { credentials: activeTab === 'my' ? 'same-origin' : 'omit' });
      if (!resp.ok) {
        console.error('Failed to fetch challenges', resp.status);
        if (!append) setItems([]);
        setHasMore(false);
        setLoading(false);
        return;
      }

      const json = await resp.json();
      const loaded: ChallengeWithParticipation[] = (json.challenges || []).map((c: any) => ({ ...c, user_participates: activeTab === 'my' }));
      setHasMore(!!json.hasMore);
      setTotal(typeof json.total === 'number' ? json.total : null);
      setTotalPages(typeof json.totalPages === 'number' ? json.totalPages : null);
      setItems(prev => append ? prev.concat(loaded) : loaded);
      setPage(requestPage);
    } catch (e) {
      console.error('Error fetching page', e);
      if (!append) setItems([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  const loadMore = () => fetchPage(page + 1, true);

  const shown = items.length;

  return (
    <div className="min-h-screen bg-[var(--color-bg-secondary)]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {/* Swapped order: show "Thử Thách Của Tôi" first */}
            <button onClick={() => setActiveTab('my')} className={`px-4 py-2 font-semibold rounded ${activeTab === 'my' ? 'text-white' : 'text-[var(--color-text-secondary)]'}`} style={activeTab === 'my' ? { background: 'var(--color-primary)' } : { background: 'transparent' }}>
              <User size={16} className="inline-block mr-2" /> Thử Thách Của Tôi
            </button>
            <button onClick={() => setActiveTab('all')} className={`px-4 py-2 font-semibold rounded ${activeTab === 'all' ? 'text-white' : 'text-[var(--color-text-secondary)]'}`} style={activeTab === 'all' ? { background: 'var(--color-primary)' } : { background: 'transparent' }}>
              <List size={16} className="inline-block mr-2" /> Tất Cả
            </button>
          </div>
          <div className="text-sm text-[var(--color-text-secondary)]">
            {total !== null ? `Hiển thị ${shown} / ${total}` : `Hiển thị ${shown}`}{totalPages ? ` • Trang ${page + 1} / ${totalPages}` : ''}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">Đang tải dữ liệu...</div>
        ) : items.length > 0 ? (
          <div>
            <ul className="space-y-4">
              {items.map(i => <ChallengeListItem key={i.id} challenge={i} />)}
            </ul>
            {/* Pagination temporarily disabled — full list requested via large PAGE_SIZE */}
          </div>
        ) : (
          <div className="rounded-lg p-12 text-center shadow-sm" style={{ background: 'var(--color-bg-secondary)' }}>
            <p className="text-lg text-[var(--color-text-secondary)]">{activeTab === 'my' ? 'Bạn chưa tham gia thử thách nào' : 'Chưa có thử thách'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

