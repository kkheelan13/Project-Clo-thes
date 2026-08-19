import { useEffect, useState } from 'react';
import { importInto } from '../lib/store/importLocal';
import { LocalStore } from '../lib/store/local';
import type { WardrobeStore } from '../lib/types';

interface Props {
  cloud: WardrobeStore;
  onImported(): void;
}

/**
 * Offers to move garments logged before sign-in into the cloud account, so
 * nothing added in local mode gets stranded in one browser.
 */
export function ImportPrompt({ cloud, onImported }: Props) {
  const [local] = useState(() => new LocalStore());
  const [waiting, setWaiting] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    local.count().then(setWaiting).catch(() => setWaiting(0));
  }, [local]);

  if (waiting === 0 || dismissed) return null;

  async function move() {
    setBusy(true);
    setError(undefined);
    try {
      const result = await importInto(cloud, local);
      if (result.moved < result.total) {
        setError(
          `Moved ${result.moved} of ${result.total}. The rest are still on this device — try again.`,
        );
        setWaiting(await local.count());
        setBusy(false);
        return;
      }
      setWaiting(0);
      onImported();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Import failed.');
      setBusy(false);
    }
  }

  return (
    <div className="banner">
      <p>
        {waiting} {waiting === 1 ? 'garment is' : 'garments are'} saved on this
        device only. Move {waiting === 1 ? 'it' : 'them'} into your account?
      </p>
      {error && <p className="error">{error}</p>}
      <div className="banner-actions">
        <button type="button" className="ghost small" onClick={() => setDismissed(true)}>
          Not now
        </button>
        <button type="button" className="small" disabled={busy} onClick={move}>
          {busy ? 'Moving…' : 'Move them'}
        </button>
      </div>
    </div>
  );
}
