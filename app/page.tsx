import Link from "next/link";
import { countActive } from "@/src/features/renungan/data/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadRenunganCount(): Promise<{ value: number | null; error: string | null }> {
  try {
    return { value: await countActive(), error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[dashboard] renungan count failed", { error: message });
    return { value: null, error: message };
  }
}

export default async function Home() {
  const renungan = await loadRenunganCount();
  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Welcome to Kima CMS.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/renungan"
          className="rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
        >
          <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Renungan Harian</div>
          <div className="mt-2 text-3xl font-semibold">
            {renungan.error ? "—" : (renungan.value ?? 0).toLocaleString("id-ID")}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {renungan.error ? `Error: ${renungan.error}` : "renungan created"}
          </div>
        </Link>
      </div>
    </div>
  );
}
