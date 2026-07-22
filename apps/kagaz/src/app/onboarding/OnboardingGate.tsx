/**
 * First-launch onboarding walkthrough (F-27). A dependency-free, full-screen
 * carousel shown once on first launch; skippable at any point and dismissed on
 * finish. Copy is kept at an 8th-grade reading level `[A11Y]` and localized
 * (en/hi). Renders nothing once completed.
 */
import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from '@kagaz/ui';
import { useOnboarding } from './useOnboarding';
import './onboarding.css';

/** Slide definitions — icon + i18n keys (bodies read at 8th-grade level). */
const SLIDES = [
  { icon: 'FileText', key: 'welcome' },
  { icon: 'Lock', key: 'privacy' },
  { icon: 'Scan', key: 'organize' },
  { icon: 'Download', key: 'backup' },
] as const satisfies readonly {
  icon: 'FileText' | 'Lock' | 'Scan' | 'Download';
  key: string;
}[];

/** Minimum horizontal drag (px) before a pointer gesture counts as a swipe,
 * not a tap or vertical scroll — same cancel-threshold idea as F-25's
 * long-press tremor tolerance, just for the opposite purpose (require
 * deliberate movement instead of tolerating accidental movement). */
const SWIPE_THRESHOLD_PX = 50;

/** The first-launch intro overlay. */
export function OnboardingGate(): ReactNode {
  const { t } = useTranslation('common');
  const { showOnboarding, complete } = useOnboarding();
  const [index, setIndex] = useState(0);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  if (!showOnboarding) {
    return null;
  }

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;
  const isFirst = index === 0;

  const goNext = (): void => {
    if (isLast) {
      complete();
    } else {
      setIndex((i) => Math.min(SLIDES.length - 1, i + 1));
    }
  };
  const goBack = (): void => {
    if (!isFirst) {
      setIndex((i) => Math.max(0, i - 1));
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    swipeStart.current = { x: event.clientX, y: event.clientY };
  };
  const handlePointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) {
      return;
    }
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) {
      return; // tap, or a mostly-vertical drag — not a swipe
    }
    if (dx < 0) {
      goNext(); // swiped left → next
    } else {
      goBack(); // swiped right → back
    }
  };

  return (
    <div
      className="kg-onboarding"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kg-onboarding-title"
      data-agent-id="app.onboarding"
      data-agent-state={`slide-${index + 1}`}
    >
      <div className="kg-onboarding__bar">
        <Button
          variant="ghost"
          size="sm"
          onClick={complete}
          agentId="app.onboarding.skip"
        >
          {t('onboarding.skip')}
        </Button>
      </div>

      <div
        className="kg-onboarding__slide"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <span className="kg-onboarding__icon" aria-hidden>
          <Icon name={slide.icon} size={48} />
        </span>
        <h1 id="kg-onboarding-title" className="kg-onboarding__title">
          {t(`onboarding.${slide.key}.title`)}
        </h1>
        <p className="kg-onboarding__body">{t(`onboarding.${slide.key}.body`)}</p>
      </div>

      <div className="kg-onboarding__dots" aria-hidden>
        {SLIDES.map((s, i) => (
          <span
            key={s.key}
            className={`kg-onboarding__dot${i === index ? ' kg-onboarding__dot--active' : ''}`}
          />
        ))}
      </div>

      <div className="kg-onboarding__nav">
        <Button
          variant="ghost"
          size="md"
          onClick={goBack}
          disabled={isFirst}
          agentId="app.onboarding.back"
        >
          {t('onboarding.back')}
        </Button>
        {isLast ? (
          <Button
            variant="primary"
            size="md"
            onClick={complete}
            agentId="app.onboarding.get-started"
          >
            {t('onboarding.get_started')}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="md"
            onClick={goNext}
            agentId="app.onboarding.next"
          >
            {t('onboarding.next')}
          </Button>
        )}
      </div>
    </div>
  );
}
