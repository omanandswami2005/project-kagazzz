// Minimal type declaration for jest-axe (ships no bundled types). Used by the
// automated accessibility tests (G1-3, src/test/a11y.test.tsx).
declare module 'jest-axe' {
  interface AxeResults {
    violations: unknown[];
  }
  export function axe(
    html: Element | Document | DocumentFragment | string,
    options?: Record<string, unknown>
  ): Promise<AxeResults>;
  export const toHaveNoViolations: Record<
    string,
    (...args: unknown[]) => { pass: boolean; message(): string }
  >;
}
