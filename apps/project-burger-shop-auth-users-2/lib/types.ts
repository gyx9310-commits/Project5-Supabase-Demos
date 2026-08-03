// TypeScript types for the burger shop application

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  category: 'burger' | 'side' | 'drink';
  price_cents: number;
  quantity: number;
  available: boolean;
  emoji?: string;
  created_at: string;
  updated_at: string;
}

export interface PromoCode {
  id: string;
  code: string;
  description?: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  valid_from?: string | null;
  valid_until?: string | null;
  min_order_cents?: number;
  usage_limit?: number;
  used_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateMenuItemData {
  name: string;
  description?: string;
  category: 'burger' | 'side' | 'drink';
  price_cents: number;
  quantity?: number;
  available?: boolean;
  emoji?: string;
}

export interface UpdateMenuItemData {
  name?: string;
  description?: string;
  category?: 'burger' | 'side' | 'drink';
  price_cents?: number;
  quantity?: number;
  available?: boolean;
  emoji?: string;
}

export interface CreatePromoCodeData {
  code: string;
  description?: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  is_active?: boolean;
}

export interface UpdatePromoCodeData {
  code?: string;
  description?: string;
  discount_type?: 'percentage' | 'fixed_amount';
  discount_value?: number;
  used_count?: number;
  is_active?: boolean;
}

// Auth Users — additional types
export interface Profile {
  id: string;
  full_name: string | null;
  birthday: string | null; // ISO date string
  avatar_url: string | null;
  wallet_cents: number;
  welcome_claimed?: boolean;
  welcome_claimed_at?: string | null;
  role?: 'user' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface BuyResult {
  order_id: string;
  new_wallet_cents: number;
}

export interface PurchasedItem {
  order_id: string;
  purchased_at: string; // ISO timestamp
  item_id: string;
  name: string;
  description?: string;
  category: 'burger' | 'side' | 'drink';
  price_cents: number; // price at purchase time from orders
  emoji?: string;
  quantity: number; // current remaining quantity
  available: boolean; // current availability
}

// Helper function to format price from cents to dollars
export function formatPrice(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

// Helper function to parse price from dollars to cents
export function parsePrice(priceStr: string): number {
  const cleaned = priceStr.replace(/[¥$,]/g, '');
  const dollars = parseFloat(cleaned);
  return Math.round(dollars * 100);
}
