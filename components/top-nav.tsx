"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "工作台" },
  { href: "/tasks", label: "任务表" },
  { href: "/task-bank", label: "题库表" },
  { href: "/github-repos", label: "GitHub 仓库" },
  { href: "/settings", label: "设置" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-2 text-sm text-slate-600">
      {navItems.map((item) => {
        const isActive = item.href === "/" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={[
              "rounded-full px-3 py-2 transition hover:bg-slate-100 hover:text-slate-950",
              isActive ? "bg-slate-950 text-white hover:bg-slate-950 hover:text-white" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
