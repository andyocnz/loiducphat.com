import { useCallback, useEffect, useRef, useState } from 'react';
import { STORIES } from './data/buddhistContent';
import { getStoryParagraphs, getStoryTitle } from './data/translations';
import type { Language } from './data/translations';

type TurnDirection = 'forward' | 'backward';

const TURN_COOLDOWN_MS = 650;
const SWIPE_DISTANCE_PX = 60;

export function App() {
  const [language, setLanguage] = useState<Language>(() => {
    const savedLanguage = window.localStorage.getItem('language');
    return savedLanguage === 'en' ? 'en' : 'vi';
  });
  const [storyIndex, setStoryIndex] = useState(0);
  const [turnDirection, setTurnDirection] = useState<TurnDirection>('forward');
  const [turnSequence, setTurnSequence] = useState(0);
  const readingPaneRef = useRef<HTMLDivElement | null>(null);
  const lastTurnRef = useRef(0);
  const touchStartRef = useRef({ x: 0, y: 0 });

  const turnPage = useCallback((direction: TurnDirection) => {
    const now = Date.now();
    if (now - lastTurnRef.current < TURN_COOLDOWN_MS) return;
    lastTurnRef.current = now;

    setTurnDirection(direction);
    setTurnSequence((sequence) => sequence + 1);
    setStoryIndex((current) => {
      if (direction === 'forward') return (current + 1) % STORIES.length;
      return (current - 1 + STORIES.length) % STORIES.length;
    });

    requestAnimationFrame(() => readingPaneRef.current?.scrollTo({ top: 0 }));
  }, []);

  useEffect(() => {
    window.localStorage.setItem('language', language);
    document.documentElement.lang = language;
    document.title = language === 'vi'
      ? 'Lời Đức Phật — Trí Tuệ Phật Giáo'
      : 'The Buddha’s Teachings — Buddhist Wisdom';
  }, [language]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const forwardKeys = ['ArrowRight', 'ArrowDown', 'PageDown', ' '];
      const backwardKeys = ['ArrowLeft', 'ArrowUp', 'PageUp'];

      if (forwardKeys.includes(event.key)) {
        event.preventDefault();
        turnPage('forward');
      } else if (backwardKeys.includes(event.key)) {
        event.preventDefault();
        turnPage('backward');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [turnPage]);

  const handleWheel = (event: React.WheelEvent) => {
    const readingPane = readingPaneRef.current;
    if (!readingPane || Math.abs(event.deltaY) < 12) return;

    const isAtTop = readingPane.scrollTop <= 1;
    const isAtBottom = readingPane.scrollTop + readingPane.clientHeight >= readingPane.scrollHeight - 1;

    if (event.deltaY > 0 && isAtBottom) turnPage('forward');
    if (event.deltaY < 0 && isAtTop) turnPage('backward');
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const touch = event.changedTouches[0];
    const distanceX = touch.clientX - touchStartRef.current.x;
    const distanceY = touch.clientY - touchStartRef.current.y;

    if (Math.abs(distanceX) < SWIPE_DISTANCE_PX || Math.abs(distanceX) <= Math.abs(distanceY)) return;
    turnPage(distanceX < 0 ? 'forward' : 'backward');
  };

  const story = STORIES[storyIndex];
  const title = getStoryTitle(story, language);
  const paragraphs = getStoryParagraphs(story, language);
  const previousLabel = language === 'vi' ? 'Trang trước' : 'Previous page';
  const nextLabel = language === 'vi' ? 'Trang sau' : 'Next page';

  return (
    <div className="book-reader" onWheel={handleWheel}>
      <header className="reader-toolbar">
        <div className="reader-brand">{language === 'vi' ? 'Lời Đức Phật' : 'The Buddha’s Teachings'}</div>
        <nav className="language-switcher" aria-label={language === 'vi' ? 'Chọn ngôn ngữ' : 'Choose language'}>
          <button
            className="language-option"
            type="button"
            aria-pressed={language === 'vi'}
            onClick={() => setLanguage('vi')}
          >
            VN
          </button>
          <span aria-hidden="true">/</span>
          <button
            className="language-option"
            type="button"
            aria-pressed={language === 'en'}
            onClick={() => setLanguage('en')}
          >
            EN
          </button>
        </nav>
      </header>

      <main className="book-stage" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <article
          key={`${story.id}-${turnSequence}`}
          className={`paper-page page-turn-${turnDirection}`}
          aria-live="polite"
        >
          <div className="paper-grain" aria-hidden="true" />
          <div className="reading-pane" ref={readingPaneRef}>
            <h1 className="story-title">{title}</h1>
            <div className="story-body">
              {paragraphs.map((paragraph, index) => (
                <p key={index} className="story-paragraph">{paragraph}</p>
              ))}
            </div>
          </div>
        </article>
      </main>

      <footer className="page-controls">
        <button className="page-button" type="button" onClick={() => turnPage('backward')} aria-label={previousLabel}>
          <span aria-hidden="true">←</span>
          <span>{language === 'vi' ? 'Trước' : 'Previous'}</span>
        </button>
        <span className="page-number" aria-label={`${storyIndex + 1} / ${STORIES.length}`}>
          {storyIndex + 1} <span aria-hidden="true">/</span> {STORIES.length}
        </span>
        <button className="page-button" type="button" onClick={() => turnPage('forward')} aria-label={nextLabel}>
          <span>{language === 'vi' ? 'Sau' : 'Next'}</span>
          <span aria-hidden="true">→</span>
        </button>
      </footer>
    </div>
  );
}

export default App;
