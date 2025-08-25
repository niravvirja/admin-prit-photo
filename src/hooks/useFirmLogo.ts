import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

// Logo cache to persist across component re-renders and page changes
const logoCache = new Map<string, string>();
const DEFAULT_LOGO = '/prit-logo.png';

export const useFirmLogo = () => {
  const { currentFirmId, currentFirm } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string>(() => {
    // Initialize with cached logo if available
    if (currentFirmId) {
      const cached = logoCache.get(currentFirmId);
      if (cached) return cached;
    }
    return DEFAULT_LOGO;
  });
  const [isLoading, setIsLoading] = useState(false);
  const loadedRef = useRef<Set<string>>(new Set());
  const previousFirmIdRef = useRef<string | null>(null);

  useEffect(() => {
    const updateLogo = () => {
      if (!currentFirmId || !currentFirm) {
        // Only update if different to prevent unnecessary re-renders
        if (logoUrl !== DEFAULT_LOGO) {
          setLogoUrl(DEFAULT_LOGO);
        }
        return;
      }

      // Skip if same firm to prevent flickering
      if (previousFirmIdRef.current === currentFirmId) {
        return;
      }
      previousFirmIdRef.current = currentFirmId;

      // Check cache first
      const cacheKey = currentFirmId;
      const cachedLogo = logoCache.get(cacheKey);
      
      if (cachedLogo) {
        // Only update if different to prevent re-renders
        if (logoUrl !== cachedLogo) {
          setLogoUrl(cachedLogo);
        }
        return;
      }

      // Check if we already tried to load this firm's logo
      if (loadedRef.current.has(cacheKey)) {
        const fallbackUrl = currentFirm.logo_url || DEFAULT_LOGO;
        if (logoUrl !== fallbackUrl) {
          setLogoUrl(fallbackUrl);
        }
        return;
      }

      // If firm has logo_url, cache it and use it
      if (currentFirm.logo_url) {
        setIsLoading(true);
        
        // Test if the image loads successfully
        const img = new Image();
        img.onload = () => {
          logoCache.set(cacheKey, currentFirm.logo_url!);
          setLogoUrl(currentFirm.logo_url!);
          loadedRef.current.add(cacheKey);
          setIsLoading(false);
        };
        img.onerror = () => {
          // If firm logo fails to load, use default and cache the result
          logoCache.set(cacheKey, DEFAULT_LOGO);
          setLogoUrl(DEFAULT_LOGO);
          loadedRef.current.add(cacheKey);
          setIsLoading(false);
        };
        img.src = currentFirm.logo_url;
      } else {
        // No logo_url, use default and cache it
        logoCache.set(cacheKey, DEFAULT_LOGO);
        if (logoUrl !== DEFAULT_LOGO) {
          setLogoUrl(DEFAULT_LOGO);
        }
        loadedRef.current.add(cacheKey);
      }
    };

    updateLogo();
  }, [currentFirmId, currentFirm?.logo_url, logoUrl]);

  // Function to preload logo (can be called when firm data changes)
  const preloadLogo = (firmId: string, logoUrl: string) => {
    if (logoUrl && !logoCache.has(firmId)) {
      const img = new Image();
      img.onload = () => {
        logoCache.set(firmId, logoUrl);
      };
      img.onerror = () => {
        logoCache.set(firmId, DEFAULT_LOGO);
      };
      img.src = logoUrl;
    }
  };

  // Function to clear cache (useful when logo is updated)
  const clearCache = (firmId?: string) => {
    if (firmId) {
      logoCache.delete(firmId);
      loadedRef.current.delete(firmId);
    } else {
      logoCache.clear();
      loadedRef.current.clear();
    }
  };

  return {
    logoUrl,
    isLoading,
    isDefault: logoUrl === DEFAULT_LOGO,
    preloadLogo,
    clearCache
  };
};