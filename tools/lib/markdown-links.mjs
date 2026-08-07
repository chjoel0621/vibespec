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

export function extractRelativeMarkdownLinks(markdown) {
  const links = [];
  for (const match of withoutFencedCode(markdown).matchAll(/(?<!\!)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    if (!external.test(match[1])) links.push(match[1]);
  }
  return links;
}

function githubAnchor(heading) {
  return heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-');
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
        const anchors = new Set(
          [...withoutFencedCode(targetText).matchAll(/^#{1,6}\s+(.+)$/gm)]
            .map((match) => githubAnchor(match[1]))
        );
        if (!anchors.has(anchor.toLowerCase())) {
          errors.push({ file, target: link, reason: 'missing-anchor' });
        }
      }
    }
  }
  return errors;
}
