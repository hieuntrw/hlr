"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function DashboardContent() {
  const searchParams = useSearchParams();
  const connected = searchParams.get("strava_connected");

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Dashboard</h1>
      {connected && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#d4edda",
            borderRadius: "4px",
            marginBottom: "1rem",
          }}
        >
          Successfully connected to Strava!
        </div>
      )}
      <p>Your running challenge dashboard will appear here.</p>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem" }}>Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
