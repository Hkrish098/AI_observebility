"use client";

import { useEffect, useState } from "react";
import { getHealth } from "@/lib/api";

export function SystemStatus() {
  const [label, setLabel] = useState("Checking");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    getHealth()
      .then((health) => {
        const live = health.status === "ok";
        setOk(live);
        setLabel(live ? "System operational" : "Degraded");
      })
      .catch(() => {
        setOk(false);
        setLabel("Unavailable");
      });
  }, []);

  return (
    <p className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-[#9aa3b2]">
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-[#12b76a]" : "bg-[#9aa3b2]"}`} />
      {label}
    </p>
  );
}
