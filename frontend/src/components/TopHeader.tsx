"use client";

import { useEffect } from "react";
import { MapPin, RefreshCw, Languages, LogOut } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useShop, ShopProfile } from "@/context/ShopContext";
import { logout } from "@/lib/auth";
import { getMe } from "@/lib/api";
import WagaLogo from "@/components/WagaLogo";

interface TopHeaderProps {
  title?: string;
  subtitle?: string;
  shop?: ShopProfile;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function TopHeader({
  title,
  subtitle,
  shop,
  onRefresh,
  isRefreshing = false,
}: TopHeaderProps) {
  const { language, toggleLanguage, t } = useLanguage();
  const { session, shopProfile: contextShopProfile, setSession } = useShop();

  const currentShopName = session?.shop_name || shop?.name || contextShopProfile.name;
  const currentLocation = session?.location || shop?.location || contextShopProfile.location;
  const displayTitle = title || t.appName;

  // Background check for updated telegram_connected status
  useEffect(() => {
    if (session && !session.telegram_connected) {
      getMe()
        .then((updated) => {
          if (updated && updated.telegram_connected !== session.telegram_connected) {
            setSession(updated);
          }
        })
        .catch(() => {});
    }
  }, [session, setSession]);

  const telegramBotUsername = session?.telegram_bot_username || "WagaStockBot";
  const telegramBotUrl = session?.shop_id
    ? `https://t.me/${telegramBotUsername}?start=shop_${session.shop_id}`
    : `https://t.me/${telegramBotUsername}`;

  const isCustomLocation = Boolean(
    currentLocation &&
    currentLocation.trim() !== "" &&
    currentLocation.toLowerCase() !== "gondar" &&
    !currentLocation.toLowerCase().includes("gondar") &&
    !currentLocation.toLowerCase().includes("piassa") &&
    !currentLocation.includes("ጎንደር") &&
    !currentLocation.includes("ፒያሳ")
  );

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 px-4 py-2.5">
      <div className="max-w-md mx-auto space-y-1.5">
        {/* Main Header Row */}
        <div className="flex items-center justify-between gap-2">
          {/* Title and Logo */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <WagaLogo size="xs" />
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center truncate">
                <span>{displayTitle}</span>
              </h1>
            </div>

            {/* Shop Name & Location (Dynamically from Merchant Session) */}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 font-medium truncate">
              {subtitle ? (
                <span className="truncate">{subtitle}</span>
              ) : (
                <>
                  <span className="font-bold text-slate-200 truncate">{currentShopName}</span>
                  {isCustomLocation && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded-md border border-emerald-800/50 shrink-0">
                      <MapPin className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                      <span>{currentLocation}</span>
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Action Cluster: Language, Refresh, Logout */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Language Toggle Button */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-black text-amber-400 hover:text-white active:scale-95 transition-all shadow-sm"
              title="Switch Language / ቋንቋ ቀይር"
              aria-label="Toggle language"
            >
              <Languages className="w-3.5 h-3.5" />
              <span>{language === "am" ? "EN" : "አማ"}</span>
            </button>

            {/* Refresh Button */}
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="p-1.5 sm:p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white active:bg-slate-800 active:scale-95 transition-colors disabled:opacity-50"
                title="Refresh Data"
                aria-label="Refresh"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    isRefreshing ? "animate-spin text-blue-400" : ""
                  }`}
                />
              </button>
            )}

            {/* Logout Button ("ውጣ") */}
            <button
              onClick={() => logout()}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-800/60 text-xs font-black text-slate-300 hover:text-rose-300 active:scale-95 transition-all shadow-sm"
              title="ከሱቁ ውጣ (Sign Out)"
              aria-label="Logout"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400" />
              <span>ውጣ</span>
            </button>
          </div>
        </div>

        {/* Sub-bar: One-Tap Telegram Bot Status / Connect Link */}
        {session && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-900/80 text-[10px]">
            <div className="flex items-center gap-1.5 text-slate-400 truncate">
              <span className="font-mono text-slate-500 font-bold shrink-0">#{session.shop_id}</span>
              <span className="text-slate-300 font-semibold truncate">{session.shop_name}</span>
            </div>

            {session.telegram_connected ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-800/60 text-emerald-400 font-bold shadow-sm shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>✅ ቴሌግራም ተገናኝቷል</span>
              </span>
            ) : (
              <a
                href={telegramBotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black shadow-sm shadow-blue-600/30 border border-blue-400/40 transition-all shrink-0"
                title="ቴሌግራም ቦት ያገናኙ"
              >
                <span>📲 ቴሌግራም ያገናኙ</span>
              </a>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
