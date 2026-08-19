import { useEffect, useState } from 'react';
import { AddGarment } from './components/AddGarment';
import { GarmentSheet } from './components/GarmentSheet';
import { ImportPrompt } from './components/ImportPrompt';
import { SignIn } from './components/SignIn';
import { Wardrobe } from './components/Wardrobe';
import { useWardrobeStore } from './hooks/useWardrobeStore';
import { supabase } from './lib/supabase';
import { byPurchasedOnDesc, type Garment, type NewGarment, type WardrobeStore } from './lib/types';
import { SpriteDefs } from './sprites/textures';

function WardrobeApp({ store, email }: { store: WardrobeStore; email?: string }) {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Garment>();
  const [reloadToken, setReloadToken] = useState(0);

  // Guarded against a stale response: when `store` swaps from local to cloud on
  // sign-in, an in-flight list() from the old store must not overwrite the new.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const list = await store.list();
        if (!cancelled) {
          setGarments(list);
          setError(undefined);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : 'Could not load your wardrobe.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [store, reloadToken]);

  async function add(input: NewGarment) {
    const saved = await store.add(input);
    // Insert locally rather than refetching -- the sprite should appear instantly.
    setGarments((current) => [...current, saved].sort(byPurchasedOnDesc));
  }

  async function remove(id: string) {
    await store.remove(id);
    setGarments((current) => current.filter((garment) => garment.id !== id));
  }

  return (
    <>
      <header className="app-head">
        <div>
          <h1>Wardrobe</h1>
          <p className="muted small">
            {loading
              ? 'Loading…'
              : `${garments.length} ${garments.length === 1 ? 'item' : 'items'}`}
            {store.mode === 'local' && ' · on this device'}
          </p>
        </div>
        {email && supabase && (
          <button
            type="button"
            className="ghost small"
            onClick={() => void supabase?.auth.signOut()}
          >
            Sign out
          </button>
        )}
      </header>

      {store.mode === 'cloud' && <ImportPrompt cloud={store} onImported={() => setReloadToken((n) => n + 1)} />}

      {error && <p className="error">{error}</p>}

      {!loading && (
        <Wardrobe garments={garments} onSelect={setSelected} onAdd={() => setAdding(true)} />
      )}

      {garments.length > 0 && (
        <button type="button" className="fab" aria-label="Add a garment" onClick={() => setAdding(true)}>
          +
        </button>
      )}

      {adding && <AddGarment onSave={add} onClose={() => setAdding(false)} />}
      {selected && (
        <GarmentSheet
          garment={selected}
          onDelete={remove}
          onClose={() => setSelected(undefined)}
        />
      )}
    </>
  );
}

export default function App() {
  const state = useWardrobeStore();

  return (
    <div className="app">
      <SpriteDefs />
      {state.status === 'loading' && <p className="muted centred">Loading…</p>}
      {state.status === 'signed-out' && <SignIn />}
      {state.status === 'ready' && <WardrobeApp store={state.store} email={state.email} />}
    </div>
  );
}
