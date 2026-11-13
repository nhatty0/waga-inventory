"use client";

import { useState } from "react";
import { Check, X, Undo2, Banknote } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Order, settleOrder } from "@/lib/api";

interface SettleModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SettleModal({
  order,
  isOpen,
  onClose,
  onSuccess,
}: SettleModalProps) {
  const { t } = useLanguage();
  const [settleMode, setSettleMode] = useState<"PAYMENT" | "RETURN">("RETURN");
  const [paymentAmount, setPaymentAmount] = useState<number>(order?.balance_due || 0);
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (settleMode === "RETURN") {
        await settleOrder(order.id, {
          restock_returned_items: true,
          notes: notes.trim() || "Items returned unsold by neighbor shop",
        });
      } else {
        await settleOrder(order.id, {
          payment_amount: paymentAmount,
          notes: notes.trim() || "Payment received via Telebirr/Cash",
        });
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to settle order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl safe-area-pb">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-black uppercase text-blue-400 font-mono">
              #{order.id}
            </span>
            <h2 className="text-base font-black text-white">{t.settleModal.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800/60 active:scale-95 transition-all"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Order Info Summary */}
        <div className="mt-4 bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium">{t.settleModal.client}</span>
            <span className="font-bold text-white">
              {order.client?.name || "Walk-in"}
            </span>
          </div>

          <div className="text-xs space-y-1">
            <span className="text-slate-400 block font-medium">{t.settleModal.itemsOut}</span>
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between font-mono text-slate-200">
                <span>
                  {item.quantity}x {item.brand} {item.spec}
                </span>
                <span className="text-slate-400">
                  {item.subtotal.toLocaleString()} {t.common.etb}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-800/80 font-mono">
            <span className="text-slate-400 font-sans">{t.settleModal.remainingBalance}</span>
            <span className="font-black text-amber-400 text-sm">
              {order.balance_due.toLocaleString()} {t.common.etb}
            </span>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            type="button"
            onClick={() => setSettleMode("RETURN")}
            className={`p-3 rounded-2xl border text-left transition-all active:scale-95 ${
              settleMode === "RETURN"
                ? "bg-amber-500/15 border-amber-500/40 text-white shadow-lg shadow-amber-500/10"
                : "bg-slate-950 border-slate-800 text-slate-400"
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
              <Undo2 className="w-4 h-4" />
              <span>{t.settleModal.tabReturn}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {t.settleModal.tabReturnDesc}
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setSettleMode("PAYMENT");
              setPaymentAmount(order.balance_due);
            }}
            className={`p-3 rounded-2xl border text-left transition-all active:scale-95 ${
              settleMode === "PAYMENT"
                ? "bg-blue-950/60 border-blue-800/50 text-white shadow-lg shadow-blue-950/20"
                : "bg-slate-950 border-slate-800 text-slate-400"
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400">
              <Banknote className="w-4 h-4" />
              <span>{t.settleModal.tabPayment}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {t.settleModal.tabPaymentDesc}
            </p>
          </button>
        </div>

        <form onSubmit={handleSettle} className="mt-4 space-y-3.5">
          {settleMode === "PAYMENT" ? (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t.settleModal.paymentAmount}
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-lg font-black text-blue-400 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
              <p className="font-black">{t.settleModal.returnNoticeTitle}</p>
              <p className="text-[11px] text-amber-200/80 mt-0.5">
                {t.settleModal.returnNoticeDesc}
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t.settleModal.memoLabel}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t.settleModal.memoPlaceholder}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
              {error}
            </div>
          )}

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 active:scale-95 transition-all"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-950/50 disabled:opacity-50 active:scale-95"
            >
              {loading ? (
                t.settleModal.btnProcessing
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>
                    {settleMode === "RETURN"
                      ? t.settleModal.btnRestock
                      : `${t.settleModal.btnPay} (${paymentAmount.toLocaleString()} ${t.common.etb})`}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
