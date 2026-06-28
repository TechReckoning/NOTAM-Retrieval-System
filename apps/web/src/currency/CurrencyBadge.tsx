import type { LoadedNotam } from '../lib/types';

/** Small inline badge marking a NOTAM's currency provenance within a bundle.
 *  Only amendment-derived / flagged states are shown; plain 'current' renders nothing. */
export function CurrencyBadge({ n }: { n: LoadedNotam }): JSX.Element | null {
  const c = n.currency;
  if (!c) return null;
  switch (c.state) {
    case 'added':
      return (
        <span className="currency-badge added" title={c.notes[0] ?? 'Added by a supplement'}>
          +{c.docSequence ?? ''} added
        </span>
      );
    case 'replaces':
      return (
        <span className="currency-badge replaces" title={c.notes[0] ?? 'Up-to-date version'}>
          replaces {c.relatedRef ?? ''}
        </span>
      );
    case 'orphan-modification':
      return (
        <span className="currency-badge review" title={c.notes[0] ?? 'Modification needs review'}>
          review
        </span>
      );
    case 'duplicate':
      return (
        <span className="currency-badge review" title={c.notes[0] ?? 'Duplicate NOTAM number'}>
          duplicate
        </span>
      );
    default:
      return null;
  }
}
