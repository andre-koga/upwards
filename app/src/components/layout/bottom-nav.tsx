import { Link, useLocation } from "react-router-dom";
import { ListTodo, Folder, Settings } from "lucide-react";

const navItems = [
  { href: "/", icon: ListTodo, label: "Today" },
  { href: "/activities", icon: Folder, label: "Activities" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export default function BottomNav() {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <div className="flex justify-around items-center h-16 max-w-screen-xl mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              to={item.href}
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
