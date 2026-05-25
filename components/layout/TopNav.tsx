"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";
import {
  RiDashboardLine, RiTaskLine, RiCalendarLine, RiMailLine,
  RiRobot2Line, RiLoopLeftLine, RiMusicLine,
  RiDatabase2Line, RiBookLine, RiBookReadLine, RiBowlLine, RiHeartPulseLine,
  RiLineChartLine, RiMoneyDollarCircleLine, RiFolderLine,
  RiMoreLine, RiLogoutBoxLine, RiSettings3Line, RiRestaurantLine,
  RiGoogleLine, RiContactsBook2Line, RiChatSmile2Line, RiRunLine,
  RiTimeLine, RiFocusLine, RiLightbulbLine,
  RiMicLine, RiBook2Line, RiTrophyLine,
} from "react-icons/ri";
import { useChatPanel } from "@/contexts/ChatPanelContext";

const PRIMARY_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: RiDashboardLine },
  { href: "/tasks",     label: "Tasks",     icon: RiTaskLine },
  { href: "/habits",    label: "Habits",    icon: RiLoopLeftLine },
  { href: "/calendar",  label: "Calendar",  icon: RiCalendarLine },
  { href: "/gmail",     label: "Gmail",     icon: RiMailLine },
  { href: "/projects",  label: "Projects",  icon: RiFolderLine },
  { href: "/media",     label: "Media",     icon: RiMusicLine },
];

const MORE_SECTIONS = [
  {
    label: "Life",
    items: [
      { href: "/journal",   label: "Journal",   icon: RiBookLine },
      { href: "/bible",     label: "Bible",     icon: RiBookReadLine },
      { href: "/goals",     label: "Goals",     icon: RiLineChartLine },
      { href: "/decisions", label: "Decisions", icon: RiLightbulbLine },
      { href: "/people",    label: "People",    icon: RiContactsBook2Line },
    ],
  },
  {
    label: "Health",
    items: [
      { href: "/health",       label: "Health",       icon: RiHeartPulseLine },
      { href: "/workout",      label: "Workout",      icon: RiRunLine },
      { href: "/nutrition",    label: "Nutrition",    icon: RiBowlLine },
      { href: "/meal-planner", label: "Meal Planner", icon: RiRestaurantLine },
    ],
  },
  {
    label: "Finance & Work",
    items: [
      { href: "/finance", label: "Finance",      icon: RiMoneyDollarCircleLine },
      { href: "/time",    label: "Time Tracker", icon: RiTimeLine },
      { href: "/focus",   label: "Focus",        icon: RiFocusLine },
      { href: "/drive",   label: "Drive",        icon: RiGoogleLine },
    ],
  },
  {
    label: "Creative",
    items: [
      { href: "/content", label: "Content", icon: RiMicLine },
      { href: "/reading", label: "Reading", icon: RiBook2Line },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/chat",         label: "Chat (Full)",  icon: RiRobot2Line },
      { href: "/memory",       label: "Memory",       icon: RiDatabase2Line },
      { href: "/achievements", label: "Achievements", icon: RiTrophyLine },
    ],
  },
];

export default function TopNav() {
  const pathname = usePathname();
  const { user, signOutUser } = useAuth();
  const { isOpen: panelOpen, toggle: togglePanel } = useChatPanel();
  const [moreOpen, setMoreOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const moreActive = MORE_SECTIONS.flatMap((s) => s.items).some((n) => isActive(n.href));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header
      className="shrink-0 h-14 px-4 flex items-center justify-between gap-4 z-40 relative"
      style={{
        background: "rgba(18, 7, 15, 0.88)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-semibold shadow-sm">
          {user?.displayName?.[0]?.toUpperCase() ?? "P"}
        </div>
        <span className="hidden sm:block font-semibold text-text-primary text-sm">Personal OS</span>
      </Link>

      {/* Primary nav */}
      <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
        {PRIMARY_NAV.map(({ href, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? "bg-accent/15 text-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-white/10"
              }`}
            >
              {label}
            </Link>
          );
        })}

        {/* More dropdown */}
        <div ref={moreRef} className="relative">
          <button
            onClick={() => setMoreOpen((o) => !o)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              moreActive
                ? "bg-accent/15 text-accent"
                : "text-text-secondary hover:text-text-primary hover:bg-white/10"
            }`}
          >
            More <RiMoreLine className="w-3.5 h-3.5" />
          </button>
          {moreOpen && (
            <div
              className="absolute top-full mt-2 left-0 w-56 rounded-xl py-2 z-50 max-h-[85vh] overflow-y-auto"
              style={{
                background: "rgba(18, 7, 15, 0.95)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.50)",
              }}
            >
              {MORE_SECTIONS.map((section, si) => (
                <div key={section.label}>
                  {si > 0 && <div className="my-1.5 mx-3 border-t border-white/10" />}
                  <p className="px-4 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                    {section.label}
                  </p>
                  {section.items.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMoreOpen(false)}
                      className={`flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                        isActive(href)
                          ? "text-accent bg-accent/10"
                          : "text-text-secondary hover:text-text-primary hover:bg-white/10"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {label}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Chat panel toggle */}
      <button
        onClick={togglePanel}
        className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0 ${
          panelOpen
            ? "bg-accent/20 text-accent"
            : "text-text-secondary hover:text-text-primary hover:bg-white/10"
        }`}
        title="Toggle chat panel"
      >
        <RiChatSmile2Line className="w-4 h-4" />
        <span className="hidden lg:inline">Chat</span>
      </button>

      {/* User menu — visible on all screen sizes */}
      <div ref={userRef} className="relative shrink-0">
        <button
          onClick={() => setUserOpen((o) => !o)}
          className="flex items-center gap-2 hover:bg-white/10 rounded-lg px-2 py-1.5 transition-colors"
        >
          {user?.photoURL ? (
            <Image src={user.photoURL} alt="Avatar" width={28} height={28} className="rounded-full" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-semibold">
              {user?.displayName?.[0] ?? "?"}
            </div>
          )}
          <span className="hidden sm:block text-sm font-medium text-text-primary">
            {user?.displayName?.split(" ")[0] ?? "User"}
          </span>
        </button>

        {userOpen && (
          <div
            className="absolute top-full mt-2 right-0 min-w-[180px] rounded-xl py-1 z-50"
            style={{
              background: "rgba(18, 7, 15, 0.95)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.50)",
            }}
          >
            <div className="px-4 py-2.5 border-b border-white/10">
              <p className="text-sm font-medium text-text-primary">{user?.displayName}</p>
              <p className="text-xs text-text-muted truncate">{user?.email}</p>
            </div>
            <Link
              href="/settings"
              onClick={() => setUserOpen(false)}
              className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors"
            >
              <RiSettings3Line className="w-4 h-4" />
              Settings
            </Link>
            <button
              onClick={() => { setUserOpen(false); signOutUser(); }}
              className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
            >
              <RiLogoutBoxLine className="w-4 h-4" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
