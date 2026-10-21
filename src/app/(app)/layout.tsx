import Link from "next/link";
import { Suspense } from "react";

import { BudgetBanner } from "@/components/layout/budget-banner";
import { Logo } from "@/components/layout/logo";
import { BottomNav, SidebarNav } from "@/components/layout/nav-links";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-r bg-card/50 px-4 py-6 md:flex">
        <Link href="/home" className="px-3">
          <Logo />
        </Link>
        <SidebarNav />
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background/90 px-4 backdrop-blur md:hidden">
          <Link href="/home">
            <Logo />
          </Link>
        </header>
        <Suspense fallback={null}>
          <BudgetBanner />
        </Suspense>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-12">
          {children}
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
