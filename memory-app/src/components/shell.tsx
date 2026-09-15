"use client";
import { App, Toolbar, TabbarLink } from "konsta/react";
import {
  House,
  Images,
  PlusCircle,
  GearSix,
  ArrowLeft,
  Leaf,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import type { Settings } from "@/lib/contracts";
import { api, errorText } from "./api";
const Context = createContext<{
  settings: Settings | null;
  refresh: () => void;
  settingsError: string;
}>({ settings: null, refresh: () => {}, settingsError: "" });
export const useSettings = () => useContext(Context);
const tabs = [
  ["/", "홈", House],
  ["/start", "이야기 시작", PlusCircle],
  ["/library", "보관함", Images],
  ["/settings", "설정", GearSix],
] as const;
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname(),
    router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [offline, setOffline] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const refresh = () => {
    setSettingsError("");
    api<Settings | { settings: Settings }>("/api/settings")
      .then((s) => setSettings("settings" in s ? s.settings : s))
      .catch((e) => setSettingsError(errorText(e)));
  };
  useEffect(() => {
    refresh();
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        settings?.theme === "system" || !settings?.theme
          ? media.matches
            ? "dark"
            : "light"
          : settings.theme;
      document.documentElement.classList.toggle(
        "dark",
        document.documentElement.dataset.theme === "dark",
      );
      document.documentElement.dataset.large = String(
        settings?.largeText ?? true,
      );
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings]);
  const selected =
    tabs.find((t) => t[0] === path)?.[0] ??
    (path === "/preview" ? "/preview" : "journey");
  return (
    <Context.Provider value={{ settings, refresh, settingsError }}>
      <App theme="ios" className="memory-app">
        <a className="skip-link" href="#main">
          본문으로 건너뛰기
        </a>
        <header className="topbar">
          <div className="top-inner">
            {path !== "/" ? (
              <button
                aria-label="뒤로가기"
                className="icon-button"
                onClick={() => router.back()}
              >
                <ArrowLeft size={24} />
              </button>
            ) : (
              <Leaf size={28} weight="duotone" className="brand-leaf" />
            )}
            <Link className="brand" href="/">
              기억의 조각
            </Link>
            <label className="screen-menu">
              <span className="sr-only">화면 선택</span>
              <select
                aria-label="화면 선택"
                value={selected}
                onChange={(e) => router.push(e.target.value)}
              >
                {tabs.map((t) => (
                  <option value={t[0]} key={t[0]}>
                    {t[1]}
                  </option>
                ))}
                <option value="/preview">샘플 미리보기</option>
                {selected === "journey" && (
                  <option value="journey">이야기 기록 중</option>
                )}
              </select>
            </label>
            <Link
              href="/settings"
              aria-label="설정 열기"
              className="icon-button"
            >
              <GearSix size={25} />
            </Link>
          </div>
        </header>
        {offline && (
          <div role="status" className="notice">
            인터넷 연결이 끊겼어요. 서버에 연결하면 저장된 이야기를 다시 열 수
            있어요.
          </div>
        )}
        <main id="main" className="main-content">
          {children}
        </main>
        <Toolbar className="bottom-tabs" tabbar>
          <nav aria-label="주요 메뉴" className="tab-inner">
            {tabs.map(([href, label, Icon]) => (
              <TabbarLink
                key={href}
                active={path === href}
                linkProps={{
                  href,
                  "aria-current": path === href ? "page" : undefined,
                }}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(href);
                }}
                icon={
                  <Icon size={26} weight={path === href ? "fill" : "regular"} />
                }
                label={label}
              />
            ))}
          </nav>
        </Toolbar>
      </App>
    </Context.Provider>
  );
}
