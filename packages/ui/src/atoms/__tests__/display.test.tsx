import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Avatar } from '../Avatar';
import { Badge } from '../Badge';
import { Icon } from '../Icon';
import { Tag } from '../Tag';

describe('Badge', () => {
  it('renders content with the variant class', () => {
    render(<Badge variant="success">Uploaded</Badge>);
    const badge = screen.getByText('Uploaded');
    expect(badge).toHaveClass('kg-badge--success');
  });

  it('dot mode renders no content and exposes an accessible name', () => {
    render(<Badge dot variant="danger" aria-label="Has errors" />);
    const dot = screen.getByRole('status', { name: 'Has errors' });
    expect(dot).toHaveClass('kg-badge--dot');
    expect(dot).toBeEmptyDOMElement();
  });
});

describe('Tag', () => {
  it('renders as a toggle button when clickable, with aria-pressed', async () => {
    const onClick = vi.fn();
    render(<Tag label="Identity" selected onClick={onClick} />);
    const tag = screen.getByRole('button', { name: /Identity/ });
    expect(tag).toHaveAttribute('aria-pressed', 'true');
    expect(tag).toHaveAttribute('data-agent-state', 'selected');
    await userEvent.click(tag);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders as a span when not clickable', () => {
    render(<Tag label="PDF" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('PDF')).toBeInTheDocument();
  });

  it('removable shows an accessible × that does not trigger onClick', async () => {
    const onClick = vi.fn();
    const onRemove = vi.fn();
    render(
      <Tag label="Urgent" removable onClick={onClick} onRemove={onRemove} />
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Urgent' })
    );
    expect(onRemove).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies a custom color', () => {
    render(<Tag label="Land" color="#3498db" />);
    expect(screen.getByText('Land').closest('.kg-tag')).toHaveStyle({
      backgroundColor: '#3498db',
    });
  });
});

describe('Avatar', () => {
  it('renders the image when src is given', () => {
    render(<Avatar src="https://example.test/a.jpg" name="Asha Kumari" />);
    expect(screen.getByAltText('Asha Kumari')).toBeInTheDocument();
  });

  it('falls back to initials without src', () => {
    render(<Avatar name="Asha Kumari" />);
    expect(screen.getByText('AK')).toBeInTheDocument();
  });

  it('falls back to the user icon without src and name', () => {
    render(<Avatar />);
    expect(screen.getByRole('img', { name: 'User' })).toBeInTheDocument();
  });

  it('shows a status dot with an accessible name', () => {
    render(<Avatar name="Asha" status="online" />);
    expect(screen.getByRole('status', { name: 'online' })).toHaveClass(
      'kg-avatar__status--online'
    );
  });
});

describe('Icon', () => {
  it('is decorative (aria-hidden) without a label', () => {
    const { container } = render(<Icon name="FileText" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('is an accessible image with a label and custom size', () => {
    render(<Icon name="FileText" size={32} aria-label="Document" />);
    const svg = screen.getByRole('img', { name: 'Document' });
    expect(svg).toHaveAttribute('width', '32');
  });
});
