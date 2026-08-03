"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseClientFromSettings } from '@/lib/supabase/dynamic-client';

/**
 * OAuth callback page.
 * After GitHub/Google redirects back here with ?code=xxx,
 * we exchange the code for a session on the client side.
 */
export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const hash = window.location.hash.substring(1); // Remove leading #
    const hashParams = new URLSearchParams(hash);
    const code = url.searchParams.get('code');
    const errorParam = url.searchParams.get('error') || hashParams.get('error');
    const errorDescription = url.searchParams.get('error_description') || hashParams.get('error_description');
    const accessTokenFromHash = hashParams.get('access_token');

    console.log('[auth/callback] URL:', window.location.href);
    console.log('[auth/callback] code (query):', code ? code.substring(0, 20) + '...' : 'null');
    console.log('[auth/callback] access_token (hash):', accessTokenFromHash ? accessTokenFromHash.substring(0, 20) + '...' : 'null');
    console.log('[auth/callback] errorParam:', errorParam);

    // Provider returned an error
    if (errorParam) {
      console.error('[auth/callback] Provider error:', errorDescription || errorParam);
      setError(errorDescription || errorParam);
      setTimeout(() => router.replace('/auth/login'), 10000);
      return;
    }

    const supabase = createSupabaseClientFromSettings();
    if (!supabase) {
      console.error('[auth/callback] Supabase client not configured');
      setError('Supabase client not configured. Please set URL and Key via ⚙️');
      setTimeout(() => router.replace('/auth/login'), 10000);
      return;
    }

    // Case 1: PKCE flow — code in query string, exchange for session
    if (code) {
      console.log('[auth/callback] PKCE flow: exchanging code for session...');
      supabase.auth.exchangeCodeForSession(code).then(({ error, data }) => {
        console.log('[auth/callback] exchangeCodeForSession result:', { error: error?.message, hasSession: !!data?.session });
        if (error) {
          console.error('[auth/callback] Exchange failed:', error.message, error);
          setError(error.message);
          setTimeout(() => router.replace('/auth/login'), 10000);
        } else {
          console.log('[auth/callback] Exchange successful, redirecting to /shop');
          router.replace('/shop');
        }
      }).catch((err) => {
        console.error('[auth/callback] Exchange threw:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setTimeout(() => router.replace('/auth/login'), 10000);
      });
      return;
    }

    // Case 2: Implicit flow — access_token in hash fragment
    // Supabase client auto-detects and parses the hash fragment on init.
    // We just need to verify the session was established.
    if (accessTokenFromHash) {
      console.log('[auth/callback] Implicit flow: access_token found in hash, checking session...');
      // Give Supabase client a moment to parse the hash fragment
      setTimeout(async () => {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('[auth/callback] getSession result:', { hasSession: !!session, error: sessionError?.message });
        if (session) {
          console.log('[auth/callback] Session established, redirecting to /shop');
          // Clean the URL hash before redirecting
          window.history.replaceState(null, '', window.location.pathname);
          router.replace('/shop');
        } else {
          console.error('[auth/callback] No session after implicit flow');
          setError('Failed to establish session. Please try again.');
          setTimeout(() => router.replace('/auth/login'), 10000);
        }
      }, 1000);
      return;
    }

    // No code and no access_token
    console.error('[auth/callback] No authorization code or access_token received');
    setError('No authorization code received');
    setTimeout(() => router.replace('/auth/login'), 10000);
  }, [router]);

  return (
    <div className="min-h-[60vh] grid place-items-center">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-red-600 font-medium mb-2">Authentication failed</p>
            <p className="text-sm text-neutral-600">{error}</p>
            <p className="text-sm text-neutral-500 mt-2">Redirecting to login...</p>
          </>
        ) : (
          <>
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-neutral-300 border-t-burger-red mb-3" />
            <p className="text-neutral-600">Completing sign in...</p>
          </>
        )}
      </div>
    </div>
  );
}
