"use client";

import { useState } from "react";

export default function Rules() {
  const [activeTab, setActiveTab] = useState<"rewards" | "fees">("rewards");

  // Reward definitions for HM/FM
  const hmRewards = [
    {
      condition: "SUB 130",
      conditionTime: "1:30:00",
      prizeDescription: "Giải nhất - Giải thưởng tiền mặt",
      cashAmount: "1,000,000",
    },
    {
      condition: "SUB 135",
      conditionTime: "1:35:00",
      prizeDescription: "Giải nhì - Giải thưởng tiền mặt",
      cashAmount: "800,000",
    },
    {
      condition: "SUB 140",
      conditionTime: "1:40:00",
      prizeDescription: "Giải ba - Giải thưởng tiền mặt",
      cashAmount: "600,000",
    },
    {
      condition: "SUB 145",
      conditionTime: "1:45:00",
      prizeDescription: "Huy chương - Giải thưởng tiền mặt",
      cashAmount: "400,000",
    },
    {
      condition: "SUB 150",
      conditionTime: "1:50:00",
      prizeDescription: "Sertifikat - Giải thưởng tiền mặt",
      cashAmount: "200,000",
    },
  ];

  const fmRewards = [
    {
      condition: "SUB 300",
      conditionTime: "3:00:00",
      prizeDescription: "Giải nhất - Giải thưởng tiền mặt",
      cashAmount: "2,000,000",
    },
    {
      condition: "SUB 315",
      conditionTime: "3:15:00",
      prizeDescription: "Giải nhì - Giải thưởng tiền mặt",
      cashAmount: "1,500,000",
    },
    {
      condition: "SUB 330",
      conditionTime: "3:30:00",
      prizeDescription: "Giải ba - Giải thưởng tiền mặt",
      cashAmount: "1,200,000",
    },
    {
      condition: "SUB 345",
      conditionTime: "3:45:00",
      prizeDescription: "Huy chương - Giải thưởng tiền mặt",
      cashAmount: "800,000",
    },
    {
      condition: "SUB 360",
      conditionTime: "4:00:00",
      prizeDescription: "Sertifikat - Giải thưởng tiền mặt",
      cashAmount: "500,000",
    },
  ];

  const podiumRewards = [
    { position: "🥇 Hạng 1 toàn bộ", prize: "2,000,000 VND" },
    { position: "🥈 Hạng 2 toàn bộ", prize: "1,200,000 VND" },
    { position: "🥉 Hạng 3 toàn bộ", prize: "800,000 VND" },
    { position: "🏅 Hạng 1 nhóm tuổi", prize: "1,000,000 VND" },
    { position: "🏅 Hạng 2 nhóm tuổi", prize: "600,000 VND" },
    { position: "🏅 Hạng 3 nhóm tuổi", prize: "400,000 VND" },
  ];

  const fundingRules = [
    {
      title: "Đóng quỹ hàng tháng",
      amount: "50,000 VND",
      description:
        "Mỗi thành viên hoạt động phải đóng quỹ 50,000 VND mỗi tháng",
      details: "Dùng để tổ chức các giải đấu và quản lý CLB",
    },
    {
      title: "Phạt không hoàn thành thách thức",
      amount: "100,000 VND",
      description:
        "Nếu không đạt mục tiêu km hàng tháng sẽ bị phạt 100,000 VND",
      details:
        "Mục tiêu mặc định: 100km/tháng (có thể chọn 70, 150, 200, 250, 300km)",
    },
    {
      title: "Thưởng hoàn thành thách thức",
      amount: "Điểm thưởng",
      description: "Hoàn thành thách thức sẽ được cộng điểm và giải thưởng",
      details: "Điểm được tích lũy để xếp hạng và dự thưởng cuối năm",
    },
  ];

  return (
    <>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Quy định CLB</h1>
          <p className="text-lg text-gray-600">
            Nội quy tài chính, thưởng phạt và khoá học của HLR Running Club
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("rewards")}
            className={`pb-4 px-4 font-semibold transition border-b-2 ${
              activeTab === "rewards"
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Giải thưởng & Milestone
          </button>
          <button
            onClick={() => setActiveTab("fees")}
            className={`pb-4 px-4 font-semibold transition border-b-2 ${
              activeTab === "fees"
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Quy định tài chính
          </button>
        </div>

        {/* Rewards Tab */}
        {activeTab === "rewards" && (
          <div className="space-y-8">
            {/* Half Marathon Rewards */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  Giải thưởng Bán Marathon (21km)
                </h2>
                <span className="text-3xl">🏃‍♀️</span>
              </div>
              <div className="grid gap-3">
                {hmRewards.map((reward, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-bold">
                            {reward.condition}
                          </span>
                          <span className="text-gray-500 text-sm">
                            {reward.conditionTime}
                          </span>
                        </div>
                        <p className="text-gray-600">{reward.prizeDescription}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">
                          ₫{reward.cashAmount}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Full Marathon Rewards */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  Giải thưởng Full Marathon (42km)
                </h2>
                <span className="text-3xl">🏃</span>
              </div>
              <div className="grid gap-3">
                {fmRewards.map((reward, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-bold">
                            {reward.condition}
                          </span>
                          <span className="text-gray-500 text-sm">
                            {reward.conditionTime}
                          </span>
                        </div>
                        <p className="text-gray-600">{reward.prizeDescription}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-purple-600">
                          ₫{reward.cashAmount}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Podium Rewards */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  Giải thưởng Bảng Xếp Hạng
                </h2>
                <span className="text-3xl">🏆</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {podiumRewards.map((reward, idx) => (
                  <div
                    key={idx}
                    className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg border border-yellow-200 p-4"
                  >
                    <p className="font-semibold text-gray-900 mb-2">
                      {reward.position}
                    </p>
                    <p className="text-xl font-bold text-amber-600">
                      {reward.prize}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Fees Tab */}
        {activeTab === "fees" && (
          <div className="space-y-6">
            <div className="grid gap-6">
              {fundingRules.map((rule, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition"
                >
                  <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-4 text-white">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold">{rule.title}</h3>
                      <span className="text-2xl font-bold bg-white/20 px-4 py-2 rounded-lg">
                        {rule.amount}
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    <p className="text-gray-900 font-semibold mb-3">
                      {rule.description}
                    </p>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {rule.details}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary Box */}
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                📊 Tóm tắt Tài chính
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-gray-600 text-sm mb-1">Quỹ hàng tháng</p>
                  <p className="text-2xl font-bold text-blue-600">50,000 VND</p>
                  <p className="text-xs text-gray-500 mt-1">/ thành viên</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm mb-1">Phạt không hoàn thành</p>
                  <p className="text-2xl font-bold text-red-600">100,000 VND</p>
                  <p className="text-xs text-gray-500 mt-1">/ tháng</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm mb-1">Tổng quỹ hàng năm</p>
                  <p className="text-2xl font-bold text-green-600">~6,000,000 VND</p>
                  <p className="text-xs text-gray-500 mt-1">cho 10 thành viên</p>
                </div>
              </div>
            </div>

            {/* Important Notes */}
            <div className="bg-amber-50 rounded-lg border border-amber-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3">
                ⚠️ Lưu ý quan trọng
              </h3>
              <ul className="space-y-2 text-gray-700">
                <li className="flex gap-3">
                  <span>•</span>
                  <span>
                    Tất cả phí và thưởng được tính theo quy định của HLR Running Club
                  </span>
                </li>
                <li className="flex gap-3">
                  <span>•</span>
                  <span>
                    Thành viên phải cập nhật dữ liệu Strava để được xác nhận km chạy
                  </span>
                </li>
                <li className="flex gap-3">
                  <span>•</span>
                  <span>
                    Các giải thưởng được chi trả sau khi xác nhận chính thức từ Ban quản lý
                  </span>
                </li>
                <li className="flex gap-3">
                  <span>•</span>
                  <span>
                    Quỹ sẽ được sử dụng để tổ chức các hoạt động và thưởng phạt của CLB
                  </span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
