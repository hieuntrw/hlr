// Reusable Leaderboard Row Component
interface LeaderboardRowProps {
  rank: number;
  name: string;
  avatar?: string;
  totalKm: number;
  pace: number;
  targetKm: number;
}

export default function LeaderboardRow({
  rank,
  name,
  avatar,
  totalKm,
  pace,
  targetKm,
}: LeaderboardRowProps) {
  const progress = Math.min((totalKm / targetKm) * 100, 100);
  const isCompleted = totalKm >= targetKm;

  // Color based on progress
  const getProgressColor = () => {
    if (progress >= 100) return "bg-green-500";
    if (progress >= 75) return "bg-blue-500";
    if (progress >= 50) return "bg-amber-500";
    return "bg-red-500";
  };

  // Format pace from seconds to MM:SS
  const formatPace = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}/km`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
      <div className="flex items-center gap-4">
        {/* Rank Badge */}
        <div
          className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${
            rank === 1
              ? "bg-yellow-500"
              : rank === 2
                ? "bg-gray-400"
                : rank === 3
                  ? "bg-orange-500"
                  : "bg-gray-300"
          }`}
        >
          {rank}
        </div>

        {/* Avatar & Name */}
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-bold">
            {avatar || name.charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Member Info */}
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{name}</h3>
          <p className="text-sm text-gray-500">{formatPace(pace)}</p>
        </div>

        {/* Distance & Progress */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-gray-900">{totalKm} km</span>
            <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${getProgressColor()}`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Mục tiêu: {targetKm} km</p>
        </div>

        {/* Completion Badge */}
        {isCompleted && (
          <div className="flex-shrink-0">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              ✓ Hoàn thành
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
