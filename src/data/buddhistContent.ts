import storiesData from '../../public/stories.json';

export interface StoryItem {
  id: string;
  title: string;
  source: string;
  paragraphs: string[];
}

export const STORIES: StoryItem[] = storiesData;
