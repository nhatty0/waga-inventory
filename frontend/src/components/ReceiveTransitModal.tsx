"use client";

import { useState, useEffect } from "react";
import { Truck, X, Plus, Minus, PackageCheck, Boxes, ArrowRight } from "lucide-react";
import { ProductVariant } from "@/lib/api";

interface ReceiveTransitModalProps {
  variant: ProductVariant | null;
  productName: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirmReceive: (variantId: number, quantity: number, notes?: string) => void | Promise<void>;
  isSubmitting?: boolean;
}

export default function ReceiveTransitModal({
  variant,
  productName,
  isOpen,
  onClose,
  onConfirmReceive,
  isSubmitting = false,
}: ReceiveTransitModalProps) {
  const [quantity, setQuantity] = useState<number | "">(1);
  const [notes, setNotes] = useState<string>("Merkato truck arrival in Gondar");
  const [localError, setLocalError] = useState<string | null>(null);

  // Pre-fill quantity with total in-transit count whenever modal opens
  useEffect(() => {
    if (variant && isOpen) {
      setQuantity(Math.max(1, variant.in_transit_quantity));
      setNotes("Merkato truck arrival in Gondar");
      setLocalError(null);
    }
  }, [variant, isOpen]);

  if (!isOpen || !variant) return null;

  const maxAvailable = variant.in_transit_quantity;
  const currentQty = typeof quantity === "number" ? quantity : 0;
  const isPartial = currentQty < maxAvailable;
  const newStockCount = variant.stock_quantity + currentQty;

  const handleStepChange = (delta: number) => {
    const base = typeof quantity === "number" ? quantity : 1;
    const next = Math.max(1, Math.min(maxAvailable, base + delta));
    setQuantity(next);
    setLocalError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qtyToReceive = typeof quantity === "number" ? quantity : 0;
    if (qtyToReceive <= 0 || qtyToReceive > maxAvailable) {
      setLocalError(
        `ብዛት በ 1 እና ${maxAvailable} መካከል መሆን አለበት (Must be between 1 and ${maxAvailable})`
      );
      return;
    }

    onConfirmReceive(variant.id, qtyToReceive, notes.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm overflow-hidden animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg max-h-[92dvh] sm:max-h-[85vh] flex flex-col bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-black/80 overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex-shrink-0 p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-1.5 tracking-tight">
                <span>ዕቃዎችን ወደ መደብር አስገባ</span>
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Receive Merkato Freight
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 active:scale-95 transition-all"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-h-0 scrollbar-thin scrollbar-thumb-slate-700">
            
            {/* Summary Card: Product name, brand, spec, and current stock counts */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 shadow-inner">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md bg-blue-950/80 text-blue-400 border border-blue-800/60">
                  {productName}
                </span>
                <span className="text-xs font-black text-slate-200 uppercase tracking-wide">
                  {variant.brand}
                </span>
              </div>

              <div>
                <h3 className="text-base font-black text-white leading-snug">
                  {variant.spec}
                </h3>
              </div>

              {/* Current Stock Counts: Shelf Stock & In-Transit */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900">
                <div className="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold">
                    <Boxes className="w-3.5 h-3.5 text-blue-400" />
                    <span>በመደብር ያለ (Current Stock)</span>
                  </div>
                  <div className="text-lg font-mono font-black text-blue-400 mt-1">
                    {variant.stock_quantity} <span className="text-xs font-sans font-bold text-slate-400">ፍሬ</span>
                  </div>
                </div>

                <div className="bg-amber-500/10 rounded-xl p-2.5 border border-amber-500/25">
                  <div className="flex items-center gap-1.5 text-amber-300 text-[10px] font-bold">
                    <Truck className="w-3.5 h-3.5 text-amber-400" />
                    <span>በመንገድ ላይ (In Transit)</span>
                  </div>
                  <div className="text-lg font-mono font-black text-amber-400 mt-1">
                    {variant.in_transit_quantity} <span className="text-xs font-sans font-bold text-amber-300/80">ፍሬ</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quantity Selector: Pre-filled with total in-transit count with [-] and [+] steppers */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200">
                  የተረከቡት ብዛት (Received Quantity)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setQuantity(maxAvailable);
                    setLocalError(null);
                  }}
                  className="text-[11px] font-black text-blue-400 hover:text-blue-300 active:scale-95 transition-all"
                >
                  ሁሉንም ተቀበል / All ({maxAvailable})
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                {/* Decrement [-] Stepper */}
                <button
                  type="button"
                  onClick={() => handleStepChange(-1)}
                  disabled={currentQty <= 1 || isSubmitting}
                  aria-label="Decrease quantity"
                  className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-bold flex items-center justify-center border border-slate-700 shadow-sm active:scale-90 transition-all disabled:opacity-30 disabled:pointer-events-none"
                >
                  <Minus className="w-5 h-5 stroke-[2.5]" />
                </button>

                {/* Direct Number Input */}
                <div className="flex-1 relative">
                  <input
                    type="number"
                    min={1}
                    max={maxAvailable}
                    value={quantity === "" ? "" : quantity}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") {
                        setQuantity("");
                      } else {
                        const val = parseInt(v, 10);
                        if (!isNaN(val)) {
                          setQuantity(Math.max(1, Math.min(maxAvailable, val)));
                          setLocalError(null);
                        }
                      }
                    }}
                    onBlur={() => {
                      if (quantity === "" || quantity < 1) {
                        setQuantity(1);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-center text-2xl font-black text-white font-mono focus:outline-none focus:border-blue-500 shadow-inner"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 pointer-events-none">
                    ፍሬ
                  </span>
                </div>

                {/* Increment [+] Stepper */}
                <button
                  type="button"
                  onClick={() => handleStepChange(1)}
                  disabled={currentQty >= maxAvailable || isSubmitting}
                  aria-label="Increase quantity"
                  className="w-12 h-12 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 active:bg-blue-600 text-blue-300 font-bold flex items-center justify-center border border-blue-500/40 shadow-sm active:scale-90 transition-all disabled:opacity-30 disabled:pointer-events-none"
                >
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </button>
              </div>

              {/* Dynamic Delivery Outcome Summary */}
              <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/60 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="text-slate-400">አዲስ ክምችት፦</span>
                  <span className="font-mono font-bold text-slate-400 line-through">
                    {variant.stock_quantity}
                  </span>
                  <ArrowRight className="w-3 h-3 text-blue-400" />
                  <span className="font-mono font-black text-blue-400 text-xs">
                    {newStockCount} ፍሬ
                  </span>
                </div>

                {isPartial ? (
                  <span className="text-amber-400 font-bold px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                    {maxAvailable - currentQty} ፍሬ በመንገድ ይቀራል (Partial)
                  </span>
                ) : (
                  <span className="text-emerald-400 font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                    ሙሉ ጭነት (Full Delivery)
                  </span>
                )}
              </div>
            </div>

            {/* Optional Memo Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                የሾፌር / የመኪና ማስታወሻ (Delivery Memo - Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ምሳሌ፦ የመኪና ታርጋ 3-2345 ወይም የሾፌር ስም"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Local Validation Error */}
            {localError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                {localError}
              </div>
            )}
          </div>

          {/* Action Buttons: Cancel and Primary Confirm Button */}
          <div className="flex-shrink-0 p-4 sm:p-5 border-t border-slate-800 bg-slate-900 flex gap-3 z-10">
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
              disabled={isSubmitting || maxAvailable <= 0 || currentQty <= 0}
              className="h-12 flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-xs transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-600/30 border border-blue-400/30 disabled:opacity-50 active:scale-95"
            >
              <PackageCheck className="w-5 h-5 stroke-[2.5]" />
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black">
                  {isSubmitting ? "በመረከብ ላይ..." : "ዕቃዎችን ተረከብኩ"}
                </span>
                <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-blue-700/60 border border-blue-400/40">
                  +{currentQty}
                </span>
                <span className="text-[11px] font-semibold text-blue-200 ml-0.5 hidden sm:inline">
                  (Confirm Received)
                </span>
              </div>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
