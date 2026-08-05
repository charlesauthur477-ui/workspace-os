import { googleLoginUrl } from "@/lib/api";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="glass w-full max-w-sm rounded-2xl p-8 text-center">
        <h1 className="mb-2 text-2xl font-semibold">Workspace OS</h1>
        <p className="mb-8 text-sm text-gray-400">
          Your personal operating system. Sign in to continue.
        </p>
        <a
          href={googleLoginUrl()}
          className="block w-full rounded-lg bg-accent px-4 py-3 font-medium text-white transition hover:opacity-90"
        >
          Sign in with Google
        </a>
        <p className="mt-6 text-xs text-gray-500">
          New accounts require Owner approval before the dashboard unlocks.
        </p>
      </div>
    </main>
  );
}
