"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";

export default function HomePage() {
  const router = useRouter();
  const accessToken = useAppStore((s) => s.accessToken);

  useEffect(() => {
    if (accessToken) {
      router.replace("/files");
    } else {
      router.replace("/login");
    }
  }, [accessToken, router]);

  return null;
}