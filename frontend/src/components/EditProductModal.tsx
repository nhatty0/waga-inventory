"use client";

import { useState, useEffect } from "react";
import { Plus, Minus, X, Check, Sparkles, Pencil, Camera, ScanLine } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Product, ProductVariant } from "@/lib/api";
import BarcodeScannerModal from "./BarcodeScannerModal";
import {
  CategoryKey,
  CATEGORY_SPEC_PLACEHOLDERS,
} from "./AddProductModal";

interface EditProductModalProps {
  isOpen: boolean;
  product: Product | null;
  variant: ProductVariant | null;
  onClose: () => void;
  onSave: (
    variantId: number,
    payload: {
      barcode?: string;
      brand: string;
      spec: string;
      product_name: string;
      stock_quantity: number;
      in_transit_quantity: number;
      retail_price: number;
      wholesale_price: number;
    }
  ) => Promise<void> | void;
  isSaving?: boolean;
  suggestedBrands?: string[];
}

export default function EditProductModal({
  isOpen,
  product,
  variant,
  onClose,
  onSave,
  isSaving = false,
  suggestedBrands = [],
}: EditProductModalProps) {
  const { t } = useLanguage();

  const [productName, setProductName] = useState<string>("");
  const [brand, setBrand] = useState<string>("");
  const [spec, setSpec] = useState<string>("");
  const [barcode, setBarcode] = useState<string>("");
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);

  // Clean numeric states to prevent the "0" prepending glitch
  const [stockQuantity, setStockQuantity] = useState<string | number>(0);
  const [inTransitQuantity, setInTransitQuantity] = useState<string | number>(0);
  const [retailPrice, setRetailPrice] = useState<string | number>(0);
  const [wholesalePrice, setWholesalePrice] = useState<string | number>(0);

  const [error, setError] = useState<string | null>(null);

  // Pre-populate when opened
  useEffect(() => {
    if (variant && product && isOpen) {
      setProductName(product.name || "");
      setBrand(variant.brand || "");
      setSpec(variant.spec || "");
      setBarcode(variant.barcode || "");
      setStockQuantity(variant.stock_quantity ?? 0);
      setInTransitQuantity(variant.in_transit_quantity ?? 0);
      setRetailPrice(variant.retail_price ?? 0);
      setWholesalePrice(variant.wholesale_price ?? 0);
      setError(null);
    }
  }, [variant, product, isOpen]);

  if (!isOpen || !variant || !product) return null;

  // Determine category key for brand presets and spec placeholders
  const rawCat = (product.category || "").toLowerCase();
  let categoryKey: CategoryKey = "Other";
  if (rawCat.includes("tv")) categoryKey = "TV";
  else if (rawCat.includes("fridge") || rawCat.includes("freezer")) categoryKey = "Fridge";
  else if (rawCat.includes("filter") || rawCat.includes("water")) categoryKey = "WaterFilter";
  else if (rawCat.includes("stabiliz") || rawCat.includes("regulat")) categoryKey = "Stabilizer";
  else if (rawCat.includes("kitchen") || rawCat.includes("boiler")) categoryKey = "Kitchen";
  else if (rawCat.includes("accessor") || rawCat.includes("decoder") || rawCat.includes("mount"))
    categoryKey = "Accessories";

  const currentBrandChips = suggestedBrands.slice(0, 3);
  const currentSpecPlaceholder =
    CATEGORY_SPEC_PLACEHOLDERS[categoryKey] || "ዝርዝር መግለጫ / Model & Specs";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand.trim()) {
      setError("Please specify a brand.");
      return;
    }
    if (!spec.trim()) {
      setError("Please specify a specification or model.");
      return;
    }

    onSave(variant.id, {
      barcode: barcode.trim() || undefined,
      brand: brand.trim(),
      spec: spec.trim(),
      product_name: productName.trim() || product.name,
      stock_quantity: Math.max(0, Number(stockQuantity) || 0),
      in_transit_quantity: Math.max(0, Number(inTransitQuantity) || 0),
      retail_price: Math.max(0, Number(retailPrice) || 0),
      wholesale_price: Math.max(0, Number(wholesalePrice) || 0),
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 pb-20 sm:pb-4 bg-black/85 backdrop-blur-sm overflow-hidden animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg max-h-[calc(100dvh-6rem)] sm:max-h-[85vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-950/60 border border-blue-800/50 text-blue-400">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                {t.editModal.title}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                {t.editModal.subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800/60 active:scale-95 transition-all"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 scrollbar-thin scrollbar-thumb-slate-700">
            {/* Category Indicator Tag */}
            <div className="flex items-center justify-between bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-400 font-medium">ምድብ (Category):</span>
              <span className="font-bold text-blue-400 font-mono">
                {product.category}
              </span>
            </div>

            {/* 1. Item Name / Type */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                {t.editModal.productNameLabel}
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Product Name (e.g. Smart TV, Fridge, Stabilizer)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-semibold"
                required
              />
            </div>

            {/* 2. Brand & Dynamic Chips */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300">
                  {t.editModal.brandLabel}
                </label>
                {currentBrandChips.length > 0 && (
                  <span className="text-[10px] text-slate-400 flex items-center gap-0.5 font-medium">
                    <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                    <span>የተለመዱ ብራንዶች ({currentBrandChips.length})</span>
                  </span>
                )}
              </div>

              {/* Dynamic Database Brand Chips */}
              {currentBrandChips.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-700 mb-1.5 select-none">
                  {currentBrandChips.map((b) => {
                    const isSelected = brand.toLowerCase() === b.toLowerCase();
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBrand(b)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap border transition-all active:scale-95 ${
                          isSelected
                            ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-950/40"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white"
                        }`}
                      >
                        {b}
                      </button>
                    );
                  })}
                </div>
              )}

              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder={t.addModal.brandPlaceholder}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-semibold"
                required
              />
            </div>

            {/* 3. Spec / Description with Contextual Guidance */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                {t.editModal.specLabel}
              </label>
              <input
                type="text"
                value={spec}
                onChange={(e) => setSpec(e.target.value)}
                placeholder={currentSpecPlaceholder}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
                required
              />
            </div>

            {/* 4. Barcode Registration Field with Camera Scan Button */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <ScanLine className="w-3.5 h-3.5 text-blue-400" />
                  <span>ባርኮድ (Barcode)</span>
                </label>
                <span className="text-[10px] text-slate-400 font-medium">Scan or type</span>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="ባርኮድ ስካን አድርግ ወይም አስገባ (e.g. 6923456789012)..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono font-bold"
                  />
                  {barcode && (
                    <button
                      type="button"
                      onClick={() => setBarcode("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                      title="Clear"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-blue-600/30 border border-blue-400/30 active:scale-95 transition-all shrink-0"
                  title="በካሜራ ባርኮድ ስካን አድርግ (Scan with Camera)"
                >
                  <Camera className="w-4 h-4 stroke-[2.5]" />
                  <span>ስካን</span>
                </button>
              </div>
            </div>

            {/* 4. Stock & Transit Counts */}
            <div className="grid grid-cols-2 gap-3 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
              {/* Shelf Stock */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  {t.editModal.stockLabel}
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setStockQuantity((q) => Math.max(0, (Number(q) || 0) - 1))}
                    className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center active:scale-95 transition-all"
                  >
                    <Minus className="w-3.5 h-3.5 stroke-[3]" />
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={stockQuantity === 0 || stockQuantity === "" ? "" : stockQuantity}
                    placeholder="0"
                    onChange={(e) => {
                      const val = e.target.value;
                      setStockQuantity(val === "" ? "" : Math.max(0, Number(val)));
                    }}
                    onFocus={(e) => {
                      if (e.target.value === "0") setStockQuantity("");
                      else e.target.select();
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 text-center text-sm font-black text-blue-400 font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setStockQuantity((q) => Math.max(0, (Number(q) || 0) + 1))}
                    className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center active:scale-95 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  </button>
                </div>
              </div>

              {/* In-Transit Count */}
              <div>
                <label className="block text-[11px] font-bold text-amber-300 mb-1">
                  {t.editModal.transitLabel}
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setInTransitQuantity((q) => Math.max(0, (Number(q) || 0) - 1))}
                    className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center active:scale-95 transition-all"
                  >
                    <Minus className="w-3.5 h-3.5 stroke-[3]" />
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={inTransitQuantity === 0 || inTransitQuantity === "" ? "" : inTransitQuantity}
                    placeholder="0"
                    onChange={(e) => {
                      const val = e.target.value;
                      setInTransitQuantity(val === "" ? "" : Math.max(0, Number(val)));
                    }}
                    onFocus={(e) => {
                      if (e.target.value === "0") setInTransitQuantity("");
                      else e.target.select();
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 text-center text-sm font-black text-amber-400 font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setInTransitQuantity((q) => Math.max(0, (Number(q) || 0) + 1))}
                    className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center active:scale-95 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  </button>
                </div>
              </div>
            </div>

            {/* 5. Prices: Retail & Wholesale */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  {t.editModal.retailPriceLabel}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={retailPrice === 0 || retailPrice === "" ? "" : retailPrice}
                    placeholder="0"
                    onChange={(e) => {
                      const val = e.target.value;
                      setRetailPrice(val === "" ? "" : Math.max(0, Number(val)));
                    }}
                    onFocus={(e) => {
                      if (e.target.value === "0") setRetailPrice("");
                      else e.target.select();
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-black text-white font-mono focus:outline-none focus:border-blue-500 pr-9"
                    required
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 pointer-events-none">
                    ብር
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {t.editModal.wholesalePriceLabel}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={wholesalePrice === 0 || wholesalePrice === "" ? "" : wholesalePrice}
                    placeholder="0"
                    onChange={(e) => {
                      const val = e.target.value;
                      setWholesalePrice(val === "" ? "" : Math.max(0, Number(val)));
                    }}
                    onFocus={(e) => {
                      if (e.target.value === "0") setWholesalePrice("");
                      else e.target.select();
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-300 font-mono focus:outline-none focus:border-blue-500 pr-9"
                    required
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 pointer-events-none">
                    ብር
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                {error}
              </div>
            )}
          </div>

          {/* Footer: flex-shrink-0 p-4 border-t border-slate-800 bg-slate-900 flex gap-3 */}
          <div className="flex-shrink-0 p-4 border-t border-slate-800 bg-slate-900 flex gap-3 z-10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-12 flex-1 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="h-12 flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-950/50 disabled:opacity-50 active:scale-95"
            >
              {isSaving ? (
                t.editModal.btnSaving
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{t.editModal.btnSave}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Barcode Camera Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(scannedText) => setBarcode(scannedText)}
        title="ባርኮድ ማስተካከያ"
        subtitle="ምርቱን ካሜራው ፊት በማቅረብ ባርኮዱን ያስመዝግቡ"
      />
    </div>
  );
}
