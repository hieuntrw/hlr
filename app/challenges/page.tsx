"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-client";

interface Challenge {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  password?: string;
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

function getStatusBadge(status: "Open" | "Closed") {
  if (status === "Open") {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
        <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></span>
        Đang diễn ra
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-semibold">
      <span className="w-2 h-2 bg-gray-600 rounded-full"></span>
      Đã đóng
    </span>
  );
}

function ChallengeCard({ challenge }: { challenge: ChallengeWithParticipation }) {
  return (
    <Link href={`/challenges/${challenge.id}`}>
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden cursor-pointer border-l-4 border-blue-500">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900 flex-1">{challenge.title}</h3>
            {challenge.user_participates && (
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                ✓ Đã tham gia
              </span>
            )}
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex items-center gap-2 text-gray-600">
              <span className="text-lg">📅</span>
              <span>
                {formatDate(challenge.start_date)} - {formatDate(challenge.end_date)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {getStatusBadge(challenge.status)}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <span className="text-sm text-gray-500">Chi tiết →</span>
            {challenge.is_locked && (
              <span className="text-xs text-red-600 font-semibold">🔒 Khoá</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function ChallengesPage() {
  const [activeTab, setActiveTab] = useState<"my" | "all">("all");
  const [challenges, setChallenges] = useState<ChallengeWithParticipation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchChallenges();
    }
  }, [activeTab, currentUser]);

  async function fetchCurrentUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUser(user?.id || null);
  }

  async function fetchChallenges() {
    setLoading(true);

    try {
      let query = supabase
        .from("challenges")
        .select("id, title, start_date, end_date, password, status, is_locked, created_at")
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-2">🏃 Danh Sách Thử Thách</h1>
          <p className="text-blue-100 text-lg">Tham gia các thử thách hàng tháng và hoàn thành mục tiêu</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-gray-300">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-6 py-3 font-semibold transition-all border-b-2 ${
              activeTab === "all"
                ? "text-blue-600 border-blue-600"
                : "text-gray-600 border-transparent hover:text-gray-900"
            }`}
          >
            📋 Tất Cả Thử Thách
          </button>
          <button
            onClick={() => setActiveTab("my")}
            className={`px-6 py-3 font-semibold transition-all border-b-2 ${
              activeTab === "my"
                ? "text-blue-600 border-blue-600"
                : "text-gray-600 border-transparent hover:text-gray-900"
            }`}
          >
            ✓ Đã Tham Gia
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Đang tải dữ liệu...</p>
            </div>
          </div>
        ) : displayChallenges.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayChallenges.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg p-12 text-center shadow-sm">
            <p className="text-gray-500 text-lg">
              {activeTab === "my" ? "Bạn chưa tham gia thử thách nào" : "Chưa có thử thách"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
