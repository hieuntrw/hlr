// Reusable UI Utilities and Component Examples

export const UIColors = {
  // Progress colors
  progress: {
    complete: "bg-green-500",      // 100%
    high: "bg-blue-500",           // 75-100%
    medium: "bg-amber-500",        // 50-75%
    low: "bg-red-500",             // <50%
  },
  // Status badges
  badge: {
    success: "bg-green-100 text-green-800",
    warning: "bg-amber-100 text-amber-800",
    info: "bg-blue-100 text-blue-800",
    error: "bg-red-100 text-red-800",
    default: "bg-gray-100 text-gray-800",
  },
  // Rank medals
  medal: {
    first: "bg-yellow-500",  // Gold
    second: "bg-gray-400",   // Silver
    third: "bg-orange-500",  // Bronze
    other: "bg-gray-300",    // Gray
  },
};

// Example: Formatted Time Display Component
export function FormattedTime({ seconds }: { seconds: number }) {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);
  
  if (hours > 0) {
    return <span>{hours}:{mins.toString().padStart(2, "0")}:{secs.toString().padStart(2, "0")}</span>;
  }
  return <span>{mins}:{secs.toString().padStart(2, "0")}</span>;
}

// Example: Progress Indicator Component
export function ProgressIndicator({
  value,
  total,
  label,
  showPercentage = true,
}: {
  value: number;
  total: number;
  label?: string;
  showPercentage?: boolean;
}) {
  const percentage = Math.min((value / total) * 100, 100);
  const getColor = () => {
    if (percentage >= 100) return "bg-green-500";
    if (percentage >= 75) return "bg-blue-500";
    if (percentage >= 50) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div>
      {label && <p className="text-sm text-gray-600 mb-1">{label}</p>}
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-gray-900">{value} km</span>
        {showPercentage && (
          <span className="text-sm text-gray-500">{Math.round(percentage)}%</span>
        )}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${getColor()}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}

// Example: Medal Badge Component
export function MedalBadge({ rank }: { rank: number }) {
  const getMedalStyle = () => {
    switch (rank) {
      case 1:
        return "bg-yellow-500 text-white";
      case 2:
        return "bg-gray-400 text-white";
      case 3:
        return "bg-orange-500 text-white";
      default:
        return "bg-gray-300 text-gray-900";
    }
  };

  const getMedalEmoji = () => {
    switch (rank) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return rank;
    }
  };

  return (
    <div
      className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold ${getMedalStyle()}`}
    >
      {getMedalEmoji()}
    </div>
  );
}

// Example: Data Card Component
export function DataCard({
  title,
  value,
  subtitle,
  icon,
  className = "",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="flex items-start gap-3">
        {icon && <span className="text-3xl">{icon}</span>}
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

// Example: Stat Box Component for Rules Page
export function StatBox({
  label,
  value,
  subtitle,
  bgColor = "bg-gradient-to-br from-blue-50 to-blue-100",
  borderColor = "border-blue-200",
}: {
  label: string;
  value: string;
  subtitle?: string;
  bgColor?: string;
  borderColor?: string;
}) {
  return (
    <div className={`rounded-lg border ${borderColor} p-6 ${bgColor}`}>
      <p className="text-gray-600 text-sm mb-2">{label}</p>
      <p className="text-2xl font-bold text-blue-600 mb-1">{value}</p>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
}

// Color utilities for dynamic styling
export const getProgressColor = (percentage: number): string => {
  if (percentage >= 100) return "text-green-600";
  if (percentage >= 75) return "text-blue-600";
  if (percentage >= 50) return "text-amber-600";
  return "text-red-600";
};

export const getProgressBgColor = (percentage: number): string => {
  if (percentage >= 100) return "bg-green-500";
  if (percentage >= 75) return "bg-blue-500";
  if (percentage >= 50) return "bg-amber-500";
  return "bg-red-500";
};
