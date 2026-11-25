import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Gamepad2, ScanFace, Trophy, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Học", icon: BookOpen },
  { to: "/games", label: "Trò chơi", icon: Gamepad2 },
  { to: "/mouth", label: "Khẩu hình 3D", icon: ScanFace },
  { to: "/achievements", label: "Thành tích", icon: Trophy },
  { to: "/profile", label: "Hồ sơ", icon: UserRound },
];

export function AppShell() {
  const loc = useLocation();
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={loc.pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="flex-1 px-4 pb-28 pt-4"
        >
          <Outlet />
        </motion.main>
      </AnimatePresence>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-card/90 backdrop-blur-xl" aria-label="Điều hướng chính">
        <ul className="mx-auto grid max-w-2xl grid-cols-5 px-1 pt-1.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink to={to} end={to === "/"} className="group flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-semibold leading-tight">
                {({ isActive }) => (
                  <>
                    <span className={cn("relative grid h-8 w-12 place-items-center rounded-full transition-colors", isActive ? "text-primary" : "text-muted-foreground")}>
                      {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-primary-soft" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                      <Icon className="relative h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                    </span>
                    <span className={cn("text-center", isActive ? "text-foreground" : "text-muted-foreground")}>{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
