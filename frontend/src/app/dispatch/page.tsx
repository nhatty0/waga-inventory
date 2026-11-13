"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  SendHorizontal,
  Clock,
  Truck,
  Plus,
  Minus,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Receipt,
  Store,
  MapPin,
  User,
  AlertCircle,
  PackageCheck,
  AlertTriangle,
  History,
  ShoppingBag,
  Banknote,
  Smartphone,
  Building2,
  MoreHorizontal,
} from "lucide-react";
import TopHeader from "@/components/TopHeader";
import { useLanguage } from "@/context/LanguageContext";
import { isAuthenticated } from "@/lib/auth";
import {
  Client,
  Product,
  OrderType,
  getClients,
  getProducts,
  getOrders,
  dispatchOrder,
  Order,
  ProductVariant,
} from "@/lib/api";

interface WholesaleLineItem {
  uid: string;
  variant_id: number;
  quantity: number | "";
  unit_price: number | "";
}

interface RetailLineItem {
  uid: string;
  variant_id: number;
  quantity: number | "";
  unit_price: number | "";
}

type RetailPaymentMethod = "Telebirr" | "Cash" | "CBE" | "Other";

export default function DispatchPage() {
  const router = useRouter();
  const { t } = useLanguage();

  // Mode Selection: "NEIGHBOR_LEND" (የጎረቤት ውሰት) vs "RURAL_BULK" (የክፍለ-ሀገር ጅምላ)
  const [activeMode, setActiveMode] = useState<OrderType>("NEIGHBOR_LEND");

  // Reference Data from Backend DB
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);

  // Validation State & Refs
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({});
  const [errorToast, setErrorToast] = useState<{ detail?: string } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Element Refs for Auto-Scroll & Focus
  const neighborShopInputRef = useRef<HTMLInputElement>(null);
  const neighborItemSelectRef = useRef<HTMLSelectElement>(null);
  const neighborQtyInputRef = useRef<HTMLInputElement>(null);
  const neighborPriceInputRef = useRef<HTMLInputElement>(null);

  const wholesaleClientInputRef = useRef<HTMLInputElement>(null);
  const wholesaleDestinationInputRef = useRef<HTMLInputElement>(null);
  const wholesaleLineRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // -------------------------------------------------------------
  // Mode 0: "የቀን ችርቻሮ" State (Walk-in Multi-Item Cart)
  // -------------------------------------------------------------
  const [retailLines, setRetailLines] = useState<RetailLineItem[]>([]);
  const [retailPaymentMethod, setRetailPaymentMethod] = useState<RetailPaymentMethod>("Telebirr");
  const [retailCustomerName, setRetailCustomerName] = useState<string>("");
  const [retailNote, setRetailNote] = useState<string>("");

  // -------------------------------------------------------------
  // Mode 1: "የጎረቤት ውሰት" State
  // -------------------------------------------------------------
  const [neighborShopName, setNeighborShopName] = useState<string>("");
  const [neighborVariantId, setNeighborVariantId] = useState<number>(0);
  const [neighborQty, setNeighborQty] = useState<number | "">(1);
  const [neighborPrice, setNeighborPrice] = useState<number | "">("");
  const [neighborTermsNote, setNeighborTermsNote] = useState<string>(
    "ለደንበኛ ለማሳየት (Expected back today)"
  );

  // -------------------------------------------------------------
  // Mode 2: "የክፍለ-ሀገር ጅምላ" State
  // -------------------------------------------------------------
  const [wholesaleClientName, setWholesaleClientName] = useState<string>("");
  const [wholesaleDestination, setWholesaleDestination] = useState<string>("");
  const [wholesaleClientPhone, setWholesaleClientPhone] = useState<string>("");

  // Multi-line items for Wholesale
  const [wholesaleLines, setWholesaleLines] = useState<WholesaleLineItem[]>([]);

  // Logistics collapsible section
  const [isLogisticsOpen, setIsLogisticsOpen] = useState<boolean>(false);
  const [driverName, setDriverName] = useState<string>("");
  const [driverPhone, setDriverPhone] = useState<string>("");
  const [vehiclePlate, setVehiclePlate] = useState<string>("");

  // Wholesale Payment (no prepended "0" glitch)
  const [wholesaleAmountPaid, setWholesaleAmountPaid] = useState<number | "">("");

  // -------------------------------------------------------------
  // Submission & Summary Modal State
  // -------------------------------------------------------------
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [summarySlipOrder, setSummarySlipOrder] = useState<Order | null>(null);
  const [copiedSlip, setCopiedSlip] = useState<boolean>(false);

  // Load Real Database Data (Clients, In-Stock Products, Orders)
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    async function loadData() {
      try {
        const [cList, pList, oList] = await Promise.all([
          getClients(),
          getProducts(),
          getOrders().catch(() => [] as Order[]),
        ]);

        setClients(cList);
        setProducts(pList);
        setOrders(oList);

        // Strict Inventory Binding: Find strictly in-stock variants (> 0)
        const inStock = pList
          .flatMap((p) => p.variants)
          .filter((v) => v.stock_quantity > 0);

        if (inStock.length > 0) {
          const first = inStock[0];
          setNeighborVariantId(first.id);
          const defaultPrice = first.wholesale_price > 0 ? first.wholesale_price : first.retail_price;
          setNeighborPrice(defaultPrice);
          setNeighborQty(1);

          // Initialize first line item for wholesale mode
          setWholesaleLines([
            {
              uid: "line-1",
              variant_id: first.id,
              quantity: 1,
              unit_price: defaultPrice,
            },
          ]);

          // Initialize first line item for retail mode
          setRetailLines([
            {
              uid: "retail-1",
              variant_id: first.id,
              quantity: 1,
              unit_price: first.retail_price > 0 ? first.retail_price : defaultPrice,
            },
          ]);
        }
      } catch (err: unknown) {
        setErrorToast({
          detail: err instanceof Error ? err.message : "Failed to load shop catalog data",
        });
      } finally {
        setLoadingInitial(false);
      }
    }

    loadData();
  }, []);

  // Strict Database Inventory Binding: ONLY variants with stock_quantity > 0
  const inStockVariants = useMemo(() => {
    return products.flatMap((p) =>
      p.variants
        .filter((v) => v.stock_quantity > 0)
        .map((v) => ({
          ...v,
          productName: p.name,
          category: p.category,
        }))
    );
  }, [products]);

  // Selected variant for Mode 1
  const selectedNeighborVariant = useMemo(() => {
    return inStockVariants.find((v) => v.id === neighborVariantId) || null;
  }, [inStockVariants, neighborVariantId]);

  // Dynamic Neighbor Borrower History derived strictly from DB clients & past orders
  const dynamicNeighborChips = useMemo(() => {
    const names = new Set<string>();

    clients.forEach((c) => {
      if (c.type === "NEIGHBOR_BORROWER" && c.name?.trim()) {
        names.add(c.name.trim());
      }
    });

    orders.forEach((o) => {
      if (o.order_type === "NEIGHBOR_LEND" && o.client?.name?.trim()) {
        names.add(o.client.name.trim());
      }
    });

    return Array.from(names);
  }, [clients, orders]);

  // Dynamic Destination City History derived strictly from DB clients & past orders
  const dynamicDestinationChips = useMemo(() => {
    const locs = new Set<string>();

    clients.forEach((c) => {
      const loc = c.location?.trim();
      if (
        loc &&
        !loc.toLowerCase().includes("piassa") &&
        loc.toLowerCase() !== "gondar"
      ) {
        locs.add(loc);
      }
    });

    orders.forEach((o) => {
      if (o.client?.location) {
        const loc = o.client.location.trim();
        if (
          loc &&
          !loc.toLowerCase().includes("piassa") &&
          loc.toLowerCase() !== "gondar"
        ) {
          locs.add(loc);
        }
      }
    });

    return Array.from(locs);
  }, [clients, orders]);

  // Auto-fill price when Mode 1 Variant is selected
  const handleNeighborVariantSelect = (variantId: number) => {
    setNeighborVariantId(variantId);
    setInvalidFields((prev) => ({ ...prev, neighborVariant: false }));
    const v = inStockVariants.find((item) => item.id === variantId);
    if (v) {
      const defaultPrice = v.wholesale_price > 0 ? v.wholesale_price : v.retail_price;
      setNeighborPrice(defaultPrice);
      setNeighborQty(1);
    }
  };

  // -------------------------------------------------------------
  // Mode 0: "የቀን ችርቻሮ" Multi-Item Cart Calculations & Handlers
  // -------------------------------------------------------------
  const retailTotalAmount = useMemo(() => {
    return retailLines.reduce((acc, line) => {
      const q = typeof line.quantity === "number" ? line.quantity : 0;
      const p = typeof line.unit_price === "number" ? line.unit_price : 0;
      return acc + q * p;
    }, 0);
  }, [retailLines]);

  const retailTotalUnits = useMemo(() => {
    return retailLines.reduce((acc, line) => {
      const q = typeof line.quantity === "number" ? line.quantity : 0;
      return acc + q;
    }, 0);
  }, [retailLines]);

  const handleAddRetailLine = () => {
    if (inStockVariants.length === 0) return;
    const nextVariant = inStockVariants[retailLines.length % inStockVariants.length];
    const defaultPrice = nextVariant.retail_price > 0 ? nextVariant.retail_price : nextVariant.wholesale_price;

    setRetailLines((prev) => [
      ...prev,
      {
        uid: `retail-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        variant_id: nextVariant.id,
        quantity: 1,
        unit_price: defaultPrice,
      },
    ]);
  };

  const handleRemoveRetailLine = (uid: string) => {
    if (retailLines.length <= 1) return;
    setRetailLines((prev) => prev.filter((l) => l.uid !== uid));
  };

  const handleUpdateRetailLine = (
    uid: string,
    updates: Partial<RetailLineItem>
  ) => {
    setRetailLines((prev) =>
      prev.map((line) => {
        if (line.uid !== uid) return line;
        const updated = { ...line, ...updates };

        // When variant changes, auto-fill unit_price with variant's retail price
        if (updates.variant_id !== undefined && updates.variant_id !== line.variant_id) {
          const v = inStockVariants.find((item) => item.id === updates.variant_id);
          if (v) {
            updated.unit_price = v.retail_price > 0 ? v.retail_price : v.wholesale_price;
          }
        }
        return updated;
      })
    );
  };

  const handleStepRetailQty = (uid: string, delta: number) => {
    const line = retailLines.find((l) => l.uid === uid);
    if (!line) return;
    const v = inStockVariants.find((item) => item.id === line.variant_id);
    const maxStock = v ? v.stock_quantity : 999;
    const cur = typeof line.quantity === "number" ? line.quantity : 1;
    const next = Math.max(1, Math.min(maxStock, cur + delta));
    handleUpdateRetailLine(uid, { quantity: next });
  };

  // -------------------------------------------------------------
  // Mode 0: Submit "የቀን ችርቻሮ" Multi-Item Counter Sale
  // -------------------------------------------------------------
  const handleSubmitRetail = async (e: React.FormEvent) => {
    e.preventDefault();

    if (retailLines.length === 0) {
      setErrorToast({ detail: "እባክዎ የሚሸጥ ዕቃ ይምረጡ (Please add items to cart)" });
      return;
    }

    for (const line of retailLines) {
      const q = typeof line.quantity === "number" ? line.quantity : 0;
      const p = typeof line.unit_price === "number" ? line.unit_price : 0;
      const v = inStockVariants.find((item) => item.id === line.variant_id);

      if (!v) {
        setErrorToast({ detail: "እባክዎ ትክክለኛ ዕቃ ይምረጡ" });
        return;
      }
      if (q <= 0) {
        setErrorToast({ detail: `እባክዎ ለ ${v.brand} ${v.spec} ብዛት ያስገቡ` });
        return;
      }
      if (q > v.stock_quantity) {
        setErrorToast({
          detail: `ያለ ክምችት አልበቃም! ለ ${v.brand} ${v.spec} ያለው ክምችት ${v.stock_quantity} ፍሬ ብቻ ነው።`,
        });
        return;
      }
      if (p < 0) {
        setErrorToast({ detail: `ዋጋ ከ 0 ያነሰ መሆን አይችልም (${v.brand})` });
        return;
      }
    }

    setSubmitting(true);

    try {
      // Optimistic stock decrement
      setProducts((prev) =>
        prev.map((prod) => ({
          ...prod,
          variants: prod.variants.map((v) => {
            const line = retailLines.find((l) => l.variant_id === v.id);
            if (line) {
              const q = typeof line.quantity === "number" ? line.quantity : 0;
              return { ...v, stock_quantity: Math.max(0, v.stock_quantity - q) };
            }
            return v;
          }),
        }))
      );

      const clientName = retailCustomerName.trim() || "የሱቅ ደንበኛ";
      let paymentLabel = "ቴሌብር";
      if (retailPaymentMethod === "Cash") paymentLabel = "ጥሬ ገንዘብ";
      else if (retailPaymentMethod === "CBE") paymentLabel = "CBE / ባንክ";
      else if (retailPaymentMethod === "Other") paymentLabel = "ሌላ";

      const combinedNotes = retailNote.trim()
        ? `[ክፍያ፦ ${paymentLabel}] ${retailNote.trim()}`
        : `[ክፍያ፦ ${paymentLabel}]`;

      const dispatched = await dispatchOrder({
        client_name: clientName,
        order_type: "RETAIL",
        items: retailLines.map((l) => ({
          variant_id: l.variant_id,
          quantity: typeof l.quantity === "number" ? l.quantity : 1,
          unit_price: typeof l.unit_price === "number" ? l.unit_price : 0,
        })),
        amount_paid: retailTotalAmount,
        notes: combinedNotes,
      });

      // Reset retail cart
      if (inStockVariants.length > 0) {
        const first = inStockVariants[0];
        setRetailLines([
          {
            uid: `retail-${Date.now()}`,
            variant_id: first.id,
            quantity: 1,
            unit_price: first.retail_price > 0 ? first.retail_price : first.wholesale_price,
          },
        ]);
      } else {
        setRetailLines([]);
      }
      setRetailCustomerName("");
      setRetailNote("");

      // Show summary slip modal
      setSummarySlipOrder(dispatched);
    } catch (err: unknown) {
      setErrorToast({
        detail: err instanceof Error ? err.message : "የቀን ሽያጭ መመዝገብ አልተቻለም",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Wholesale totals calculation
  const wholesaleTotalAmount = useMemo(() => {
    return wholesaleLines.reduce((acc, line) => {
      const qty = typeof line.quantity === "number" ? line.quantity : 0;
      const price = typeof line.unit_price === "number" ? line.unit_price : 0;
      return acc + qty * price;
    }, 0);
  }, [wholesaleLines]);

  const wholesaleBalanceDue = useMemo(() => {
    const paid = typeof wholesaleAmountPaid === "number" ? wholesaleAmountPaid : 0;
    return Math.max(0, wholesaleTotalAmount - paid);
  }, [wholesaleTotalAmount, wholesaleAmountPaid]);

  // Quick Wholesale payment helper buttons (without leading "0")
  const handleSetZeroPaid = () => {
    setWholesaleAmountPaid(0);
    setInvalidFields((prev) => ({ ...prev, wholesalePayment: false }));
  };
  const handleSetHalfPaid = () => {
    setWholesaleAmountPaid(Math.round(wholesaleTotalAmount / 2));
    setInvalidFields((prev) => ({ ...prev, wholesalePayment: false }));
  };
  const handleSetFullPaid = () => {
    setWholesaleAmountPaid(wholesaleTotalAmount);
    setInvalidFields((prev) => ({ ...prev, wholesalePayment: false }));
  };

  // Add line item in Wholesale mode
  const handleAddWholesaleLine = () => {
    if (inStockVariants.length === 0) return;
    const nextVariant = inStockVariants[wholesaleLines.length % inStockVariants.length];
    const defaultPrice = nextVariant.wholesale_price > 0 ? nextVariant.wholesale_price : nextVariant.retail_price;

    setWholesaleLines((prev) => [
      ...prev,
      {
        uid: `line-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        variant_id: nextVariant.id,
        quantity: 1,
        unit_price: defaultPrice,
      },
    ]);
  };

  // Remove line item in Wholesale mode
  const handleRemoveWholesaleLine = (uid: string) => {
    if (wholesaleLines.length <= 1) return;
    setWholesaleLines((prev) => prev.filter((l) => l.uid !== uid));
  };

  // Update specific line item (handles empty strings without "0" glitch)
  const handleUpdateWholesaleLine = (
    uid: string,
    updates: Partial<WholesaleLineItem>
  ) => {
    setWholesaleLines((prev) =>
      prev.map((line) => {
        if (line.uid !== uid) return line;

        const updated = { ...line, ...updates };

        // When variant changes, auto-fill unit_price with variant's wholesale or retail price
        if (updates.variant_id !== undefined && updates.variant_id !== line.variant_id) {
          const v = inStockVariants.find((item) => item.id === updates.variant_id);
          if (v) {
            updated.unit_price = v.wholesale_price > 0 ? v.wholesale_price : v.retail_price;
          }
        }
        return updated;
      })
    );
  };

  // Trigger Validation Error with Smooth Auto-Scroll and Red Highlighting
  const triggerValidationError = (
    fieldKey: string,
    elementRef: React.RefObject<HTMLElement | null>,
    messageDetail: string
  ) => {
    setInvalidFields((prev) => ({ ...prev, [fieldKey]: true }));
    setErrorToast({ detail: messageDetail });

    if (elementRef.current) {
      elementRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      if ("focus" in elementRef.current && typeof elementRef.current.focus === "function") {
        elementRef.current.focus();
      }
    }

    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setErrorToast(null);
    }, 4000);
  };

  // -------------------------------------------------------------
  // Mode 1: Submit "የጎረቤት ውሰት" with Strict Validation & Scroll
  // -------------------------------------------------------------
  const handleSubmitNeighborLoan = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validate Shop Name
    const cleanShop = neighborShopName.trim();
    if (!cleanShop) {
      triggerValidationError(
        "neighborShop",
        neighborShopInputRef,
        "እባክዎ የጎረቤት ሱቁን ስም ያስገቡ (Shop name is required)"
      );
      return;
    }

    // 2. Validate Item Selection
    if (!selectedNeighborVariant || neighborVariantId === 0) {
      triggerValidationError(
        "neighborVariant",
        neighborItemSelectRef,
        "እባክዎ የሚተላለፈውን ዕቃ ይምረጡ (Item selection is required)"
      );
      return;
    }

    // 3. Validate Quantity
    const qty = typeof neighborQty === "number" ? neighborQty : 0;
    if (qty <= 0) {
      triggerValidationError(
        "neighborQty",
        neighborQtyInputRef,
        "ብዛት ቢያንስ 1 መሆን አለበት (Quantity must be at least 1)"
      );
      return;
    }

    if (qty > selectedNeighborVariant.stock_quantity) {
      triggerValidationError(
        "neighborQty",
        neighborQtyInputRef,
        `ያለ ክምችት ${selectedNeighborVariant.stock_quantity} ፍሬ ብቻ ነው (Only ${selectedNeighborVariant.stock_quantity} available in shop)`
      );
      return;
    }

    // 4. Validate Agreed Price
    const price = typeof neighborPrice === "number" ? neighborPrice : 0;
    if (price < 0) {
      triggerValidationError(
        "neighborPrice",
        neighborPriceInputRef,
        "እባክዎ ትክክለኛ ዋጋ ያስገቡ (Agreed price is required)"
      );
      return;
    }

    setSubmitting(true);

    try {
      // Optimistic update of local stock
      setProducts((prev) =>
        prev.map((prod) => ({
          ...prod,
          variants: prod.variants.map((v) =>
            v.id === selectedNeighborVariant.id
              ? { ...v, stock_quantity: Math.max(0, v.stock_quantity - qty) }
              : v
          ),
        }))
      );

      // Match existing neighbor client or pass clean name for auto-creation by backend
      const existingClient = clients.find(
        (c) => c.name.toLowerCase() === cleanShop.toLowerCase()
      );

      await dispatchOrder({
        client_id: existingClient?.id,
        client_name: existingClient ? undefined : cleanShop,
        client_location: "Gondar Piassa",
        order_type: "NEIGHBOR_LEND",
        items: [
          {
            variant_id: selectedNeighborVariant.id,
            quantity: qty,
            unit_price: price,
          },
        ],
        amount_paid: 0,
        notes: neighborTermsNote.trim() || "ለደንበኛ ለማሳየት (Expected back today)",
      });

      // Redirect immediately to Ledger screen
      router.push("/ledger");
    } catch (err: unknown) {
      setErrorToast({
        detail: err instanceof Error ? err.message : "ትዕዛዙን ማስተላለፍ አልተቻለም",
      });
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // Mode 2: Submit "የክፍለ-ሀገር ጅምላ" with Strict Validation & Scroll
  // -------------------------------------------------------------
  const handleSubmitWholesale = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validate Client Name
    const cleanClient = wholesaleClientName.trim();
    if (!cleanClient) {
      triggerValidationError(
        "wholesaleClient",
        wholesaleClientInputRef,
        "እባክዎ የጅምላ ደንበኛ ወይም የሱቅ ስም ያስገቡ (Client name is required)"
      );
      return;
    }

    // 2. Validate Destination City
    const cleanDestination = wholesaleDestination.trim();
    if (!cleanDestination) {
      triggerValidationError(
        "wholesaleDestination",
        wholesaleDestinationInputRef,
        "እባክዎ የመዳረሻ ከተማ ያስገቡ (Destination city is required)"
      );
      return;
    }

    // 3. Validate Line Items
    if (wholesaleLines.length === 0) {
      setErrorToast({
        detail: "እባክዎ ቢያንስ አንድ ዕቃ ይምረጡ (Select at least one item)",
      });
      return;
    }

    for (const line of wholesaleLines) {
      const v = inStockVariants.find((item) => item.id === line.variant_id);
      const q = typeof line.quantity === "number" ? line.quantity : 0;
      const p = typeof line.unit_price === "number" ? line.unit_price : 0;

      if (!v) {
        setErrorToast({ detail: "የተመረጠው ዕቃ በመደብር ውስጥ የለም (Variant out of stock)" });
        return;
      }

      if (q <= 0) {
        const lineEl = wholesaleLineRefs.current[line.uid];
        triggerValidationError(
          `line_${line.uid}`,
          { current: lineEl },
          `ብዛት ቢያንስ 1 መሆን አለበት (${v.brand} ${v.spec})`
        );
        return;
      }

      if (q > v.stock_quantity) {
        const lineEl = wholesaleLineRefs.current[line.uid];
        triggerValidationError(
          `line_${line.uid}`,
          { current: lineEl },
          `ያለ ክምችት አልበቃም! ለ ${v.brand} ${v.spec} ያለው ክምችት ${v.stock_quantity} ፍሬ ብቻ ነው።`
        );
        return;
      }

      if (p < 0) {
        const lineEl = wholesaleLineRefs.current[line.uid];
        triggerValidationError(
          `line_${line.uid}`,
          { current: lineEl },
          `እባክዎ ትክክለኛ ዋጋ ያስገቡ (${v.brand})`
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      // Optimistic decrement of stock
      setProducts((prev) =>
        prev.map((prod) => ({
          ...prod,
          variants: prod.variants.map((v) => {
            const line = wholesaleLines.find((l) => l.variant_id === v.id);
            if (line) {
              const q = typeof line.quantity === "number" ? line.quantity : 0;
              return { ...v, stock_quantity: Math.max(0, v.stock_quantity - q) };
            }
            return v;
          }),
        }))
      );

      const existingClient = clients.find(
        (c) => c.name.toLowerCase() === cleanClient.toLowerCase()
      );

      const paidAmount = typeof wholesaleAmountPaid === "number" ? wholesaleAmountPaid : 0;

      const dispatched = await dispatchOrder({
        client_id: existingClient?.id,
        client_name: existingClient ? undefined : cleanClient,
        client_phone: wholesaleClientPhone.trim() || undefined,
        client_location: cleanDestination,
        order_type: "RURAL_BULK",
        items: wholesaleLines.map((l) => ({
          variant_id: l.variant_id,
          quantity: typeof l.quantity === "number" ? l.quantity : 1,
          unit_price: typeof l.unit_price === "number" ? l.unit_price : 0,
        })),
        amount_paid: paidAmount,
        driver_name: driverName.trim() || undefined,
        driver_phone: driverPhone.trim() || undefined,
        vehicle_plate: vehiclePlate.trim() || undefined,
        notes: `የክፍለ-ሀገር ጅምላ ጭነት (${cleanDestination})`,
      });

      // Update clients list so newly created client immediately appears in suggestions
      if (!existingClient) {
        setClients((prev) => [
          {
            id: dispatched.client_id || Date.now(),
            name: cleanClient,
            phone: wholesaleClientPhone.trim(),
            type: "RURAL_WHOLESALER",
            location: cleanDestination,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }

      // Show formatted summary slip modal
      setSummarySlipOrder(dispatched);
    } catch (err: unknown) {
      setErrorToast({
        detail: err instanceof Error ? err.message : "የጅምላ ሽያጭ መመዝገብ አልተቻለም",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Formatted Telegram/SMS receipt slip text generator
  const telegramSlipText = useMemo(() => {
    if (!summarySlipOrder) return "";

    if (summarySlipOrder.order_type === "RETAIL") {
      const linesText = [
        "🧾 እስቲፍ ኤሌክትሮኒክስ - የቀን ችርቻሮ ደረሰኝ",
        "━━━━━━━━━━━━━━━━━━━━",
        `ትዕዛዝ ቁጥር፦ #${summarySlipOrder.id}`,
        `ደንበኛ፦ ${summarySlipOrder.client?.name || "የሱቅ ደንበኛ"}`,
        `ክፍያ፦ ${summarySlipOrder.notes || "ሙሉ የተከፈለ"}`,
        "━━━━━━━━━━━━━━━━━━━━",
        "የተሸጡ ዕቃዎች፦",
      ];

      summarySlipOrder.items.forEach((item, idx) => {
        const subtotal = (item.quantity * item.unit_price).toLocaleString();
        linesText.push(
          `${idx + 1}. ${item.quantity}x ${item.brand || ""} ${item.spec || ""} @ ${item.unit_price.toLocaleString()} ብር = ${subtotal} ብር`
        );
      });

      linesText.push("━━━━━━━━━━━━━━━━━━━━");
      linesText.push(`ጠቅላላ የተከፈለ፦ ${summarySlipOrder.total_amount.toLocaleString()} ብር`);
      linesText.push("━━━━━━━━━━━━━━━━━━━━");
      linesText.push("📍 እስቲፍ ኤሌክትሮኒክስ - ጎንደር ፒያሳ");

      return linesText.join("\n");
    }

    const linesText = [
      "📦 ዋጋ ኢንቬንቶሪ - የጅምላ ሽያጭ ደረሰኝ",
      "━━━━━━━━━━━━━━━━━━━━",
      `ትዕዛዝ ቁጥር፦ #${summarySlipOrder.id}`,
      `ደንበኛ፦ ${wholesaleClientName || summarySlipOrder.client?.name || "ጅምላ ደንበኛ"}`,
      `መዳረሻ፦ ${wholesaleDestination || summarySlipOrder.client?.location || "ጎንደር"}`,
    ];

    if (driverName || vehiclePlate || summarySlipOrder.driver_name) {
      const parts = [
        driverName || summarySlipOrder.driver_name
          ? `ሹፌር፦ ${driverName || summarySlipOrder.driver_name}`
          : null,
        driverPhone || summarySlipOrder.driver_phone
          ? `ስልክ፦ ${driverPhone || summarySlipOrder.driver_phone}`
          : null,
        vehiclePlate || summarySlipOrder.vehicle_plate
          ? `ታርጋ፦ ${vehiclePlate || summarySlipOrder.vehicle_plate}`
          : null,
      ].filter(Boolean);
      linesText.push(parts.join(" | "));
    }

    linesText.push("━━━━━━━━━━━━━━━━━━━━");
    linesText.push("የተላኩ ዕቃዎች፦");

    summarySlipOrder.items.forEach((item, idx) => {
      const subtotal = (item.quantity * item.unit_price).toLocaleString();
      linesText.push(
        `${idx + 1}. ${item.quantity}x ${item.brand || ""} ${item.spec || ""} @ ${item.unit_price.toLocaleString()} ብር = ${subtotal} ብር`
      );
    });

    linesText.push("━━━━━━━━━━━━━━━━━━━━");
    linesText.push(`ጠቅላላ ድምር፦ ${summarySlipOrder.total_amount.toLocaleString()} ብር`);
    linesText.push(`አሁን የተከፈለ፦ ${summarySlipOrder.amount_paid.toLocaleString()} ብር`);
    linesText.push(`ቀሪ ዕዳ፦ ${summarySlipOrder.balance_due.toLocaleString()} ብር`);
    linesText.push("━━━━━━━━━━━━━━━━━━━━");
    linesText.push("📍 እስቲፍ ኤሌክትሮኒክስ - ጎንደር ፒያሳ");

    return linesText.join("\n");
  }, [summarySlipOrder, wholesaleClientName, wholesaleDestination, driverName, driverPhone, vehiclePlate]);

  // Copy to clipboard handler
  const handleCopySlip = async () => {
    if (!telegramSlipText) return;
    try {
      await navigator.clipboard.writeText(telegramSlipText);
      setCopiedSlip(true);
      setTimeout(() => setCopiedSlip(false), 2500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = telegramSlipText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiedSlip(true);
      setTimeout(() => setCopiedSlip(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-28">
      <TopHeader
        title={t.dispatch.title}
        subtitle="የጎረቤት ውሰትና የክፍለ-ሀገር ጅምላ"
      />

      {/* Floating Bottom Validation Error Toast */}
      {errorToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-3 bg-rose-600 text-white text-xs font-black rounded-2xl shadow-2xl shadow-rose-950/80 border border-rose-400 flex items-center gap-2.5 max-w-[92vw] animate-in slide-in-from-bottom-5 duration-200">
          <AlertCircle className="w-5 h-5 text-white shrink-0" />
          <div className="leading-tight">
            <div className="font-black text-sm">
              እባክዎ የጎደሉ መረጃዎችን (የሱቅ ስም ወይም ዕቃ) ይሙሉ
            </div>
            {errorToast.detail && (
              <div className="text-[11px] text-rose-200 font-normal mt-0.5">
                {errorToast.detail}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 py-3.5 space-y-4">
        {/* Out of Stock Overall Warning */}
        {!loadingInitial && inStockVariants.length === 0 && (
          <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-4 flex items-center gap-3 text-amber-300">
            <AlertTriangle className="w-6 h-6 shrink-0 text-amber-400" />
            <div className="text-xs">
              <span className="font-black block">በመደብር ውስጥ ምንም ያለ ክምችት የለም</span>
              <span className="text-[11px] text-amber-200/80">
                All inventory items are currently at 0 stock. Please intake or restock items first.
              </span>
            </div>
          </div>
        )}

        {/* 1. Clear Top Mode Selector */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-2xl">
          {/* Mode 0: የቀን ችርቻሮ */}
          <button
            type="button"
            onClick={() => {
              setActiveMode("RETAIL");
              setInvalidFields({});
              setErrorToast(null);
            }}
            className={`p-2.5 sm:p-3 rounded-xl text-left transition-all active:scale-95 ${
              activeMode === "RETAIL"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-black border border-blue-400/30"
                : "bg-transparent text-slate-400 hover:text-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-black tracking-tight truncate">
                የቀን ችርቻሮ
              </span>
              <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
            </div>
            <p
              className={`text-[9px] sm:text-[10px] mt-0.5 truncate ${
                activeMode === "RETAIL" ? "text-blue-100" : "text-slate-500"
              }`}
            >
              Walk-in Sale
            </p>
          </button>

          {/* Mode 1: የጎረቤት ውሰት */}
          <button
            type="button"
            onClick={() => {
              setActiveMode("NEIGHBOR_LEND");
              setInvalidFields({});
              setErrorToast(null);
            }}
            className={`p-2.5 sm:p-3 rounded-xl text-left transition-all active:scale-95 ${
              activeMode === "NEIGHBOR_LEND"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-black border border-blue-400/30"
                : "bg-transparent text-slate-400 hover:text-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-black tracking-tight truncate">
                የጎረቤት ውሰት
              </span>
              <Clock className="w-3.5 h-3.5 shrink-0" />
            </div>
            <p
              className={`text-[9px] sm:text-[10px] mt-0.5 truncate ${
                activeMode === "NEIGHBOR_LEND" ? "text-blue-100" : "text-slate-500"
              }`}
            >
              Neighbor Loan
            </p>
          </button>

          {/* Mode 2: የክፍለ-ሀገር ጅምላ */}
          <button
            type="button"
            onClick={() => {
              setActiveMode("RURAL_BULK");
              setInvalidFields({});
              setErrorToast(null);
            }}
            className={`p-2.5 sm:p-3 rounded-xl text-left transition-all active:scale-95 ${
              activeMode === "RURAL_BULK"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-black border border-blue-400/30"
                : "bg-transparent text-slate-400 hover:text-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-black tracking-tight truncate">
                የክፍለ-ሀገር ጅምላ
              </span>
              <Truck className="w-3.5 h-3.5 shrink-0" />
            </div>
            <p
              className={`text-[9px] sm:text-[10px] mt-0.5 truncate ${
                activeMode === "RURAL_BULK" ? "text-blue-100" : "text-slate-500"
              }`}
            >
              Wholesale
            </p>
          </button>
        </div>

        {/* ========================================================= */}
        {/* MODE 0: "የቀን ችርቻሮ" (Walk-in Multi-Item Flow)            */}
        {/* ========================================================= */}
        {activeMode === "RETAIL" && (
          <form onSubmit={handleSubmitRetail} className="space-y-4 animate-in fade-in duration-150">
            {/* 1. Header Banner */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-white">
                    የቀን ቆጣሪ ችርቻሮ (Walk-in Sale)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    የደንበኛ መረጃ መሙላት አያስፈልግም • ፈጣን ሽያጭ
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-1 rounded-lg bg-blue-950/80 text-blue-300 border border-blue-800/60">
                {retailTotalUnits} ፍሬ
              </span>
            </div>

            {/* 2. Multi-Item Cart */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-blue-400" />
                  <span>የሚሸጡ ዕቃዎች (Cart Items)</span>
                </label>

                <button
                  type="button"
                  onClick={handleAddRetailLine}
                  disabled={inStockVariants.length === 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-bold border border-blue-500/30 active:scale-95 transition-all disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ ዕቃ ጨምር (Add Item)</span>
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                {retailLines.map((line, idx) => {
                  const currentVariant = inStockVariants.find((v) => v.id === line.variant_id);
                  const lineSubtotal =
                    (typeof line.quantity === "number" ? line.quantity : 0) *
                    (typeof line.unit_price === "number" ? line.unit_price : 0);

                  return (
                    <div
                      key={line.uid}
                      className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2.5 relative"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
                          #{idx + 1}
                        </span>

                        {retailLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRetailLine(line.uid)}
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="ዕቃውን አስወግድ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Variant Selector */}
                      <div>
                        <select
                          value={line.variant_id}
                          onChange={(e) =>
                            handleUpdateRetailLine(line.uid, {
                              variant_id: parseInt(e.target.value, 10),
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-blue-500"
                        >
                          {inStockVariants.map((v) => (
                            <option key={v.id} value={v.id}>
                              [{v.brand}] {v.spec} — ({v.stock_quantity} ፍሬ በመደብር)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Steppers & Quantity & Unit Price */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 mb-1 block">
                            ብዛት (Qty, Max: {currentVariant?.stock_quantity || 0})
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStepRetailQty(line.uid, -1)}
                              disabled={(typeof line.quantity === "number" ? line.quantity : 1) <= 1}
                              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>

                            <input
                              type="number"
                              min={1}
                              max={currentVariant?.stock_quantity || 999}
                              value={line.quantity}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "") {
                                  handleUpdateRetailLine(line.uid, { quantity: "" });
                                } else {
                                  const parsed = parseInt(val, 10);
                                  handleUpdateRetailLine(line.uid, {
                                    quantity: isNaN(parsed) ? "" : parsed,
                                  });
                                }
                              }}
                              className="flex-1 min-w-0 bg-slate-900 border border-slate-700/80 rounded-xl py-1.5 text-center text-xs font-mono font-black text-white focus:outline-none focus:border-blue-500"
                            />

                            <button
                              type="button"
                              onClick={() => handleStepRetailQty(line.uid, 1)}
                              disabled={
                                (typeof line.quantity === "number" ? line.quantity : 1) >=
                                (currentVariant?.stock_quantity || 999)
                              }
                              className="w-9 h-9 rounded-xl bg-blue-600/30 hover:bg-blue-600 text-blue-300 font-bold flex items-center justify-center active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-slate-400 mb-1 block">
                            መሸጫ ዋጋ (Unit Price)
                          </span>
                          <div className="relative">
                            <input
                              type="number"
                              min={0}
                              placeholder="0"
                              value={line.unit_price}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "") {
                                  handleUpdateRetailLine(line.uid, { unit_price: "" });
                                } else {
                                  const parsed = parseFloat(val);
                                  handleUpdateRetailLine(line.uid, {
                                    unit_price: isNaN(parsed) ? "" : parsed,
                                  });
                                }
                              }}
                              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-2 text-xs font-bold text-white font-mono focus:outline-none focus:border-blue-500 pr-8"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 pointer-events-none font-bold">
                              ብር
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Line Subtotal */}
                      <div className="flex justify-between items-center text-[11px] pt-1.5 border-t border-slate-800 text-slate-400 font-mono">
                        <span>ንዑስ ድምር፦</span>
                        <span className="font-black text-white">
                          {lineSubtotal.toLocaleString()} ብር
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Payment Method Chips */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5 shadow-sm">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                <span>የክፍያ ዘዴ (Payment Method)</span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRetailPaymentMethod("Telebirr")}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all active:scale-95 ${
                    retailPaymentMethod === "Telebirr"
                      ? "bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-950/50"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <Smartphone className={`w-4 h-4 shrink-0 ${retailPaymentMethod === "Telebirr" ? "text-white" : "text-blue-400"}`} />
                  <div>
                    <span className="text-xs font-black block leading-none">ቴሌብር</span>
                    <span className={`text-[10px] ${retailPaymentMethod === "Telebirr" ? "text-blue-100" : "text-slate-400"}`}>
                      Telebirr
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRetailPaymentMethod("Cash")}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all active:scale-95 ${
                    retailPaymentMethod === "Cash"
                      ? "bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-950/50"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <Banknote className={`w-4 h-4 shrink-0 ${retailPaymentMethod === "Cash" ? "text-white" : "text-emerald-400"}`} />
                  <div>
                    <span className="text-xs font-black block leading-none">ጥሬ ገንዘብ</span>
                    <span className={`text-[10px] ${retailPaymentMethod === "Cash" ? "text-emerald-100" : "text-slate-400"}`}>
                      Cash
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRetailPaymentMethod("CBE")}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all active:scale-95 ${
                    retailPaymentMethod === "CBE"
                      ? "bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-950/50"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <Building2 className={`w-4 h-4 shrink-0 ${retailPaymentMethod === "CBE" ? "text-white" : "text-purple-400"}`} />
                  <div>
                    <span className="text-xs font-black block leading-none">CBE / ባንክ</span>
                    <span className={`text-[10px] ${retailPaymentMethod === "CBE" ? "text-purple-100" : "text-slate-400"}`}>
                      Bank Transfer
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRetailPaymentMethod("Other")}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all active:scale-95 ${
                    retailPaymentMethod === "Other"
                      ? "bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-950/50"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <MoreHorizontal className={`w-4 h-4 shrink-0 ${retailPaymentMethod === "Other" ? "text-white" : "text-amber-400"}`} />
                  <div>
                    <span className="text-xs font-black block leading-none">ሌላ</span>
                    <span className={`text-[10px] ${retailPaymentMethod === "Other" ? "text-amber-100" : "text-slate-400"}`}>
                      Other
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* 4. Optional Customer Name & Warranty / Note */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5 shadow-sm">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span>የደንበኛ ስም እና ማስታወሻ (Optional Details)</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">
                    የደንበኛ ስም (Customer Name - Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="ነባሪ፦ የሱቅ ደንበኛ"
                    value={retailCustomerName}
                    onChange={(e) => setRetailCustomerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">
                    ዋስትና / ማስታወሻ (Warranty / Note)
                  </label>
                  <input
                    type="text"
                    placeholder="ምሳሌ፦ 1 ዓመት ዋስትና"
                    value={retailNote}
                    onChange={(e) => setRetailNote(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* 5. Total Summary Card */}
            <div className="bg-gradient-to-br from-blue-950/80 via-slate-900 to-slate-950 border border-blue-500/30 rounded-2xl p-4 shadow-lg shadow-blue-950/40 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-blue-300 block">
                  ጠቅላላ ሂሳብ (Total Bill)
                </span>
                <span className="text-2xl font-black font-mono text-white mt-0.5 block">
                  {retailTotalAmount.toLocaleString()} <span className="text-xs font-sans text-blue-400">ብር</span>
                </span>
              </div>
              <div className="text-right">
                <span className="inline-block px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-300 font-mono text-xs font-bold border border-blue-500/30">
                  {retailTotalUnits} ፍሬ ዕቃዎች
                </span>
                <span className="block text-[10px] text-emerald-400 font-bold mt-1">
                  ✓ ሙሉ የተከፈለ (Full Paid)
                </span>
              </div>
            </div>

            {/* 6. Single-Tap Submit Button */}
            <button
              type="submit"
              disabled={submitting || inStockVariants.length === 0 || retailLines.length === 0}
              className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-sm transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-600/30 border border-blue-400/30 disabled:opacity-40 active:scale-95"
            >
              <ShoppingBag className="w-5 h-5 stroke-[2.5]" />
              <span>
                {submitting ? "በመመዝገብ ላይ..." : "የቀን ሽያጩን መዝግብ (Confirm Sale)"}
              </span>
            </button>
          </form>
        )}

        {/* ========================================================= */}
        {/* MODE 1: "የጎረቤት ውሰት" (Fast 3-Tap Mobile Flow)           */}
        {/* ========================================================= */}
        {activeMode === "NEIGHBOR_LEND" && (
          <form onSubmit={handleSubmitNeighborLoan} className="space-y-4">
            {/* Step 1: Shop Selector with Dynamic History Chips from Database */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-blue-400" />
                  <span>1. የጎረቤት ሱቅ ምረጥ (Shop Selector)</span>
                </label>
              </div>

              {/* Dynamic Chips from Database */}
              {dynamicNeighborChips.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                    <History className="w-3 h-3 text-blue-400" />
                    <span>ቀደም ሲል የተመዘገቡ ሱቆች (Saved Shops)፦</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {dynamicNeighborChips.map((chip) => {
                      const isSelected = neighborShopName.trim() === chip;
                      return (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => {
                            setNeighborShopName(chip);
                            setInvalidFields((prev) => ({ ...prev, neighborShop: false }));
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                            isSelected
                              ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-400/40 font-black"
                              : "bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700 hover:text-white"
                          }`}
                        >
                          {chip}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => {
                        setNeighborShopName("");
                        neighborShopInputRef.current?.focus();
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-950 text-blue-400 border border-blue-900/60 hover:border-blue-700 active:scale-95"
                    >
                      + አዲስ ሱቅ
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 font-medium">
                  እስካሁን የተመዘገበ ጎረቤት ሱቅ የለም። አዲሱን ስም ከታች ያስገቡ (አንዴ ሲመዘገብ ለቀጣይ ይቀመጣል)፦
                </div>
              )}

              {/* Shop Name Input (with validation auto-scroll and red highlight) */}
              <div>
                <input
                  ref={neighborShopInputRef}
                  type="text"
                  placeholder="የሱቅ ስም አስገባ (ምሳሌ፦ ሱቅ 12 ዳዊት)..."
                  value={neighborShopName}
                  onChange={(e) => {
                    setNeighborShopName(e.target.value);
                    if (e.target.value.trim()) {
                      setInvalidFields((prev) => ({ ...prev, neighborShop: false }));
                    }
                  }}
                  className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none font-semibold transition-all ${
                    invalidFields.neighborShop
                      ? "border-red-500 ring-2 ring-red-500/30"
                      : "border-slate-800 focus:border-blue-500"
                  }`}
                />
              </div>
            </div>

            {/* Step 2: Strict Database Item Selection & Price */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
              <label className="text-xs font-bold text-slate-300 block">
                2. የሚወሰድ ዕቃ ምረጥ (Item Selection from Active Stock)
              </label>

              {/* Strictly in-stock items dropdown */}
              <select
                ref={neighborItemSelectRef}
                value={neighborVariantId}
                onChange={(e) => handleNeighborVariantSelect(Number(e.target.value))}
                className={`w-full bg-slate-950 border rounded-xl px-3.5 py-3 text-xs text-white font-medium focus:outline-none transition-all ${
                  invalidFields.neighborVariant
                    ? "border-red-500 ring-2 ring-red-500/30"
                    : "border-slate-800 focus:border-blue-500"
                }`}
              >
                {inStockVariants.length === 0 ? (
                  <option value={0}>ምንም ያለ ክምችት የለም (Out of Stock)</option>
                ) : (
                  inStockVariants.map((v) => (
                    <option key={v.id} value={v.id}>
                      [{v.brand}] {v.spec} — {v.stock_quantity} in shop ({v.stock_quantity} ፍሬ በመደብር)
                    </option>
                  ))
                )}
              </select>

              {/* Quantity Stepper & Agreed Settlement Price (Without "0" Glitch) */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {/* Stepper with clean numeric typing */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 mb-1.5 block">
                    የተወሰደ ብዛት (Quantity)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const current = typeof neighborQty === "number" ? neighborQty : 1;
                        setNeighborQty(Math.max(1, current - 1));
                        setInvalidFields((prev) => ({ ...prev, neighborQty: false }));
                      }}
                      disabled={neighborQty === "" || neighborQty <= 1}
                      className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-90 text-white font-bold flex items-center justify-center border border-slate-700 disabled:opacity-30"
                    >
                      <Minus className="w-4 h-4 stroke-[2.5]" />
                    </button>

                    <input
                      ref={neighborQtyInputRef}
                      type="number"
                      min={1}
                      max={selectedNeighborVariant?.stock_quantity || 999}
                      placeholder="1"
                      value={neighborQty}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          setNeighborQty("");
                        } else {
                          const parsed = parseInt(val, 10);
                          setNeighborQty(isNaN(parsed) ? "" : parsed);
                          setInvalidFields((prev) => ({ ...prev, neighborQty: false }));
                        }
                      }}
                      onBlur={() => {
                        if (neighborQty === "" || neighborQty < 1) {
                          setNeighborQty(1);
                        }
                      }}
                      className={`flex-1 w-full bg-slate-950 border rounded-xl py-2 text-center text-sm font-black text-white font-mono focus:outline-none transition-all ${
                        invalidFields.neighborQty
                          ? "border-red-500 ring-2 ring-red-500/30"
                          : "border-slate-800 focus:border-blue-500"
                      }`}
                    />

                    <button
                      type="button"
                      onClick={() => {
                        const current = typeof neighborQty === "number" ? neighborQty : 1;
                        const max = selectedNeighborVariant?.stock_quantity || 999;
                        setNeighborQty(Math.min(max, current + 1));
                        setInvalidFields((prev) => ({ ...prev, neighborQty: false }));
                      }}
                      disabled={
                        selectedNeighborVariant
                          ? typeof neighborQty === "number" &&
                            neighborQty >= selectedNeighborVariant.stock_quantity
                          : false
                      }
                      className="w-10 h-10 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 font-bold flex items-center justify-center border border-blue-500/40 active:scale-90 disabled:opacity-30"
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                </div>

                {/* Agreed Cut / Price Field without "0" Glitch */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 mb-1.5 block">
                    የስምምነት ዋጋ (Agreed Price ETB)
                  </span>
                  <div className="relative">
                    <input
                      ref={neighborPriceInputRef}
                      type="number"
                      min={0}
                      placeholder="0"
                      value={neighborPrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          setNeighborPrice("");
                        } else {
                          const parsed = parseFloat(val);
                          setNeighborPrice(isNaN(parsed) ? "" : parsed);
                          setInvalidFields((prev) => ({ ...prev, neighborPrice: false }));
                        }
                      }}
                      className={`w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-sm font-black text-white font-mono focus:outline-none transition-all ${
                        invalidFields.neighborPrice
                          ? "border-red-500 ring-2 ring-red-500/30"
                          : "border-slate-800 focus:border-blue-500"
                      }`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 pointer-events-none">
                      ብር
                    </span>
                  </div>
                </div>
              </div>

              {/* Terms Pill: [ለደንበኛ ለማሳየት / To Show Customer] */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px] font-semibold">ሁኔታ፦</span>
                <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold inline-flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>ለደንበኛ ለማሳየት (Expected back today)</span>
                </span>
              </div>
            </div>

            {/* Sticky Bottom Action Bar for Mode 1 */}
            <div className="sticky bottom-0 bg-slate-950/95 backdrop-blur-md pt-3 pb-4 border-t border-slate-800/80 z-30">
              <button
                type="submit"
                disabled={submitting || loadingInitial || inStockVariants.length === 0}
                className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-sm tracking-wide shadow-xl shadow-blue-600/30 border border-blue-400/30 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {submitting ? (
                  <span>በማስተላለፍ ላይ... (Dispatching...)</span>
                ) : (
                  <>
                    <SendHorizontal className="w-5 h-5 stroke-[2.5]" />
                    <span>ዕቃውን አስተላልፍ (Dispatch Item)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ========================================================= */}
        {/* MODE 2: "የክፍለ-ሀገር ጅምላ" (Bulk Wholesale Multi-Line Flow) */}
        {/* ========================================================= */}
        {activeMode === "RURAL_BULK" && (
          <form onSubmit={handleSubmitWholesale} className="space-y-4">
            {/* 1. Client Name & Dynamic Destination History */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span>1. የደንበኛ እና የመዳረሻ መረጃ (Client & Destination)</span>
              </label>

              <input
                ref={wholesaleClientInputRef}
                type="text"
                placeholder="የጅምላ ደንበኛ / የሱቅ ስም (ምሳሌ፦ አበበ ኤሌክትሮኒክስ)..."
                value={wholesaleClientName}
                onChange={(e) => {
                  setWholesaleClientName(e.target.value);
                  if (e.target.value.trim()) {
                    setInvalidFields((prev) => ({ ...prev, wholesaleClient: false }));
                  }
                }}
                className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none font-semibold transition-all ${
                  invalidFields.wholesaleClient
                    ? "border-red-500 ring-2 ring-red-500/30"
                    : "border-slate-800 focus:border-blue-500"
                }`}
              />

              {/* Dynamic Destination Chips from Database (No fake data) */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-blue-400" />
                  <span>መዳረሻ ከተማ (Destination City)፦</span>
                </span>

                {dynamicDestinationChips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pb-1">
                    {dynamicDestinationChips.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => {
                          setWholesaleDestination(chip);
                          setInvalidFields((prev) => ({ ...prev, wholesaleDestination: false }));
                        }}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                          wholesaleDestination === chip
                            ? "bg-blue-600 text-white border border-blue-400/40 shadow-sm"
                            : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-white"
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <input
                    ref={wholesaleDestinationInputRef}
                    type="text"
                    list="destination-suggestions"
                    placeholder="ከተማ (ምሳሌ፦ ደባርቅ፣ ዳባት፣ መተማ)"
                    value={wholesaleDestination}
                    onChange={(e) => {
                      setWholesaleDestination(e.target.value);
                      if (e.target.value.trim()) {
                        setInvalidFields((prev) => ({ ...prev, wholesaleDestination: false }));
                      }
                    }}
                    className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none font-medium transition-all ${
                      invalidFields.wholesaleDestination
                        ? "border-red-500 ring-2 ring-red-500/30"
                        : "border-slate-800 focus:border-blue-500"
                    }`}
                  />
                  <datalist id="destination-suggestions">
                    {dynamicDestinationChips.map((dest) => (
                      <option key={dest} value={dest} />
                    ))}
                  </datalist>

                  <input
                    type="text"
                    placeholder="ስልክ ቁጥር (+251...)"
                    value={wholesaleClientPhone}
                    onChange={(e) => setWholesaleClientPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* 2. Strict Database Multi-Item Selector */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>2. የጅምላ ዕቃዎች ዝርዝር (Multi-Item Lines from Real Stock)</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddWholesaleLine}
                  disabled={inStockVariants.length === 0}
                  className="px-3 py-1 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 font-black text-xs inline-flex items-center gap-1 border border-blue-500/40 active:scale-95 transition-all disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>+ ዕቃ ጨምር</span>
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                {wholesaleLines.map((line, idx) => {
                  const currentVariant = inStockVariants.find((v) => v.id === line.variant_id);
                  const qty = typeof line.quantity === "number" ? line.quantity : 0;
                  const price = typeof line.unit_price === "number" ? line.unit_price : 0;
                  const lineSubtotal = qty * price;
                  const isLineInvalid = invalidFields[`line_${line.uid}`];

                  return (
                    <div
                      key={line.uid}
                      ref={(el) => {
                        wholesaleLineRefs.current[line.uid] = el;
                      }}
                      className={`bg-slate-950 border rounded-2xl p-3.5 space-y-2.5 relative shadow-inner transition-all ${
                        isLineInvalid
                          ? "border-red-500 ring-2 ring-red-500/30"
                          : "border-slate-800/90"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-900 text-blue-400 border border-slate-800">
                          ዕቃ #{idx + 1}
                        </span>
                        {wholesaleLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveWholesaleLine(line.uid)}
                            className="p-1 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 active:scale-90 transition-all"
                            title="ዕቃውን ሰርዝ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Variant picker loaded strictly from real in-stock variants */}
                      <select
                        value={line.variant_id}
                        onChange={(e) =>
                          handleUpdateWholesaleLine(line.uid, {
                            variant_id: Number(e.target.value),
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-blue-500"
                      >
                        {inStockVariants.map((v) => (
                          <option key={v.id} value={v.id}>
                            [{v.brand}] {v.spec} — {v.stock_quantity} in shop ({v.stock_quantity} ፍሬ በመደብር)
                          </option>
                        ))}
                      </select>

                      {/* Quantity & Unit Price without "0" glitch */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 mb-1 block">
                            ብዛት (Qty)
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const current = typeof line.quantity === "number" ? line.quantity : 1;
                                handleUpdateWholesaleLine(line.uid, {
                                  quantity: Math.max(1, current - 1),
                                });
                              }}
                              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center active:scale-90"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={currentVariant?.stock_quantity || 999}
                              placeholder="1"
                              value={line.quantity}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "") {
                                  handleUpdateWholesaleLine(line.uid, { quantity: "" });
                                } else {
                                  const parsed = parseInt(val, 10);
                                  handleUpdateWholesaleLine(line.uid, {
                                    quantity: isNaN(parsed) ? "" : parsed,
                                  });
                                }
                              }}
                              onBlur={() => {
                                if (line.quantity === "" || line.quantity < 1) {
                                  handleUpdateWholesaleLine(line.uid, { quantity: 1 });
                                }
                              }}
                              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl py-1.5 text-center text-xs font-black text-white font-mono focus:outline-none focus:border-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const current = typeof line.quantity === "number" ? line.quantity : 1;
                                const max = currentVariant?.stock_quantity || 999;
                                handleUpdateWholesaleLine(line.uid, {
                                  quantity: Math.min(max, current + 1),
                                });
                              }}
                              className="w-9 h-9 rounded-xl bg-blue-600/30 hover:bg-blue-600 text-blue-300 font-bold flex items-center justify-center active:scale-90"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-slate-400 mb-1 block">
                            የጅምላ ዋጋ (Unit Price)
                          </span>
                          <input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={line.unit_price}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "") {
                                handleUpdateWholesaleLine(line.uid, { unit_price: "" });
                              } else {
                                const parsed = parseFloat(val);
                                handleUpdateWholesaleLine(line.uid, {
                                  unit_price: isNaN(parsed) ? "" : parsed,
                                });
                              }
                            }}
                            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-2 text-xs font-bold text-white font-mono focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {/* Line Subtotal */}
                      <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-900 text-slate-400 font-mono">
                        <span>ንዑስ ድምር፦</span>
                        <span className="font-black text-white">
                          {lineSubtotal.toLocaleString()} ብር
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Logistics Collapsible Section */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() => setIsLogisticsOpen(!isLogisticsOpen)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white">
                    የመኪና እና ሹፌር መረጃ (ከተፈለገ / Optional)
                  </span>
                </div>
                {isLogisticsOpen ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {isLogisticsOpen && (
                <div className="p-4 pt-1 space-y-2.5 border-t border-slate-800/60 bg-slate-950/60 animate-in fade-in">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">
                      የሹፌር ስም (Driver Name)
                    </label>
                    <input
                      type="text"
                      placeholder="ምሳሌ፦ ፋሲል ተሾመ"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">
                        የሹፌር ስልክ (Driver Phone)
                      </label>
                      <input
                        type="text"
                        placeholder="+2519..."
                        value={driverPhone}
                        onChange={(e) => setDriverPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">
                        የመኪና ታርጋ (Vehicle Plate)
                      </label>
                      <input
                        type="text"
                        placeholder="ምሳሌ፦ 3-12895 አማ"
                        value={vehiclePlate}
                        onChange={(e) => setVehiclePlate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Payment Fields: No Prepending "0" Glitch */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-bold">ጠቅላላ የጅምላ ሂሳብ፦</span>
                <span className="text-xl font-black text-white font-mono">
                  {wholesaleTotalAmount.toLocaleString()} ብር
                </span>
              </div>

              {/* Amount Paid Now without leading "0" glitch */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-300">
                    አሁን የተከፈለ (Amount Paid Now)
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={handleSetZeroPaid}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                        wholesaleAmountPaid === 0
                          ? "bg-amber-500 text-black font-black"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      0 (ብድር)
                    </button>
                    <button
                      type="button"
                      onClick={handleSetHalfPaid}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                        typeof wholesaleAmountPaid === "number" &&
                        wholesaleAmountPaid === Math.round(wholesaleTotalAmount / 2) &&
                        wholesaleAmountPaid > 0
                          ? "bg-blue-600 text-white font-black"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      onClick={handleSetFullPaid}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                        typeof wholesaleAmountPaid === "number" &&
                        wholesaleAmountPaid === wholesaleTotalAmount &&
                        wholesaleTotalAmount > 0
                          ? "bg-blue-600 text-white font-black shadow-md shadow-blue-600/30"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      ሙሉ
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={wholesaleTotalAmount}
                    placeholder="0"
                    value={wholesaleAmountPaid}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        setWholesaleAmountPaid("");
                      } else {
                        const parsed = parseFloat(val);
                        setWholesaleAmountPaid(isNaN(parsed) ? "" : parsed);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-lg font-black text-blue-400 font-mono focus:outline-none focus:border-blue-500"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                    ብር
                  </span>
                </div>
              </div>

              {/* Remaining Credit (Highlighted in amber/red when > 0) */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                  wholesaleBalanceDue > 0
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                }`}
              >
                <span className="font-bold">ቀሪ ዕዳ (Remaining Credit)፦</span>
                <span className="text-base font-black font-mono">
                  {wholesaleBalanceDue.toLocaleString()} ብር
                </span>
              </div>
            </div>

            {/* Sticky Bottom Action Bar for Mode 2 */}
            <div className="sticky bottom-0 bg-slate-950/95 backdrop-blur-md pt-3 pb-4 border-t border-slate-800/80 z-30">
              <button
                type="submit"
                disabled={submitting || loadingInitial || inStockVariants.length === 0}
                className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-sm tracking-wide shadow-xl shadow-blue-600/30 border border-blue-400/30 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {submitting ? (
                  <span>በመመዝገብ ላይ... (Registering...)</span>
                ) : (
                  <>
                    <SendHorizontal className="w-5 h-5 stroke-[2.5]" />
                    <span>ጅምላ ሽያጩን መዝግብ</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ========================================================= */}
      {/* SUMMARY SLIP MODAL with "በቴሌግራም ላክ / ኮፒ አድርግ"           */}
      {/* ========================================================= */}
      {summarySlipOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 rounded-xl bg-blue-950/70 border border-blue-800/60 text-blue-400">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  {summarySlipOrder.order_type === "RETAIL"
                    ? "የቀን ችርቻሮ ደረሰኝ"
                    : "የጅምላ ጭነት ደረሰኝ"}
                </h3>
                <p className="text-xs text-blue-300 font-mono mt-0.5">
                  ትዕዛዝ #{summarySlipOrder.id} • {summarySlipOrder.status}
                </p>
              </div>
            </div>

            {/* Formatted Receipt Slip Box */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs font-mono space-y-2 text-slate-300">
              <div className="flex justify-between text-slate-400 pb-1 border-b border-slate-900">
                <span>{summarySlipOrder.order_type === "RETAIL" ? "ደንበኛ፦" : "ደንበኛ / መዳረሻ፦"}</span>
                <span className="text-white font-bold">
                  {summarySlipOrder.order_type === "RETAIL"
                    ? (summarySlipOrder.client?.name || retailCustomerName || "የሱቅ ደንበኛ")
                    : `${wholesaleClientName || summarySlipOrder.client?.name} (${wholesaleDestination || summarySlipOrder.client?.location})`}
                </span>
              </div>

              {summarySlipOrder.order_type !== "RETAIL" && (driverName || vehiclePlate) && (
                <div className="flex justify-between text-slate-400 pb-1 border-b border-slate-900">
                  <span>ሹፌር / ታርጋ፦</span>
                  <span className="text-amber-300 font-bold">
                    {driverName || "ሹፌር"} {vehiclePlate ? `(${vehiclePlate})` : ""}
                  </span>
                </div>
              )}

              {/* Items Table */}
              <div className="py-1 space-y-1">
                <div className="text-[10px] text-slate-500 uppercase font-sans font-bold">
                  {summarySlipOrder.order_type === "RETAIL" ? "የተሸጡ ዕቃዎች፦" : "የተላኩ ዕቃዎች፦"}
                </div>
                {summarySlipOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span className="text-slate-200">
                      {item.quantity}x {item.brand} {item.spec}
                    </span>
                    <span className="text-white font-bold">
                      {(item.quantity * item.unit_price).toLocaleString()} ብር
                    </span>
                  </div>
                ))}
              </div>

              {/* Financial Totals */}
              <div className="pt-2 border-t border-slate-800 space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>ጠቅላላ ድምር፦</span>
                  <span className="text-white font-black">
                    {summarySlipOrder.total_amount.toLocaleString()} ብር
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>አሁን የተከፈለ፦</span>
                  <span className="text-blue-400 font-black">
                    {summarySlipOrder.amount_paid.toLocaleString()} ብር
                  </span>
                </div>
                <div className="flex justify-between text-slate-400 border-t border-slate-900 pt-1">
                  <span>ቀሪ ዕዳ፦</span>
                  <span className="text-amber-400 font-black">
                    {summarySlipOrder.balance_due.toLocaleString()} ብር
                  </span>
                </div>
              </div>
            </div>

            {/* Telegram / SMS Copy Button */}
            <button
              type="button"
              onClick={handleCopySlip}
              className={`w-full py-3 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md ${
                copiedSlip
                  ? "bg-emerald-600 text-white"
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 border border-blue-400/30"
              }`}
            >
              {copiedSlip ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>ደረሰኙ ተቀድቷል! (Copied to Clipboard)</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>በቴሌግራም ላክ / ኮፒ አድርግ (Copy for Telegram/SMS)</span>
                </>
              )}
            </button>

            {/* Navigation Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setSummarySlipOrder(null);
                  if (inStockVariants.length > 0) {
                    setWholesaleLines([
                      {
                        uid: `line-${Date.now()}`,
                        variant_id: inStockVariants[0].id,
                        quantity: 1,
                        unit_price:
                          inStockVariants[0].wholesale_price > 0
                            ? inStockVariants[0].wholesale_price
                            : inStockVariants[0].retail_price,
                      },
                    ]);
                    setRetailLines([
                      {
                        uid: `retail-${Date.now()}`,
                        variant_id: inStockVariants[0].id,
                        quantity: 1,
                        unit_price:
                          inStockVariants[0].retail_price > 0
                            ? inStockVariants[0].retail_price
                            : inStockVariants[0].wholesale_price,
                      },
                    ]);
                  }
                  setWholesaleAmountPaid("");
                  setDriverName("");
                  setDriverPhone("");
                  setVehiclePlate("");
                  setRetailCustomerName("");
                  setRetailNote("");
                }}
                className="py-2.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700 active:scale-95 transition-all text-center"
              >
                አዲስ ሽያጭ (New)
              </button>
              <button
                type="button"
                onClick={() =>
                  summarySlipOrder.order_type === "RETAIL"
                    ? router.push("/")
                    : router.push("/ledger")
                }
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-300 text-xs font-bold active:scale-95 transition-all text-center border border-slate-700"
              >
                {summarySlipOrder.order_type === "RETAIL"
                  ? "ወደ ዕቃዎች ዝርዝር →"
                  : "ወደ ዕዳ መዝገብ ሂድ →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
