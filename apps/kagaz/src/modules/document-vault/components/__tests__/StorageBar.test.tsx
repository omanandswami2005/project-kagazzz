import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StorageBar } from '../StorageBar';

describe('StorageBar (ST-2/ST-8)', () => {
  it('draws one segment per type, sized by share, with a legend row each', () => {
    const { container } = render(
      <StorageBar
        ariaLabel="By type"
        segments={[
          { fileType: 'pdf', sizeLabel: '8 MB', fraction: 0.8 },
          { fileType: 'png', sizeLabel: '2 MB', fraction: 0.2 },
        ]}
      />
    );
    const segs = container.querySelectorAll<HTMLElement>('.kg-storage-bar__segment');
    expect([...segs].map((s) => s.style.width)).toEqual(['80%', '20%']);
    expect(container.querySelectorAll('.kg-storage-bar__item svg')).toHaveLength(2);
    expect(container.textContent).toContain('PDF8 MB80%');
  });
});
