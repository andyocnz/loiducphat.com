import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const CONTENT_ROOT = path.resolve('public', 'content');
const STORIES_ROOT = path.join(CONTENT_ROOT, 'stories');
const INDEX_PATH = path.join(CONTENT_ROOT, 'index.json');
const DHAMMAPADA_BASE = 'https://ancient-buddhist-texts.net/English-Texts/Buddhist-Legends/';
const JATAKA_BASE = 'https://ancient-buddhist-texts.net/English-Texts/Jataka/';
const TRANSLATION_SEPARATOR = '|||987654321|||';
const USER_AGENT = 'loiducphat.com canonical story importer/1.0';
const VIETNAMESE_TITLE_OVERRIDES = new Map([
  ['jataka-111', 'Câu hỏi về con lừa'],
]);

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
  return [key, value];
}));
const selectedCollection = args.get('collection') ?? 'all';
const limit = Number(args.get('limit') ?? Number.POSITIVE_INFINITY);
const skipTranslation = args.has('skip-translation');

fs.mkdirSync(STORIES_ROOT, { recursive: true });

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchText(url, attempt = 1) {
  const response = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (response.ok) return response.text();
  if (attempt >= 5) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  await wait(attempt * 1000);
  return fetchText(url, attempt + 1);
}

function normalizedText($, element) {
  const clone = $(element).clone();
  clone.find('.TT, .number, nmb, sup, script, audio').remove();
  clone.find('br').replaceWith('\n');
  return clone
    .text()
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function contentKind(element) {
  const classes = new Set((element.attribs?.class ?? '').split(/\s+/));
  if ([...classes].some((name) => /^Heading[4-6]/.test(name))) return 'heading';
  if (classes.has('indent3') || classes.has('indent4')) return 'verse';
  return 'paragraph';
}

function extractDhammapadaStory(html, href) {
  const $ = cheerio.load(html);
  const nodes = $('p').toArray();
  const headingIndex = nodes.findIndex((node) => $(node).hasClass('Heading3'));
  if (headingIndex < 0) throw new Error(`No story heading found in ${href}`);

  const headingClone = $(nodes[headingIndex]).clone();
  headingClone.find('.TT, sup').remove();
  headingClone.find('br').replaceWith('\n');
  const headingLines = headingClone.text().split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const titleEn = (headingLines[0] ?? href)
    .replace(/^[IVXLCDM]+\.\s*\d+\.\s*/, '')
    .replace(/^['“”"]|['“”"]$/g, '')
    .trim();

  const contentEn = [];
  for (const node of nodes.slice(headingIndex + 1)) {
    const className = node.attribs?.class ?? '';
    if (/NavBar|right/.test(className)) continue;
    const text = normalizedText($, node);
    if (!text || /last updated:/i.test(text)) continue;
    contentEn.push({ kind: contentKind(node), text });
  }

  if (contentEn.length < 2) throw new Error(`Insufficient story content in ${href}`);
  const [chapter, item] = href.replace('.htm', '').split('-').map(Number);
  return {
    id: `dhammapada-${href.replace('.htm', '')}`,
    collection: 'dhammapada-commentary',
    number: `${chapter}.${item}`,
    titleEn,
    sourceEn: 'Buddhist Legends: Dhammapada Commentary',
    sourceUrl: new URL(href, DHAMMAPADA_BASE).href,
    attribution: 'Eugene Watson Burlingame (1921), public domain; digital edition by Ancient Buddhist Texts',
    contentEn,
  };
}

function extractJatakaStory(html, storyNumber) {
  const $ = cheerio.load(html);
  const nodes = $('p').toArray();
  const headingIndex = nodes.findIndex((node) => $(node).hasClass('Heading3'));
  if (headingIndex < 0) throw new Error(`No story heading found for Jataka ${storyNumber}`);

  const heading = $(nodes[headingIndex]).clone();
  heading.find('.TT, sup').remove();
  heading.find('br').replaceWith('\n');
  const headingLines = heading.text().split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const extractedTitle = headingLines.find((line) => /Birth Story/i.test(line))
    ?? headingLines.find((line) => !/^Ja\s+\d+\b/i.test(line))
    ?? headingLines[0]?.replace(/^Ja\s+\d+\s+\S+\s*/i, '')
    ?? '';
  const titleEn = extractedTitle.trim().replace(/\s+\(\d+s\)$/i, '') || `Jataka ${storyNumber}`;

  const following = nodes.slice(headingIndex + 1);
  const alternativeIndex = following.findIndex((node) => normalizedText($, node).startsWith('Alternative:'));
  const metadataNodes = alternativeIndex >= 0 ? following.slice(0, alternativeIndex) : following.slice(0, 5);
  const identification = metadataNodes
    .map((node) => normalizedText($, node))
    .find((text) => /Bodhisatta\s*=/.test(text));
  const storyNodes = alternativeIndex >= 0 ? following.slice(alternativeIndex + 1) : following.slice(1);
  const contentEn = [];
  let endingSeen = false;

  for (const node of storyNodes) {
    if ($(node).hasClass('Heading3')) break;
    const className = node.attribs?.class ?? '';
    if (/NavBar|right/.test(className)) continue;
    const text = normalizedText($, node);
    if (!text) continue;

    if (endingSeen && /^(In this connection|Herein|The word\b|In the words)/i.test(text)) break;
    contentEn.push({ kind: contentKind(node), text });
    if (/This story ended|linked the two stories|identified the Birth|identified the characters/i.test(text)) {
      endingSeen = true;
    }
  }

  if (identification) {
    contentEn.push({ kind: 'heading', text: 'Identification of the characters' });
    contentEn.push({ kind: 'paragraph', text: identification });
  }

  if (contentEn.length < 3) throw new Error(`Insufficient story content for Jataka ${storyNumber}`);
  return {
    id: `jataka-${String(storyNumber).padStart(3, '0')}`,
    collection: 'jataka',
    number: String(storyNumber),
    titleEn,
    sourceEn: 'The Jataka: Stories of the Buddha’s Former Births',
    sourceUrl: new URL(`${String(storyNumber).padStart(3, '0')}.htm`, JATAKA_BASE).href,
    attribution: 'Cowell, Chalmers, Rouse, Francis and Neil (1880–1907), public domain; revised digital edition by Ancient Buddhist Texts',
    contentEn,
  };
}

function splitForTranslation(text, maxLength = 3000) {
  if (text.length <= maxLength) return [text];
  const parts = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf('. ', maxLength);
    if (splitAt < maxLength * 0.55) splitAt = remaining.lastIndexOf(' ', maxLength);
    if (splitAt < 1) splitAt = maxLength;
    parts.push(remaining.slice(0, splitAt + 1).trim());
    remaining = remaining.slice(splitAt + 1).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

function decodeHtml(text) {
  return cheerio.load(`<div>${text}</div>`).text().trim();
}

async function translateBatch(texts, attempt = 1) {
  const query = texts.join(`\n\n${TRANSLATION_SEPARATOR}\n\n`);
  const url = `https://translate.google.com/m?sl=en&tl=vi&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  const html = await response.text();
  const match = html.match(/<div class="result-container">([\s\S]*?)<\/div>/);

  if (!response.ok || !match) {
    if (attempt >= 5) throw new Error(`Translation failed: ${response.status}`);
    await wait(attempt * 1500);
    return translateBatch(texts, attempt + 1);
  }

  const translated = decodeHtml(match[1]);
  const parts = translated.split(TRANSLATION_SEPARATOR).map((part) => part.trim());
  if (parts.length !== texts.length) {
    if (texts.length === 1) return [translated];
    const individual = [];
    for (const text of texts) individual.push(...await translateBatch([text]));
    return individual;
  }
  return parts;
}

async function translateStory(story) {
  const sourceItems = [story.titleEn, story.sourceEn, ...story.contentEn.map((item) => item.text)];
  const units = sourceItems.flatMap((text, itemIndex) =>
    splitForTranslation(text).map((part, partIndex) => ({ itemIndex, partIndex, text: part }))
  );
  const translatedUnits = [];
  let batch = [];
  let batchLength = 0;

  async function flush() {
    if (!batch.length) return;
    const results = await translateBatch(batch.map((unit) => unit.text));
    batch.forEach((unit, index) => translatedUnits.push({ ...unit, textVi: results[index] }));
    batch = [];
    batchLength = 0;
    await wait(50);
  }

  for (const unit of units) {
    if (batchLength + unit.text.length > 4000 && batch.length) await flush();
    batch.push(unit);
    batchLength += unit.text.length;
  }
  await flush();

  const translatedItems = sourceItems.map((_, itemIndex) => translatedUnits
    .filter((unit) => unit.itemIndex === itemIndex)
    .sort((a, b) => a.partIndex - b.partIndex)
    .map((unit) => unit.textVi)
    .join(' '));

  return {
    ...story,
    titleVi: VIETNAMESE_TITLE_OVERRIDES.get(story.id) ?? translatedItems[0],
    sourceVi: translatedItems[1],
    contentVi: story.contentEn.map((item, index) => ({ ...item, text: translatedItems[index + 2] })),
  };
}

async function loadDhammapadaTasks() {
  const indexHtml = await fetchText(`${DHAMMAPADA_BASE}index.htm`);
  const $ = cheerio.load(indexHtml);
  const hrefs = [...new Set($('a')
    .map((_, anchor) => $(anchor).attr('href'))
    .get()
    .filter((href) => /^(0[1-9]|1[0-9]|2[0-6])-\d{2}\.htm$/.test(href)))];
  return hrefs.map((href) => ({
    id: `dhammapada-${href.replace('.htm', '')}`,
    url: new URL(href, DHAMMAPADA_BASE).href,
    extract: (html) => extractDhammapadaStory(html, href),
  }));
}

function loadJatakaTasks() {
  return Array.from({ length: 547 }, (_, index) => {
    const number = index + 1;
    const file = `${String(number).padStart(3, '0')}.htm`;
    return {
      id: `jataka-${String(number).padStart(3, '0')}`,
      url: new URL(file, JATAKA_BASE).href,
      extract: (html) => extractJatakaStory(html, number),
    };
  });
}

async function processTask(task, position, total) {
  const outputPath = path.join(STORIES_ROOT, `${task.id}.json`);
  if (fs.existsSync(outputPath)) {
    const existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    const hasCompleteTranslation = existing.titleVi
      && existing.contentVi?.length === existing.contentEn?.length;
    const hasSpecificTitle = !/^Jataka \d+$/i.test(existing.titleEn ?? '');
    if (skipTranslation || (hasCompleteTranslation && hasSpecificTitle)) {
      console.log(`[${position}/${total}] Reusing ${task.id}`);
      return existing;
    }
  }

  console.log(`[${position}/${total}] Fetching ${task.id}`);
  const html = await fetchText(task.url);
  const extracted = task.extract(html);
  const complete = skipTranslation ? extracted : await translateStory(extracted);
  fs.writeFileSync(outputPath, `${JSON.stringify(complete, null, 2)}\n`, 'utf8');
  return complete;
}

let tasks = [];
if (selectedCollection === 'all' || selectedCollection === 'dhammapada') {
  tasks.push(...await loadDhammapadaTasks());
}
if (selectedCollection === 'all' || selectedCollection === 'jataka') {
  tasks.push(...loadJatakaTasks());
}
tasks = tasks.slice(0, limit);

const stories = new Array(tasks.length);
let taskCursor = 0;
const workerCount = Math.min(3, tasks.length);

async function worker() {
  while (taskCursor < tasks.length) {
    const index = taskCursor;
    taskCursor += 1;
    stories[index] = await processTask(tasks[index], index + 1, tasks.length);
  }
}

await Promise.all(Array.from({ length: workerCount }, () => worker()));

const existingFiles = fs.readdirSync(STORIES_ROOT).filter((file) => file.endsWith('.json'));
const indexEntries = existingFiles.map((file) => {
  const story = JSON.parse(fs.readFileSync(path.join(STORIES_ROOT, file), 'utf8'));
  return {
    id: story.id,
    collection: story.collection,
    number: story.number,
    titleVi: story.titleVi ?? story.titleEn,
    titleEn: story.titleEn,
    sourceVi: story.sourceVi ?? story.sourceEn,
    sourceEn: story.sourceEn,
    sourceUrl: story.sourceUrl,
  };
}).sort((a, b) => a.collection.localeCompare(b.collection) || Number.parseFloat(a.number) - Number.parseFloat(b.number));

fs.writeFileSync(INDEX_PATH, `${JSON.stringify(indexEntries, null, 2)}\n`, 'utf8');
console.log(`Imported ${stories.length} stories; index contains ${indexEntries.length} stories.`);
