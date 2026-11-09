import type { Property } from '../types';
import { householdLabels } from '../lib/householdFlags';

export function HouseholdFlags({ property }: { property: Property }) {
  const labels = householdLabels(property);
  if (!labels.length) return null;
  return <div className="my-3 flex flex-wrap gap-1.5" aria-label="Household flags">
    {labels.map(label => <span key={label} className={`rounded-lg border px-2 py-1 text-xs font-semibold ${label === 'Do not contact'
      ? 'border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100'
      : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100'}`}>{label}</span>)}
  </div>;
}
