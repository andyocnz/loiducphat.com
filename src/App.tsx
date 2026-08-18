import { useState, useEffect, useRef, useCallback } from 'react';
import { STORIES } from './data/buddhistContent';
import type { StoryItem } from './data/buddhistContent';

interface RenderedStory {
  uniqueId: string;
  story: StoryItem;
}

const BATCH_SIZE = 3;

export function App() {
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

  return (
    <div className="pure-zen-app">
      <main className="pure-story-feed">
        {feed.map(({ uniqueId, story }) => (
          <article key={uniqueId} className="pure-story-item">
            <h2 className="pure-story-title">{story.title}</h2>
            <div className="pure-story-body">
              {story.paragraphs.map((p, idx) => (
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
