import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-2xl">🏃</div>
              <h1 className="text-2xl font-bold text-gray-900">
                HLR Running Club
              </h1>
            </div>
            <div className="flex gap-6">
              <Link
                href="/dashboard"
                className="text-gray-700 hover:text-primary-600 transition"
              >
                Bảng xếp hạng
              </Link>
              <Link
                href="/profile"
                className="text-gray-700 hover:text-primary-600 transition"
              >
                Tài khoản
              </Link>
              <Link
                href="/rules"
                className="text-gray-700 hover:text-primary-600 transition"
              >
                Quy định
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center text-center">
          <div className="mb-8">
            <h1 className="text-6xl md:text-7xl font-bold text-white mb-4">
              🏃‍♀️ HLR Running Club
            </h1>
            <p className="text-2xl text-primary-100 mb-8">
              Hệ thống quản lý CLB chạy bộ với tích hợp Strava
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 w-full max-w-4xl">
            <div className="bg-white rounded-lg p-6 shadow-lg hover:shadow-xl transition">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Bảng Xếp Hạng
              </h3>
              <p className="text-gray-600 mb-4">
                Theo dõi tiến độ chạy của các thành viên trong tháng
              </p>
              <Link
                href="/dashboard"
                className="inline-block text-primary-600 hover:text-primary-700 font-semibold"
              >
                Xem bảng →
              </Link>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-lg hover:shadow-xl transition">
              <div className="text-4xl mb-4">👤</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Hồ Sơ Cá Nhân
              </h3>
              <p className="text-gray-600 mb-4">
                Quản lý thông tin cá nhân và lịch sử giải đấu
              </p>
              <Link
                href="/profile"
                className="inline-block text-primary-600 hover:text-primary-700 font-semibold"
              >
                Xem hồ sơ →
              </Link>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-lg hover:shadow-xl transition">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Quy Định & Thưởng Phạt
              </h3>
              <p className="text-gray-600 mb-4">
                Tìm hiểu về tiêu chí thưởng và quy định tài chính
              </p>
              <Link
                href="/rules"
                className="inline-block text-primary-600 hover:text-primary-700 font-semibold"
              >
                Xem quy định →
              </Link>
            </div>
          </div>

          {/* CTA Button */}
          <div className="space-y-4">
            <p className="text-primary-100 text-lg">
              Bạn chưa có tài khoản?
            </p>
            <a
              href="/api/auth/strava/login"
              className="inline-block px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg rounded-lg shadow-lg hover:shadow-xl transition transform hover:scale-105"
            >
              Kết nối với Strava ngay
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-black/20 text-white py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-primary-200">
            © 2024 HLR Running Club. Designed with ❤️ for runners.
          </p>
        </div>
      </footer>
    </div>
  );
}
