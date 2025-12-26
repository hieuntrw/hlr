"use client";

import { useState, useEffect, useRef } from "react";
import { Activity, Calendar, MapPin, Medal, Star, User, Lightbulb } from "lucide-react";
import PRIcon from '@/components/PRIcon';
import Image from "next/image";


interface Race {
  id: string;
  name: string;
  race_date: string;
  location: string;
  image_url?: string;
  participant_count?: number;
  distances?: string[]; // e.g. ["5km","10km","21km","42km"]
}

interface RaceResult {
  id: string;
  user_id: string;
  distance: string;
  chip_time_seconds: number;
  podium_config_id?: string | null;
  is_pr: boolean;
  profile?: {
    full_name: string;
    avatar_url?: string | null;
  };
}

interface RewardDefinition {
  id: string;
  category: string;
  type: string;
  condition_value: number;
  condition_label: string;
  prize_description: string;
  cash_amount: number;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

function formatCash(amount: number): string {
  if (amount === 0) return "Huy chương";
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}tr`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}k`;
  }
  return `${amount}`;
}

function RaceCard({ race, onClick }: { race: Race; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
      style={{ background: "var(--color-bg-secondary)", boxShadow: "var(--shadow-md)" }}
    >
      {race.image_url && (
        <div className="w-full h-40 overflow-hidden bg-gray-200 flex items-center justify-center">
          <Image
            src={race.image_url}
            alt={race.name}
            width={1200}
            height={160}
            className="object-cover hover:scale-105 transition-transform"
            style={{ width: 'auto', height: '160px', display: 'block' }}
          />
        </div>
      )}

      <div className="p-4">
        <h3 className="text-lg font-bold mb-3" style={{ color: "var(--color-text-primary)" }}>{race.name}</h3>

        <div className="space-y-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
          <p className="flex items-center gap-2">
            <Calendar size={20} className="text-gray-600" />
            <span>{formatDate(race.race_date)}</span>
          </p>
          <p className="flex items-center gap-2">
            <MapPin size={20} className="text-gray-600" />
            <span>{race.location || "Chưa có thông tin"}</span>
          </p>
          <p className="flex items-center gap-2">
            <User size={18} className="text-gray-600" />
            <span>{(race.participant_count ?? 0) + ' thành viên'}</span>
          </p>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>Chi tiết →</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RacesPage() {
  const [races, setRaces] = useState<Race[]>([]);
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [raceResults, setRaceResults] = useState<RaceResult[]>([]);
  const [rewards, setRewards] = useState<RewardDefinition[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedDistance, setSelectedDistance] = useState<string>('');
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  useEffect(() => {
    fetchRaces();
  }, []);

  // (removed unused withTimeout helper — using fetch with timeouts instead)

  const fetchTokenRef = useRef<number | null>(null);
  const isFetchingRef = useRef(false);

  async function fetchRaces() {
    // Prevent concurrent fetches
    if (isFetchingRef.current) return;

    setLoading(true);
    setFetchError(null);
    const currentToken = (fetchTokenRef.current = (fetchTokenRef.current || 0) + 1);
    isFetchingRef.current = true;

    const maxAttempts = 2;
    const baseTimeout = 15000;
    let lastError: unknown = null;

    try {
      console.log('[Races] fetchRaces start token=', currentToken, 'time=', Date.now());
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const timeoutMs = baseTimeout * attempt; // increase on retry
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          const res = await fetch('/api/races', { signal: controller.signal });
          clearTimeout(timer);
          if (!res.ok) {
            const txt = await res.text().catch(() => '');
            lastError = new Error(txt || 'Failed to fetch races');
            console.warn('[Races] fetch attempt error', { attempt, error: lastError });
            if (attempt < maxAttempts) {
              await new Promise((r) => setTimeout(r, 500 * attempt));
              continue;
            }
            setFetchError(
              (((lastError as unknown) as { message?: unknown }).message
                ? String(((lastError as unknown) as { message?: unknown }).message)
                : String(lastError))
            );
            return;
          }

          const data = await res.json().catch(() => []);
          if (currentToken !== fetchTokenRef.current) {
            console.warn('[Races] stale fetch result ignored token=', currentToken);
            return; // ignore stale result
          }

          setRaces(data || []);
          lastError = null;
          return;
        } catch (e) {
          lastError = e;
          console.warn('[Races] fetch attempt threw', { attempt, error: e });
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 500 * attempt));
            continue;
          }
          setFetchError(e instanceof Error ? e.message : String(e));
          return;
        }
      }
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      if (lastError) console.error('[Races] final fetch error', lastError);
    }
  }

  async function handleSelectRace(race: Race) {
    setSelectedRace(race);
    setResultsLoading(true);

    try {
      // Fetch race results and rewards via server APIs (service-role)
      try {
        const [resResults] = await Promise.all([
          fetch(`/api/races/${encodeURIComponent(race.id)}/results`, { credentials: 'same-origin' }),
  
        ]);

        if (!resResults.ok) {
          console.error('[Races] failed to fetch results', await resResults.text().catch(() => null));
        } else {
          const jr = await resResults.json().catch(() => null);
          const resultsData = jr?.data ?? [];
          const formatted = (Array.isArray(resultsData) ? resultsData : []).map((rec: Record<string, unknown>) => ({
            id: String(rec.id ?? ''),
            user_id: String(rec.user_id ?? ''),
            distance: String(rec.distance ?? ''),
            chip_time_seconds: Number(rec.chip_time_seconds ?? 0),
            podium_config_id: rec.podium_config_id ?? undefined,
            is_pr: Boolean(rec.is_pr),
            profile: rec.profiles ?? undefined,
          } as RaceResult));
          setRaceResults(formatted);
        }
      } catch (e) {
        console.error('Unexpected error fetching race data via API', e);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
    } finally {
      setResultsLoading(false);
    }
    // reset register UI state when selecting a race
    setSelectedDistance('');
    setRegisterError(null);
    setRegisterSuccess(false);
  }
  
  // Note: card-level quick-register removed; use detail view for registration

  useEffect(() => {
    // fetch current user's id to allow hiding register button
    let mounted = true;
    (async () => {
      try {
        const resp = await fetch('/api/profiles/me', { credentials: 'same-origin' });
        if (!resp.ok) return;
        const json = await resp.json().catch(() => null);
        const id = json?.profile?.id ?? null;
        if (mounted) setCurrentUserId(id);
      } catch (e) {
        console.error('[Races] failed to fetch current profile', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  
  async function submitRegistration(raceId: string) {
    setRegisterError(null);
    if (!selectedDistance) return setRegisterError('Vui lòng chọn cự ly');
    setRegistering(true);
    try {
      const res = await fetch(`/api/races/${encodeURIComponent(raceId)}/register`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ distance: selectedDistance }),
      });
      const json = await res.json().catch(() => ({ ok: false, error: 'Invalid response' }));
      if (!res.ok || !json.ok) {
        setRegisterError(json.error || 'Đăng ký thất bại');
      } else {
        setRegisterSuccess(true);
        // refresh results to reflect new registration
        const race = races.find((r) => r.id === raceId) || selectedRace;
        if (race) await handleSelectRace(race as Race);
      }
    } catch (err) {
      setRegisterError(String(err));
    } finally {
      setRegistering(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--color-bg-secondary)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: "var(--color-primary)" }}></div>
          <p style={{ color: "var(--color-text-secondary)" }}>Đang tải dữ liệu...</p>
          {fetchError && (
            <div className="mt-4 text-sm text-red-600">
              <p>{fetchError}</p>
              <button
                onClick={() => fetchRaces()}
                className="mt-2 inline-block px-4 py-2 bg-blue-600 text-white rounded"
              >
                Thử lại
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (selectedRace) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="rounded-lg p-4 mb-6 shadow-lg gradient-theme-primary">
          <div className="max-w-7xl mx-auto">
            <button
              onClick={() => {
                setSelectedRace(null);
                setRaceResults([]);
                setRewards([]);
              }}
              className="hover:opacity-80 mb-4 inline-block"
              style={{ color: "var(--color-text-inverse)" }}
            >
              ← Quay lại
            </button>
            <h1 className="text-4xl md:text-5xl font-bold mb-2">{selectedRace.name}</h1>
            <div className="text-blue-100">
              <div className="flex items-center gap-3 text-gray-600">
                <Calendar size={18} /> {formatDate(selectedRace.race_date)} • <MapPin size={18} /> {selectedRace.location}
                <span className="mx-2">•</span>
                <div className="flex items-center gap-2">
                  <User size={16} />
                  <span>{String(raceResults.length)} thành viên</span>
                </div>
              </div>
            </div>
            {/* Registration area */}
            <div className="mt-4">
              <div className="rounded-lg p-4 bg-white shadow-sm" style={{ background: 'var(--color-bg-secondary)' }}>
                <h3 className="text-lg font-semibold mb-2">Đăng ký tham gia</h3>
                <div className="flex items-center gap-3 flex-wrap">
                  <select
                    value={selectedDistance}
                    onChange={(e) => setSelectedDistance(e.target.value)}
                    className="px-3 py-2 border rounded-md bg-white"
                  >
                    <option value="">Chọn cự ly</option>
                    <option value="5km">5km</option>
                    <option value="10km">10km</option>
                    <option value="21km">HM (21km)</option>
                    <option value="42km">FM (42km)</option>
                  </select>

                  {/* Show register button only while registration open; disable if already registered */}
                  {(() => {
                    const raceDate = new Date(selectedRace.race_date);
                    const now = new Date();
                    const registrationOpen = now <= raceDate;
                    const alreadyRegistered = Boolean(currentUserId && raceResults.some((r) => r.user_id === currentUserId));

                    if (!registrationOpen) {
                      return <div className="text-sm text-gray-500">Đã quá ngày đăng ký</div>;
                    }

                    return (
                      <button
                        onClick={() => {
                          if (alreadyRegistered) return;
                          submitRegistration(selectedRace.id);
                        }}
                        disabled={registering || alreadyRegistered}
                        className={`px-4 py-2 rounded-md text-sm font-medium ${registering || alreadyRegistered ? 'bg-gray-300 text-gray-600' : 'bg-green-600 text-white hover:opacity-90'}`}
                      >
                        {alreadyRegistered ? 'Đã đăng ký' : (registering ? 'Đang gửi...' : 'Đăng ký')}
                      </button>
                    );
                  })()}

                  {registerError && <div className="text-red-600 ml-2">{registerError}</div>}
                  {registerSuccess && <div className="text-green-700 ml-2">Đăng ký thành công</div>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          {resultsLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: "var(--color-primary)" }}></div>
                <p style={{ color: "var(--color-text-secondary)" }}>Đang tải kết quả...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Results by Distance */}
              {raceResults.length > 0 && (
                <div className="mb-8">
                  <div className="rounded-lg p-4 mb-6 shadow-lg gradient-theme-primary">
                    <h2 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--color-text-inverse)" }}>
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: "var(--color-text-inverse)" }}>
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                      </svg>
                      Danh sách tham gia
                    </h2>
                  </div>

                  {/* Group by distance */}
                  {Array.from(new Set(raceResults.map((r) => r.distance))).map((distance) => (
                    <div key={distance} className="mb-8">
                      <h3 className="text-xl font-bold mb-4 pb-2" style={{ color: "var(--color-text-primary)", borderBottom: "2px solid var(--color-border)" }}>
                        {distance} Cự Ly
                      </h3>

                      <div className="rounded-lg shadow-md overflow-x-auto" style={{ background: "var(--color-bg-secondary)", boxShadow: "var(--shadow-md)" }}>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b-2 border-gray-300 bg-gray-50">
                              <th className="text-left py-3 px-4 font-bold text-gray-700">Xếp Hạng</th>
                              <th className="text-left py-3 px-4 font-bold text-gray-700">Tên Thành Viên</th>
                              <th className="text-right py-3 px-4 font-bold text-gray-700">Chip Time</th>
                              <th className="text-right py-3 px-4 font-bold text-gray-700">Nhóm Tuổi</th>
                              <th className="text-center py-3 px-4 font-bold text-gray-700">PR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {raceResults
                              .filter((r) => r.distance === distance)
                              .map((result, idx) => (
                                <tr
                                  key={result.id}
                                  className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                                >
                                  <td className="py-3 px-4">
                                    <div className="flex items-center justify-center">
                                      {idx === 0 ? (
                                        <Medal size={24} className="text-yellow-400" />
                                      ) : idx === 1 ? (
                                        <Medal size={24} className="text-gray-400" />
                                      ) : idx === 2 ? (
                                        <Medal size={24} style={{ color: "var(--color-primary)" }} />
                                      ) : (
                                        <span className="font-bold text-gray-600">#{idx + 1}</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-3">
                                      {result.profile?.avatar_url ? (
                                        <Image
                                          src={result.profile.avatar_url}
                                          alt={result.profile.full_name}
                                          width={32}
                                          height={32}
                                          className="w-8 h-8 rounded-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                                          <User size={16} className="text-gray-600" />
                                        </div>
                                      )}
                                      <span className="font-semibold text-gray-900">
                                        {result.profile?.full_name}
                                      </span>
                                      {result.is_pr && (
                                         <PRIcon className="text-yellow-400 fill-yellow-400 animate-pulse" />
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <span className="font-bold" style={{ color: "var(--color-primary)" }}>
                                      {formatTime(result.chip_time_seconds)}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-right text-gray-600">
                                    -
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    {result.is_pr ? (
                                        <PRIcon className="text-yellow-400 mx-auto" size={24} />
                                    ) : (
                                      <span className="text-gray-300">-</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            
              {/* Reward Table */}
              {rewards.length > 0 && (
                <div className="mb-8">
                  <div className="rounded-lg p-4 mb-6 shadow-lg gradient-theme-primary">
                    <h2 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--color-text-inverse)" }}>
                      <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" style={{ color: "var(--color-text-inverse)" }}>
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                      Bảng Quy Đổi Giải Thưởng
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Half Marathon Rewards */}
                    {rewards.filter((r) => r.category === "PODIUM").length > 0 && (
                      <div className="rounded-lg shadow-md p-6" style={{ background: "var(--color-bg-secondary)" }}>
                        <h3 className="text-xl font-bold mb-4" style={{ color: "var(--color-primary)" }}>
                          <Activity size={18} /> Half Marathon (21km)
                        </h3>

                        <div className="space-y-3">
                          {rewards
                            .filter((r) => r.category === "HM")
                            .map((reward) => (
                              <div
                                key={reward.id}
                                className="flex items-start gap-4 p-3 rounded-lg transition-colors"
                                style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-secondary)" }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.95'}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                              >
                                <div className="flex-1">
                                  <div className="font-bold text-gray-900">
                                    {reward.condition_label}
                                  </div>
                                  <div className="text-sm text-gray-600 mt-1">
                                    {reward.prize_description}
                                  </div>
                                </div>
                                <div className="text-right font-bold text-green-600 whitespace-nowrap">
                                  {formatCash(reward.cash_amount)}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Full Marathon Rewards */}
                    {rewards.filter((r) => r.category === "FM").length > 0 && (
                      <div className="rounded-lg shadow-md p-6" style={{ background: "var(--color-bg-secondary)" }}>
                        <h3 className="text-xl font-bold mb-4" style={{ color: "var(--color-primary)" }}>
                          <Activity size={18} /> Full Marathon (42km)
                        </h3>

                        <div className="space-y-3">
                          {rewards
                            .filter((r) => r.category === "FM")
                            .map((reward) => (
                              <div
                                key={reward.id}
                                className="flex items-start gap-4 p-3 rounded-lg transition-colors"
                                style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-secondary)" }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.95'}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                              >
                                <div className="flex-1">
                                  <div className="font-bold text-gray-900">
                                    {reward.condition_label}
                                  </div>
                                  <div className="text-sm text-gray-600 mt-1">
                                    {reward.prize_description}
                                  </div>
                                </div>
                                <div className="text-right font-bold text-green-600 whitespace-nowrap">
                                  {formatCash(reward.cash_amount)}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="text-sm mt-6 p-4 rounded-lg flex items-start gap-2" style={{ background: "var(--color-info-bg, #DBEAFE)", color: "var(--color-text-secondary)" }}>
                    <Lightbulb size={20} className="flex-shrink-0 mt-0.5" style={{ color: "var(--color-info, #2563EB)" }} />
                    <span>
                      <strong>Hướng dẫn:</strong> Tra cứu thành tích của bạn để xem mình đạt mốc nào và sẽ nhận được giải thưởng gì.
                      Những thành tích có dấu <Star size={14} className="inline text-yellow-400 fill-yellow-400" /> là những kỷ lục cá nhân (PR).
                    </span>
                  </p>
                </div>
              )}

              {raceResults.length === 0 && rewards.length === 0 && (
                <div className="rounded-lg p-12 text-center shadow-sm" style={{ background: "var(--color-bg-secondary)" }}>
                  <p className="text-lg" style={{ color: "var(--color-text-secondary)" }}>Chưa có dữ liệu cho race này</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="min-h-screen bg-[var(--color-bg-secondary)]">
        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          {races.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {races.map((race) => (
                <RaceCard
                  key={race.id}
                  race={race}
                  onClick={() => handleSelectRace(race)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg p-12 text-center shadow-sm" style={{ background: "var(--color-bg-secondary)" }}>
              <p className="text-lg" style={{ color: "var(--color-text-secondary)" }}>Chưa có race nào</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
