import { useState, useEffect, useRef, useCallback } from 'react';
import { STORIES } from './data/buddhistContent';
import type { StoryItem } from './data/buddhistContent';
import { getStoryParagraphs, getStoryTitle } from './data/translations';
import type { Language } from './data/translations';

interface RenderedStory {
  uniqueId: string;
  story: StoryItem;
}

interface StoryArticleProps {
  story: StoryItem;
  language: Language;
}

const BATCH_SIZE = 3;

function pickRandomStory(excludedIds: Set<string>) {
  let story = STORIES[Math.floor(Math.random() * STORIES.length)];

  while (excludedIds.has(story.id) && excludedIds.size < STORIES.length) {
    story = STORIES[Math.floor(Math.random() * STORIES.length)];
  }

  return story;
}

function StoryArticle({ story, language }: StoryArticleProps) {
  const [isVisible, setIsVisible] = useState(false);
  const articleRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      { threshold: 0.08, rootMargin: '0px 0px -6% 0px' }
    );

    observer.observe(article);
    return () => observer.disconnect();
  }, []);

  return (
    <article ref={articleRef} className={`pure-story-item${isVisible ? ' is-visible' : ''}`}>
      <h2 className="pure-story-title">{getStoryTitle(story, language)}</h2>
      <div className="pure-story-body">
        {getStoryParagraphs(story, language).map((paragraph, index) => (
          <p key={index} className="pure-story-paragraph">{paragraph}</p>
        ))}
      </div>
      <div className="pure-story-separator">• • •</div>
    </article>
  );
}

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
      const excludedIds = new Set<string>();
      const previousStory = prev.at(-1)?.story;
      if (previousStory) excludedIds.add(previousStory.id);

      for (let i = 0; i < BATCH_SIZE; i++) {
        const story = pickRandomStory(excludedIds);
        excludedIds.add(story.id);
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
    const excludedIds = new Set<string>();

    for (let i = 0; i < BATCH_SIZE; i++) {
      const story = pickRandomStory(excludedIds);
      excludedIds.add(story.id);
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
      ? 'Lời Đức Phật'
      : 'The Buddha’s Teachings';
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
          <StoryArticle key={uniqueId} story={story} language={language} />
        ))}

        {/* Sentinel element for infinite scroll */}
        <div ref={sentinelRef} className="pure-sentinel" />
      </main>
    </div>
  );
}

export default App;
