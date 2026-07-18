/**
 * Bottom-sheet action picker (component-library.md; bottom-sheet rules in
 * interaction-patterns.md §Bottom sheets vs modals vs drawers).
 *
 * Built on a native `<dialog>` (`showModal()`), not `IonActionSheet` — part
 * of the G1-4 Ionic-overlay refactor. `<dialog>` gives a real top-layer
 * modal, backdrop, focus trap, and Esc-to-dismiss for free, so this atom
 * only has to add: the visual sheet chrome, scrim-tap dismiss, and Android
 * hardware-back handling (`ionBackButton`, the same global event Ionic's
 * own overlays listen to — see VaultHomePage's folder-nav back handler for
 * the same pattern at a lower priority).
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { agentAttrs, type AgentProps } from '../agent-props';
import { closeDialog, openDialog, useDialogBackButton } from '../dialog-utils';

/** One row in an {@link ActionSheet}. */
export interface ActionSheetButton {
  /** Button label. */
  text: string;
  /** `destructive` renders in the danger color; `cancel` is the dismiss row. */
  role?: 'destructive' | 'cancel';
  /** Runs on tap, before the sheet closes. */
  handler?: () => void;
}

/** Props for {@link ActionSheet}. */
export interface ActionSheetProps extends AgentProps {
  /** Whether the sheet is open. */
  isOpen: boolean;
  /** Optional sheet title (rendered as the sheet's heading). */
  header?: string;
  /** Rows, top to bottom. */
  buttons: ActionSheetButton[];
  /** Fires after the sheet closes, however it closed (row tap, scrim, Esc, back button). */
  onDidDismiss: () => void;
}

/** A bottom-sheet list of actions — the `IonActionSheet` replacement. */
export function ActionSheet({
  isOpen,
  header,
  buttons,
  onDidDismiss,
  ...agent
}: ActionSheetProps): ReactNode {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      openDialog(dialog);
    } else if (!isOpen && dialog.open) {
      closeDialog(dialog);
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onClose = (): void => onDidDismiss();
    dialog.addEventListener('close', onClose);
    return (): void => dialog.removeEventListener('close', onClose);
  }, [onDidDismiss]);

  useDialogBackButton(isOpen, ref);

  const handleScrimClick = (
    event: React.MouseEvent<HTMLDialogElement>
  ): void => {
    if (event.target === ref.current && ref.current) closeDialog(ref.current);
  };

  const handleButtonClick = (button: ActionSheetButton): void => {
    button.handler?.();
    if (ref.current) closeDialog(ref.current);
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- click-outside-to-dismiss on the scrim; Escape (native `<dialog>` cancel) and the ionBackButton handler above already give keyboard/hardware-back equivalents
    <dialog
      ref={ref}
      className="kg-action-sheet"
      onClick={handleScrimClick}
      onCancel={() => {
        if (ref.current) closeDialog(ref.current);
      }}
      {...agentAttrs(agent, isOpen ? 'expanded' : 'collapsed')}
    >
      <div className="kg-action-sheet__panel">
        <div className="kg-action-sheet__handle" aria-hidden="true" />
        {header && <h2 className="kg-action-sheet__header">{header}</h2>}
        <div className="kg-action-sheet__buttons">
          {buttons.map((button, index) => (
            <button
              key={index}
              type="button"
              className={clsx(
                'kg-action-sheet__btn',
                button.role === 'destructive' &&
                  'kg-action-sheet__btn--destructive',
                button.role === 'cancel' && 'kg-action-sheet__btn--cancel'
              )}
              onClick={() => handleButtonClick(button)}
            >
              {button.text}
            </button>
          ))}
        </div>
      </div>
    </dialog>
  );
}
