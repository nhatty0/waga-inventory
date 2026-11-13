# Waga Inventory (ዋጋ) Mobile-First PWA Frontend

Fast, high-contrast, mobile-first inventory tracking and peer-lending management PWA designed for electronics shops in **Gondar, Ethiopia**.

Built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4**, and **Lucide React**.

---

## Key Features

1. **Mobile Touch-First Design**:
   - Deep slate high-contrast palette (`#09090b`) with emerald and amber indicators.
   - Touch targets $\ge 44\text{px}$ for one-thumb shop floor operation.
   - PWA metadata, standalone display mode, and safe-area padding for mobile home-screen installation.

2. **Inventory Screen (`/`)**:
   - Real-time stock overview (Gondar shelf units vs. Merkato freight transit).
   - Category filter pills: All Products, Smart TVs, Kitchen, Accessories.
   - Live search by product name, brand, or specification.
   - **Quick Stepper**: Instant `[-]` and `[+]` count adjusters with optimistic UI updating.
   - **Merkato Freight Intake**: One-tap modal to receive arriving freight from Addis Ababa.

3. **Borrow & Dispatch Screen (`/dispatch`)**:
   - Fast dispatch for **Neighbor Borrow ("Amarech")** peer loans and **Rural Wholesale** minibus batches (e.g., Debark, Dabat).
   - Instant client selector with inline `+ New Shop` creator.
   - Auto-fills wholesale vs retail pricing.
   - Quick payment toggles: 0 ETB (Amarech loan), 50% down-payment, or Full Paid.
   - Single-tap atomic dispatch posting directly to `/api/orders/dispatch`.

4. **Open Ledger Screen (`/ledger`)**:
   - Aggregated total receivables and open debtor count.
   - Filter by account type: Neighbor Borrowers (Amarech) vs Rural Wholesalers.
   - **Unreturned Items tracker**: Live inventory cards showing which products are currently out with neighbor shops.
   - **Settle Modal**:
     - **Return Unsold**: Automatically restocks returned items to Gondar shelf inventory.
     - **Cash Payment**: Records Telebirr, CBE Birr, or cash payment to close balance.

5. **API Client (`src/lib/api.ts`)**:
   - Fully typed TypeScript client pointing to `http://127.0.0.1:8000` or `NEXT_PUBLIC_API_URL`.

---

## Running Locally

### Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) on your phone or browser.

### Production Build
```bash
npm run build
npm run start
```
