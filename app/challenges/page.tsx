"use client";

import { useState } from "react";

export default function ChallengesPage() {
  const [activeTab, setActiveTab] = useState<"my" | "all">("all");

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6">Danh Sách Thử Thách</h1>

      {/* Tab Navigation */}
      <div className="flex gap-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 font-semibold ${
            activeTab === "all"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600"
          }`}
        >
          Tất Cả Thử Thách
        </button>
        <button
          onClick={() => setActiveTab("my")}
          className={`px-4 py-2 font-semibold ${
            activeTab === "my"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600"
          }`}
        >
          Thử Thách Của Tôi
        </button>
      </div>

      {/* Content */}
      {activeTab === "all" && (
        <div>
          <p className="text-gray-600">Tất cả thử thách hiện có</p>
          {/* TODO: Fetch and display all challenges */}
        </div>
      )}

      {activeTab === "my" && (
        <div>
          <p className="text-gray-600">Thử thách mà bạn đang tham gia</p>
          {/* TODO: Fetch user's challenge_participants and display */}
        </div>
      )}
    </div>
  );
}
