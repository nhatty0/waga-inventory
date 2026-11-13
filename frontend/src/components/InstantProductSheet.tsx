"use client";

import {
  X,
  ShoppingBag,
  Pencil,
  Plus,
  Minus,
  Truck,
  Boxes,
  Barcode as BarcodeIcon,
  CheckCircle2,
} from "lucide-react";
import { Product, ProductVariant } from "@/lib/api";

interface InstantProductSheetProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  variant: ProductVariant | null;
  onQuickSell: (product: Product, variant: ProductVariant) => void;
  onRestock: (variantId: number, delta: number, currentStock: number, brandSpec: string) => void;
  onOpenTransit?: (product: Product, variant: ProductVariant) => void;
  onEdit: (product: Product, variant: ProductVariant) => void;
  isAdjusting?: boolean;
}

export default function InstantProductSheet({
  isOpen,
  onClose,
  product,
  variant,
  onQuickSell,
  onRestock,
  onOpenTransit,
  onEdit,
  isAdjusting = false,
}: InstantProductSheetProps) {
  if (!isOpen || !product || !variant) return null;

  const isOutOfStock = variant.stock_quantity <= 0;
  const hasTransit = variant.in_transit_quantity > 0;

  return (
    <div className="fixed inset-0 z-[105] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm overflow-hidden animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg max-h-[92dvh] sm:max-h-[85vh] flex flex-col bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-black/80 overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex-shrink-0 p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 shrink-0">
              <BarcodeIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  የዕቃ መረጃ
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-950 text-blue-300 border border-blue-800/80">
                  Instant Sheet
                </span>
              </div>
              {variant.barcode ? (
                <p className="text-xs font-mono font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                  <span>ባርኮድ፦</span>
                  <span className="text-blue-400">{variant.barcode}</span>
                </p>
              ) : (
                <p className="text-xs text-slate-400">ባርኮድ የተመዘገበ ዕቃ</p>
              )}
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
          
          {/* Main Product Card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-md bg-blue-600/20 text-blue-300 border border-blue-500/30">
                  {variant.brand}
                </span>
                <span className="text-xs font-bold text-slate-300">
                  {product.name}
                </span>
                <span className="text-[10px] font-semibold text-slate-500 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                  {product.category}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white mt-1.5 leading-snug">
                {variant.spec}
              </h3>
            </div>

            {/* Price Grid */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 block">
                  የችርቻሮ መሸጫ ዋጋ
                </span>
                <span className="text-base font-black font-mono text-emerald-400 mt-0.5 block">
                  {variant.retail_price.toLocaleString()}{" "}
                  <span className="text-xs font-sans">ብር</span>
                </span>
              </div>

              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 block">
                  የጅምላ መሸጫ ዋጋ
                </span>
                <span className="text-base font-black font-mono text-slate-200 mt-0.5 block">
                  {variant.wholesale_price.toLocaleString()}{" "}
                  <span className="text-xs font-sans">ብር</span>
                </span>
              </div>
            </div>

            {/* Live Stock Counts Bar */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div
                className={`p-2.5 rounded-xl border flex items-center justify-between ${
                  isOutOfStock
                    ? "bg-rose-500/10 border-rose-500/25 text-rose-300"
                    : "bg-blue-950/40 border-blue-800/40 text-blue-300"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold">በመደብር ያለ፦</span>
                </div>
                <span className="text-base font-black font-mono">
                  {variant.stock_quantity} ፍሬ
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold">በመንገድ ላይ፦</span>
                </div>
                <span className="text-base font-black font-mono">
                  +{variant.in_transit_quantity} ፍሬ
                </span>
              </div>
            </div>
          </div>

          {/* Action 2: "ዕቃ ጨምር (Restock / Transit)" Interactive Stepper Section */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-blue-400" />
                <span>ዕቃ ጨምር (Quick Restock)</span>
              </span>
              <span className="text-[11px] text-slate-400">
                አሁን ያለው፦ <strong className="text-white font-mono">{variant.stock_quantity}</strong>
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 bg-slate-900 p-2 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 font-medium pl-1">
                ፈጣን ቆጠራ ማስተካከያ
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onRestock(
                      variant.id,
                      -1,
                      variant.stock_quantity,
                      `${variant.brand} ${variant.spec}`
                    )
                  }
                  disabled={isAdjusting || variant.stock_quantity <= 0}
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 font-bold flex items-center justify-center border border-slate-700 active:scale-90 transition-all disabled:opacity-30 disabled:pointer-events-none"
                  aria-label="Decrease Stock"
                >
                  <Minus className="w-4 h-4 stroke-[2.5]" />
                </button>

                <span className="w-8 text-center font-mono font-black text-sm text-white">
                  {variant.stock_quantity}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    onRestock(
                      variant.id,
                      1,
                      variant.stock_quantity,
                      `${variant.brand} ${variant.spec}`
                    )
                  }
                  disabled={isAdjusting}
                  className="w-10 h-10 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 active:bg-blue-600 text-blue-300 font-bold flex items-center justify-center border border-blue-500/40 active:scale-90 transition-all disabled:opacity-30"
                  aria-label="Increase Stock"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* In-Transit Intake Button (if freight is on way) */}
            {hasTransit && onOpenTransit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenTransit(product, variant);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 active:scale-95 transition-all text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
              >
                <Truck className="w-4 h-4 text-amber-400" />
                <span>የመርካቶ ጭነት ተረከብ (+{variant.in_transit_quantity} በመንገድ ላይ)</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer Actions: Action 1 (Quick Sell) and Action 3 (Edit) */}
        <div className="flex-shrink-0 p-4 sm:p-5 border-t border-slate-800 bg-slate-900 flex gap-2.5 z-10">
          {/* Action 3: አስተካክል (Edit) */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit(product, variant);
            }}
            className="h-12 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs transition-all flex items-center justify-center gap-1.5 border border-slate-700/80 shadow-sm"
          >
            <Pencil className="w-4 h-4 text-blue-400 stroke-[2.2]" />
            <span>አስተካክል (Edit)</span>
          </button>

          {/* Action 1: ፈጣን ሽያጭ (Quick Sell) */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onQuickSell(product, variant);
            }}
            disabled={isOutOfStock}
            className="h-12 flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-600/30 border border-blue-400/30 active:scale-95"
          >
            <ShoppingBag className="w-5 h-5 stroke-[2.5]" />
            <div className="flex items-center gap-1.5">
              <span className="text-sm">ፈጣን ሽያጭ (Quick Sell)</span>
              <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-blue-700/60 border border-blue-400/40">
                {variant.retail_price.toLocaleString()} ብር
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
