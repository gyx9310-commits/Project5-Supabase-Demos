"use client";
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  createDynamicSupabaseClient,
  createSupabaseClientFromSettings,
  getStoredSupabaseSettings,
  saveSupabaseSettings
} from '@/lib/supabase/dynamic-client';
import { createDatabaseServices } from '@/lib/database';
import Settings from '../components/Settings';
import { formatPrice, type MenuItem, type PurchasedItem } from '@/lib/types';

type Profile = {
  id: string;
  full_name: string | null;
  birthday: string | null; // ISO date
  avatar_url: string | null;
  wallet_cents: number;
  welcome_claimed?: boolean;
};

export default function ShopPage() {
  const [supabaseSettings, setSupabaseSettings] = useState({ url: '', key: '' });
  const [supabaseClient, setSupabaseClient] = useState<any>(null);
  const services = useMemo(() => (supabaseClient ? createDatabaseServices(supabaseClient) : null), [supabaseClient]);

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [purchases, setPurchases] = useState<PurchasedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function getErrMessage(e: unknown): string {
    const anyE = e as any;
    if (anyE?.error?.message) return anyE.error.message;
    if (anyE?.message) return anyE.message;
    return 'Failed to load';
  }

  useEffect(() => {
    const stored = getStoredSupabaseSettings();
    setSupabaseSettings(stored);
    const client = createSupabaseClientFromSettings();
    setSupabaseClient(client);
  }, []);

  useEffect(() => {
    if (!supabaseClient) return;
    supabaseClient.auth.getUser().then(({ data }: any) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabaseClient.auth.onAuthStateChange((_evt: any, session: any) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => sub?.subscription?.unsubscribe();
  }, [supabaseClient]);

  useEffect(() => {
    if (!services) return;
    (async () => {
      try {
        setLoading(true);
        if (userId) {
          const [items, p] = await Promise.all([
            services.menuItems.getAvailable(),
            services.profiles.getMyProfile()
          ]);
          setMenu(items);
          setProfile(p);
          try {
            const owned = await services.orders.getMyPurchases();
            setPurchases(owned);
          } catch (e) {
            console.warn('getMyPurchases failed', e);
          }
        } else {
          setProfile(null);
          setMenu([]);
          setPurchases([]);
        }
      } catch (e) {
        setError(getErrMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [services, userId]);

  const handleSettingsChange = (url: string, key: string) => {
    setSupabaseSettings({ url, key });
    saveSupabaseSettings(url, key);
    const newClient = createDynamicSupabaseClient(url, key);
    setSupabaseClient(newClient);
  };

  async function buy(item: MenuItem) {
    if (!services) return;
    try {
      setError(null);
      setMessage(null);
      const res = await services.orders.buyBurger(item.id);
      setProfile((p) => (p ? { ...p, wallet_cents: res.new_wallet_cents } : p));
      setMessage(`Purchased: ${item.name} — Paid ${formatPrice(item.price_cents)}`);
      // Refresh menu and purchases to reflect new stock and history
      if (userId) {
        const [items, owned] = await Promise.all([
          services.menuItems.getAvailable(),
          services.orders.getMyPurchases()
        ]);
        setMenu(items);
        setPurchases(owned);
      }
    } catch (e) {
      setError(getErrMessage(e));
    }
  }

  if (!supabaseClient) {
    return (
      <div className="min-h-[70vh] grid place-items-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h1 className="text-xl font-bold text-red-600 mb-3">Supabase configuration missing</h1>
          <p className="text-sm text-neutral-600 mb-3">Click the top-right ⚙️ to set URL and Key, or configure .env.local.</p>
          <Settings onSettingsChange={handleSettingsChange} currentUrl={supabaseSettings.url} currentKey={supabaseSettings.key} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🍔 Burger Shop</h1>
          <p className="text-sm text-neutral-600">Sign in to purchase. Email/password via Supabase is supported.</p>
        </div>
        <Settings onSettingsChange={handleSettingsChange} currentUrl={supabaseSettings.url} currentKey={supabaseSettings.key} />
      </div>

      {!userId ? (
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Not signed in</div>
              <div className="text-sm text-neutral-600">Please sign in or create an account to purchase.</div>
            </div>
            <Link href="/auth" className="rounded bg-burger-red px-3 py-2 text-white text-sm hover:opacity-90">Go to Sign In / Sign Up</Link>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-4">
            <div className="text-3xl">{profile?.avatar_url ? '👤' : '🧑‍🍳'}</div>
            <div>
              <div className="font-semibold">{profile?.full_name || 'User'}</div>
              <div className="text-sm text-neutral-600">Balance: {formatPrice(profile?.wallet_cents ?? 0)}{profile?.birthday ? ` · Birthday: ${new Date(profile.birthday).toLocaleDateString('en-US')}` : ''}</div>
            </div>
            {!!profile && !profile.welcome_claimed && (
              <button
                className="ml-auto rounded bg-green-600 px-3 py-1 text-sm text-white hover:opacity-90"
                onClick={async ()=>{
                  try{
                    setError(null); setMessage(null);
                    const res = await services!.profiles.claimWelcomeBonus();
                    setProfile((p)=> p ? { ...p, wallet_cents: res.new_wallet_cents, welcome_claimed: true } : p);
                    setMessage(`Welcome gift claimed: +${formatPrice(res.bonus_cents)}`);
                  }catch(e){
                    setError(e instanceof Error? e.message: 'Failed to claim gift');
                  }
                }}
              >Claim Welcome Gift</button>
            )}
            <button
              className="ml-auto rounded border px-3 py-1 text-sm"
              onClick={async () => {
                await supabaseClient.auth.signOut();
                setMessage('Signed out');
              }}
            >Sign out</button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {message && (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>
      )}

      {userId && (
      <div className="space-y-3">
        <section className="rounded-lg border bg-white">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="font-semibold">My Purchases</div>
          </div>
          <div className="px-4 py-2">
            {purchases.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {(() => {
                  // Group purchases by item_id and count quantities
                  const groupedPurchases = purchases.reduce((acc, item) => {
                    if (!acc[item.item_id]) {
                      acc[item.item_id] = {
                        ...item,
                        count: 0,
                        lastPurchasedAt: item.purchased_at
                      };
                    }
                    acc[item.item_id].count += 1;
                    // Update last purchased date if this item is newer
                    if (new Date(item.purchased_at) > new Date(acc[item.item_id].lastPurchasedAt)) {
                      acc[item.item_id].lastPurchasedAt = item.purchased_at;
                    }
                    return acc;
                  }, {} as Record<string, PurchasedItem & { count: number; lastPurchasedAt: string }>);

                  return Object.values(groupedPurchases).map((m) => (
                    <div key={m.item_id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm">
                      <span className="text-lg">{m.emoji || '🍔'}</span>
                      <span className="font-medium">{m.name}</span>
                      <span className="text-neutral-600">·</span>
                      <span className="font-semibold">{formatPrice(m.price_cents)}</span>
                      <span className="text-neutral-600">·</span>
                      <span className="text-xs text-neutral-500">I have: {m.count}</span>
                      <span className="text-neutral-600">·</span>
                      <span className="text-xs text-neutral-500">{new Date(m.lastPurchasedAt).toLocaleDateString('en-US')}</span>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <div className="text-center text-sm text-neutral-500 py-4">No purchases yet.</div>
            )}
          </div>
        </section>

        <section className="rounded-lg border bg-white">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="font-semibold">Available Items</div>
            <button className="text-sm rounded border px-2 py-1" onClick={async ()=>{
              try {
                setLoading(true);
                setError(null);
                if (userId) {
                  const [items, p] = await Promise.all([
                    services!.menuItems.getAvailable(),
                    services!.profiles.getMyProfile()
                  ]);
                  setMenu(items);
                  setProfile(p);
                  try {
                    const owned = await services!.orders.getMyPurchases();
                    setPurchases(owned);
                  } catch (e) {
                    console.warn('getMyPurchases failed', e);
                  }
                }
              } catch (e) {
                setError(getErrMessage(e));
              } finally { setLoading(false); }
            }}>{loading? 'Refreshing...':'Refresh'}</button>
          </div>
          <ul className="divide-y">
            {menu.map((m)=> (
              <li key={m.id} className="px-4 py-3 grid grid-cols-1 md:grid-cols-5 items-center gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{m.emoji || '🍔'}</span>
                  <div>
                    <div className="font-medium">{m.name}</div>
                    {m.description && <div className="text-xs text-neutral-500">{m.description}</div>}
                  </div>
                </div>
                <div className="text-sm text-neutral-600">{m.category}</div>
                <div className="font-semibold">{formatPrice(m.price_cents)}</div>
                <div className="text-xs text-neutral-500">{new Date(m.created_at).toLocaleDateString('en-US')} · Qty: {m.quantity}</div>
                <div className="flex justify-end">
                  <button
                    disabled={!userId || !m.available}
                    onClick={() => buy(m)}
                    className="rounded bg-burger-red px-3 py-2 text-white text-sm disabled:opacity-50"
                  >
                    {userId ? 'Buy' : 'Sign in first'}
                  </button>
                </div>
              </li>
            ))}
            {menu.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-neutral-500">No items yet. Please add some in the CRUD app.</li>
            )}
          </ul>
        </section>
      </div>
      )}
    </div>
  );
}
