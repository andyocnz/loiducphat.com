import { useState, useEffect, useRef, useCallback } from 'react';
import { STORIES } from './data/buddhistContent';
import type { StoryItem } from './data/buddhistContent';
import { getStoryParagraphs, getStoryTitle } from './data/translations';
import type { Language } from './data/translations';

interface RenderedStory {
  uniqueId: string;
  story: StoryItem;
}

const BATCH_SIZE = 3;

export function App() {
  const [language, setLanguage] = useState<Language>(() => {
    const savedLanguage = window.localStorage.getItem('language');
    return savedLanguage === 'en' ? 'en' : 'vi';
  });
  const [feed, setFeed] = useState<RenderedStory[]>([]);
  const sequenceRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMoreStories = useCallback(() => {
    setFeed((prev) => {
      const nextBatch: RenderedStory[] = [];
      for (let i = 0; i < BATCH_SIZE; i++) {
        const index = (sequenceRef.current + i) % STORIES.length;
        const story = STORIES[index];
        nextBatch.push({
          uniqueId: `${story.id}-${sequenceRef.current + i}`,
          story,
        });
      }
      sequenceRef.current += BATCH_SIZE;
      return [...prev, ...nextBatch];
    });
  }, []);

  // Initial load
  useEffect(() => {
    const initial: RenderedStory[] = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      const story = STORIES[i % STORIES.length];
      initial.push({
        uniqueId: `${story.id}-${i}`,
        story,
      });
    }
    sequenceRef.current = BATCH_SIZE;
    setFeed(initial);
  }, []);

  // IntersectionObserver for endless scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreStories();
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreStories]);

  useEffect(() => {
    window.localStorage.setItem('language', language);
    document.documentElement.lang = language;
    document.title = language === 'vi'
      ? 'Lời Đức Phật — Trí Tuệ Phật Giáo'
      : 'The Buddha’s Teachings — Buddhist Wisdom';
  }, [language]);

  return (
    <div className="pure-zen-app">
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
      <main className="pure-story-feed">
        {feed.map(({ uniqueId, story }) => (
          <article key={uniqueId} className="pure-story-item">
            <h2 className="pure-story-title">{getStoryTitle(story, language)}</h2>
            <div className="pure-story-body">
              {getStoryParagraphs(story, language).map((p, idx) => (
                <p key={idx} className="pure-story-paragraph">
                  {p}
                </p>
              ))}
            </div>
            <div className="pure-story-separator">• • •</div>
          </article>
        ))}

        {/* Sentinel element for infinite scroll */}
        <div ref={sentinelRef} className="pure-sentinel" />
      </main>
    </div>
  );
}

export default App;
