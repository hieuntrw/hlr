"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-client";
import { Calendar, CheckCircle, Clock, PlayCircle, XCircle, Lock, Flag, List, User } from "lucide-react";
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

  if (now < start) {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold" style={{ background: "var(--color-info-bg, #DBEAFE)", color: "var(--color-info, #1E40AF)" }}>
        <span className="w-2 h-2 rounded-full" style={{ background: "var(--color-info, #2563EB)" }}></span>
        Sắp diễn ra
      </span>
    );
  } else if (now >= start && now <= end && challenge.status === "Open") {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
        <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></span>
        Đang chạy
      </span>
    );
  } else {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold" style={{ background: "var(--color-bg-primary)", color: "var(--color-text-secondary)" }}>
        <span className="w-2 h-2 rounded-full" style={{ background: "var(--color-text-secondary)" }}></span>
        Đã kết thúc
      </span>
    );
  }
}

function ChallengeCard({ challenge }: { challenge: ChallengeWithParticipation }) {
  return (
    <Link href={`/challenges/${challenge.id}`}>
      <div className="rounded-xl shadow-md hover:shadow-xl transition-all overflow-hidden cursor-pointer border-l-4" style={{ background: "var(--color-bg-secondary)", borderLeftColor: "var(--color-primary)" }}>
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-xl font-bold flex-1" style={{ color: "var(--color-primary)" }}>{challenge.title}</h3>
            {challenge.user_participates && (
              <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded flex items-center gap-1">
                <CheckCircle size={14} />
                Đã tham gia
              </span>
            )}
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex items-center gap-2" style={{ color: "var(--color-text-secondary)" }}>
              <Calendar size={18} />
              <span className="text-sm">
                {formatDate(challenge.start_date)} - {formatDate(challenge.end_date)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {getStatusBadge(challenge)}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
            <span className="text-sm font-medium" style={{ color: "var(--color-accent)" }}>Chi tiết →</span>
            {challenge.is_locked && (
              <span className="text-xs text-red-600 font-semibold flex items-center gap-1">
                <Lock size={12} /> Đã khóa
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function ChallengesPage() {
  const [activeTab, setActiveTab] = useState<"my" | "all">("my");
  const [challenges, setChallenges] = useState<ChallengeWithParticipation[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isLoading: authLoading } = useAuth(); // Use auth context
  const currentUser = user?.id || null;

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;
    
    if (currentUser) {
      fetchChallenges();
    } else if (!user) {
      // No user logged in
      setLoading(false);
    }
  }, [activeTab, currentUser, user, authLoading]);

  async function fetchChallenges() {
    setLoading(true);

    try {
      let query = supabase
        .from("challenges")
        .select("id, title, start_date, end_date, status, is_locked, created_at")
        .order("start_date", { ascending: false });

      const { data: allChallenges, error } = await query;

      if (error) {
        console.error("Error fetching challenges:", error);
        setChallenges([]);
        return;
      }

      if (!allChallenges) {
        setChallenges([]);
        return;
      }

      if (activeTab === "my" && currentUser) {
        // Fetch user's participations
        const { data: participations, error: partError } = await supabase
          .from("challenge_participants")
          .select("challenge_id")
          .eq("user_id", currentUser);

        if (partError) {
          console.error("Error fetching participations:", partError);
          setChallenges([]);
          return;
        }

        const userChallengeIds = participations?.map((p) => p.challenge_id) || [];
        const filtered = allChallenges
          .filter((c) => userChallengeIds.includes(c.id))
          .map((c) => ({
            ...c,
            user_participates: true,
          }));

        setChallenges(filtered);
      } else {
        // All challenges
        const enhanced = allChallenges.map((c) => ({
          ...c,
          user_participates: false,
        }));
        setChallenges(enhanced);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setChallenges([]);
    } finally {
      setLoading(false);
    }
  }

  const displayChallenges = challenges;

  return (
    <div>
      <div className="min-h-screen bg-[var(--color-bg-secondary)]">
        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Tabs */}
          <div className="flex gap-2 mb-8" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <button
              onClick={() => setActiveTab("all")}
              className="px-6 py-3 font-semibold transition-all border-b-2 flex items-center gap-2"
              style={activeTab === "all" ? {
                color: "var(--color-primary)",
                borderBottomColor: "var(--color-primary)"
              } : {
                color: "var(--color-text-secondary)",
                borderBottomColor: "transparent"
              }}
            >
              <List size={20} />
              Tất Cả Thử Thách
            </button>
            <button
              onClick={() => setActiveTab("my")}
              className="px-6 py-3 font-semibold transition-all border-b-2 flex items-center gap-2"
              style={activeTab === "my" ? {
                color: "var(--color-primary)",
                borderBottomColor: "var(--color-primary)"
              } : {
                color: "var(--color-text-secondary)",
                borderBottomColor: "transparent"
              }}
            >
              <User size={20} />
              Thử Thách Của Tôi
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderBottomColor: "var(--color-primary)" }}></div>
                <p style={{ color: "var(--color-text-secondary)" }}>Đang tải dữ liệu...</p>
              </div>
            </div>
          ) : displayChallenges.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayChallenges.map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg p-12 text-center shadow-sm" style={{ background: "var(--color-bg-secondary)" }}>
              <p className="text-lg" style={{ color: "var(--color-text-secondary)" }}>
                {activeTab === "my" ? "Bạn chưa tham gia thử thách nào" : "Chưa có thử thách"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
