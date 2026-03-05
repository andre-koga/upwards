"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListTodo, Folder, Settings, BookOpen } from "lucide-react";

const navItems = [
  { href: "/", icon: ListTodo, label: "Today" },
  { href: "/journal", icon: BookOpen, label: "Journal" },
  { href: "/activities", icon: Folder, label: "Activities" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function BottomNav() {
  const pathname = usePathname();

  // Don't show on auth pages
  if (pathname.startsWith("/auth")) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <div className="flex justify-around items-center h-16 max-w-screen-xl mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
