/**
 * Waga Stock API Client
 * Connects to FastAPI backend at process.env.NEXT_PUBLIC_API_URL or http://127.0.0.1:8000
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export type ClientType = "NEIGHBOR_BORROWER" | "RURAL_WHOLESALER" | "REGULAR_CUSTOMER";
export type OrderType = "RETAIL" | "NEIGHBOR_LEND" | "RURAL_BULK" | "INBOUND_MERKATO";
export type OrderStatus = "PENDING_RETURN" | "PARTIALLY_PAID" | "COMPLETED";

export interface ProductVariant {
  id: number;
  product_id: number;
  barcode?: string;
  brand: string;
  spec: string;
  cost_price: number;
  retail_price: number;
  wholesale_price: number;
  stock_quantity: number;
  in_transit_quantity: number;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  created_at: string;
  variants: ProductVariant[];
  total_stock: number;
  total_in_transit: number;
}

export interface Client {
  id: number;
  name: string;
  phone?: string;
  type: ClientType;
  location: string;
  created_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  variant_id: number;
  quantity: number;
  unit_price: number;
  brand?: string;
  spec?: string;
  subtotal: number;
}

export interface Order {
  id: number;
  client_id?: number;
  order_type: OrderType;
  status: OrderStatus;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  driver_name?: string;
  driver_phone?: string;
  vehicle_plate?: string;
  notes?: string;
  created_at: string;
  client?: Client;
  items: OrderItem[];
}

export interface UnreturnedItemSummary {
  variant_id: number;
  brand: string;
  spec: string;
  quantity: number;
}

export interface ClientLedgerGroup {
  client: Client;
  total_owed: number;
  open_orders_count: number;
  orders: Order[];
  unreturned_items: UnreturnedItemSummary[];
}

export interface OpenLedgerResponse {
  total_receivables: number;
  total_open_orders: number;
  clients: ClientLedgerGroup[];
  anonymous_orders: Order[];
}

export interface InventoryActionResponse {
  variant_id: number;
  brand: string;
  spec: string;
  previous_stock: number;
  new_stock: number;
  previous_in_transit: number;
  new_in_transit: number;
  message: string;
}

export interface OrderDispatchPayload {
  client_id?: number;
  client_name?: string;
  client_phone?: string;
  client_location?: string;
  order_type: OrderType;
  items: Array<{
    variant_id: number;
    quantity: number;
    unit_price: number;
  }>;
  amount_paid: number;
  driver_name?: string;
  driver_phone?: string;
  vehicle_plate?: string;
  notes?: string;
}

export interface OrderSettlePayload {
  payment_amount?: number;
  restock_returned_items?: boolean;
  notes?: string;
}

import {
  MerchantSession,
  getAccessToken,
  saveSession,
  clearSession,
} from "./auth";

export type { MerchantSession } from "./auth";
export {
  getSession,
  saveSession,
  clearSession,
  getAccessToken,
  isAuthenticated,
  logout,
} from "./auth";

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const token = getAccessToken();
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...options?.headers,
      },
      ...options,
    });

    if (!res.ok) {
      if (res.status === 401) {
        clearSession();
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }

      let errorMsg = `Request failed: ${res.status}`;
      try {
        const errorJson = await res.json();
        errorMsg = errorJson.detail || errorJson.message || errorMsg;
      } catch {
        // Fallback to status text
        errorMsg = res.statusText || errorMsg;
      }
      throw new Error(errorMsg);
    }

    if (res.status === 204) {
      return {} as T;
    }

    return await res.json();
  } catch (err: unknown) {
    if (err instanceof TypeError && err.message.includes("fetch")) {
      throw new Error("Unable to reach backend server. Ensure FastAPI is running on http://127.0.0.1:8000.");
    }
    throw err;
  }
}

// -------------------------------------------------------------
// Products API
// -------------------------------------------------------------
export interface ProductCreatePayload {
  name: string;
  category: string;
  variants: Array<{
    barcode?: string;
    brand: string;
    spec: string;
    cost_price: number;
    retail_price: number;
    wholesale_price: number;
    stock_quantity: number;
    in_transit_quantity: number;
  }>;
}

export async function createProduct(payload: ProductCreatePayload): Promise<Product> {
  return request<Product>("/api/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getProducts(params?: { category?: string; search?: string }): Promise<Product[]> {
  const searchParams = new URLSearchParams();
  if (params?.category && params.category !== "ALL") searchParams.append("category", params.category);
  if (params?.search) searchParams.append("search", params.search);
  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return request<Product[]>(`/api/products${query}`);
}

export interface VariantUpdatePayload {
  barcode?: string;
  brand?: string;
  spec?: string;
  product_name?: string;
  cost_price?: number;
  retail_price?: number;
  wholesale_price?: number;
  stock_quantity?: number;
  in_transit_quantity?: number;
}

export async function updateProductVariant(
  variantId: number,
  payload: VariantUpdatePayload
): Promise<ProductVariant> {
  return request<ProductVariant>(`/api/products/variants/${variantId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// -------------------------------------------------------------
// Inventory API
// -------------------------------------------------------------
export interface BarcodeLookupResponse {
  variant: ProductVariant;
  product_name: string;
  category: string;
  product?: Product;
}

export async function lookupBarcode(code: string): Promise<BarcodeLookupResponse> {
  return request<BarcodeLookupResponse>(`/api/inventory/barcode/${encodeURIComponent(code.trim())}`);
}
export async function adjustStock(payload: {
  variant_id: number;
  delta: number;
  notes?: string;
}): Promise<InventoryActionResponse> {
  return request<InventoryActionResponse>("/api/inventory/adjust", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function receiveTransit(payload: {
  variant_id: number;
  quantity: number;
  notes?: string;
}): Promise<InventoryActionResponse> {
  return request<InventoryActionResponse>("/api/inventory/receive-transit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// -------------------------------------------------------------
// Clients API
// -------------------------------------------------------------
export async function getClients(params?: { client_type?: string; search?: string }): Promise<Client[]> {
  const searchParams = new URLSearchParams();
  if (params?.client_type) searchParams.append("client_type", params.client_type);
  if (params?.search) searchParams.append("search", params.search);
  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return request<Client[]>(`/api/clients${query}`);
}

export async function createClient(payload: {
  name: string;
  phone: string;
  type: ClientType;
  location?: string;
}): Promise<Client> {
  return request<Client>("/api/clients", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      location: payload.location || "",
    }),
  });
}

// -------------------------------------------------------------
// Orders & Dispatch API
// -------------------------------------------------------------
export async function dispatchOrder(payload: OrderDispatchPayload): Promise<Order> {
  return request<Order>("/api/orders/dispatch", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getOrders(params?: {
  client_id?: number;
  order_type?: OrderType;
  order_status?: OrderStatus;
}): Promise<Order[]> {
  const searchParams = new URLSearchParams();
  if (params?.client_id) searchParams.append("client_id", params.client_id.toString());
  if (params?.order_type) searchParams.append("order_type", params.order_type);
  if (params?.order_status) searchParams.append("order_status", params.order_status);
  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return request<Order[]>(`/api/orders${query}`);
}

// -------------------------------------------------------------
// Ledger API
// -------------------------------------------------------------
export async function getOpenLedger(): Promise<OpenLedgerResponse> {
  return request<OpenLedgerResponse>("/api/ledger/open");
}

export async function settleOrder(orderId: number, payload?: OrderSettlePayload): Promise<Order> {
  return request<Order>(`/api/ledger/${orderId}/settle`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
}

// -------------------------------------------------------------
// Auth API
// -------------------------------------------------------------
export async function registerShop(payload: {
  shop_name: string;
  location?: string;
  owner_phone: string;
  pin: string;
}): Promise<MerchantSession> {
  const data = await request<MerchantSession>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (data.access_token) {
    saveSession(data);
  }
  return data;
}

export async function loginShop(payload: {
  owner_phone: string;
  pin: string;
}): Promise<MerchantSession> {
  const data = await request<MerchantSession>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (data.access_token) {
    saveSession(data);
  }
  return data;
}

export async function getMe(): Promise<MerchantSession> {
  const data = await request<MerchantSession>("/api/auth/me");
  if (data.access_token) {
    saveSession(data);
  }
  return data;
}
