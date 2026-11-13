"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { MerchantSession, getSession, saveSession, clearSession } from "@/lib/auth";

export interface ShopProfile {
  name: string;
  location: string;
}

export const defaultShopProfile: ShopProfile = {
  name: "Estif Electronics",
  location: "Gondar, Piassa",
};

interface ShopContextType {
  session: MerchantSession | null;
  shopProfile: ShopProfile;
  setSession: (session: MerchantSession | null) => void;
  setShopProfile: (profile: ShopProfile) => void;
  updateShopProfile: (updates: Partial<ShopProfile>) => void;
}

const ShopContext = createContext<ShopContextType>({
  session: null,
  shopProfile: defaultShopProfile,
  setSession: () => {},
  setShopProfile: () => {},
  updateShopProfile: () => {},
});

export function ShopProvider({
  children,
  initialProfile = defaultShopProfile,
}: {
  children: ReactNode;
  initialProfile?: ShopProfile;
}) {
  const [session, setSessionState] = useState<MerchantSession | null>(null);
  const [shopProfile, setShopProfile] = useState<ShopProfile>(initialProfile);

  useEffect(() => {
    const activeSession = getSession();
    if (activeSession) {
      setSessionState(activeSession);
      setShopProfile({
        name: activeSession.shop_name,
        location: activeSession.location,
      });
    }
  }, []);

  const setSession = (newSession: MerchantSession | null) => {
    setSessionState(newSession);
    if (newSession) {
      saveSession(newSession);
      setShopProfile({
        name: newSession.shop_name,
        location: newSession.location,
      });
    } else {
      clearSession();
      setShopProfile(defaultShopProfile);
    }
  };

  const updateShopProfile = (updates: Partial<ShopProfile>) => {
    setShopProfile((prev) => {
      const updated = { ...prev, ...updates };
      if (session) {
        const updatedSession: MerchantSession = {
          ...session,
          shop_name: updated.name,
          location: updated.location,
        };
        setSessionState(updatedSession);
        saveSession(updatedSession);
      }
      return updated;
    });
  };

  return (
    <ShopContext.Provider
      value={{
        session,
        shopProfile,
        setSession,
        setShopProfile,
        updateShopProfile,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error("useShop must be used within a ShopProvider");
  }
  return context;
}
