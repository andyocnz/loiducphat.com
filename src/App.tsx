import { useCallback, useEffect, useRef, useState } from 'react';

type Language = 'vi' | 'en';
type ContentKind = 'heading' | 'paragraph' | 'verse';

interface ContentItem {
  kind: ContentKind;
  text: string;
}

interface StoryIndexItem {
  id: string;
  collection: 'dhammapada-commentary' | 'jataka';
  number: string;
  titleVi: string;
  titleEn: string;
  sourceVi: string;
  sourceEn: string;
  sourceUrl: string;
}

interface Story extends StoryIndexItem {
  attribution: string;
  contentVi: ContentItem[];
  contentEn: ContentItem[];
}

const copy = {
  vi: {
    languageLabel: 'Chọn ngôn ngữ',
    loading: 'Đang mở một câu chuyện…',
    error: 'Không thể mở câu chuyện này.',
    retry: 'Thử lại',
    next: 'Đọc một câu chuyện ngẫu nhiên khác',
    source: 'Nguồn',
    collection: {
      'dhammapada-commentary': 'Chú giải Kinh Pháp Cú',
      jataka: 'Chuyện tiền thân Đức Phật',
    },
  },
  en: {
    languageLabel: 'Choose language',
    loading: 'Opening a story…',
    error: 'This story could not be opened.',
    retry: 'Try again',
    next: 'Read another random story',
    source: 'Source',
    collection: {
      'dhammapada-commentary': 'Dhammapada Commentary',
      jataka: 'The Buddha’s former births',
    },
  },
} as const;

function pickRandomStory(index: StoryIndexItem[], previousId?: string) {
  if (index.length === 1) return index[0];

  let candidate = index[Math.floor(Math.random() * index.length)];
  while (candidate.id === previousId) {
    candidate = index[Math.floor(Math.random() * index.length)];
  }
  return candidate;
}

export function App() {
  const [language, setLanguage] = useState<Language>(() =>
    window.localStorage.getItem('language') === 'en' ? 'en' : 'vi'
  );
  const [storyIndex, setStoryIndex] = useState<StoryIndexItem[]>([]);
  const [story, setStory] = useState<Story | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const currentRequest = useRef<AbortController | null>(null);

  const openStory = useCallback(async (entry: StoryIndexItem, scrollToTop = false) => {
    currentRequest.current?.abort();
    const controller = new AbortController();
    currentRequest.current = controller;
    setIsLoading(true);
    setHasError(false);

    try {
      const response = await fetch(`/content/stories/${entry.id}.json`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Story request failed: ${response.status}`);
      const loadedStory = await response.json() as Story;
      setStory(loadedStory);
      if (scrollToTop) window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setHasError(true);
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function start() {
      try {
        const response = await fetch('/content/index.json', { signal: controller.signal });
        if (!response.ok) throw new Error(`Index request failed: ${response.status}`);
        const index = await response.json() as StoryIndexItem[];
        if (!index.length) throw new Error('The story index is empty');
        setStoryIndex(index);
        await openStory(pickRandomStory(index));
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setHasError(true);
        setIsLoading(false);
      }
    }

    void start();
    return () => controller.abort();
  }, [openStory]);

  useEffect(() => {
    window.localStorage.setItem('language', language);
    document.documentElement.lang = language;
    document.title = language === 'vi' ? 'Lời Đức Phật' : 'The Buddha’s Teachings';
  }, [language]);

  const openAnotherStory = () => {
    if (!storyIndex.length) return;
    void openStory(pickRandomStory(storyIndex, story?.id), true);
  };

  const ui = copy[language];
  const title = story ? (language === 'vi' ? story.titleVi : story.titleEn) : '';
  const source = story ? (language === 'vi' ? story.sourceVi : story.sourceEn) : '';
  const content = story ? (language === 'vi' ? story.contentVi : story.contentEn) : [];

  return (
    <div className="pure-zen-app">
      <nav className="language-switcher" aria-label={ui.languageLabel}>
        <button className="language-option" type="button" aria-pressed={language === 'vi'} onClick={() => setLanguage('vi')}>VN</button>
        <span aria-hidden="true">/</span>
        <button className="language-option" type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
      </nav>

      <main className="reader-shell">
        {isLoading && !story && <p className="reader-status" role="status">{ui.loading}</p>}

        {hasError && !story && (
          <div className="reader-status" role="alert">
            <p>{ui.error}</p>
            <button className="next-story-button" type="button" onClick={() => window.location.reload()}>{ui.retry}</button>
          </div>
        )}

        {story && (
          <article key={story.id} className={`pure-story-item${isLoading ? ' is-loading' : ''}`} aria-busy={isLoading}>
            <header className="story-header">
              <p className="story-collection">{ui.collection[story.collection]} · {story.number}</p>
              <h1 className="pure-story-title">{title}</h1>
            </header>

            <div className="pure-story-body">
              {content.map((item, index) => {
                if (item.kind === 'heading') return <h2 className="story-section" key={index}>{item.text}</h2>;
                if (item.kind === 'verse') return <blockquote className="story-verse" key={index}>{item.text}</blockquote>;
                return <p className="pure-story-paragraph" key={index}>{item.text}</p>;
              })}
            </div>

            <footer className="story-footer">
              <div className="pure-story-separator" aria-hidden="true">• • •</div>
              <p className="story-source">
                {ui.source}:{' '}
                <a href={story.sourceUrl} target="_blank" rel="noreferrer">{source}</a>
                <span>{story.attribution}</span>
              </p>
              <button className="next-story-button" type="button" onClick={openAnotherStory} disabled={isLoading}>
                {isLoading ? ui.loading : ui.next}
              </button>
            </footer>
          </article>
        )}
      </main>
    </div>
  );
}

export default App;
