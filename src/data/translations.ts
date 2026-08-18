import englishParagraphs from '../../public/translations.en.json';
import type { StoryItem } from './buddhistContent';

export type Language = 'vi' | 'en';

const DHAMMAPADA_CHAPTERS: Record<string, string> = {
  sy: 'Twin Verses (Yamakavagga)',
  pd: 'Heedfulness (Appamadavagga)',
  tam: 'The Mind (Cittavagga)',
  hoa: 'Flowers (Pupphavagga)',
  ngu: 'The Fool (Balavagga)',
  ht: 'The Wise (Panditavagga)',
  alh: 'The Arahant (Arahantavagga)',
  ngan: 'The Thousands (Sahasravagga)',
  ac: 'Evil (Papavagga)',
  hp: 'Violence (Dandavagga)',
  gia: 'Old Age (Jaravagga)',
  tn: 'The Self (Attavagga)',
  tt: 'The World (Lokavagga)',
  pt: 'The Buddha (Buddhavagga)',
  al: 'Happiness (Sukhavagga)',
  ta: 'Affection (Piyavagga)',
  pn: 'Anger (Kodhavagga)',
  un: 'Impurities (Malavagga)',
  tp: 'The Just (Dhammatthavagga)',
  dao: 'The Path (Maggavagga)',
  tl: 'Miscellaneous (Pakinnakavagga)',
  dn: 'Hell (Nirayavagga)',
  voi: 'The Elephant (Nagavagga)',
  dv: 'Craving (Tanhavagga)',
  tk: 'The Monk (Bhikkhuvagga)',
  blm: 'The Brahmin (Brahmanavagga)',
};

const NIKAYA_NAMES = ['Digha Nikaya', 'Majjhima Nikaya', 'Samyutta Nikaya', 'Anguttara Nikaya'];

export function hashText(text: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function getStoryTitle(story: StoryItem, language: Language) {
  if (language === 'vi') return story.title;

  if (story.id.startsWith('tich-phap-cu-')) {
    const parts = story.id.split('-');
    const lesson = Number(parts.at(-1));
    const chapterKey = parts.slice(3, -1).join('-');
    const storyNumber = story.title.match(/Pháp Cú (\d+)/)?.[1] ?? lesson;
    const chapter = DHAMMAPADA_CHAPTERS[chapterKey] ?? 'Dhammapada';
    return `Dhammapada Story ${storyNumber}: ${chapter} (Lesson ${lesson})`;
  }

  if (story.id.startsWith('jataka-')) {
    const number = Number(story.id.slice('jataka-'.length));
    return `The Buddha's Past-Life Story (Jataka ${number}): A Lesson in Compassion & Wisdom`;
  }

  if (story.id.startsWith('nikaya-')) {
    const number = Number(story.id.slice('nikaya-'.length));
    const collection = NIKAYA_NAMES[(number - 1) % NIKAYA_NAMES.length];
    return `Early Buddhist Discourse (${collection} ${number}): Teachings on Mindfulness`;
  }

  if (story.id.startsWith('loi-phat-day-')) {
    const number = Number(story.id.slice('loi-phat-day-'.length));
    return `Buddhist Teaching ${number}`;
  }

  return story.title;
}

export function getStoryParagraphs(story: StoryItem, language: Language) {
  if (language === 'vi') return story.paragraphs;

  return story.paragraphs.map((paragraph) => {
    const key = hashText(paragraph) as keyof typeof englishParagraphs;
    return englishParagraphs[key] ?? paragraph;
  });
}
