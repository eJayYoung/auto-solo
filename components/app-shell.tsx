import Link from "next/link";
import { cookies } from "next/headers";
import { TopNav } from "@/components/top-nav";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import { getCurrentUserFromCookies } from "@/lib/auth";

export async function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = await getCurrentUserFromCookies(sessionValue ? `${SESSION_COOKIE_NAME}=${sessionValue}` : null);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold">
            auto-solo
          </Link>
          <TopNav />
          {user ? (
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{user.name}</span>
              <a className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700" href="/api/auth/logout">
                退出
              </a>
            </div>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
