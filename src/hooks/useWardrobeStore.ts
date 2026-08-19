import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { cloudConfigured, supabase } from '../lib/supabase';
import { CloudStore } from '../lib/store/cloud';
import { LocalStore } from '../lib/store/local';
import type { WardrobeStore } from '../lib/types';

export type StoreState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'ready'; store: WardrobeStore; email?: string };

const localStore = new LocalStore();

export function useWardrobeStore(): StoreState {
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(!cloudConfigured);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecked(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!checked) return { status: 'loading' };

  // No project configured: fall back to the on-device store so the app still
  // works. Everything stays in this browser until credentials are added.
  if (!supabase) return { status: 'ready', store: localStore };

  if (!session) return { status: 'signed-out' };

  return {
    status: 'ready',
    store: new CloudStore(supabase, session.user.id),
    email: session.user.email ?? undefined,
  };
}
