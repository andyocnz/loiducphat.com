import fs from 'node:fs';
import path from 'node:path';

const storiesPath = path.resolve('public', 'stories.json');
const outputPath = path.resolve('public', 'translations.en.json');
const stories = JSON.parse(fs.readFileSync(storiesPath, 'utf8'));
const paragraphs = [...new Set(stories.flatMap((story) => story.paragraphs))];

function hashText(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

async function translate(text, attempt = 1) {
  const body = new URLSearchParams({
    client: 'gtx',
    sl: 'vi',
    tl: 'en',
    dt: 't',
    q: text,
  });
  const response = await fetch('https://translate.googleapis.com/translate_a/single', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body,
  });

  if (!response.ok) {
    if (attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      return translate(text, attempt + 1);
    }
    throw new Error(`Translation request failed with status ${response.status}`);
  }

  const result = await response.json();
  return result[0].map((part) => part[0]).join('').trim();
}

const translations = {};
let cursor = 0;
const workerCount = 6;

async function worker() {
  while (cursor < paragraphs.length) {
    const index = cursor;
    cursor += 1;
    const paragraph = paragraphs[index];
    const key = hashText(paragraph);

    if (translations[key]) {
      throw new Error(`Translation hash collision for ${key}`);
    }

    translations[key] = await translate(paragraph);
    process.stdout.write(`\rTranslated ${Object.keys(translations).length}/${paragraphs.length}`);
  }
}

await Promise.all(Array.from({ length: workerCount }, () => worker()));
fs.writeFileSync(outputPath, `${JSON.stringify(translations, null, 2)}\n`, 'utf8');
console.log(`\nSaved English translations to ${outputPath}`);
