import { useCallback, useEffect, useState } from 'react';
import { AddGarment } from './components/AddGarment';
import { GarmentSheet } from './components/GarmentSheet';
import { ImportPrompt } from './components/ImportPrompt';
import { LogWear } from './components/LogWear';
import { PairOutfit } from './components/PairOutfit';
import { SignIn } from './components/SignIn';
import { Wardrobe } from './components/Wardrobe';
import { useWardrobeStore } from './hooks/useWardrobeStore';
import { supabase } from './lib/supabase';
import type {
  NewGarment,
  WardrobeSnapshot,
  WardrobeStore,
} from './lib/types';
import { SpriteDefs } from './sprites/textures';

const EMPTY: WardrobeSnapshot = { garments: [], wears: [], outfits: [] };

function WardrobeApp({ store, email }: { store: WardrobeStore; email?: string }) {
  const [snapshot, setSnapshot] = useState<WardrobeSnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [reloadToken, setReloadToken] = useState(0);
  const [adding, setAdding] = useState(false);
  const [logging, setLogging] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();

  // Guarded against a stale response: when `store` swaps from local to cloud on
  // sign-in, an in-flight read from the old store must not overwrite the new.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const next = await store.read();
        if (!cancelled) {
          setSnapshot(next);
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

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  /**
   * Every mutation reloads rather than patching local state. Wearing a garment
   * also unirons it and dissolves its outfit, so three lists move at once --
   * refetching a few kilobytes is cheaper than keeping them in step by hand.
   */
  const act = useCallback(
    async (work: () => Promise<unknown>) => {
      await work();
      reload();
    },
    [reload],
  );

  // Read from the snapshot so the sheet reflects the latest reload rather than
  // a garment captured when it was opened.
  const selected = snapshot.garments.find((g) => g.id === selectedId);
  const count = snapshot.garments.length;

  return (
    <>
      <header className="app-head">
        <div>
          <h1>Wardrobe</h1>
          <p className="muted small">
            {loading ? 'Loading…' : `${count} ${count === 1 ? 'item' : 'items'}`}
            {store.mode === 'local' && ' · on this device'}
          </p>
        </div>
        <div className="head-actions">
          {count > 0 && (
            <button type="button" className="small" onClick={() => setLogging(true)}>
              Wore today
            </button>
          )}
          {email && supabase && (
            <button
              type="button"
              className="ghost small"
              onClick={() => void supabase?.auth.signOut()}
            >
              Sign out
            </button>
          )}
        </div>
      </header>

      {store.mode === 'cloud' && <ImportPrompt cloud={store} onImported={reload} />}

      {error && <p className="error">{error}</p>}

      {!loading && (
        <Wardrobe
          snapshot={snapshot}
          onSelect={(garment) => setSelectedId(garment.id)}
          onAdd={() => setAdding(true)}
          onPair={() => setPairing(true)}
          onUnpair={(id) => act(() => store.unpair(id))}
          onWash={(ids) => act(() => store.wash(ids))}
        />
      )}

      {count > 0 && (
        <button
          type="button"
          className="fab"
          aria-label="Add a garment"
          onClick={() => setAdding(true)}
        >
          +
        </button>
      )}

      {adding && (
        <AddGarment
          onSave={async (input: NewGarment) => {
            await store.add(input);
            reload();
          }}
          onClose={() => setAdding(false)}
        />
      )}

      {logging && (
        <LogWear
          snapshot={snapshot}
          onLog={(ids, wornOn) => act(() => store.logWear(ids, wornOn))}
          onClose={() => setLogging(false)}
        />
      )}

      {pairing && (
        <PairOutfit
          snapshot={snapshot}
          onPair={(topId, bottomId) => act(() => store.pair(topId, bottomId))}
          onClose={() => setPairing(false)}
        />
      )}

      {selected && (
        <GarmentSheet
          garment={selected}
          snapshot={snapshot}
          onDelete={(id: string) => act(() => store.remove(id))}
          onWear={(id: string, wornOn: string) => act(() => store.logWear([id], wornOn))}
          onWash={(id: string) => act(() => store.wash([id]))}
          onIron={(id: string, ironed: boolean) => act(() => store.setIroned(id, ironed))}
          onClose={() => setSelectedId(undefined)}
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
