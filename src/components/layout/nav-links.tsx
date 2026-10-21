"use client";

import { House, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";

import { SubjectDialog } from "@/components/subjects/subject-dialog";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/home", label: "Inicio", icon: House, match: ["/home", "/subjects", "/onboarding"] },
  { href: "/settings", label: "Ajustes", icon: Settings, match: ["/settings"] },
];

type NavLink = (typeof LINKS)[number];

function isActive(pathname: string | null, match: string[]) {
  return pathname !== null && match.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

// The current URL is only known at request time, so the links render without
// highlighting in the prerendered shell and highlight once it streams in.
function ActiveAware({ children }: { children: (pathname: string | null) => React.ReactNode }) {
  return <Suspense fallback={children(null)}>{<WithPathname>{children}</WithPathname>}</Suspense>;
}

function WithPathname({ children }: { children: (pathname: string | null) => React.ReactNode }) {
  return children(usePathname());
}

function SidebarLink({ link, pathname }: { link: NavLink; pathname: string | null }) {
  const active = isActive(pathname, link.match);
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground",
        active && "bg-accent text-foreground",
      )}
    >
      <link.icon className="size-4" />
      {link.label}
    </Link>
  );
}

function BottomLink({ link, pathname }: { link: NavLink; pathname: string | null }) {
  const active = isActive(pathname, link.match);
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium text-muted-foreground",
        active && "text-primary",
      )}
    >
      <link.icon className="size-5" />
      {link.label}
    </Link>
  );
}

export function SidebarNav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="grid gap-1">
      <ActiveAware>
        {(pathname) => LINKS.map((link) => <SidebarLink key={link.href} link={link} pathname={pathname} />)}
      </ActiveAware>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/10"
      >
        <Plus className="size-4" />
        Nueva materia
      </button>
      <SubjectDialog open={open} onOpenChange={setOpen} />
    </nav>
  );
}

export function BottomNav() {
  const [open, setOpen] = useState(false);
  const [home, settings] = LINKS;

  return (
    <nav className="flex items-center px-6">
      <ActiveAware>{(pathname) => <BottomLink link={home} pathname={pathname} />}</ActiveAware>
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Nueva materia"
          className="-mt-6 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-95"
        >
          <Plus className="size-6" />
        </button>
      </div>
      <ActiveAware>{(pathname) => <BottomLink link={settings} pathname={pathname} />}</ActiveAware>
      <SubjectDialog open={open} onOpenChange={setOpen} />
    </nav>
  );
}
