/**
 * Search input (component-library.md) — a plain `<input type="search">`
 * with a leading icon and a clear button, not `IonSearchbar`. Part of the
 * G1-4 Ionic-overlay refactor.
 */
import { useId, type ReactNode } from 'react';
import { agentAttrs, type AgentProps } from '../agent-props';
import { Icon } from './Icon';

/** Props for {@link Search}. */
export interface SearchProps extends AgentProps {
  value: string;
  placeholder?: string;
  'aria-label'?: string;
  onChange: (value: string) => void;
}

/** A search field with a leading icon and a clear ("×") button. */
export function Search({
  value,
  placeholder,
  'aria-label': ariaLabel,
  onChange,
  ...agent
}: SearchProps): ReactNode {
  const id = useId();
  return (
    <div className="kg-search">
      <span className="kg-search__icon">
        <Icon name="Search" size={20} />
      </span>
      <input
        id={id}
        type="search"
        className="kg-search__input"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        onChange={(e) => onChange(e.target.value)}
        {...agentAttrs(agent, value ? 'dirty' : 'pristine', value)}
      />
      {value && (
        <button
          type="button"
          className="kg-search__clear"
          aria-label="Clear"
          onClick={() => onChange('')}
        >
          <Icon name="X" size={16} />
        </button>
      )}
    </div>
  );
}
