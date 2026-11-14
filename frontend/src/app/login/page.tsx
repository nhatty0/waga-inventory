"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  Phone,
  Store,
  MapPin,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { loginShop, registerShop } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { useShop } from "@/context/ShopContext";
import WagaLogo from "@/components/WagaLogo";

type AuthMode = "LOGIN" | "REGISTER";

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useShop();

  const [mode, setMode] = useState<AuthMode>("LOGIN");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields - Login
  const [loginPhone, setLoginPhone] = useState<string>("");
  const [loginPin, setLoginPin] = useState<string>("");

  // Form Fields - Register
  const [regShopName, setRegShopName] = useState<string>("");
  const [regLocation, setRegLocation] = useState<string>("");
  const [regPhone, setRegPhone] = useState<string>("");
  const [regPin, setRegPin] = useState<string>("");

  // Redirect to home if already logged in
  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/");
    }
  }, [router]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPhone = loginPhone.trim();
    const cleanPin = loginPin.trim();

    if (!cleanPhone) {
      setError("እባክዎ የስልክ ቁጥርዎን ያስገቡ");
      return;
    }
    if (cleanPin.length !== 4) {
      setError("ፒን (PIN) 4 አሃዝ መሆን አለበት");
      return;
    }

    setLoading(true);
    try {
      const session = await loginShop({
        owner_phone: cleanPhone,
        pin: cleanPin,
      });
      setSession(session);
      router.replace("/");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "የስልክ ቁጥር ወይም ፒን (PIN) ተሳስቷል። እባክዎ እንደገና ይሞክሩ።"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = regShopName.trim();
    const cleanLocation = regLocation.trim();
    const cleanPhone = regPhone.trim();
    const cleanPin = regPin.trim();

    if (!cleanName) {
      setError("እባክዎ የሱቁን ስም ያስገቡ");
      return;
    }
    if (!cleanPhone) {
      setError("እባክዎ የስልክ ቁጥር ያስገቡ");
      return;
    }
    if (cleanPin.length !== 4) {
      setError("ፒን (PIN) 4 አሃዝ መሆን አለበት");
      return;
    }

    setLoading(true);
    try {
      const session = await registerShop({
        shop_name: cleanName,
        location: cleanLocation,
        owner_phone: cleanPhone,
        pin: cleanPin,
      });
      setSession(session);
      router.replace("/");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "ሱቁን መመዝገብ አልተቻለም። ስልክ ቁጥሩ ቀድሞ የተመዘገበ ሊሆን ይችላል።"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-8 select-none">
      {/* Background radial glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2.5">
          <div className="flex justify-center mb-1">
            <WagaLogo size="lg" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            ዋጋ ስቶክ
          </h1>
          <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto">
            ንግድዎን በቀላሉ ያስተዳድሩ • Manage your business easily
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-slate-900/90 border border-blue-500/20 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-blue-950/60 backdrop-blur-xl space-y-5">
          {/* Segmented Mode Toggle */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setMode("LOGIN");
                setError(null);
              }}
              className={`py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                mode === "LOGIN"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-400/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>ግባ (Login)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("REGISTER");
                setError(null);
              }}
              className={`py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                mode === "REGISTER"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-400/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>አዲስ ሱቅ መዝግብ</span>
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-snug font-medium">{error}</span>
            </div>
          )}

          {/* Form 1: LOGIN FORM */}
          {mode === "LOGIN" ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Phone Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-blue-400" />
                  <span>የስልክ ቁጥር (Phone Number)</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    inputMode="tel"
                    required
                    placeholder="09..."
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
                  />
                </div>
              </div>

              {/* 4-Digit PIN Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-blue-400" />
                    <span>4 አሃዝ ፒን (4-Digit PIN)</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">4 digits</span>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    required
                    placeholder="••••"
                    value={loginPin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      if (val.length <= 4) setLoginPin(val);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-2xl font-black text-blue-400 tracking-widest placeholder:text-slate-700 focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !loginPhone.trim() || loginPin.length !== 4}
                className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 border border-blue-400/40 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>በመግባት ላይ...</span>
                  </>
                ) : (
                  <>
                    <span>ግባ (Sign In)</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Form 2: REGISTER SHOP FORM */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {/* Shop Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-blue-400" />
                  <span>የሱቅ ስም (Shop Name)</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="ምሳሌ፦ እስቲፍ ኤሌክትሮኒክስ"
                  value={regShopName}
                  onChange={(e) => setRegShopName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
                />
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-400" />
                  <span>አድራሻ / ከተማ (Location / City)</span>
                </label>
                <input
                  type="text"
                  placeholder="ምሳሌ፦ አዲስ አበባ / ቦሌ (e.g. Addis Ababa)"
                  value={regLocation}
                  onChange={(e) => setRegLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
                />
              </div>

              {/* Owner Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-blue-400" />
                  <span>የባለቤቱ ስልክ (Owner Phone Number)</span>
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  required
                  placeholder="09..."
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
                />
              </div>

              {/* Create 4-Digit PIN */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-blue-400" />
                    <span>አዲስ 4 አሃዝ ፒን (Create 4-Digit PIN)</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">4 digits</span>
                </div>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  required
                  placeholder="••••"
                  value={regPin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    if (val.length <= 4) setRegPin(val);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-center text-xl font-black text-blue-400 tracking-widest placeholder:text-slate-700 focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={
                  loading ||
                  !regShopName.trim() ||
                  !regPhone.trim() ||
                  regPin.length !== 4
                }
                className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 border border-blue-400/40 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>በመመዝገብ ላይ...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ሱቁን መዝግብ (Create Shop)</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
