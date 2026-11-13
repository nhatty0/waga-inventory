"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, SendHorizontal, ReceiptText } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  if (pathname === "/login") return null;

  const navItems = [
    {
      label: t.nav.inventory,
      href: "/",
      icon: Boxes,
    },
    {
      label: t.nav.dispatch,
      href: "/dispatch",
      icon: SendHorizontal,
    },
    {
      label: t.nav.ledger,
      href: "/ledger",
      icon: ReceiptText,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800 shadow-2xl safe-area-pb">
      <div className="max-w-md mx-auto px-4 flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-all duration-200 select-none ${
                isActive
                  ? "text-blue-400 font-black scale-105"
                  : "text-slate-400 hover:text-slate-200 active:scale-95"
              }`}
            >
              <div className="relative">
                <div
                  className={`p-1 rounded-xl transition-all ${
                    isActive
                      ? "bg-blue-950/60 border border-blue-800/50 text-blue-400 shadow-md shadow-blue-950/40"
                      : "bg-transparent border border-transparent text-slate-400"
                  }`}
                >
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                </div>
              </div>
              <span className="text-[11px] tracking-tight mt-0.5 font-bold">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
