import React, { useEffect, useState } from 'react';
import { APIProvider, APILoadingStatus, useApiLoadingStatus } from '@vis.gl/react-google-maps';
import { getMapUsagePeriod, type MapLoadAllowance } from '../lib/mapUsage';
import { MapLoadError, requestMapLoad } from '../services/mapLoadService';
import { GoogleMapView } from './GoogleMapView';

type Props = React.ComponentProps<typeof GoogleMapView> & { apiKey: string };

function AuthorizedMap({ allowance, onExpired, onFailure, ...props }: Omit<Props, 'apiKey'> & {
  allowance: MapLoadAllowance; onExpired: () => void; onFailure: () => void;
}) {
  const status = useApiLoadingStatus();
  const expired = allowance.period !== getMapUsagePeriod();
  useEffect(() => { if (expired) onExpired(); }, [expired, onExpired]);
  useEffect(() => {
    if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) onFailure();
  }, [status, onFailure]);
  if (expired || status !== APILoadingStatus.LOADED) {
    return <div role="status" className="grid h-full place-items-center p-6 text-sm">Loading Google Maps…</div>;
  }
  return <GoogleMapView {...props} />;
}

export function BudgetedGoogleMap({ apiKey, ...props }: Props) {
  const [allowance, setAllowance] = useState<MapLoadAllowance | null>(null);
  const [error, setError] = useState<MapLoadError | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setAllowance(null); setError(null);
    // Every mounted map must reserve its own opening. Never reuse this grant
    // after leaving the map screen, refreshing, or switching back from the sketch.
    requestMapLoad().then(grant => { if (active) setAllowance(grant); }).catch(cause => {
      if (active) setError(cause instanceof MapLoadError ? cause : new MapLoadError('Map usage could not be checked. Please try again.', 503));
    });
    return () => { active = false; };
  }, [attempt]);
  const retry = React.useCallback(() => { setAllowance(null); setError(null); setAttempt(value => value + 1); }, []);
  const mapError = React.useCallback(() => setError(new MapLoadError('Google Maps could not load. You can still use Addresses and Follow-Ups.', 503)), []);

  if (error) return (
    <div className="grid h-full place-items-center bg-slate-100 p-6 dark:bg-slate-950">
      <div role="status" className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold">{error.status === 429 ? 'Monthly map allowance reached' : 'Google Maps is paused'}</h2>
        <p className="mt-2">{error.message}</p>
        <p className="mt-2 text-slate-500">Addresses, notes, and follow-ups are still available.</p>
        <div className="mt-4 flex gap-4">
          {error.status !== 429 && <button onClick={retry} className="font-medium text-blue-600 underline">Try again</button>}
          <button onClick={props.onToggleMapMode} className="font-medium text-blue-600 underline">Use sketch map</button>
        </div>
      </div>
    </div>
  );
  if (!allowance) return <div role="status" className="grid h-full place-items-center p-6 text-sm">Checking map allowance…</div>;
  return (
    <APIProvider apiKey={apiKey} libraries={['marker']} onError={mapError}>
      <div className="relative h-full w-full">
        <AuthorizedMap {...props} allowance={allowance} onExpired={retry} onFailure={mapError} />
        <div className="pointer-events-none absolute bottom-7 right-4 rounded-lg border border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] text-slate-600 shadow dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-300">
          Monthly map allowance: {allowance.used.toLocaleString()} / {allowance.limit.toLocaleString()}
        </div>
      </div>
    </APIProvider>
  );
}
