/**
 * A row of next-best actions (smart UI plan §1/§4): the 1–3 things a user
 * most likely does next on this screen, as large labelled buttons in their
 * path — the first one is the primary. Screens pass only the actions that
 * apply (e.g. no Share on web, no Ask AI where AI is unsupported).
 */
import type { ReactNode } from 'react';
import { Button, Icon, type IconName } from '@kagaz/ui';
import './next-actions.css';

/** One next action. */
export interface NextAction {
  id: string;
  icon: IconName;
  label: string;
  onClick: () => void;
}

/** Props for {@link NextActions}. */
export interface NextActionsProps {
  actions: NextAction[];
  /** Agent-id prefix; each button is `<prefix>.<action id>`. */
  agentPrefix: string;
}

/** Labelled action row; renders nothing when there are no actions. */
export function NextActions({ actions, agentPrefix }: NextActionsProps): ReactNode {
  if (actions.length === 0) {
    return null;
  }
  return (
    <div className="kg-next-actions" data-agent-id={agentPrefix}>
      {actions.map((action, i) => (
        <Button
          key={action.id}
          variant={i === 0 ? 'primary' : 'secondary'}
          onClick={action.onClick}
          agentId={`${agentPrefix}.${action.id}`}
        >
          <Icon name={action.icon} size={20} aria-hidden />
          {action.label}
        </Button>
      ))}
    </div>
  );
}
