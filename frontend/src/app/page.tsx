"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Truck,
  Plus,
  Minus,
  Search,
  AlertCircle,
  X,
  SearchX,
  Pencil,
  RotateCcw,
  CheckCircle2,
  ShoppingBag,
  TrendingUp,
  Camera,
} from "lucide-react";
import TopHeader from "@/components/TopHeader";
import ReceiveTransitModal from "@/components/ReceiveTransitModal";
import AddProductModal from "@/components/AddProductModal";
import EditProductModal from "@/components/EditProductModal";
import QuickSellModal from "@/components/QuickSellModal";
import TodaySalesDrawer from "@/components/TodaySalesDrawer";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";
import InstantProductSheet from "@/components/InstantProductSheet";
import { useLanguage } from "@/context/LanguageContext";
import { isAuthenticated } from "@/lib/auth";
import {
  Product,
  ProductVariant,
  Order,
  getProducts,
  getOrders,
  adjustStock,
  receiveTransit,
  updateProductVariant,
  lookupBarcode,
} from "@/lib/api";

/** Helper to match a product against selected category pill */
function matchesCategory(product: Product, category: string): boolean {
  if (category === "ALL") return true;

  const prodCat = (product.category || "").toLowerCase();
  const prodName = (product.name || "").toLowerCase();

  const isAccessory =
    prodCat.includes("accessor") ||
    prodCat.includes("mount") ||
    prodCat.includes("bracket") ||
    prodCat.includes("hanger") ||
    prodCat.includes("decoder") ||
    prodName.includes("mount") ||
    prodName.includes("bracket") ||
    prodName.includes("hanger");

  switch (category) {
    case "TV":
      return (
        !isAccessory &&
        (prodCat === "tv" ||
          prodCat.includes("televis") ||
          prodName.includes("smart tv") ||
          prodName.includes("television"))
      );
    case "Fridge":
      return (
        prodCat.includes("fridge") ||
        prodCat.includes("refrigerat") ||
        prodCat.includes("freezer") ||
        prodName.includes("refrigerat") ||
        prodName.includes("fridge")
      );
    case "Kitchen":
      return (
        prodCat.includes("kitchen") ||
        prodCat.includes("boiler") ||
        prodCat.includes("kettle") ||
        prodCat.includes("appliance") ||
        prodName.includes("boiler") ||
        prodName.includes("kettle")
      );
    case "Stabilizer":
      return (
        prodCat.includes("stabili") ||
        prodCat.includes("regulat") ||
        prodName.includes("stabili") ||
        prodName.includes("regulat")
      );
    case "Accessories":
      return isAccessory;
    case "WaterFilter":
      return (
        prodCat.includes("filter") ||
        prodCat.includes("purif") ||
        (prodCat.includes("water") && !prodCat.includes("heater")) ||
        prodName.includes("filter") ||
        prodName.includes("purifier")
      );
    case "Other":
      return (
        !matchesCategory(product, "TV") &&
        !matchesCategory(product, "Fridge") &&
        !matchesCategory(product, "Kitchen") &&
        !matchesCategory(product, "Stabilizer") &&
        !matchesCategory(product, "Accessories") &&
        !matchesCategory(product, "WaterFilter")
      );
    default:
      return prodCat.includes(category.toLowerCase());
  }
}

/** Helper to generate full searchable text including Amharic terms, specs, brands, and aliases */
function getSearchableText(product: Product, variant: ProductVariant): string {
  const parts: string[] = [
    variant.brand,
    product.name,
    variant.spec,
    product.category,
  ];

  // Normalized spec variations for easy unit matching (e.g. 43", 350L, 1.8L)
  const specWithoutQuotes = variant.spec.replace(/["”″]/g, " inch ");
  const specAlphanumeric = variant.spec.replace(/[^a-zA-Z0-9\u1200-\u137F]/g, " ");
  parts.push(specWithoutQuotes, specAlphanumeric);

  // Amharic and bilingual product keywords
  const cat = (product.category || "").toLowerCase();
  const name = (product.name || "").toLowerCase();

  const isAccessories =
    cat.includes("accessor") ||
    cat.includes("mount") ||
    cat.includes("bracket") ||
    cat.includes("hanger") ||
    cat.includes("decoder") ||
    name.includes("mount") ||
    name.includes("bracket") ||
    name.includes("hanger") ||
    name.includes("decoder");

  const isTV =
    !isAccessories &&
    (cat === "tv" ||
      cat.includes("televis") ||
      name.includes("smart tv") ||
      name.includes("television"));

  const isFridge =
    cat.includes("fridge") ||
    cat.includes("refrigerat") ||
    name.includes("refrigerat") ||
    name.includes("fridge") ||
    name.includes("freezer");

  const isWaterFilter =
    cat.includes("filter") ||
    cat.includes("purif") ||
    (cat.includes("water") && !cat.includes("heater")) ||
    name.includes("filter") ||
    name.includes("purifier");

  const isStabilizer =
    cat.includes("stabil") ||
    cat.includes("regulat") ||
    name.includes("stabil") ||
    name.includes("regulat");

  const isKitchen =
    cat.includes("kitchen") ||
    cat.includes("boiler") ||
    cat.includes("kettle") ||
    name.includes("boiler") ||
    name.includes("kettle");

  if (isTV) {
    parts.push("ቴሌቪዥን ቲቪ smart tv television led uhd hd");
  }
  if (isFridge) {
    parts.push("ማቀዝቀዣ ፍሪጅ ፍሪዘር በረዶ refrigerator fridge freezer");
  }
  if (isWaterFilter) {
    parts.push("የውሃ ማጣሪያ ውሃ ማጣሪያ ማጣሪያ water filter purifier gravity");
  }
  if (isStabilizer) {
    parts.push("ስታብላይዘር ስቴብላይዘር ሬጉሌተር voltage regulator stabilizer sollatek");
  }
  if (isKitchen) {
    parts.push("የወጥ ቤት ወጥ ቤት ቦይለር ኬትል ማብሰያ kitchen electric boiler kettle");
  }
  if (isAccessories) {
    parts.push("ዲኮደርና መለዋወጫ መለዋወጫ ማንጠልጠያ ኮንሶል ዲኮደር tv mount wall hanger bracket accessories");
  }

  return parts.filter(Boolean).join(" ").toLowerCase();
}

export default function InventoryPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Stepper pending state
  const [adjustingId, setAdjustingId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [activeTransitVariant, setActiveTransitVariant] = useState<{
    variant: ProductVariant;
    productName: string;
  } | null>(null);
  const [receivingTransit, setReceivingTransit] = useState<boolean>(false);

  // Walk-in Quick Sell & Today's Sales Drawer state
  const [activeSellVariant, setActiveSellVariant] = useState<{
    variant: ProductVariant;
    productName: string;
  } | null>(null);
  const [isSalesDrawerOpen, setIsSalesDrawerOpen] = useState<boolean>(false);
  const [todayStr, setTodayStr] = useState<string>("");

  // Edit item state
  const [editingItem, setEditingItem] = useState<{
    product: Product;
    variant: ProductVariant;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Global Barcode Scanning & Instant Product Sheet state (Workflow 2)
  const [isGlobalScannerOpen, setIsGlobalScannerOpen] = useState<boolean>(false);
  const [instantProductSheet, setInstantProductSheet] = useState<{
    product: Product;
    variant: ProductVariant;
  } | null>(null);
  const [addModalInitialBarcode, setAddModalInitialBarcode] = useState<string>("");

  const fetchInventory = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [pData, oData] = await Promise.all([
        getProducts(),
        getOrders().catch(() => [] as Order[]),
      ]);
      setProducts(pData);
      setOrders(oData);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load inventory items"
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
    fetchInventory();
    setTodayStr(new Date().toDateString());
  }, [fetchInventory, router]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Quick Sell Handler with Optimistic UI Update & Instant Amharic Toast
  const handleQuickSellSuccess = (soldQty: number, newOrder: Order) => {
    // 1. Optimistically deduct sold quantity from variant stock
    setProducts((prev) =>
      prev.map((prod) => ({
        ...prod,
        variants: prod.variants.map((v) =>
          v.id === newOrder.items[0]?.variant_id
            ? { ...v, stock_quantity: Math.max(0, v.stock_quantity - soldQty) }
            : v
        ),
      }))
    );

    // 2. Prepend order to orders list for live Today's Sales KPI & Drawer
    setOrders((prev) => [newOrder, ...prev]);

    // 3. Show brief success toast: "ሽያጩ ተመዝግቧል!"
    showToast("ሽያጩ ተመዝግቧል!");

    // 4. Close modal
    setActiveSellVariant(null);

    // 5. Silent refresh to ensure database consistency
    fetchInventory(true);
  };

  // Quick Stepper Handler with Optimistic UI Update
  const handleStepAdjust = async (
    variantId: number,
    delta: number,
    currentStock: number,
    brandSpec: string
  ) => {
    if (delta < 0 && currentStock <= 0) return;
    if (adjustingId === variantId) return;

    setAdjustingId(variantId);

    // Optimistically update local state
    setProducts((prev) =>
      prev.map((product) => ({
        ...product,
        variants: product.variants.map((v) =>
          v.id === variantId
            ? { ...v, stock_quantity: Math.max(0, v.stock_quantity + delta) }
            : v
        ),
      }))
    );

    // Also optimistically update instant product sheet if open
    setInstantProductSheet((prev) => {
      if (!prev || prev.variant.id !== variantId) return prev;
      return {
        ...prev,
        variant: {
          ...prev.variant,
          stock_quantity: Math.max(0, prev.variant.stock_quantity + delta),
        },
      };
    });

    try {
      const res = await adjustStock({
        variant_id: variantId,
        delta,
        notes: "Quick count adjustment on mobile",
      });
      showToast(
        `${t.inventory.countUpdated} ${brandSpec} → ${res.new_stock} ${t.common.units}`
      );
    } catch (err: unknown) {
      // Revert on failure
      fetchInventory(true);
      showToast(
        `Failed: ${err instanceof Error ? err.message : "Error"}`
      );
    } finally {
      setAdjustingId(null);
    }
  };

  // Workflow 2: Global Camera Barcode Scan Handler
  const handleGlobalBarcodeScan = async (scannedCode: string) => {
    try {
      const res = await lookupBarcode(scannedCode);
      if (res && res.variant) {
        // CASE A (Registered Item Found): Pop up Instant Product Sheet
        const matchedProduct =
          res.product ||
          products.find((p) => p.id === res.variant.product_id) || {
            id: res.variant.product_id,
            name: res.product_name,
            category: res.category,
            created_at: new Date().toISOString(),
            variants: [res.variant],
            total_stock: res.variant.stock_quantity,
            total_in_transit: res.variant.in_transit_quantity,
          };

        setInstantProductSheet({
          product: matchedProduct,
          variant: res.variant,
        });
      }
    } catch {
      // CASE B (Unregistered Barcode - 404):
      showToast("አዲስ ባርኮድ ነው! ወደ መዝገብ አስገባው");
      setAddModalInitialBarcode(scannedCode);
      setIsAddModalOpen(true);
    }
  };

  // One-Tap Receive Transit with Optimistic UI Update & Instant Toast
  const handleConfirmReceiveTransit = async (
    variantId: number,
    quantityReceived: number,
    notes?: string
  ) => {
    setReceivingTransit(true);

    // 1. Optimistically deduct received amount from in_transit_quantity and add to stock_quantity
    setProducts((prev) =>
      prev.map((product) => ({
        ...product,
        variants: product.variants.map((v) =>
          v.id === variantId
            ? {
                ...v,
                stock_quantity: v.stock_quantity + quantityReceived,
                in_transit_quantity: Math.max(0, v.in_transit_quantity - quantityReceived),
              }
            : v
        ),
      }))
    );

    // 2. Instant Amharic toast notification matching specification:
    // "ዕቃው በተሳካ ሁኔታ ወደ መደብር ገብቷል!"
    showToast("ዕቃው በተሳካ ሁኔታ ወደ መደብር ገብቷል!");

    // 3. Immediately close modal for snappy UI
    setActiveTransitVariant(null);

    // 4. Send POST /api/inventory/receive-transit to backend
    try {
      await receiveTransit({
        variant_id: variantId,
        quantity: quantityReceived,
        notes: notes || "Merkato truck arrival in Gondar",
      });
      // Silent sync to ensure database consistency
      fetchInventory(true);
    } catch (err: unknown) {
      // Revert on network/server failure
      fetchInventory(true);
      showToast(
        `ስህተት ተከስቷል፦ ${err instanceof Error ? err.message : "Failed to receive transit"}`
      );
    } finally {
      setReceivingTransit(false);
    }
  };

  // Full Edit Item Handler with Optimistic UI Update & Instant Toast
  const handleSaveEdit = async (
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
  ) => {
    setSavingEdit(true);

    // 1. Optimistically update local state
    setProducts((prev) =>
      prev.map((prod) => {
        const hasVariant = prod.variants.some((v) => v.id === variantId);
        if (!hasVariant) return prod;

        return {
          ...prod,
          name: payload.product_name || prod.name,
          variants: prod.variants.map((v) =>
            v.id === variantId
              ? {
                  ...v,
                  barcode: payload.barcode !== undefined ? payload.barcode : v.barcode,
                  brand: payload.brand,
                  spec: payload.spec,
                  stock_quantity: payload.stock_quantity,
                  in_transit_quantity: payload.in_transit_quantity,
                  retail_price: payload.retail_price,
                  wholesale_price: payload.wholesale_price,
                }
              : v
          ),
        };
      })
    );

    // 2. Instant toast notification
    showToast(t.editModal.successMsg);

    // 3. Close the modal
    setEditingItem(null);

    // 4. Send PUT request to backend
    try {
      await updateProductVariant(variantId, payload);
      fetchInventory(true);
    } catch (err: unknown) {
      fetchInventory(true);
      showToast(
        `ስህተት ተከስቷል፦ ${err instanceof Error ? err.message : "Failed to update item"}`
      );
    } finally {
      setSavingEdit(false);
    }
  };

  // Live Client-Side Search & Multi-Field Filtering synchronized with Category Pills
  const filteredItems = useMemo(() => {
    const list: Array<{
      product: Product;
      variant: ProductVariant;
    }> = [];

    const rawQuery = searchQuery.trim().toLowerCase();
    const tokens = rawQuery ? rawQuery.split(/\s+/).filter(Boolean) : [];

    products.forEach((prod) => {
      // 1. Synchronize with active category pill
      if (!matchesCategory(prod, selectedCategory)) {
        return;
      }

      prod.variants.forEach((v) => {
        // 2. Live Client-Side Multi-Field Search (Brand, Name, Spec, Category)
        if (tokens.length > 0) {
          const searchable = getSearchableText(prod, v);

          // Every token must match somewhere in brand, name, spec, or synonyms
          const matchesAllTokens = tokens.every((token) => {
            const cleanToken = token.replace(/["”]/g, "").toLowerCase();
            return (
              searchable.includes(token) ||
              (cleanToken.length > 0 && searchable.includes(cleanToken))
            );
          });

          if (!matchesAllTokens) return;
        }

        list.push({ product: prod, variant: v });
      });
    });

    return list;
  }, [products, selectedCategory, searchQuery]);

  // Aggregate stats
  const totalStockUnits = useMemo(() => {
    return products.reduce(
      (acc, p) =>
        acc + p.variants.reduce((vAcc, v) => vAcc + v.stock_quantity, 0),
      0
    );
  }, [products]);

  const totalTransitUnits = useMemo(() => {
    return products.reduce(
      (acc, p) =>
        acc + p.variants.reduce((vAcc, v) => vAcc + v.in_transit_quantity, 0),
      0
    );
  }, [products]);

  // Today's Sales Metrics: Total ETB sold today and number of units sold
  const todaySalesMetrics = useMemo(() => {
    if (!todayStr) return { totalETB: 0, totalUnits: 0, count: 0 };
    const todayRetail = orders.filter((o) => {
      try {
        return new Date(o.created_at).toDateString() === todayStr && o.order_type === "RETAIL";
      } catch {
        return false;
      }
    });

    const totalETB = todayRetail.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalUnits = todayRetail.reduce(
      (sum, o) => sum + (o.items || []).reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    );

    return { totalETB, totalUnits, count: todayRetail.length };
  }, [orders, todayStr]);

  // Active Category Pills (All, TV, Fridge, Kitchen, Stabilizer, Accessories, WaterFilter, Other)
  const categoryPills = [
    { label: "ሁሉም (All)", value: "ALL" },
    { label: "ቴሌቪዥን (TV)", value: "TV" },
    { label: "ማቀዝቀዣ (Fridge)", value: "Fridge" },
    { label: "የወጥ ቤት (Kitchen)", value: "Kitchen" },
    { label: "ስታብላይዘር (Stabilizer)", value: "Stabilizer" },
    { label: "መለዋወጫ (Accessories)", value: "Accessories" },
    { label: "የውሃ ማጣሪያ (Filter)", value: "WaterFilter" },
    { label: "ሌላ (Other)", value: "Other" },
  ];

  const isFiltering = searchQuery.trim().length > 0 || selectedCategory !== "ALL";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <TopHeader onRefresh={() => fetchInventory(true)} isRefreshing={refreshing} />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-blue-600 text-white text-xs font-black rounded-full shadow-2xl shadow-blue-950/60 border border-blue-400 animate-in fade-in slide-in-from-top duration-150 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 py-3.5 space-y-3.5">
        {/* KPI Overview Bar: Shelf Stock vs Merkato Transit vs Today's Sales */}
        <div className="grid grid-cols-3 gap-2">
          {/* Card 1: Shelf Stock */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 block tracking-tight truncate">
                {t.inventory.shelfStock}
              </span>
              <div className="p-1.5 sm:p-2 rounded-xl bg-blue-950/60 border border-blue-800/50 text-blue-400">
                <Boxes className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="mt-1">
              <span className="text-xl sm:text-2xl font-black text-blue-400 font-mono block">
                {loading ? "..." : totalStockUnits}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">ፍሬ במደብር</span>
            </div>
          </div>

          {/* Card 2: Merkato Transit */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 block tracking-tight truncate">
                {t.inventory.merkatoTransit}
              </span>
              <div className="p-1.5 sm:p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="mt-1">
              <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono block">
                {loading ? "..." : totalTransitUnits}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">ፍሬ በመንገድ</span>
            </div>
          </div>

          {/* Card 3: Today's Sales (Interactive Clickable Card to open Cash Drawer) */}
          <button
            type="button"
            onClick={() => setIsSalesDrawerOpen(true)}
            className="bg-slate-900 hover:bg-slate-800/80 active:scale-95 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between text-left shadow-sm transition-all group"
            title="የዛሬ ሽያጭ ዝርዝርና የካዝና ቆጠራ (Today's Sales & Cash Balancing)"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 block tracking-tight truncate group-hover:text-emerald-300 transition-colors">
                የዛሬ ሽያጭ
              </span>
              <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/20 transition-all">
                <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="mt-1">
              <span className="text-lg sm:text-xl font-black text-emerald-400 font-mono block leading-tight truncate">
                {loading ? "..." : todaySalesMetrics.totalETB.toLocaleString()}{" "}
                <span className="text-[10px] font-sans font-bold">ብር</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium flex items-center justify-between mt-0.5">
                <span>{todaySalesMetrics.totalUnits} ፍሬ</span>
                <span className="text-emerald-400 font-bold group-hover:translate-x-0.5 transition-transform">
                  ክፈት →
                </span>
              </span>
            </div>
          </button>
        </div>

        {/* Live Client-Side Search Bar with Camera Barcode Scan Icon */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.inventory.searchPlaceholder}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-20 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium transition-colors"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="p-1 text-slate-400 hover:text-white active:scale-95 transition-all"
                title="ፍለጋውን አጽዳ (Clear Search)"
                aria-label="Clear input"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsGlobalScannerOpen(true)}
              className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 border border-blue-500/30 active:scale-95 transition-all flex items-center gap-1 shadow-sm"
              title="ባርኮድ በካሜራ ስካን አድርግ (Scan Barcode with Camera)"
              aria-label="Scan Barcode"
            >
              <Camera className="w-4 h-4 stroke-[2.2]" />
            </button>
          </div>
        </div>

        {/* Category Pills (Synchronized with search) */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none select-none">
          {categoryPills.map((cat) => {
            const isSelected = selectedCategory === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-150 active:scale-95 ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-950/50 font-black"
                    : "border border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:text-white"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-center space-y-2">
            <AlertCircle className="w-6 h-6 text-rose-400 mx-auto" />
            <p className="text-xs text-rose-300 font-semibold">{error}</p>
            <button
              onClick={() => fetchInventory()}
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
                className="h-28 rounded-2xl bg-slate-900/60 border border-slate-800/60 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Clean Dark Slate Card for Empty State: "ምንም የተገኘ ዕቃ የለም" (No items found) */}
        {!loading && !error && filteredItems.length === 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-xl animate-in fade-in duration-200">
            <div className="w-14 h-14 rounded-2xl bg-blue-950/60 border border-blue-800/50 flex items-center justify-center mx-auto text-blue-400 shadow-md shadow-blue-950/50">
              <SearchX className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                ምንም የተገኘ ዕቃ የለም
              </h3>
              <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">
                {searchQuery
                  ? `"${searchQuery}" ጋር የሚዛመድ ዕቃ አልተገኘም።`
                  : "በተመረጠው ምድብ ውስጥ ምንም ዕቃ አልተገኘም።"}
              </p>
              <p className="text-[11px] text-slate-500 font-medium">
                No items found matching your search or filters.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("ALL");
                }}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-xs shadow-lg shadow-blue-600/30 border border-blue-400/30 active:scale-95 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>ማጣሪያዎችን አጽዳ (Reset Filters)</span>
              </button>

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs border border-slate-700 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>{t.inventory.addItemBtn}</span>
              </button>
            </div>
          </div>
        )}

        {/* Product Cards List */}
        {!loading && !error && (
          <div className="space-y-3">
            {filteredItems.map(({ product, variant }) => {
              const isAdjusting = adjustingId === variant.id;
              const hasTransit = variant.in_transit_quantity > 0;
              const isOutOfStock = variant.stock_quantity === 0;

              return (
                <div
                  key={variant.id}
                  className={`bg-slate-900 border rounded-2xl p-4 transition-all shadow-md ${
                    isOutOfStock
                      ? "border-rose-950/40 bg-slate-900/90"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {/* Top Row: Brand, Category, Spec */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700">
                          {variant.brand}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {product.name}
                        </span>
                        <span className="text-[9px] font-bold text-slate-500 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                          {product.category}
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-white mt-1 leading-snug">
                        {variant.spec}
                      </h3>
                    </div>

                    {/* Stock Count Badge */}
                    <div className="text-right shrink-0">
                      <div
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-mono text-xs font-black ${
                          isOutOfStock
                            ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                            : "bg-blue-950/60 text-blue-400 border border-blue-800/50"
                        }`}
                      >
                        <span className="text-[10px] uppercase font-sans font-bold">
                          {t.common.stock}:
                        </span>
                        <span className="text-sm">{variant.stock_quantity}</span>
                      </div>
                    </div>
                  </div>

                  {/* Price Row */}
                  <div className="flex items-center justify-between text-xs mt-2.5 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-200 font-black font-mono">
                        {variant.retail_price.toLocaleString()} {t.common.etb}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {t.common.wholesale}: {variant.wholesale_price.toLocaleString()}
                      </span>
                    </div>

                    {/* One-Tap 'Receive Transit' Amber Badge */}
                    {hasTransit ? (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveTransitVariant({
                            variant,
                            productName: product.name,
                          })
                        }
                        className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 active:scale-95 transition-all font-bold shadow-sm"
                        title="ዕቃዎችን ወደ መደብር አስገባ (Receive Merkato Freight)"
                      >
                        <Truck className="w-3.5 h-3.5 text-amber-400" />
                        <span>+{variant.in_transit_quantity} በመንገድ ላይ (In Transit)</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-500">ጭነት የለም (No transit)</span>
                    )}
                  </div>

                  {/* Bottom Action Row: Quick Count Adjust Steppers, Prominent "ሽጥ / Sell" Button & Clean "አስተካክል / Edit" Button */}
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/60 gap-1.5 flex-wrap">
                    {/* Left: Quick Stepper Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() =>
                          handleStepAdjust(
                            variant.id,
                            -1,
                            variant.stock_quantity,
                            `${variant.brand} ${variant.spec}`
                          )
                        }
                        disabled={isAdjusting || variant.stock_quantity <= 0}
                        aria-label="Decrease stock"
                        className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 font-bold flex items-center justify-center border border-slate-700 shadow-sm active:scale-90 transition-all disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>

                      <span className="w-7 text-center font-mono font-black text-xs text-white">
                        {variant.stock_quantity}
                      </span>

                      <button
                        onClick={() =>
                          handleStepAdjust(
                            variant.id,
                            1,
                            variant.stock_quantity,
                            `${variant.brand} ${variant.spec}`
                          )
                        }
                        disabled={isAdjusting}
                        aria-label="Increase stock"
                        className="w-9 h-9 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 active:bg-blue-600 text-blue-300 font-bold flex items-center justify-center border border-blue-500/40 shadow-sm active:scale-90 transition-all disabled:opacity-30"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>

                    {/* Right: Actions ("ሽጥ / Sell" & "አስተካክል / Edit") */}
                    <div className="flex items-center gap-1.5 ml-auto">
                      {/* Prominent "ሽጥ / Sell" Button */}
                      <button
                        type="button"
                        onClick={() =>
                          setActiveSellVariant({
                            variant,
                            productName: product.name,
                          })
                        }
                        disabled={isOutOfStock}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-black shadow-md shadow-blue-600/25 border border-blue-400/30 active:scale-95 transition-all"
                        title="የችርቻሮ ሽያጭ (Walk-in Sale)"
                      >
                        <ShoppingBag className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>ሽጥ <span className="text-[10px] text-blue-100 font-semibold hidden sm:inline">(Sell)</span></span>
                      </button>

                      {/* Clean "አስተካክል / Edit" Button */}
                      <button
                        onClick={() => setEditingItem({ product, variant })}
                        className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700/80 text-xs font-bold text-slate-200 hover:text-white active:scale-95 transition-all shadow-sm"
                        title="ዕቃውን አስተካክል (Edit Product)"
                      >
                        <Pencil className="w-3.5 h-3.5 text-blue-400 stroke-[2.2]" />
                        <span>አስተካክል</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Prominent Floating "+" Button for Add Product */}
      <div className="fixed bottom-20 right-4 z-40 max-w-md">
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="w-14 h-14 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black flex items-center justify-center shadow-2xl shadow-blue-950/60 border-2 border-blue-400 active:scale-90 transition-all select-none"
          title={t.inventory.addItemBtn}
          aria-label="Add Item"
        >
          <Plus className="w-7 h-7 stroke-[3]" />
        </button>
      </div>

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={isAddModalOpen}
        initialBarcode={addModalInitialBarcode}
        onClose={() => {
          setIsAddModalOpen(false);
          setAddModalInitialBarcode("");
        }}
        onSuccess={() => {
          fetchInventory(true);
          showToast(t.addModal.successMsg);
        }}
      />

      {/* Edit Product Modal */}
      {editingItem && (
        <EditProductModal
          isOpen={!!editingItem}
          product={editingItem.product}
          variant={editingItem.variant}
          onClose={() => setEditingItem(null)}
          onSave={handleSaveEdit}
          isSaving={savingEdit}
        />
      )}

      {/* One-Tap Transit Intake Modal */}
      {activeTransitVariant && (
        <ReceiveTransitModal
          isOpen={!!activeTransitVariant}
          variant={activeTransitVariant.variant}
          productName={activeTransitVariant.productName}
          onClose={() => setActiveTransitVariant(null)}
          onConfirmReceive={handleConfirmReceiveTransit}
          isSubmitting={receivingTransit}
        />
      )}

      {/* Quick Sell Modal */}
      {activeSellVariant && (
        <QuickSellModal
          isOpen={!!activeSellVariant}
          variant={activeSellVariant.variant}
          productName={activeSellVariant.productName}
          onClose={() => setActiveSellVariant(null)}
          onSuccess={handleQuickSellSuccess}
        />
      )}

      {/* Today's Sales & Evening Cash Drawer Balancing Drawer */}
      <TodaySalesDrawer
        isOpen={isSalesDrawerOpen}
        onClose={() => setIsSalesDrawerOpen(false)}
        orders={orders}
      />

      {/* Instant Product Sheet (Workflow 2 CASE A: Registered Item) */}
      {instantProductSheet && (
        <InstantProductSheet
          isOpen={!!instantProductSheet}
          product={instantProductSheet.product}
          variant={instantProductSheet.variant}
          onClose={() => setInstantProductSheet(null)}
          onQuickSell={(prod, v) => {
            setActiveSellVariant({
              variant: v,
              productName: prod.name,
            });
          }}
          onRestock={handleStepAdjust}
          onOpenTransit={(prod, v) => {
            setActiveTransitVariant({
              variant: v,
              productName: prod.name,
            });
          }}
          onEdit={(prod, v) => {
            setEditingItem({ product: prod, variant: v });
          }}
          isAdjusting={adjustingId !== null}
        />
      )}

      {/* Global Barcode Camera Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isGlobalScannerOpen}
        onClose={() => setIsGlobalScannerOpen(false)}
        onScan={handleGlobalBarcodeScan}
        title="ባርኮድ ስካነር"
        subtitle="በሳጥኑ ላይ ያለውን ባርኮድ ስካን ያድርጉ"
      />
    </div>
  );
}
