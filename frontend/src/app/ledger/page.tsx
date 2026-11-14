"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ReceiptText,
  Package,
  Clock,
  Phone,
  MapPin,
  Truck,
  Undo2,
  Check,
  Banknote,
  Share2,
  CheckCircle2,
  AlertCircle,
  X,
  Store,
  Building2,
} from "lucide-react";
import TopHeader from "@/components/TopHeader";
import { useLanguage } from "@/context/LanguageContext";
import { useShop } from "@/context/ShopContext";
import { isAuthenticated } from "@/lib/auth";
import {
  OpenLedgerResponse,
  Order,
  OrderStatus,
  getOpenLedger,
  settleOrder,
} from "@/lib/api";

type SegmentedTab = "NEIGHBOR_LEND" | "RURAL_BULK";

/** Formats date into natural Amharic relative time (e.g., "ከ 2 ሰዓት በፊት") */
function formatAmharicRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) {
    return "አሁን";
  }
  if (diffMin < 60) {
    return `ከ ${diffMin} ደቂቃ በፊት`;
  }
  if (diffHour < 24) {
    return `ከ ${diffHour} ሰዓት በፊት`;
  }
  if (diffDay < 30) {
    return `ከ ${diffDay} ቀን በፊት`;
  }
  const diffMonth = Math.floor(diffDay / 30);
  return `ከ ${diffMonth} ወር በፊት`;
}

/** Extracts driver and plate information from structured fields or notes */
function getDriverInfo(order: Order): string | null {
  const parts: string[] = [];
  if (order.driver_name) {
    parts.push(`ሹፌር፦ ${order.driver_name}`);
  }
  if (order.driver_phone) {
    parts.push(`ስልክ፦ ${order.driver_phone}`);
  }
  if (order.vehicle_plate) {
    parts.push(`ታርጋ፦ ${order.vehicle_plate}`);
  }
  if (parts.length > 0) {
    return parts.join(" | ");
  }

  // Graceful fallback from notes if driver/plate was captured in text
  if (order.notes) {
    const driverMatch = order.notes.match(/Driver:\s*([^,\.\)\|\;]+)/i);
    const phoneMatch = order.notes.match(/Phone:\s*([^,\.\)\|\;]+)/i);
    const plateMatch = order.notes.match(/Plate\s*([^,\.\)\|\;]+)/i);
    const noteParts: string[] = [];
    if (driverMatch) noteParts.push(`ሹፌር፦ ${driverMatch[1].trim()}`);
    if (phoneMatch) noteParts.push(`ስልክ፦ ${phoneMatch[1].trim()}`);
    if (plateMatch) noteParts.push(`ታርጋ፦ ${plateMatch[1].trim()}`);
    if (noteParts.length > 0) {
      return noteParts.join(" | ");
    }
  }
  return null;
}

/** Plain-text wholesale voucher slip generator for Telegram / SMS */
function generateWholesaleVoucherSlip(
  order: Order,
  shopName?: string,
  shopLocation?: string
): string {
  const storeName = shopName || "ዋጋ ስቶክ";
  const hasCustomLoc =
    shopLocation &&
    !shopLocation.toLowerCase().includes("gondar") &&
    !shopLocation.toLowerCase().includes("piassa") &&
    !shopLocation.includes("ጎንደር") &&
    !shopLocation.includes("ፒያሳ");

  const lines = [
    `📦 ${storeName} - የጅምላ ሂሳብ ደረሰኝ`,
    "━━━━━━━━━━━━━━━━━━━━",
    `ትዕዛዝ ቁጥር፦ #${order.id}`,
    `ደንበኛ፦ ${order.client?.name || "ጅምላ ደንበኛ"}`,
    `መዳረሻ፦ ${order.client?.location || "-"}`,
  ];

  if (order.client?.phone) {
    lines.push(`ስልክ፦ ${order.client.phone}`);
  }

  const driverInfo = getDriverInfo(order);
  if (driverInfo) {
    lines.push(driverInfo);
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━");
  lines.push("የተላኩ ዕቃዎች፦");
  order.items.forEach((item, idx) => {
    const subtotal = (item.quantity * item.unit_price).toLocaleString();
    lines.push(
      `${idx + 1}. ${item.quantity}x ${item.brand || ""} ${item.spec || ""} @ ${item.unit_price.toLocaleString()} ብር = ${subtotal} ብር`
    );
  });

  lines.push("━━━━━━━━━━━━━━━━━━━━");
  lines.push(`ጠቅላላ ድምር፦ ${order.total_amount.toLocaleString()} ብር`);
  lines.push(`የተከፈለ፦ ${order.amount_paid.toLocaleString()} ብር`);
  lines.push(`ቀሪ ዕዳ፦ ${order.balance_due.toLocaleString()} ብር`);
  lines.push("━━━━━━━━━━━━━━━━━━━━");
  lines.push(hasCustomLoc ? `📍 ${storeName} - ${shopLocation}` : `📍 ${storeName}`);

  return lines.join("\n");
}

export default function LedgerPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { session, shopProfile } = useShop();

  const [ledger, setLedger] = useState<OpenLedgerResponse | null>(null);
  const [activeTab, setActiveTab] = useState<SegmentedTab>("NEIGHBOR_LEND");
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Quick Action Pending & Modal States
  const [processingOrderId, setProcessingOrderId] = useState<number | null>(null);
  const [activeCollectOrder, setActiveCollectOrder] = useState<Order | null>(null);
  const [collectPaymentAmount, setCollectPaymentAmount] = useState<number | "">("");
  const [collectNotes, setCollectNotes] = useState<string>("");
  const [submittingCollect, setSubmittingCollect] = useState<boolean>(false);
  const [copiedOrderId, setCopiedOrderId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchLedger = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const data = await getOpenLedger();
      setLedger(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "ክፍት የዕዳ መዝገብን ማምጣት አልተቻለም"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    fetchLedger();
  }, [fetchLedger, router]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Flatten and normalize all open orders from clients and anonymous groups
  const allOpenOrders = useMemo(() => {
    if (!ledger) return [];
    const list: Order[] = [];

    ledger.clients.forEach((group) => {
      group.orders.forEach((o) => {
        list.push({
          ...o,
          client: o.client || group.client,
        });
      });
    });

    if (ledger.anonymous_orders) {
      ledger.anonymous_orders.forEach((o) => list.push(o));
    }

    return list;
  }, [ledger]);

  // Tab 1: "የጎረቤት ውሰት" (Neighbor Loans — PENDING_RETURN)
  const neighborLoans = useMemo(() => {
    return allOpenOrders.filter((o) => o.status === "PENDING_RETURN");
  }, [allOpenOrders]);

  // Tab 2: "የጅምላ ቀሪ ዕዳ" (Wholesale Balances — PARTIALLY_PAID)
  const wholesaleBalances = useMemo(() => {
    return allOpenOrders.filter(
      (o) => o.status === "PARTIALLY_PAID" && (o.balance_due > 0 || o.total_amount > o.amount_paid)
    );
  }, [allOpenOrders]);

  // Top Metric 1: "ያልተመለሱ ዕቃዎች" (Total unreturned borrowed items count)
  const totalUnreturnedItems = useMemo(() => {
    return neighborLoans.reduce(
      (acc, o) => acc + o.items.reduce((iAcc, item) => iAcc + item.quantity, 0),
      0
    );
  }, [neighborLoans]);

  // Top Metric 2: "የሚሰበሰብ ቀሪ ዕዳ" (Total outstanding receivables in ETB)
  const totalOutstandingReceivables = useMemo(() => {
    if (ledger?.total_receivables !== undefined) {
      return ledger.total_receivables;
    }
    return allOpenOrders.reduce((acc, o) => acc + o.balance_due, 0);
  }, [ledger, allOpenOrders]);

  // Optimistic helper to remove settled order from local state
  const optimisticallyRemoveOrder = (orderId: number) => {
    setLedger((prev) => {
      if (!prev) return null;
      const targetOrder = allOpenOrders.find((o) => o.id === orderId);
      const balanceToDeduct = targetOrder ? targetOrder.balance_due : 0;

      return {
        ...prev,
        total_open_orders: Math.max(0, prev.total_open_orders - 1),
        total_receivables: Math.max(0, prev.total_receivables - balanceToDeduct),
        clients: prev.clients
          .map((g) => ({
            ...g,
            orders: g.orders.filter((o) => o.id !== orderId),
          }))
          .filter((g) => g.orders.length > 0),
        anonymous_orders: prev.anonymous_orders.filter((o) => o.id !== orderId),
      };
    });
  };

  // Optimistic helper to update wholesale payment amount
  const optimisticallyUpdateWholesalePayment = (orderId: number, paid: number) => {
    setLedger((prev) => {
      if (!prev) return null;
      const updatedClients = prev.clients
        .map((g) => ({
          ...g,
          orders: g.orders
            .map((o) => {
              if (o.id !== orderId) return o;
              const newAmountPaid = o.amount_paid + paid;
              const newBalanceDue = Math.max(0, o.total_amount - newAmountPaid);
              const newStatus: OrderStatus = newBalanceDue <= 0 ? "COMPLETED" : "PARTIALLY_PAID";
              return {
                ...o,
                amount_paid: newAmountPaid,
                balance_due: newBalanceDue,
                status: newStatus,
              };
            })
            .filter((o) => o.balance_due > 0),
        }))
        .filter((g) => g.orders.length > 0);

      const updatedAnonymous = prev.anonymous_orders
        .map((o) => {
          if (o.id !== orderId) return o;
          const newAmountPaid = o.amount_paid + paid;
          const newBalanceDue = Math.max(0, o.total_amount - newAmountPaid);
          const newStatus: OrderStatus = newBalanceDue <= 0 ? "COMPLETED" : "PARTIALLY_PAID";
          return {
            ...o,
            amount_paid: newAmountPaid,
            balance_due: newBalanceDue,
            status: newStatus,
          };
        })
        .filter((o) => o.balance_due > 0);

      return {
        ...prev,
        total_receivables: Math.max(0, prev.total_receivables - paid),
        clients: updatedClients,
        anonymous_orders: updatedAnonymous,
      };
    });
  };

  // -------------------------------------------------------------
  // Neighbor Action 1: "ዕቃው ተመልሷል" (Item Returned & Restocked)
  // sends POST /api/ledger/{order_id}/settle with { "restock_returned_items": true }
  // -------------------------------------------------------------
  const handleItemReturned = async (orderId: number) => {
    setProcessingOrderId(orderId);
    optimisticallyRemoveOrder(orderId);
    showToast("ዕቃው ወደ መደብር ስቶክ ተመልሷል!");

    try {
      await settleOrder(orderId, {
        restock_returned_items: true,
      });
      fetchLedger(true);
    } catch (err: unknown) {
      fetchLedger(true);
      showToast(
        `ስህተት ተከስቷል፦ ${err instanceof Error ? err.message : "Failed to return item"}`
      );
    } finally {
      setProcessingOrderId(null);
    }
  };

  // -------------------------------------------------------------
  // Neighbor Action 2: "ተከፍሏል" (Cash/Telebirr Settled)
  // sends POST /api/ledger/{order_id}/settle with { "restock_returned_items": false }
  // -------------------------------------------------------------
  const handleNeighborPaymentSettled = async (orderId: number) => {
    setProcessingOrderId(orderId);
    optimisticallyRemoveOrder(orderId);
    showToast("ክፍያው ተመዝግቧል!");

    try {
      await settleOrder(orderId, {
        restock_returned_items: false,
      });
      fetchLedger(true);
    } catch (err: unknown) {
      fetchLedger(true);
      showToast(
        `ስህተት ተከስቷል፦ ${err instanceof Error ? err.message : "Failed to settle payment"}`
      );
    } finally {
      setProcessingOrderId(null);
    }
  };

  // -------------------------------------------------------------
  // Wholesale Action: Open Collect Balance Modal
  // -------------------------------------------------------------
  const handleOpenCollectModal = (order: Order) => {
    setActiveCollectOrder(order);
    setCollectPaymentAmount(order.balance_due);
    setCollectNotes("");
  };

  // Wholesale Action: Submit Partial or Full Balance Collection
  const handleSubmitCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCollectOrder) return;

    const amount =
      typeof collectPaymentAmount === "number" ? collectPaymentAmount : 0;
    if (amount <= 0) {
      showToast("እባክዎ ትክክለኛ የገንዘብ መጠን ያስገቡ");
      return;
    }

    setSubmittingCollect(true);
    const targetOrderId = activeCollectOrder.id;
    optimisticallyUpdateWholesalePayment(targetOrderId, amount);
    showToast("ክፍያው ተመዝግቧል!");
    setActiveCollectOrder(null);

    try {
      await settleOrder(targetOrderId, {
        payment_amount: amount,
        notes: collectNotes.trim() || undefined,
      });
      fetchLedger(true);
    } catch (err: unknown) {
      fetchLedger(true);
      showToast(
        `ስህተት ተከስቷል፦ ${err instanceof Error ? err.message : "Failed to record payment"}`
      );
    } finally {
      setSubmittingCollect(false);
    }
  };

  // -------------------------------------------------------------
  // Wholesale Action: "ደረሰኝ ላክ" (Share Receipt via Telegram / SMS)
  // -------------------------------------------------------------
  const handleCopyVoucher = async (order: Order) => {
    const sName = session?.shop_name || shopProfile.name;
    const sLoc = session?.location || shopProfile.location;
    const text = generateWholesaleVoucherSlip(order, sName, sLoc);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedOrderId(order.id);
      showToast("ደረሰኙ ተቀድቷል! ወደ ቴሌግራም ወይም SMS መላክ ይችላሉ");
      setTimeout(() => setCopiedOrderId(null), 2500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiedOrderId(order.id);
      showToast("ደረሰኙ ተቀድቷል!");
      setTimeout(() => setCopiedOrderId(null), 2500);
    }
  };

  const currentTabList = activeTab === "NEIGHBOR_LEND" ? neighborLoans : wholesaleBalances;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <TopHeader
        title={t.ledger.title}
        subtitle="ያልተከፈሉ ሂሳቦችና የጎረቤት ውሰቶች"
        onRefresh={() => fetchLedger(true)}
        isRefreshing={refreshing}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-blue-600 text-white text-xs font-black rounded-full shadow-2xl shadow-blue-950/70 border border-blue-400 animate-in fade-in slide-in-from-top duration-150 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 py-3.5 space-y-4">
        {/* ========================================================= */}
        {/* 1. TOP SUMMARY METRIC CARDS (ELECTRIC BLUE DARK THEME)    */}
        {/* ========================================================= */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Card 1: ያልተመለሱ ዕቃዎች (Total unreturned borrowed items count) */}
          <div className="bg-slate-900/90 border border-blue-500/20 shadow-lg shadow-blue-950/30 rounded-2xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 block tracking-tight">
                ያልተመለሱ ዕቃዎች
              </span>
              <div className="p-2 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-sm shadow-blue-500/10">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-blue-400 font-mono block">
                {loading ? "..." : `${totalUnreturnedItems}`}
                <span className="text-xs font-sans font-bold text-slate-400 ml-1">ፍሬ</span>
              </span>
              <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                Unreturned Items Out
              </span>
            </div>
          </div>

          {/* Card 2: የሚሰበሰብ ቀሪ ዕዳ (Total outstanding receivables in ETB) */}
          <div className="bg-slate-900/90 border border-blue-500/20 shadow-lg shadow-blue-950/30 rounded-2xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 block tracking-tight">
                የሚሰበሰብ ቀሪ ዕዳ
              </span>
              <div className="p-2 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-sm shadow-blue-500/10">
                <ReceiptText className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-xl font-black text-blue-400 font-mono block truncate">
                {loading ? "..." : totalOutstandingReceivables.toLocaleString()}
                <span className="text-xs font-sans font-bold text-slate-400 ml-1">ብር</span>
              </span>
              <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                Outstanding Receivables
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. TWO FILTER TABS                                        */}
        {/* ========================================================= */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900/90 border border-blue-500/20 rounded-2xl select-none">
          {/* Tab 1: "የጎረቤት ውሰት" (Neighbor Loans — PENDING_RETURN) */}
          <button
            type="button"
            onClick={() => setActiveTab("NEIGHBOR_LEND")}
            className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 active:scale-95 ${
              activeTab === "NEIGHBOR_LEND"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-400/40"
                : "bg-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>የጎረቤት ውሰት</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                activeTab === "NEIGHBOR_LEND"
                  ? "bg-blue-700/80 text-white border border-blue-400/40"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {neighborLoans.length}
            </span>
          </button>

          {/* Tab 2: "የጅምላ ቀሪ ዕዳ" (Wholesale Balances — PARTIALLY_PAID) */}
          <button
            type="button"
            onClick={() => setActiveTab("RURAL_BULK")}
            className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 active:scale-95 ${
              activeTab === "RURAL_BULK"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-400/40"
                : "bg-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>የጅምላ ቀሪ ዕዳ</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                activeTab === "RURAL_BULK"
                  ? "bg-blue-700/80 text-white border border-blue-400/40"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {wholesaleBalances.length}
            </span>
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-center space-y-2">
            <AlertCircle className="w-6 h-6 text-rose-400 mx-auto" />
            <p className="text-xs text-rose-300 font-semibold">{error}</p>
            <button
              onClick={() => fetchLedger()}
              className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl text-xs font-bold"
            >
              {t.common.retry}
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-36 rounded-2xl bg-slate-900/60 border border-slate-800/60 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* ========================================================= */}
        {/* 5. CLEAN EMPTY STATE                                      */}
        {/* ========================================================= */}
        {!loading && !error && currentTabList.length === 0 && (
          <div className="text-center py-16 px-5 bg-slate-900/40 rounded-3xl border border-blue-500/20 space-y-2.5 animate-in fade-in">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto shadow-md shadow-blue-950/40">
              <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
            </div>
            <h3 className="text-base font-black text-white">
              ምንም ክፍት ውሰት ወይም ዕዳ የለም
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              {activeTab === "NEIGHBOR_LEND"
                ? "ሁሉም የጎረቤት ውሰቶች ተመልሰዋል ወይም ተወራርደዋል! 🎉"
                : "ሁሉም የጅምላ ሽያጭ ቀሪ ሂሳቦች ሙሉ በሙሉ ተከፍለዋል! 🎉"}
            </p>
            <p className="text-[11px] text-slate-500">
              {activeTab === "NEIGHBOR_LEND"
                ? "No active neighbor peer loans pending return."
                : "No outstanding wholesale bulk receivables."}
            </p>
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. TAB 1: NEIGHBOR LOAN CARDS                             */}
        {/* ========================================================= */}
        {!loading && !error && activeTab === "NEIGHBOR_LEND" && neighborLoans.length > 0 && (
          <div className="space-y-3">
            {neighborLoans.map((order) => {
              const isProcessing = processingOrderId === order.id;

              return (
                <div
                  key={order.id}
                  className="bg-slate-900 border border-slate-800 hover:border-blue-500/30 rounded-2xl p-4 space-y-3 shadow-md transition-all"
                >
                  {/* Header: Shop Name & Time Elapsed */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-600/15 border border-blue-500/30 text-blue-300">
                          የጎረቤት ውሰት
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          #{order.id}
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-blue-400" />
                        <span>{order.client?.name || "የጎረቤት ሱቅ"}</span>
                      </h3>
                      {order.client?.location && (
                        <p className="text-[11px] text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          <span>{order.client.location}</span>
                        </p>
                      )}
                    </div>

                    {/* Time elapsed since dispatch */}
                    <div className="text-right shrink-0">
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-bold text-amber-300">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>{formatAmharicRelativeTime(order.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Item Brand / Spec / Quantity */}
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
                    {order.items.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-blue-950 text-blue-400 font-mono font-black text-xs flex items-center justify-center border border-blue-800/60">
                            {it.quantity}
                          </span>
                          <span className="font-bold text-slate-200">
                            {it.brand} {it.spec}
                          </span>
                        </div>
                        <span className="font-mono text-slate-400 text-xs">
                          {it.subtotal.toLocaleString()} ብር
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Agreed Payout (ETB) & Memo */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                    <div className="text-slate-400 text-[11px]">
                      <span>የስምምነት ዋጋ፦ </span>
                      <span className="font-mono font-black text-blue-400 text-xs">
                        {order.total_amount.toLocaleString()} ብር
                      </span>
                    </div>

                    {order.notes && (
                      <span className="text-[10px] text-slate-500 italic max-w-[180px] truncate" title={order.notes}>
                        "{order.notes}"
                      </span>
                    )}
                  </div>

                  {/* Neighbor Loan Card Actions */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {/* Action 1: "ዕቃው ተመልሷል" (Item Returned -> restock_returned_items: true) */}
                    <button
                      type="button"
                      onClick={() => handleItemReturned(order.id)}
                      disabled={isProcessing}
                      className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border border-slate-700/80 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
                      title="ዕቃው ወደ መደብር ስቶክ ይመለስ"
                    >
                      <Undo2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>ዕቃው ተመልሷል</span>
                    </button>

                    {/* Action 2: "ተከፍሏል" (Cash/Telebirr Settled -> restock_returned_items: false) */}
                    <button
                      type="button"
                      onClick={() => handleNeighborPaymentSettled(order.id)}
                      disabled={isProcessing}
                      className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/30 border border-blue-400/30 active:scale-95 transition-all disabled:opacity-50"
                      title="ክፍያው ተመዝግቦ ይዘጋ"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>ተከፍሏል</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================= */}
        {/* 4. TAB 2: WHOLESALE CREDIT CARDS                          */}
        {/* ========================================================= */}
        {!loading && !error && activeTab === "RURAL_BULK" && wholesaleBalances.length > 0 && (
          <div className="space-y-3">
            {wholesaleBalances.map((order) => {
              const isCopied = copiedOrderId === order.id;
              const driverInfo = getDriverInfo(order);

              return (
                <div
                  key={order.id}
                  className="bg-slate-900 border border-slate-800 hover:border-blue-500/30 rounded-2xl p-4 space-y-3 shadow-md transition-all"
                >
                  {/* Client Name, Location & Remaining Debt */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-600/15 border border-blue-500/30 text-blue-300">
                          የክፍለ-ሀገር ጅምላ
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          #{order.id}
                        </span>
                      </div>

                      <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-blue-400" />
                        <span>{order.client?.name || "ጅምላ ደንበኛ"}</span>
                      </h3>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        {order.client?.location &&
                          !order.client.location.toLowerCase().includes("gondar") &&
                          !order.client.location.toLowerCase().includes("piassa") &&
                          !order.client.location.includes("ጎንደር") &&
                          !order.client.location.includes("ፒያሳ") && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-blue-400" />
                              <span>{order.client.location}</span>
                            </span>
                          )}
                        {order.client?.phone && (
                          <a
                            href={`tel:${order.client.phone}`}
                            className="flex items-center gap-1 hover:text-blue-300 font-mono text-[10px]"
                          >
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{order.client.phone}</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Remaining debt ("ቀሪ ዕዳ") */}
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        ቀሪ ዕዳ
                      </span>
                      <span className="text-base font-black text-amber-400 font-mono block">
                        {order.balance_due.toLocaleString()} ብር
                      </span>
                    </div>
                  </div>

                  {/* Driver / Plate Info (if present) */}
                  {driverInfo && (
                    <div className="bg-slate-950/70 px-3 py-1.5 rounded-xl border border-slate-800/80 flex items-center gap-2 text-[11px] text-amber-300">
                      <Truck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{driverInfo}</span>
                    </div>
                  )}

                  {/* Items list */}
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1">
                    {order.items.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between text-xs font-mono text-slate-300"
                      >
                        <span>
                          {it.quantity}x {it.brand} {it.spec}
                        </span>
                        <span className="text-slate-500">
                          {it.subtotal.toLocaleString()} ብር
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Total Amount & Paid Amount */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800/60 font-mono">
                    <div className="text-slate-400">
                      <span>ጠቅላላ፦ </span>
                      <span className="text-white font-bold">
                        {order.total_amount.toLocaleString()} ብር
                      </span>
                    </div>
                    <div className="text-slate-400 text-right">
                      <span>የተከፈለ፦ </span>
                      <span className="text-blue-400 font-bold">
                        {order.amount_paid.toLocaleString()} ብር
                      </span>
                    </div>
                  </div>

                  {/* Wholesale Credit Card Actions */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {/* "ቀሪ ክፍያ ተቀበል" (Collect Balance) Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenCollectModal(order)}
                      className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/30 border border-blue-400/30 active:scale-95 transition-all"
                    >
                      <Banknote className="w-4 h-4" />
                      <span>ቀሪ ክፍያ ተቀበል</span>
                    </button>

                    {/* "ደረሰኝ ላክ" (Share Receipt) Icon Button */}
                    <button
                      type="button"
                      onClick={() => handleCopyVoucher(order)}
                      className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border active:scale-95 transition-all ${
                        isCopied
                          ? "bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/40"
                          : "bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border-slate-700/80"
                      }`}
                      title="ደረሰኝ ላክ (Share receipt to Telegram/SMS)"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>ተቀድቷል!</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-3.5 h-3.5 text-blue-400" />
                          <span>ደረሰኝ ላክ</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* QUICK COLLECT WHOLESALE PAYMENT MODAL                      */}
      {/* ========================================================= */}
      {activeCollectOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-blue-500/20 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    ቀሪ ክፍያ መቀበያ
                  </h3>
                  <p className="text-xs text-slate-400">
                    ትዕዛዝ #{activeCollectOrder.id} • {activeCollectOrder.client?.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveCollectOrder(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800/60 active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Financial Summary */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>ጠቅላላ ሂሳብ፦</span>
                <span className="text-white font-bold">
                  {activeCollectOrder.total_amount.toLocaleString()} ብር
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>ቀደም ሲል የተከፈለ፦</span>
                <span className="text-blue-400 font-bold">
                  {activeCollectOrder.amount_paid.toLocaleString()} ብር
                </span>
              </div>
              <div className="flex justify-between text-slate-400 pt-1.5 border-t border-slate-900">
                <span>የቀረው ክፍያ (ቀሪ ዕዳ)፦</span>
                <span className="text-amber-400 font-black text-sm">
                  {activeCollectOrder.balance_due.toLocaleString()} ብር
                </span>
              </div>
            </div>

            {/* Payment Input Form */}
            <form onSubmit={handleSubmitCollectPayment} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    የተከፈለ ገንዘብ መጠን (ETB)
                  </label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setCollectPaymentAmount(
                          Math.round(activeCollectOrder.balance_due / 2)
                        )
                      }
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 hover:text-white active:scale-95"
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCollectPaymentAmount(activeCollectOrder.balance_due)
                      }
                      className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-600/30 border border-blue-500/40 text-blue-300 active:scale-95"
                    >
                      ሙሉ ቀሪ ({activeCollectOrder.balance_due.toLocaleString()} ብር)
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={activeCollectOrder.balance_due}
                    placeholder="0"
                    value={collectPaymentAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        setCollectPaymentAmount("");
                      } else {
                        const parsed = parseFloat(val);
                        setCollectPaymentAmount(isNaN(parsed) ? "" : parsed);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xl font-black text-blue-400 font-mono focus:outline-none focus:border-blue-500 shadow-inner"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 pointer-events-none">
                    ብር
                  </span>
                </div>
              </div>

              {/* Memo / Payment Method Note */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  የክፍያ ማስታወሻ (Receipt / Note - Optional)
                </label>
                <input
                  type="text"
                  placeholder="ምሳሌ፦ በቴሌብር ደረሰኝ ቁጥር #88291..."
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveCollectOrder(null)}
                  disabled={submittingCollect}
                  className="flex-1 py-3.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 active:scale-95 transition-all"
                >
                  ይቅር (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={submittingCollect || collectPaymentAmount === "" || collectPaymentAmount <= 0}
                  className="flex-1 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/30 border border-blue-400/30 disabled:opacity-50 active:scale-95"
                >
                  {submittingCollect ? (
                    <span>በመመዝገብ ላይ...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>ክፍያውን ተቀበል</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
