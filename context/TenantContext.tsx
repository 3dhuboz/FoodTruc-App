/**
 * TenantContext — Resolves the current tenant on app bootstrap.
 *
 * Flow:
 * 1. Calls GET /api/v1/tenant (subdomain-based resolution on backend)
 * 2. Stores tenant config (name, logo, colors, plan)
 * 3. Applies CSS custom property --brand-color for theming
 * 4. If tenant not found → sets error flag so App.tsx can show Landing page
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Tenant } from '../types';
import { fetchTenant, setDevTenantId, isLocalMode } from '../services/api';

interface TenantContextType {
  tenant: Tenant | null;
  isResolved: boolean;
  isTenantError: boolean;
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  isResolved: false,
  isTenantError: false,
});

export const useTenant = () => useContext(TenantContext);

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isResolved, setIsResolved] = useState(false);
  const [isTenantError, setIsTenantError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // In local dev, default to 'default' tenant via header
    if (isLocalMode()) {
      setDevTenantId('default');
    }

    fetchTenant()
      .then((t) => {
        if (cancelled) return;
        setTenant(t);
        setIsResolved(true);

        // Apply brand color as CSS custom property
        if (t.primaryColor) {
          document.documentElement.style.setProperty('--brand-color', t.primaryColor);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setIsTenantError(true);
        setIsResolved(true);
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <TenantContext.Provider value={{ tenant, isResolved, isTenantError }}>
      {children}
    </TenantContext.Provider>
  );
};
