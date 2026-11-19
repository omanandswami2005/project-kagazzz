/**
 * First-launch onboarding walkthrough (F-27). A dependency-free, full-screen
 * carousel shown once on first launch; skippable at any point and dismissed on
 * finish. Copy is kept at an 8th-grade reading level `[A11Y]` and localized
 * (en/hi). Renders nothing once completed.
 */
import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon, SegmentedControl, type IconName } from '@kagaz/ui';
import { i18n, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/core/i18n';
import { AppMark } from '@/app/shell/AppMark';
import { useLockSettings } from '@/modules/auth/hooks/useLockSettings';
import { useVaultStore } from '@/modules/document-vault/store/vault.store';
import { useOnboarding } from './useOnboarding';
import './onboarding.css';

/** Slide definitions — icon + i18n keys (bodies read at 8th-grade level). */
const SLIDES = [
  { icon: null, key: 'welcome' }, // OB-3: the app mark, not a generic file icon
  { icon: 'Lock', key: 'privacy' },
  { icon: 'Scan', key: 'organize' },
  { icon: 'ShieldCheck', key: 'backup' },
] as const satisfies readonly {
  icon: IconName | null;
  key: string;
}[];

/** Each language in its own script (OB-8). */
const LANGUAGE_NAMES: Record<SupportedLanguage, string> = { en: 'English', hi: 'हिन्दी' };

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
  const lock = useLockSettings();

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
        {/* OB-8: the device language is picked automatically; slide 1 lets
            the user switch before reading anything else. Names are shown in
            their own script, so they never need translating. */}
        {isFirst && (
          <SegmentedControl
            aria-label="Language / भाषा"
            agentId="app.onboarding.language"
            value={(i18n.resolvedLanguage ?? i18n.language) as SupportedLanguage}
            onChange={(lng) => void i18n.changeLanguage(lng)}
            options={SUPPORTED_LANGUAGES.map((lng) => ({ value: lng, label: LANGUAGE_NAMES[lng] }))}
          />
        )}
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
        <span className="kg-onboarding__icon" aria-hidden key={slide.key}>
          {slide.icon ? <Icon name={slide.icon} size={48} /> : <AppMark size={96} />}
        </span>
        <h1 id="kg-onboarding-title" className="kg-onboarding__title">
          {t(`onboarding.${slide.key}.title`)}
        </h1>
        <p className="kg-onboarding__body">{t(`onboarding.${slide.key}.body`)}</p>
      </div>

      {/* OB-7: the lock the last slide talks about, one tap away. */}
      {isLast && lock.available === true && (
        <Button
          variant="secondary"
          fullWidth
          icon={<Icon name={lock.enabled ? 'Check' : 'Lock'} size={20} />}
          disabled={lock.enabled || lock.busy}
          loading={lock.busy}
          onClick={() => lock.toggle(true)}
          agentId="app.onboarding.enable-lock"
        >
          {lock.enabled ? t('onboarding.lock_on') : t('onboarding.enable_lock')}
        </Button>
      )}

      {/* OB-1/OB-5: Back is a text link beside the dots (hidden on slide 1);
         the primary action is full-width in the thumb zone. */}
      <div className="kg-onboarding__nav">
        <span className="kg-onboarding__back">
          {!isFirst && (
            <Button variant="ghost" size="sm" onClick={goBack} agentId="app.onboarding.back">
              {t('onboarding.back')}
            </Button>
          )}
        </span>
        <div className="kg-onboarding__dots" aria-hidden>
          {SLIDES.map((s, i) => (
            <span
              key={s.key}
              className={`kg-onboarding__dot${i === index ? ' kg-onboarding__dot--active' : ''}`}
            />
          ))}
        </div>
        <span className="kg-onboarding__back" />
      </div>

      {isLast ? (
        <div className="kg-onboarding__finish">
          {/* OB-6 (next best action): land on the first real step, not an empty vault. */}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            icon={<Icon name="Plus" size={20} />}
            onClick={() => {
              complete();
              useVaultStore.getState().openUploadSheet();
            }}
            agentId="app.onboarding.add-first"
            agentRole="primary-action"
          >
            {t('onboarding.add_first')}
          </Button>
          <Button variant="ghost" fullWidth onClick={complete} agentId="app.onboarding.get-started">
            {t('onboarding.explore')}
          </Button>
        </div>
      ) : (
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={goNext}
          agentId="app.onboarding.next"
          agentRole="primary-action"
        >
          {t('onboarding.next')}
        </Button>
      )}
    </div>
  );
}
