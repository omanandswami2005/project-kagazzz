import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StorageDonut } from '../StorageDonut';

describe('StorageDonut (F-26)', () => {
  const segments = [
    { label: 'PDF', sizeLabel: '8 MB', fraction: 0.8 },
    { label: 'JPG', sizeLabel: '2 MB', fraction: 0.2 },
  ];

  it('renders the center value, caption, and a legend row per segment', () => {
    render(
      <StorageDonut
        segments={segments}
        centerValue="10 MB"
        centerLabel="5 documents"
        ariaLabel="By file type"
      />
    );
    expect(screen.getByText('10 MB')).toBeInTheDocument();
    expect(screen.getByText('5 documents')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByLabelText('By file type')).toBeInTheDocument();
  });

  it('offsets each arc by the cumulative length of the prior arcs', () => {
    const { container } = render(
      <StorageDonut
        segments={segments}
        centerValue="10 MB"
        centerLabel="5 documents"
        ariaLabel="By file type"
      />
    );
    const arcs = container.querySelectorAll('.kg-donut__ring circle');
    expect(arcs).toHaveLength(2);
    // First arc starts at 0; second is offset by the first arc's length.
    expect(arcs[0]?.getAttribute('stroke-dashoffset')).toBe('0');
    const secondOffset = Number(arcs[1]?.getAttribute('stroke-dashoffset'));
    expect(secondOffset).toBeLessThan(0);
  });
});
