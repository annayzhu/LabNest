"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function SettingsAILink() {
  const router = useRouter();
  useEffect(() => {
    const follow = () => { if (["#ai-access", "#providers"].includes(window.location.hash)) router.replace(`/ai${window.location.hash}`); };
    follow(); window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, [router]);
  return <p id="ai-access" className="text-sm"><span id="providers" /><Link className="focus-ring text-moss hover:underline" href="/ai">AI 设置 →</Link></p>;
}
