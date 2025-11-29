// Common Header Component for all pages
export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold text-primary-600">🏃</div>
            <h1 className="text-2xl font-bold text-gray-900">HLR Running Club</h1>
          </div>
          <nav className="flex gap-6">
            <a
              href="/dashboard"
              className="text-gray-700 hover:text-primary-600 transition"
            >
              Bảng xếp hạng
            </a>
            <a
              href="/profile"
              className="text-gray-700 hover:text-primary-600 transition"
            >
              Tài khoản
            </a>
            <a
              href="/rules"
              className="text-gray-700 hover:text-primary-600 transition"
            >
              Quy định
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
