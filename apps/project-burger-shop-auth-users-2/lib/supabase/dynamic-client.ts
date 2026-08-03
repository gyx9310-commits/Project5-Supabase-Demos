"use client";
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Global singleton reference to ensure only one SupabaseClient exists
// Using window to share across Next.js App Router page module scopes
declare global {
  interface Window {
    __supabaseClient?: SupabaseClient;
    __supabaseUrl?: string;
    __supabaseKey?: string;
  }
}

// Sanitize and validate the API key to prevent duplication issues.
// A valid Supabase anon key is a JWT with exactly 3 dot-separated segments.
function sanitizeAnonKey(key: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  // Check if the key was accidentally duplicated (same JWT concatenated twice)
  // A JWT looks like: header.payload.signature (3 parts)
  const parts = trimmed.split('.');
  if (parts.length === 6) {
    // Likely a duplication: two JWTs concatenated (3 + 3 = 6 parts)
    const firstHalf = parts.slice(0, 3).join('.');
    const secondHalf = parts.slice(3, 6).join('.');
    if (firstHalf === secondHalf) {
      console.warn('Detected duplicated API key, using first copy only');
      return firstHalf;
    }
  }
  return trimmed;
}

export function createDynamicSupabaseClient(url: string, anonKey: string): SupabaseClient | null {
  if (!url || !anonKey) return null;

  const cleanUrl = url.trim();
  const cleanKey = sanitizeAnonKey(anonKey);

  // Return cached client if URL and key haven't changed
  if (typeof window !== 'undefined' &&
      window.__supabaseClient &&
      window.__supabaseUrl === cleanUrl &&
      window.__supabaseKey === cleanKey) {
    return window.__supabaseClient;
  }

  try {
    const client = createClient(cleanUrl, cleanKey);
    if (typeof window !== 'undefined') {
      window.__supabaseClient = client;
      window.__supabaseUrl = cleanUrl;
      window.__supabaseKey = cleanKey;
    }
    return client;
  } catch (error) {
    console.error('Failed to create Supabase client:', error);
    return null;
  }
}

// Storage keys for persisting settings
export const STORAGE_KEYS = {
  SUPABASE_URL: 'supabase_url',
  SUPABASE_ANON_KEY: 'supabase_anon_key'
} as const;

// Get stored settings from localStorage
export function getStoredSupabaseSettings(): { url: string; key: string } {
  if (typeof window === 'undefined') {
    return { url: '', key: '' };
  }
  
  const url = localStorage.getItem(STORAGE_KEYS.SUPABASE_URL) || '';
  const key = localStorage.getItem(STORAGE_KEYS.SUPABASE_ANON_KEY) || '';
  
  return { url, key };
}

// Save settings to localStorage
export function saveSupabaseSettings(url: string, key: string): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(STORAGE_KEYS.SUPABASE_URL, url);
  localStorage.setItem(STORAGE_KEYS.SUPABASE_ANON_KEY, key);
}

// Clear stored settings
export function clearSupabaseSettings(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(STORAGE_KEYS.SUPABASE_URL);
  localStorage.removeItem(STORAGE_KEYS.SUPABASE_ANON_KEY);
}

// Create client from stored settings or environment variables
export function createSupabaseClientFromSettings(): SupabaseClient | null {
  // First try stored settings
  const stored = getStoredSupabaseSettings();
  if (stored.url && stored.key) {
    return createDynamicSupabaseClient(stored.url, stored.key);
  }
  
  // Fallback to environment variables
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (envUrl && envKey) {
    return createDynamicSupabaseClient(envUrl, envKey);
  }
  
  return null;
}