"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";
import {
  RiDashboardLine, RiTaskLine, RiCalendarLine, RiDatabase2Line,
  RiBookLine, RiHeartPulseLine, RiBowlLine, RiLineChartLine,
  RiFolderLine, RiMoneyDollarCircleLine, RiRobot2Line, RiLogoutBoxLine,
  RiLoopLeftLine, RiMailLine, RiDiscordLine, RiMusicLine,
} from "react-icons/ri";

const NAV_ITEMS = [
  { href: "/dashboard",  label: "Dashboard",  icon: RiDashboardLine },
  { href: "/tasks",      label: "Tasks",      icon: RiTaskLine },
  { href: "/habits",     label: "Habits",     icon: RiLoopLeftLine },
  { href: "/calendar",   label: "Calendar",   icon: RiCalendarLine },
  { href: "/gmail",      label: "Gmail",      icon: RiMailLine },
  { href: "/discord",    label: "Discord",    icon: RiDiscordLine },
  { href: "/media",      label: "Media",      icon: RiMusicLine },
  { href: "/memory",     label: "Memory",     icon: RiDatabase2Line },
  { href: "/journal",    label: "Journal",    icon: RiBookLine },
  { href: "/nutrition",  label: "Nutrition",  icon: RiBowlLine },
  { href: "/health",     label: "Health",     icon: RiHeartPulseLine },
  { href: "/goals",      label: "Goals",      icon: RiLineChartLine },
  { href: "/finance",    label: "Finance",    icon: RiMoneyDollarCircleLine },
  { href: "/projects",   label: "Projects",   icon: RiFolderLine },
  { href: "/chat",       label: "Chat",       icon: RiRobot2Line },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, signOutUser } = useAuth();

  return (
    <nav className="h-full flex flex-col bg-bg-secondary border-r border-bg-border">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-bg-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
            <RiDashboardLine className="w-4 h-4 text-accent" />
          </div>
          <span className="font-semibold text-text-primary">Personal OS</span>
        </div>
      </div>

      {/* Nav links */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-accent/15 text-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {label}
            </Link>
          );
        })}
      </div>

      {/* User profile + sign out */}
      <div className="p-3 border-t border-bg-border">
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          {user?.photoURL ? (
            <Image
              src={user.photoURL}
              alt="Avatar"
              width={32}
              height={32}
              className="rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-semibold">
              {user?.displayName?.[0] ?? "?"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {user?.displayName ?? "User"}
            </p>
            <p className="text-xs text-text-muted truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={signOutUser}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-secondary hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
        >
          <RiLogoutBoxLine className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </nav>
  );
}
