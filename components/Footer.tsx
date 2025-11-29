// Footer Component for all pages
export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-8 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h4 className="font-bold text-white mb-4">HLR Running Club</h4>
            <p className="text-sm">
              Nền tảng quản lý CLB chạy bộ với tích hợp Strava và hệ thống
              giải thưởng toàn diện
            </p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Liên kết nhanh</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/dashboard" className="hover:text-white transition">
                  Bảng xếp hạng
                </a>
              </li>
              <li>
                <a href="/profile" className="hover:text-white transition">
                  Hồ sơ cá nhân
                </a>
              </li>
              <li>
                <a href="/rules" className="hover:text-white transition">
                  Quy định
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Liên hệ</h4>
            <p className="text-sm">Email: info@hlrrunning.club</p>
            <p className="text-sm">Điện thoại: +84 (0) 123 456 789</p>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-8 text-center text-sm">
          <p>© 2024 HLR Running Club. Designed with ❤️ for runners.</p>
        </div>
      </div>
    </footer>
  );
}
