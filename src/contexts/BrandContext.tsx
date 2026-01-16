import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useLocation } from 'react-router-dom';

interface Brand {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logo_url: string | null;
  primary_color: string;
  primary_foreground: string;
  secondary_color: string;
  secondary_foreground: string;
  accent_color: string;
  accent_foreground: string;
  background_color: string;
  foreground_color: string;
  card_color: string;
  muted_color: string;
  is_default: boolean;
  active: boolean;
}

interface BrandContextType {
  currentBrand: Brand | null;
  allBrands: Brand[];
  loading: boolean;
  detectedBrandSlug: string | null;
  setCurrentBrandById: (brandId: string) => void;
  refreshBrands: () => Promise<void>;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

const BRAND_COOKIE_NAME = 'axiom_brand_slug';

const getBrandCookie = (): string | null => {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === BRAND_COOKIE_NAME) {
      return decodeURIComponent(value);
    }
  }
  return null;
};

const setBrandCookie = (slug: string) => {
  const maxAge = 365 * 24 * 60 * 60; // 1 year
  const isSecure = window.location.protocol === 'https:';
  const securePart = isSecure ? '; Secure' : '';
  document.cookie = `${BRAND_COOKIE_NAME}=${encodeURIComponent(slug)}; path=/; max-age=${maxAge}; SameSite=Lax${securePart}`;
};

export const BrandProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentBrand, setCurrentBrand] = useState<Brand | null>(null);
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [detectedBrandSlug, setDetectedBrandSlug] = useState<string | null>(null);
  const { user } = useAuth();
  const location = useLocation();

  const applyBrandTheme = useCallback((brand: Brand) => {
    const root = document.documentElement;
    root.style.setProperty('--primary', brand.primary_color);
    root.style.setProperty('--primary-foreground', brand.primary_foreground);
    root.style.setProperty('--secondary', brand.secondary_color);
    root.style.setProperty('--secondary-foreground', brand.secondary_foreground);
    root.style.setProperty('--accent', brand.accent_color);
    root.style.setProperty('--accent-foreground', brand.accent_foreground);
    root.style.setProperty('--background', brand.background_color);
    root.style.setProperty('--foreground', brand.foreground_color);
    root.style.setProperty('--card', brand.card_color);
    root.style.setProperty('--muted', brand.muted_color);
  }, []);

  const checkIfCustomer = async (): Promise<boolean> => {
    if (!user) return false;
    
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    
    // If user has only customer role (or no admin/operator role), they are a customer
    const hasAdminOrOperator = roles?.some(r => r.role === 'admin' || r.role === 'operator');
    return !hasAdminOrOperator;
  };

  const fetchBrands = useCallback(async (isCustomer: boolean = false) => {
    // For customers, we don't fetch all brands - they should only see their own
    if (isCustomer) {
      return [];
    }
    
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('active', true)
      .order('is_default', { ascending: false });

    if (error) {
      return [];
    }
    return data as Brand[];
  }, []);

  const fetchUserBrand = useCallback(async () => {
    if (!user) return null;

    const { data: customer } = await supabase
      .from('customers')
      .select('brand_id')
      .eq('user_id', user.id)
      .single();

    if (customer?.brand_id) {
      const { data: brand } = await supabase
        .from('brands')
        .select('*')
        .eq('id', customer.brand_id)
        .single();

      return brand as Brand;
    }

    return null;
  }, [user]);

  const refreshBrands = useCallback(async () => {
    // Check if user is a customer - customers shouldn't see all brands
    const isCustomer = await checkIfCustomer();
    const brands = await fetchBrands(isCustomer);
    setAllBrands(brands);
  }, [fetchBrands]);


  useEffect(() => {
    const initializeBrand = async () => {
      setLoading(true);
      
      // Check if user is a customer
      const isCustomer = await checkIfCustomer();
      
      // For customers, don't expose all brands
      const brands = await fetchBrands(isCustomer);
      setAllBrands(brands);

      let brandToUse: Brand | null = null;

      // 1. Detect brand from custom domain (highest priority)
      const currentHostname = window.location.hostname;
      
      // Match configured domain directly (supports full domain like b2b.nexusaminos.com)
      const domainBrand = brands.find(b => {
        if (!b.domain) return false;
        // Remove protocol if present and compare
        const cleanDomain = b.domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
        return currentHostname === cleanDomain;
      });
      
      if (domainBrand) {
        setDetectedBrandSlug(domainBrand.slug);
        setBrandCookie(domainBrand.slug);
        brandToUse = domainBrand;
      }

      // 2. Detect brand from URL path (e.g., /nexus_aminos)
      if (!brandToUse) {
        const pathSegments = location.pathname.split('/').filter(Boolean);
        if (pathSegments.length > 0) {
          const potentialSlug = pathSegments[0].toLowerCase().replace(/_/g, '-');
          const detectedBrand = brands.find(b => b.slug.toLowerCase() === potentialSlug);
          if (detectedBrand) {
            setDetectedBrandSlug(detectedBrand.slug);
            setBrandCookie(detectedBrand.slug);
            brandToUse = detectedBrand;
          }
        }
      }

      // 3. If logged in, use user's assigned brand
      if (!brandToUse && user) {
        brandToUse = await fetchUserBrand();
      }

      // 4. Check cookie for previously detected brand
      if (!brandToUse) {
        const cookieBrandSlug = getBrandCookie();
        if (cookieBrandSlug) {
          const cookieBrand = brands.find(b => b.slug === cookieBrandSlug);
          if (cookieBrand) {
            setDetectedBrandSlug(cookieBrand.slug);
            brandToUse = cookieBrand;
          }
        }
      }

      // 5. Fallback to default brand
      if (!brandToUse) {
        brandToUse = brands.find(b => b.is_default) || brands[0] || null;
      }

      if (brandToUse) {
        setCurrentBrand(brandToUse);
        applyBrandTheme(brandToUse);
      }

      setLoading(false);
    };

    initializeBrand();
  }, [user, location.pathname, fetchBrands, fetchUserBrand, applyBrandTheme]);

  const setCurrentBrandById = (brandId: string) => {
    const brand = allBrands.find(b => b.id === brandId);
    if (brand) {
      setCurrentBrand(brand);
      applyBrandTheme(brand);
    }
  };

  return (
    <BrandContext.Provider
      value={{
        currentBrand,
        allBrands,
        loading,
        detectedBrandSlug,
        setCurrentBrandById,
        refreshBrands,
      }}
    >
      {children}
    </BrandContext.Provider>
  );
};

export const useBrand = () => {
  const context = useContext(BrandContext);
  if (context === undefined) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
};