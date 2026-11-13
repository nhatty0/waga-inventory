"use client";

import { useState, useMemo, useEffect } from "react";
import {
  X,
  TrendingUp,
  Banknote,
  Smartphone,
  Building2,
  Receipt,
  Copy,
  Check,
  Package,
  Calendar,
  Sparkles,
  ShoppingBag,
} from "lucide-react";
import { Order } from "@/lib/api";

interface TodaySalesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
}

export default function TodaySalesDrawer({
  isOpen,
  onClose,
  orders,
}: TodaySalesDrawerProps) {
  const [copied, setCopied] = useState<boolean>(false);
  const [todayDateStr, setTodayDateStr] = useState<string>("");

  useEffect(() => {
    setTodayDateStr(new Date().toDateString());
  }, []);

  // Filter orders that occurred today (or retail orders created today)
  const todayOrders = useMemo(() => {
    if (!todayDateStr) return [];
    return orders.filter((o) => {
      try {
        const orderDate = new Date(o.created_at).toDateString();
        return orderDate === todayDateStr && o.order_type === "RETAIL";
      } catch {
        return false;
      }
    });
  }, [orders, todayDateStr]);

  // Evening Cash Drawer Split Calculation
  const { totalETB, totalUnits, telebirrETB, cashETB, cbeETB, otherETB } = useMemo(() => {
    let sumTotal = 0;
    let sumUnits = 0;
    let tbirr = 0;
    let cash = 0;
    let cbe = 0;
    let other = 0;

    todayOrders.forEach((o) => {
      const amt = o.total_amount || 0;
      sumTotal += amt;

      const units = (o.items || []).reduce((acc, item) => acc + item.quantity, 0);
      sumUnits += units;

      const note = (o.notes || "").toLowerCase();
      if (note.includes("ቴሌብር") || note.includes("telebirr")) {
        tbirr += amt;
      } else if (note.includes("ጥሬ") || note.includes("cash")) {
        cash += amt;
      } else if (note.includes("cbe") || note.includes("ባንክ") || note.includes("bank")) {
        cbe += amt;
      } else {
        // Fallback: If not specified or other
        other += amt;
      }
    });

    return {
      totalETB: sumTotal,
      totalUnits: sumUnits,
      telebirrETB: tbirr,
      cashETB: cash,
      cbeETB: cbe,
      otherETB: other,
    };
  }, [todayOrders]);

  // Copy Evening Cash Balancing Summary for Telegram / SMS
  const handleCopySummary = async () => {
    const todayDate = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const lines = [
      `📊 የእስቲፍ ኤሌክትሮኒክስ የቀን ሽያጭ ማጠቃለያ`,
      `📅 ቀን፦ ${todayDate}`,
      `---------------------------------`,
      `📱 ቴሌብር (Telebirr)፦ ${telebirrETB.toLocaleString()} ብር`,
      `💵 ጥሬ ገንዘብ (Cash)፦ ${cashETB.toLocaleString()} ብር`,
      cbeETB > 0 ? `🏛 CBE / ባንክ፦ ${cbeETB.toLocaleString()} ብር` : null,
      otherETB > 0 ? `💳 ሌላ ክፍያ፦ ${otherETB.toLocaleString()} ብር` : null,
      `---------------------------------`,
      `💰 ጠቅላላ ገቢ፦ ${totalETB.toLocaleString()} ብር`,
      `📦 የተሸጡ ዕቃዎች ብዛት፦ ${totalUnits} ፍሬ`,
      `📝 የግብይት ብዛት፦ ${todayOrders.length} ደረሰኝ`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(lines);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm overflow-hidden animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg max-h-[92dvh] sm:max-h-[85vh] flex flex-col bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-black/80 overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex-shrink-0 p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-1.5 tracking-tight">
                <span>የዛሬ ሽያጮች</span>
                <span className="text-xs font-bold text-blue-400 font-mono">(Today&apos;s Sales)</span>
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                የቀን ማጠቃለያና የካዝና ቆጠራ (Cash Drawer Balancing)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 active:scale-95 transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* Top Total Banner */}
          <div className="bg-gradient-to-br from-blue-950/80 via-slate-900 to-slate-950 border border-blue-500/30 rounded-2xl p-4 shadow-lg shadow-blue-950/40 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-blue-300 block">
                  የዛሬ ጠቅላላ ሽያጭ (Today&apos;s Total Revenue)
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-black font-mono text-white tracking-tight">
                    {totalETB.toLocaleString()}
                  </span>
                  <span className="text-sm font-bold text-blue-400">ብር</span>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-mono font-bold">
                  <Package className="w-3.5 h-3.5 text-blue-400" />
                  <span>{totalUnits} ፍሬ ዕቃ</span>
                </span>
                <span className="block text-[11px] text-slate-400 mt-1">
                  {todayOrders.length} ግብይቶች (Sales)
                </span>
              </div>
            </div>
          </div>

          {/* Evening Cash Drawer Balancing Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-emerald-400" />
                <span>የካዝና ቆጠራ ክፍፍል (Payment Split)</span>
              </span>
              <span className="text-[11px] text-slate-400">የምሽት ማስታረቂያ</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Telebirr Box */}
              <div className="bg-slate-950 border border-blue-900/40 rounded-2xl p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-blue-400 flex items-center gap-1">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>ቴሌብር</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Telebirr</span>
                </div>
                <div className="mt-1.5">
                  <span className="text-lg font-black font-mono text-white">
                    {telebirrETB.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-slate-400 ml-1">ብር</span>
                </div>
              </div>

              {/* Cash Box */}
              <div className="bg-slate-950 border border-emerald-900/40 rounded-2xl p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                    <Banknote className="w-3.5 h-3.5" />
                    <span>ጥሬ ገንዘብ</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Cash</span>
                </div>
                <div className="mt-1.5">
                  <span className="text-lg font-black font-mono text-white">
                    {cashETB.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-slate-400 ml-1">ብር</span>
                </div>
              </div>

              {/* CBE / Bank Box */}
              <div className="bg-slate-950 border border-purple-900/40 rounded-2xl p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-purple-400 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>CBE / ባንክ</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Bank</span>
                </div>
                <div className="mt-1.5">
                  <span className="text-lg font-black font-mono text-white">
                    {cbeETB.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-slate-400 ml-1">ብር</span>
                </div>
              </div>

              {/* Other Box */}
              <div className="bg-slate-950 border border-amber-900/40 rounded-2xl p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5" />
                    <span>ሌላ ክፍያ</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Other</span>
                </div>
                <div className="mt-1.5">
                  <span className="text-lg font-black font-mono text-white">
                    {otherETB.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-slate-400 ml-1">ብር</span>
                </div>
              </div>
            </div>
          </div>

          {/* Copy Daily Slip Button */}
          {todayOrders.length > 0 && (
            <button
              type="button"
              onClick={handleCopySummary}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 text-xs font-bold text-slate-200 hover:text-white active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                  <span className="text-emerald-400">ማጠቃለያው ተቀድቷል! (Copied to Clipboard)</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-blue-400" />
                  <span>የምሽት ማጠቃለያ ቅዳ (Copy Summary for Telegram / SMS)</span>
                </>
              )}
            </button>
          )}

          {/* Transaction History Section */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-blue-400" />
                <span>የዛሬ የግብይት ዝርዝር (Today&apos;s Transactions)</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {todayOrders.length} ሽያጮች
              </span>
            </div>

            {/* Empty State */}
            {todayOrders.length === 0 ? (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-8 text-center space-y-2">
                <ShoppingBag className="w-8 h-8 text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-300">
                  ዛሬ የተመዘገበ የቀን ሽያጭ የለም
                </h4>
                <p className="text-xs text-slate-500">
                  No counter walk-in sales recorded yet today.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {todayOrders.map((order) => {
                  const timeFormatted = new Date(order.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  // Detect payment badge
                  const note = order.notes || "";
                  const isTelebirr = note.includes("ቴሌብር") || note.includes("telebirr");
                  const isCash = note.includes("ጥሬ") || note.includes("cash");
                  const isCbe = note.includes("cbe") || note.includes("ባንክ") || note.includes("bank");

                  let badgeColor = "bg-amber-500/10 text-amber-300 border-amber-500/20";
                  let badgeLabel = "ሌላ";
                  if (isTelebirr) {
                    badgeColor = "bg-blue-500/15 text-blue-300 border-blue-500/30";
                    badgeLabel = "ቴሌብር";
                  } else if (isCash) {
                    badgeColor = "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
                    badgeLabel = "ጥሬ ገንዘብ";
                  } else if (isCbe) {
                    badgeColor = "bg-purple-500/15 text-purple-300 border-purple-500/30";
                    badgeLabel = "CBE / ባንክ";
                  }

                  return (
                    <div
                      key={order.id}
                      className="bg-slate-950 border border-slate-800/90 rounded-2xl p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono font-bold text-slate-400">
                            {timeFormatted}
                          </span>
                          <span className="text-xs font-bold text-white">
                            {order.client?.name || "የሱቅ ደንበኛ"}
                          </span>
                        </div>

                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${badgeColor}`}
                        >
                          {badgeLabel}
                        </span>
                      </div>

                      {/* Items List */}
                      <div className="space-y-1">
                        {order.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs text-slate-300"
                          >
                            <span className="truncate pr-2">
                              <span className="font-bold text-slate-200">
                                {item.brand} {item.spec}
                              </span>{" "}
                              <span className="text-slate-400 font-mono">
                                × {item.quantity}
                              </span>
                            </span>
                            <span className="font-mono text-slate-300 shrink-0">
                              {(item.quantity * item.unit_price).toLocaleString()} ብር
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Footer: Notes & Total */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                        <span className="text-[11px] text-slate-400 truncate max-w-[200px]">
                          {order.notes || "መደበኛ የቀን ሽያጭ"}
                        </span>
                        <span className="font-mono font-black text-blue-400 text-sm">
                          {order.total_amount.toLocaleString()} ብር
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-4 border-t border-slate-800 bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs transition-all flex items-center justify-center border border-slate-700"
          >
            ዝጋ (Close)
          </button>
        </div>
      </div>
    </div>
  );
}
