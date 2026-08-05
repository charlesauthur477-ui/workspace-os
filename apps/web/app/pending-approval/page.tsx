export default function PendingApprovalPage() {
  return (
    <main className="flex min-h-screen items-center justify-center text-center">
      <div className="glass max-w-md rounded-2xl p-8">
        <h1 className="mb-2 text-xl font-semibold">Almost there</h1>
        <p className="text-sm text-gray-400">
          Your account was created and is waiting on the Owner to approve it and
          assign a role. You&apos;ll be able to sign in once that happens.
        </p>
      </div>
    </main>
  );
}
