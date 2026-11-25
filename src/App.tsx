import { lazy, Suspense, useEffect } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { useApp, useChild } from "@/store/app";
import { prefersReducedMotion } from "@/lib/device";
import { AppShell } from "@/components/AppShell";
import { Toasts } from "@/components/Toasts";
import HomePage from "@/pages/HomePage";
import WelcomePage from "@/pages/WelcomePage";

const LessonPage = lazy(() => import("@/pages/LessonPage"));
const GamesPage = lazy(() => import("@/pages/GamesPage"));
const GamePlayPage = lazy(() => import("@/pages/GamePlayPage"));
const MouthRoomPage = lazy(() => import("@/pages/MouthRoomPage"));
const AchievementsPage = lazy(() => import("@/pages/AchievementsPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const ParentPage = lazy(() => import("@/pages/ParentPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const PlacementPage = lazy(() => import("@/pages/PlacementPage"));
const RenderPage = lazy(() => import("@/pages/RenderPage"));
const HelpPage = lazy(() => import("@/pages/HelpPage"));

function useThemeEffects() {
  const settings = useApp((s) => s.settings);
  const child = useChild();
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = settings.theme === "dark" || (settings.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", dark);
    };
    apply();
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.theme]);
  useEffect(() => {
    document.documentElement.classList.toggle("mode-kid", (child?.mode ?? "kid") === "kid");
    document.documentElement.classList.toggle("mode-teen", child?.mode === "teen");
  }, [child?.mode]);
  const reduce = settings.reducedMotion === "on" || (settings.reducedMotion === "system" && prefersReducedMotion());
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reduce);
  }, [reduce]);
  return reduce;
}

function Guard({ children }: { children: React.ReactNode }) {
  const parent = useApp((s) => s.parent);
  const child = useChild();
  const loc = useLocation();
  if ((!parent || !child) && !loc.pathname.startsWith("/welcome")) return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}

const Loading = () => <div className="grid min-h-[60dvh] place-items-center text-muted-foreground">Đang tải…</div>;

export default function App() {
  const reduce = useThemeEffects();
  return (
    <MotionConfig reducedMotion={reduce ? "always" : "never"}>
      <HashRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/render" element={<RenderPage />} />
            <Route path="/welcome/*" element={<WelcomePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route
              path="/*"
              element={
                <Guard>
                  <Routes>
                    <Route path="/placement" element={<PlacementPage />} />
                    <Route path="/lesson/:pairId" element={<LessonPage />} />
                    <Route path="/play/:gameId" element={<GamePlayPage />} />
                    <Route element={<AppShell />}>
                      <Route index element={<HomePage />} />
                      <Route path="games" element={<GamesPage />} />
                      <Route path="mouth" element={<MouthRoomPage />} />
                      <Route path="achievements" element={<AchievementsPage />} />
                      <Route path="profile" element={<ProfilePage />} />
                      <Route path="parent" element={<ParentPage />} />
                      <Route path="help" element={<HelpPage />} />
                    </Route>
                  </Routes>
                </Guard>
              }
            />
          </Routes>
        </Suspense>
        <Toasts />
      </HashRouter>
    </MotionConfig>
  );
}
