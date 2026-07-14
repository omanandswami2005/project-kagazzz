/**
 * Automated accessibility (axe) smoke tests (G1-3). Renders the design-system
 * atoms — the building blocks every screen composes — plus the new legal
 * MarkdownView, and asserts zero axe violations. This is a durable regression
 * guard for the WCAG 2.1 AA structural rules (labels, roles, name/role/value);
 * the on-device TalkBack/VoiceOver walkthrough remains the G1-10 tail.
 */
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import {
  Badge,
  Button,
  Checkbox,
  Input,
  ProgressBar,
  Radio,
  Toggle,
} from '@kagaz/ui';
import { MarkdownView } from '@/modules/settings/components/MarkdownView';

expect.extend(toHaveNoViolations);

// jest-axe's matcher isn't in vitest's Assertion types by default.
declare module 'vitest' {
  interface Assertion {
    toHaveNoViolations(): void;
  }
}

const noop = (): void => undefined;

describe('a11y: design-system atoms (G1-3)', () => {
  it('a labelled form of atoms has no axe violations', async () => {
    const { container } = render(
      <form aria-label="Sample">
        <Input label="Full name" value="" onChange={noop} />
        <Checkbox label="I agree" onChange={noop} />
        <fieldset>
          <legend>Language</legend>
          <Radio name="lang" value="en" label="English" checked onChange={noop} />
          <Radio name="lang" value="hi" label="हिन्दी" onChange={noop} />
        </fieldset>
        <Toggle label="Dark mode" enabled={false} onChange={noop} />
        <ProgressBar value={42} aria-label="Uploading" showLabel />
        <Badge>New</Badge>
        <Button onClick={noop}>Save</Button>
      </form>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('an icon-only button with an accessible name has no violations', async () => {
    const { container } = render(
      <Button iconOnly aria-label="Close" icon={<svg aria-hidden="true" />} onClick={noop} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('a11y: legal MarkdownView (G1-3)', () => {
  it('renders headings/lists/links with no violations', async () => {
    const { container } = render(
      <main>
        <MarkdownView
          source={'# Privacy\n\nWe respect you.\n\n- one\n- two\n\n[site](https://example.com)'}
        />
      </main>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
