"use client";
// Bottom navigation bar shown only on mobile
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  RiDashboardLine, RiTaskLine, RiRobot2Line,
  RiMailLine, RiMusicLine,
} from "react-icons/ri";

// Only the 5 most-used sections appear in mobile nav
const MOBILE_NAV = [
  { href: "/dashboard", label: "Home",    icon: RiDashboardLine },
  { href: "/tasks",     label: "Tasks",   icon: RiTaskLine },
  { href: "/gmail",     label: "Gmail",   icon: RiMailLine },
  { href: "/media",     label: "Media",   icon: RiMusicLine },
  { href: "/chat",      label: "Chat",    icon: RiRobot2Line },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 flex z-40" style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.6)" }}>
      {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors ${
              active ? "text-accent" : "text-text-secondary"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
