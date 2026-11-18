import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { askUserSchema } from '../../types/ask-user';
import { AskUserForm } from '../AskUserForm';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

const q = (id: string): HTMLElement | null => document.querySelector(`[data-agent-id="${id}"]`);
const docs = [{ id: 'doc-c', name: 'Me.jpg', fileType: 'jpg', isLocked: false }] as never[];

const spec = askUserSchema.parse({
  question: 'Resize how?',
  fields: [
    { id: 'width', label: 'Width', type: 'number', min: 16, max: 8000, unit: 'px', default: 200 },
    { id: 'quality', label: 'Quality', type: 'choice', options: [{ value: 'low', label: 'Low' }, { value: 'high', label: 'High' }] },
    { id: 'photo', label: 'Photo', type: 'document', kinds: ['image'] },
  ],
});

describe('AskUserForm', () => {
  it('blocks submit with inline errors until required fields are filled', async () => {
    const onSubmit = vi.fn();
    render(<AskUserForm spec={spec} documents={docs} onSubmit={onSubmit} />);

    await userEvent.click(q('ai.chat.form-submit') as Element);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual(['Required', 'Required']);
  });

  it('submits a readable summary and the raw values once everything is valid', async () => {
    const onSubmit = vi.fn();
    render(<AskUserForm spec={spec} documents={docs} onSubmit={onSubmit} />);

    await userEvent.click(q('ai.chat.form-option-quality-high') as Element);
    await userEvent.click(q('ai.chat.form-docs-photo.item-doc-c') as Element);
    await userEvent.click(q('ai.chat.form-submit') as Element);

    expect(onSubmit).toHaveBeenCalledWith('Width: 200 px · Quality: High · Photo: "Me.jpg" (id doc-c)', {
      width: 200,
      quality: 'high',
      photo: ['doc-c'],
    });
  });

  it('rejects an out-of-range number with a bound in the message', async () => {
    render(<AskUserForm spec={spec} documents={docs} onSubmit={vi.fn()} />);
    const width = q('ai.chat.form-input-width') as HTMLInputElement;
    await userEvent.clear(width);
    await userEvent.type(width, '5');
    await userEvent.click(q('ai.chat.form-submit') as Element);
    expect(screen.getByText('Must be at least 16')).toBeInTheDocument();
  });

  it('choices are a labelled radio group; selecting one marks it checked', async () => {
    render(<AskUserForm spec={spec} documents={docs} onSubmit={vi.fn()} />);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Low' }));
    expect(screen.getByRole('radio', { name: 'Low' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'High' })).toHaveAttribute('aria-checked', 'false');
  });

  it('is inert while the assistant is answering', () => {
    render(<AskUserForm spec={spec} documents={docs} disabled onSubmit={vi.fn()} />);
    expect(q('ai.chat.form-submit')).toBeDisabled();
    expect(q('ai.chat.form-input-width')).toBeDisabled();
  });

  it('renders model-written text as plain text, never as markup', () => {
    const hostile = askUserSchema.parse({ question: 'q', fields: [{ id: 'a', label: '<img src=x onerror=alert(1)>Name', type: 'text' }] });
    const { container } = render(<AskUserForm spec={hostile} documents={[]} onSubmit={vi.fn()} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>Name');
  });
});
