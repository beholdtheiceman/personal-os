"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  RiDashboardLine, RiTaskLine, RiRobot2Line, RiMailLine, RiMusicLine,
  RiLoopLeftLine, RiCalendarLine, RiDatabase2Line,
  RiBookLine, RiBowlLine, RiHeartPulseLine, RiLineChartLine,
  RiMoneyDollarCircleLine, RiFolderLine, RiCloseLine, RiApps2Line, RiRestaurantLine,
  RiGoogleLine, RiContactsBook2Line, RiChatSmile2Line,
} from "react-icons/ri";
import { useChatPanel } from "@/contexts/ChatPanelContext";

const PRIMARY = [
  { href: "/dashboard", label: "Home",     icon: RiDashboardLine },
  { href: "/tasks",     label: "Tasks",    icon: RiTaskLine },
  { href: "/gmail",     label: "Gmail",    icon: RiMailLine },
  { href: "/habits",    label: "Habits",   icon: RiLoopLeftLine },
];

const MORE = [
  { href: "/chat",         label: "Chat (Full)",   icon: RiRobot2Line },
  { href: "/calendar",     label: "Calendar",      icon: RiCalendarLine },
  { href: "/projects",     label: "Projects",      icon: RiFolderLine },
  { href: "/media",        label: "Media",         icon: RiMusicLine },
  { href: "/memory",       label: "Memory",        icon: RiDatabase2Line },
  { href: "/journal",      label: "Journal",       icon: RiBookLine },
  { href: "/nutrition",    label: "Nutrition",     icon: RiBowlLine },
  { href: "/meal-planner", label: "Meal Planner",  icon: RiRestaurantLine },
  { href: "/health",       label: "Health",        icon: RiHeartPulseLine },
  { href: "/goals",        label: "Goals",         icon: RiLineChartLine },
  { href: "/finance",      label: "Finance",       icon: RiMoneyDollarCircleLine },
  { href: "/people",       label: "People",        icon: RiContactsBook2Line },
  { href: "/drive",        label: "Drive",         icon: RiGoogleLine },
];

export default function MobileNav() {
  const pathname = usePathname();
  const { isOpen: panelOpen, toggle: togglePanel } = useChatPanel();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const moreActive = MORE.some((n) => isActive(n.href));

  return (
    <>
      {/* Bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 flex z-40"
        style={{ background: "rgba(18, 7, 15, 0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.10)" }}
      >
        {PRIMARY.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors ${
              isActive(href) ? "text-accent" : "text-text-secondary"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </Link>
        ))}

        {/* Chat panel toggle */}
        <button
          onClick={togglePanel}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors ${
            panelOpen ? "text-accent" : "text-text-secondary"
          }`}
        >
          <RiChatSmile2Line className="w-5 h-5" />
          <span>Chat</span>
        </button>

        {/* More button */}
        <button
          onClick={() => setOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors ${
            moreActive ? "text-accent" : "text-text-secondary"
          }`}
        >
          <RiApps2Line className="w-5 h-5" />
          <span>More</span>
        </button>
      </nav>

      {/* Bottom sheet overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />

          {/* Sheet */}
          <div
            className="relative rounded-t-2xl p-5 pb-8"
            style={{ background: "rgba(18, 7, 15, 0.96)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.10)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-text-primary">All Pages</span>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-text-secondary"
              >
                <RiCloseLine className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {MORE.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors ${
                    isActive(href)
                      ? "bg-accent/15 text-accent"
                      : "bg-white/10 text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-xs font-medium">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
