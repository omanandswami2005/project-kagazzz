/**
 * Gmail-style swipe-to-act row (F-88): drag a row left/right to reveal a
 * colored action behind it, release past the threshold to fire it. Wraps
 * {@link useSwipeGesture} with the visual layer — the reveal background,
 * 1:1 finger tracking while dragging, and a spring-back/settle transition
 * on release (see `swipeable-row.css` for the actual easing).
 *
 * Action-vocabulary-agnostic on purpose: callers resolve their own
 * icon+color reveal per side (document rows use delete/favorite/move/tags,
 * Trash uses restore/delete-forever, the Recent strip uses open-in-Tools —
 * three different action sets sharing one gesture/animation primitive).
 *
 * Every caller is expected to also expose each action through a non-swipe
 * path (a tap-menu / button) — swipe is an accelerator, never the only way
 * to reach an action, per the accessibility gate (WCAG 2.1 AA has no
 * reliable swipe equivalent for switch/keyboard users).
 */
import { useRef, type ReactNode } from 'react';
import { Icon, type IconName } from '@kagaz/ui';
import { hapticTap } from '@/core/haptics';
import {
  SWIPE_COMMIT_PX,
  useSwipeGesture,
  type SwipeSide,
} from './useSwipeGesture';
import './swipeable-row.css';

/** What a swipe side reveals: icon + a `var(--color-*)` background. */
export interface SwipeReveal {
  icon: IconName;
  colorVar: string;
}

/** Props for {@link SwipeableRow}. */
export interface SwipeableRowProps {
  /** Reveal shown on a swipe-left drag; `null` disables that side. */
  leftReveal: SwipeReveal | null;
  /** Reveal shown on a swipe-right drag; `null` disables that side. */
  rightReveal: SwipeReveal | null;
  /** Fires once when a drag release commits past the threshold. */
  onCommit: (side: SwipeSide) => void;
  /** Suppresses the gesture (e.g. multi-select mode is active). */
  disabled?: boolean;
  children: ReactNode;
  agentId?: string;
}

/** Wraps a row with swipe-left/right reveal + commit; caller owns meaning. */
export function SwipeableRow({
  leftReveal,
  rightReveal,
  onCommit,
  disabled = false,
  children,
  agentId,
}: SwipeableRowProps): ReactNode {
  const committing = useRef(false);
  const { dragX, isDragging, bind } = useSwipeGesture({
    enabled: { left: leftReveal !== null, right: rightReveal !== null },
    disabled,
    onThresholdCross: () => hapticTap(),
    onCommit: (side: SwipeSide) => {
      if (committing.current) return;
      committing.current = true;
      onCommit(side);
      // The row is typically about to unmount or re-render (most swipe
      // actions mutate the list) — this guard just prevents a double-fire
      // if a stray pointer event lands after onCommit already ran.
      setTimeout(() => {
        committing.current = false;
      }, 0);
    },
  });

  const revealSide: SwipeSide | null =
    dragX > 0 ? 'right' : dragX < 0 ? 'left' : null;
  const revealMeta =
    revealSide === 'right' ? rightReveal : revealSide === 'left' ? leftReveal : null;
  const progress = Math.min(1, Math.abs(dragX) / SWIPE_COMMIT_PX);

  return (
    <div className="kg-swipe-row" data-agent-id={agentId}>
      {revealMeta && (
        <div
          className={`kg-swipe-row__reveal kg-swipe-row__reveal--${revealSide}`}
          style={{ backgroundColor: revealMeta.colorVar, opacity: 0.15 + progress * 0.85 }}
          aria-hidden
        >
          <Icon name={revealMeta.icon} size={24} color="var(--surface-1)" />
        </div>
      )}
      <div
        className="kg-swipe-row__content"
        style={{
          transform: dragX !== 0 ? `translateX(${dragX}px)` : undefined,
          transition: isDragging ? 'none' : undefined,
        }}
        {...bind}
      >
        {children}
      </div>
    </div>
  );
}
