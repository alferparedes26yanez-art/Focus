import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-primary/5 to-background px-4 py-10">
      <Logo className="mb-8 text-xl" />
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
