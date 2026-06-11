/**
 * Avatar atom (component-library.md §Avatar).
 * Fallback chain: image → initials → default user icon.
 */
import { clsx } from 'clsx';
import { User } from 'lucide-react';
import { useState, type ReactNode } from 'react';

/** Props for {@link Avatar}. */
export interface AvatarProps {
  /** Image URL. */
  src?: string;
  /** User name — drives the initials fallback and alt text. */
  name?: string;
  /** Avatar size: sm=32, md=40, lg=56. */
  size?: 'sm' | 'md' | 'lg';
  /** Optional presence dot. */
  status?: 'online' | 'offline' | 'busy';
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** User/document-owner representation. */
export function Avatar({ src, name, size = 'md', status }: AvatarProps): ReactNode {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(src) && !imageFailed;
  const initials = name ? initialsOf(name) : '';

  return (
    <span className={clsx('kg-avatar', `kg-avatar--${size}`)}>
      {showImage ? (
        <img
          className="kg-avatar__image"
          src={src}
          alt={name ?? 'User avatar'}
          onError={() => setImageFailed(true)}
        />
      ) : initials ? (
        <span className="kg-avatar__initials" aria-hidden="true">
          {initials}
        </span>
      ) : (
        <User
          className="kg-avatar__fallback"
          aria-label={name ?? 'User'}
          role="img"
        />
      )}
      {status && (
        <span
          className={clsx('kg-avatar__status', `kg-avatar__status--${status}`)}
          role="status"
          aria-label={status}
        />
      )}
    </span>
  );
}
