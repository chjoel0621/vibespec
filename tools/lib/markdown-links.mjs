import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const external = /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i;

function withoutFencedCode(markdown) {
  const lines = markdown.split(/(?<=\n)/);
  let fence;

  return lines.filter((line) => {
    const content = line.replace(/\r?\n$/, '');
    if (fence) {
      const closing = new RegExp(`^ {0,3}${fence.marker}{${fence.length},}[ \\t]*$`);
      if (closing.test(content)) fence = undefined;
      return false;
    }

    const opening = content.match(/^ {0,3}(`{3,}|~{3,})/);
    if (opening) {
      fence = { marker: opening[1][0], length: opening[1].length };
      return false;
    }

    return true;
  }).join('');
}

function maskInlineCode(markdown) {
  let result = '';
  let index = 0;

  while (index < markdown.length) {
    if (markdown[index] !== '`') {
      result += markdown[index];
      index += 1;
      continue;
    }

    let markerLength = 1;
    while (markdown[index + markerLength] === '`') markerLength += 1;
    const marker = '`'.repeat(markerLength);
    let closing = markdown.indexOf(marker, index + markerLength);
    while (closing !== -1 && (markdown[closing - 1] === '`' || markdown[closing + markerLength] === '`')) {
      closing = markdown.indexOf(marker, closing + markerLength);
    }

    if (closing === -1) {
      result += marker;
      index += markerLength;
      continue;
    }

    const end = closing + markerLength;
    result += markdown.slice(index, end).replace(/[^\r\n]/g, ' ');
    index = end;
  }

  return result;
}

function unescapeDestination(destination) {
  return destination.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1');
}

function titleEnd(markdown, index) {
  while (/\s/.test(markdown[index] ?? '')) index += 1;
  if (markdown[index] === ')') return index;

  const opener = markdown[index];
  const closer = opener === '(' ? ')' : opener;
  if (!['"', "'", '('].includes(opener)) return -1;
  index += 1;
  while (index < markdown.length) {
    if (markdown[index] === '\\') {
      index += 2;
      continue;
    }
    if (markdown[index] === closer) {
      index += 1;
      while (/\s/.test(markdown[index] ?? '')) index += 1;
      return markdown[index] === ')' ? index : -1;
    }
    index += 1;
  }
  return -1;
}

function destinationAt(markdown, start) {
  let index = start;
  while (markdown[index] === ' ' || markdown[index] === '\t') index += 1;

  if (markdown[index] === '<') {
    const destinationStart = ++index;
    while (index < markdown.length && markdown[index] !== '>' && !/[\r\n]/.test(markdown[index])) {
      if (markdown[index] === '\\') index += 1;
      index += 1;
    }
    if (markdown[index] !== '>') return undefined;
    const destination = unescapeDestination(markdown.slice(destinationStart, index));
    const end = titleEnd(markdown, index + 1);
    return end === -1 ? undefined : { destination, end };
  }

  const destinationStart = index;
  let depth = 0;
  while (index < markdown.length) {
    const character = markdown[index];
    if (character === '\\') {
      index += 2;
      continue;
    }
    if (character === '(') {
      depth += 1;
      index += 1;
      continue;
    }
    if (character === ')') {
      if (depth === 0) {
        return {
          destination: unescapeDestination(markdown.slice(destinationStart, index)),
          end: index
        };
      }
      depth -= 1;
      index += 1;
      continue;
    }
    if (/\s/.test(character) && depth === 0) {
      const destination = unescapeDestination(markdown.slice(destinationStart, index));
      const end = titleEnd(markdown, index);
      return end === -1 ? undefined : { destination, end };
    }
    index += 1;
  }
  return undefined;
}

function labelEndAt(markdown, start) {
  let index = start + 1;
  let depth = 1;

  while (index < markdown.length) {
    if (markdown[index] === '\\') {
      index += 2;
      continue;
    }
    if (markdown[index] === '[') depth += 1;
    if (markdown[index] === ']') {
      depth -= 1;
      if (depth === 0) return index;
    }
    index += 1;
  }
  return -1;
}

export function extractRelativeMarkdownLinks(markdown) {
  const source = maskInlineCode(withoutFencedCode(markdown));
  const links = [];
  let index = 0;
  while (index < source.length) {
    if (source[index] !== '[' || source[index - 1] === '!') {
      index += 1;
      continue;
    }
    const labelEnd = labelEndAt(source, index);
    if (labelEnd === -1 || source[labelEnd + 1] !== '(') {
      index = labelEnd === -1 ? index + 1 : labelEnd + 1;
      continue;
    }
    const parsed = destinationAt(source, labelEnd + 2);
    if (!parsed) {
      index = labelEnd + 2;
      continue;
    }
    if (parsed.destination && !external.test(parsed.destination)) links.push(parsed.destination);
    index = parsed.end + 1;
  }
  return links;
}

function githubAnchor(heading) {
  return heading.replace(/\s+#+\s*$/, '').trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-');
}

function githubAnchors(markdown) {
  const anchors = new Set();
  for (const match of withoutFencedCode(markdown).matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const base = githubAnchor(match[1]);
    let anchor = base;
    let suffix = 0;
    while (anchors.has(anchor)) {
      suffix += 1;
      anchor = `${base}-${suffix}`;
    }
    anchors.add(anchor);
  }
  return anchors;
}

export async function validateMarkdownFiles(repoRoot, files = []) {
  const errors = [];
  for (const file of files) {
    const markdown = await readFile(resolve(repoRoot, file), 'utf8');
    for (const link of extractRelativeMarkdownLinks(markdown)) {
      const [encodedPath, anchor] = link.split('#', 2);
      const target = resolve(repoRoot, dirname(file), decodeURIComponent(encodedPath));
      try {
        await access(target);
      } catch {
        errors.push({ file, target: link, reason: 'missing-target' });
        continue;
      }

      if (anchor && target.toLowerCase().endsWith('.md')) {
        const targetText = await readFile(target, 'utf8');
        const anchors = githubAnchors(targetText);
        if (!anchors.has(anchor.toLowerCase())) {
          errors.push({ file, target: link, reason: 'missing-anchor' });
        }
      }
    }
  }
  return errors;
}
