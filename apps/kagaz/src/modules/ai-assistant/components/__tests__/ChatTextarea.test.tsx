import { fireEvent, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChatTextarea } from '../ChatTextarea';

function Harness({ onSubmit }: { onSubmit: () => void }) {
  const [value, setValue] = useState('');
  return <ChatTextarea value={value} onChange={setValue} onSubmit={onSubmit} label="Message" />;
}
const box = (): HTMLTextAreaElement => document.querySelector('[data-agent-id="ai.chat.input"]') as HTMLTextAreaElement;

describe('ChatTextarea', () => {
  it('sends on Enter and keeps a newline for Shift+Enter', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await userEvent.type(box(), 'line one{Shift>}{Enter}{/Shift}line two');
    expect(box().value).toBe('line one\nline two');
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.type(box(), '{Enter}');
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(box().value).toBe('line one\nline two'); // Enter did not add a newline
  });

  it('ignores Enter while an IME composition is open (Hindi keyboards confirm with Enter)', () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    fireEvent.keyDown(box(), { key: 'Enter', isComposing: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('is labelled for assistive tech and respects disabled', () => {
    render(<ChatTextarea value="" onChange={vi.fn()} onSubmit={vi.fn()} label="Message" disabled />);
    expect(box()).toHaveAccessibleName('Message');
    expect(box()).toBeDisabled();
  });
});
