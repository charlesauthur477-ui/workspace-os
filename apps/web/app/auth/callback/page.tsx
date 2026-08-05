"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setAccessToken } from "@/lib/api";

// The API redirects here after a successful Google OAuth login, with the
// short-lived access token in the query string. We stash it in memory and
// move on — the refresh token already landed as an httpOnly cookie.
function AuthCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get("access_token");
    if (token) {
      setAccessToken(token);
      router.replace("/");
    } else {
      router.replace("/login");
    }
  }, [params, router]);

  return null;
}

// useSearchParams() requires a Suspense boundary in the app router, or
// `next build` fails during prerendering — this wrapper is that boundary.
export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center text-gray-400">
      <Suspense fallback={<span>Signing you in…</span>}>
        <AuthCallbackInner />
      </Suspense>
    </main>
  );
}
