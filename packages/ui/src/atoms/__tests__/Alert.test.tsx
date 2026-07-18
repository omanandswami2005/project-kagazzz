import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Alert } from '../Alert';

describe('Alert', () => {
  it('is closed and reports collapsed state when isOpen is false', () => {
    const { container } = render(
      <Alert
        isOpen={false}
        header="Delete folder?"
        buttons={[{ text: 'Cancel', role: 'cancel' }]}
        onDidDismiss={() => undefined}
      />
    );
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toHaveAttribute('open');
    expect(dialog).toHaveAttribute('data-agent-state', 'collapsed');
  });

  it('shows header, message, and buttons in message-confirm mode', () => {
    render(
      <Alert
        isOpen
        header="Delete folder?"
        message="This cannot be undone."
        buttons={[
          { text: 'Delete', role: 'destructive' },
          { text: 'Cancel', role: 'cancel' },
        ]}
        onDidDismiss={() => undefined}
      />
    );
    expect(screen.getByText('Delete folder?')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass(
      'kg-alert__btn--destructive'
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass(
      'kg-alert__btn--cancel'
    );
  });

  it('renders a text input pre-filled with defaultValue in prompt mode', () => {
    render(
      <Alert
        isOpen
        header="Rename folder"
        input={{ label: 'Folder name', defaultValue: 'Old name' }}
        buttons={[{ text: 'Save' }]}
        onDidDismiss={() => undefined}
      />
    );
    expect(screen.getByLabelText('Folder name')).toHaveValue('Old name');
  });

  it('passes the current input value to the button handler, then dismisses', async () => {
    const handler = vi.fn();
    const onDidDismiss = vi.fn();
    render(
      <Alert
        isOpen
        header="Rename folder"
        input={{ label: 'Folder name', defaultValue: 'Old name' }}
        buttons={[{ text: 'Save', handler }]}
        onDidDismiss={onDidDismiss}
      />
    );
    const input = screen.getByLabelText('Folder name');
    await userEvent.clear(input);
    await userEvent.type(input, 'New name');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(handler).toHaveBeenCalledWith('New name');
    expect(onDidDismiss).toHaveBeenCalled();
  });

  it('passes no value to the handler when there is no input (message-confirm mode)', async () => {
    const handler = vi.fn();
    render(
      <Alert
        isOpen
        header="Delete folder?"
        buttons={[{ text: 'Delete', handler, role: 'destructive' }]}
        onDidDismiss={() => undefined}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(handler).toHaveBeenCalledWith(undefined);
  });

  it('re-seeds the input to defaultValue each time the dialog opens', () => {
    const { rerender } = render(
      <Alert
        isOpen={false}
        header="Rename"
        input={{ label: 'Name', defaultValue: 'first' }}
        buttons={[{ text: 'Save' }]}
        onDidDismiss={() => undefined}
      />
    );
    rerender(
      <Alert
        isOpen
        header="Rename"
        input={{ label: 'Name', defaultValue: 'second' }}
        buttons={[{ text: 'Save' }]}
        onDidDismiss={() => undefined}
      />
    );
    expect(screen.getByLabelText('Name')).toHaveValue('second');
  });
});
