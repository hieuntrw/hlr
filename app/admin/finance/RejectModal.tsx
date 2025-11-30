"use client";
import React, { useState } from "react";

export default function RejectModal({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-2">Lý do từ chối biên lai</h2>
        <textarea
          className="w-full border rounded p-2 mb-4"
          rows={3}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Nhập lý do từ chối..."
        />
        <div className="flex gap-2 justify-end">
          <button className="px-4 py-2 bg-gray-200 rounded" onClick={onClose}>Hủy</button>
          <button className="px-4 py-2 bg-red-600 text-white rounded" onClick={() => onSubmit(reason)}>Từ chối</button>
        </div>
      </div>
    </div>
  );
}
