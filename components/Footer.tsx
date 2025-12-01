// Footer Component for all pages
export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-8 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h4 className="font-bold text-white mb-4">Hải Lăng Runners</h4>
            <p className="text-sm">
              Nền tảng quản lý CLB chạy bộ
            </p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Liên kết nhanh</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/challenges" className="hover:text-white transition">
                  Thử thách
                </a>
              </li>
              <li>
                <a href="/hall-of-fame" className="hover:text-white transition">
                  Bảng vàng
                </a>
              </li>
              <li>
                <a href="/races" className="hover:text-white transition">
                  Races
                </a>
              </li>
              <li>
                <a href="/rewards" className="hover:text-white transition">
                  Quà tặng
                </a>
              </li>
              <li>
                <a href="/finance" className="hover:text-white transition">
                  Quỹ CLB
                </a>
              </li>
              <li>
                <a href="/rules" className="hover:text-white transition">
                  Quy định
                </a>
              </li>
              <li>
                <a href="/profile" className="hover:text-white transition">
                  Thành viên
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Liên hệ</h4>
            <p className="text-sm">Email: hailangrunners@gmail.com</p>
            <p className="text-sm">Điện thoại: +84 935 666 235</p>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-8 text-center text-sm">
          <p>© 2025 HLR Running Club. Designed with ❤️ for runners.</p>
        </div>
      </div>
    </footer>
  );
}
