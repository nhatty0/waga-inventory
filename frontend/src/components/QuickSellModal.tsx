"use client";

import { useState, useEffect } from "react";
import {
  ShoppingBag,
  X,
  Plus,
  Minus,
  CheckCircle2,
  Boxes,
  Banknote,
  Smartphone,
  Building2,
  MoreHorizontal,
  FileText,
  AlertCircle,
} from "lucide-react";
import { ProductVariant, Order, dispatchOrder } from "@/lib/api";

export type PaymentMethod = "Telebirr" | "Cash" | "CBE" | "Other";

interface QuickSellModalProps {
  variant: ProductVariant | null;
  productName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (soldQty: number, order: Order) => void;
}

export default function QuickSellModal({
  variant,
  productName,
  isOpen,
  onClose,
  onSuccess,
}: QuickSellModalProps) {
  const [quantity, setQuantity] = useState<number | "">(1);
  const [unitPrice, setUnitPrice] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Telebirr");
  const [customerNote, setCustomerNote] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize values when modal opens
  useEffect(() => {
    if (variant && isOpen) {
      setQuantity(1);
      setUnitPrice(variant.retail_price > 0 ? variant.retail_price : 0);
      setPaymentMethod("Telebirr");
      setCustomerNote("");
      setCustomerName("");
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [variant, isOpen]);

  if (!isOpen || !variant) return null;

  const maxStock = variant.stock_quantity;
  const currentQty = typeof quantity === "number" ? quantity : 0;
  const currentPrice = typeof unitPrice === "number" ? unitPrice : 0;
  const totalAmount = currentQty * currentPrice;

  const handleStepChange = (delta: number) => {
    const base = typeof quantity === "number" ? quantity : 1;
    const next = Math.max(1, Math.min(maxStock, base + delta));
    setQuantity(next);
    setErrorMsg(null);
  };

  const getPaymentLabel = (method: PaymentMethod) => {
    switch (method) {
      case "Telebirr":
        return "ቴሌብር (Telebirr)";
      case "Cash":
        return "ጥሬ ገንዘብ (Cash)";
      case "CBE":
        return "CBE / ባንክ";
      case "Other":
        return "ሌላ (Other)";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentQty <= 0) {
      setErrorMsg("እባክዎ የሚሸጥ ብዛት ያስገቡ (Please enter valid quantity)");
      return;
    }
    if (currentQty > maxStock) {
      setErrorMsg(`በቂ ክምችት የለም። በመደብር ያለ፦ ${maxStock} ፍሬ ብቻ (Insufficient stock)`);
      return;
    }
    if (currentPrice < 0) {
      setErrorMsg("ዋጋ ከ 0 ያነሰ መሆን አይችልም (Price cannot be negative)");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const clientNameResolved = customerName.trim() || "የሱቅ ደንበኛ";
    const paymentLabel = getPaymentLabel(paymentMethod);
    const combinedNotes = customerNote.trim()
      ? `[ክፍያ፦ ${paymentLabel}] ${customerNote.trim()}`
      : `[ክፍያ፦ ${paymentLabel}]`;

    try {
      const order = await dispatchOrder({
        order_type: "RETAIL",
        client_name: clientNameResolved,
        items: [
          {
            variant_id: variant.id,
            quantity: currentQty,
            unit_price: currentPrice,
          },
        ],
        amount_paid: totalAmount,
        notes: combinedNotes,
      });

      onSuccess(currentQty, order);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "ሽያጩን መመዝገብ አልተቻለም (Failed to record sale)"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm overflow-hidden animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg max-h-[92dvh] sm:max-h-[85vh] flex flex-col bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-black/80 overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex-shrink-0 p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-1.5 tracking-tight">
                <span>የችርቻሮ ሽያጭ</span>
                <span className="text-xs font-bold text-blue-400 font-mono">(Walk-in Sale)</span>
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                ፈጣን የቀን ቆጣሪ ሽያጭ መመዝገቢያ
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
          <div className="p-4 sm:p-5 space-y-4">

            {/* Item Summary Card */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-600/20 text-blue-300 border border-blue-500/30">
                      {variant.brand}
                    </span>
                    <span className="text-xs font-bold text-slate-300">
                      {productName}
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-white mt-1">
                    {variant.spec}
                  </h3>
                </div>

                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-mono font-bold shrink-0">
                  <Boxes className="w-3.5 h-3.5 text-blue-400" />
                  <span>በመደብር፦ {variant.stock_quantity} ፍሬ</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60">
                <span>መደበኛ የችርቻሮ ዋጋ፦</span>
                <span className="font-mono font-bold text-slate-200">
                  {variant.retail_price.toLocaleString()} ብር
                </span>
              </div>
            </div>

            {/* Quantity Stepper & Direct Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="font-bold text-slate-300">
                  የሚሸጥ ብዛት (Quantity)
                </label>
                <span className="text-slate-400 text-[11px]">
                  ከፍተኛ ክምችት፦ <span className="text-white font-mono font-bold">{maxStock}</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleStepChange(-1)}
                  disabled={currentQty <= 1 || isSubmitting}
                  className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 font-bold flex items-center justify-center border border-slate-700 shadow-sm active:scale-90 transition-all disabled:opacity-30 disabled:pointer-events-none shrink-0"
                >
                  <Minus className="w-5 h-5 stroke-[2.5]" />
                </button>

                <div className="flex-1 relative">
                  <input
                    type="number"
                    min={1}
                    max={maxStock}
                    value={quantity}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        setQuantity("");
                      } else {
                        const parsed = parseInt(val, 10);
                        if (!isNaN(parsed)) {
                          setQuantity(Math.max(1, Math.min(maxStock, parsed)));
                        }
                      }
                      setErrorMsg(null);
                    }}
                    className="w-full h-12 bg-slate-950 border border-slate-800 rounded-xl px-3 text-center text-lg font-black font-mono text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 pointer-events-none">
                    ፍሬ
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleStepChange(1)}
                  disabled={currentQty >= maxStock || isSubmitting}
                  className="w-12 h-12 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 active:bg-blue-600 text-blue-300 font-bold flex items-center justify-center border border-blue-500/40 shadow-sm active:scale-90 transition-all disabled:opacity-30 disabled:pointer-events-none shrink-0"
                >
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Final Selling Unit Price */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="font-bold text-slate-300">
                  የመጨረሻ መሸጫ ዋጋ (Final Selling Price)
                </label>
                {variant.retail_price > 0 && currentPrice !== variant.retail_price && (
                  <button
                    type="button"
                    onClick={() => setUnitPrice(variant.retail_price)}
                    className="text-[11px] text-blue-400 hover:text-blue-300 underline font-medium"
                  >
                    ወደ መደበኛ ዋጋ መልስ ({variant.retail_price.toLocaleString()} ብር)
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  type="number"
                  min={0}
                  value={unitPrice}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") {
                      setUnitPrice("");
                    } else {
                      const parsed = parseFloat(val);
                      setUnitPrice(isNaN(parsed) ? "" : parsed);
                    }
                    setErrorMsg(null);
                  }}
                  placeholder="0"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono font-black text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors pr-12"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 pointer-events-none">
                  ብር
                </span>
              </div>
            </div>

            {/* Total Calculation Display */}
            <div className="bg-blue-950/40 border border-blue-800/50 rounded-2xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-blue-300 block">
                  ጠቅላላ ሂሳብ (Total Bill)
                </span>
                <span className="text-[11px] text-slate-400">
                  {currentQty} ፍሬ × {currentPrice.toLocaleString()} ብር
                </span>
              </div>
              <div className="text-right">
                <span className="text-xl font-black font-mono text-blue-400">
                  {totalAmount.toLocaleString()} <span className="text-xs font-sans">ብር</span>
                </span>
              </div>
            </div>

            {/* Payment Method Chips */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                የክፍያ ዘዴ (Payment Method)
              </label>

              <div className="grid grid-cols-2 gap-2">
                {/* Telebirr Chip */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod("Telebirr")}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all active:scale-95 ${
                    paymentMethod === "Telebirr"
                      ? "bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-950/50"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <Smartphone className={`w-4 h-4 shrink-0 ${paymentMethod === "Telebirr" ? "text-white" : "text-blue-400"}`} />
                  <div>
                    <span className="text-xs font-black block leading-none">ቴሌብር</span>
                    <span className={`text-[10px] ${paymentMethod === "Telebirr" ? "text-blue-100" : "text-slate-400"}`}>
                      Telebirr
                    </span>
                  </div>
                </button>

                {/* Cash Chip */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod("Cash")}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all active:scale-95 ${
                    paymentMethod === "Cash"
                      ? "bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-950/50"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <Banknote className={`w-4 h-4 shrink-0 ${paymentMethod === "Cash" ? "text-white" : "text-emerald-400"}`} />
                  <div>
                    <span className="text-xs font-black block leading-none">ጥሬ ገንዘብ</span>
                    <span className={`text-[10px] ${paymentMethod === "Cash" ? "text-emerald-100" : "text-slate-400"}`}>
                      Cash
                    </span>
                  </div>
                </button>

                {/* CBE / Bank Chip */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CBE")}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all active:scale-95 ${
                    paymentMethod === "CBE"
                      ? "bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-950/50"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <Building2 className={`w-4 h-4 shrink-0 ${paymentMethod === "CBE" ? "text-white" : "text-purple-400"}`} />
                  <div>
                    <span className="text-xs font-black block leading-none">CBE / ባንክ</span>
                    <span className={`text-[10px] ${paymentMethod === "CBE" ? "text-purple-100" : "text-slate-400"}`}>
                      Bank Transfer
                    </span>
                  </div>
                </button>

                {/* Other Chip */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod("Other")}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all active:scale-95 ${
                    paymentMethod === "Other"
                      ? "bg-amber-600 text-white border-amber-400 shadow-lg shadow-amber-950/50"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <MoreHorizontal className={`w-4 h-4 shrink-0 ${paymentMethod === "Other" ? "text-white" : "text-amber-400"}`} />
                  <div>
                    <span className="text-xs font-black block leading-none">ሌላ</span>
                    <span className={`text-[10px] ${paymentMethod === "Other" ? "text-amber-100" : "text-slate-400"}`}>
                      Other
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Customer / Warranty Note (Single subtle line) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                ማስታወሻ / ዋስትና / የደንበኛ ስም (Optional Note)
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="ምሳሌ፦ 1 ዓመት ዋስትና / የደንበኛ ስም"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Action Buttons: Cancel and Primary Confirm Button */}
          <div className="flex-shrink-0 p-4 sm:p-5 border-t border-slate-800 bg-slate-900 flex gap-3 z-10 mt-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-12 px-5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center border border-slate-700/60"
            >
              ይቅር
            </button>
            <button
              type="submit"
              disabled={isSubmitting || maxStock <= 0 || currentQty <= 0}
              className="h-12 flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-xs transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-600/30 border border-blue-400/30 disabled:opacity-50 active:scale-95"
            >
              <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black">
                  {isSubmitting ? "በመመዝገብ ላይ..." : "ሽያጭ መዝግብ"}
                </span>
                <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-blue-700/60 border border-blue-400/40">
                  {totalAmount.toLocaleString()} ብር
                </span>
                <span className="text-[11px] font-semibold text-blue-200 ml-0.5 hidden sm:inline">
                  (Confirm Sale)
                </span>
              </div>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
