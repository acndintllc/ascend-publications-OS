/* Reading stats (PTL-008 §4, Phase 3D). */
import type { ACABlock, ACAInline, ReadingStats } from "../schema/aca";

const WPM = 220;

function inlineText(nodes: ACAInline[]): string {
  return nodes
    .map((n) => {
      switch (n.kind) {
        case "text":
          return n.value;
        case "code":
          return n.value;
        case "emphasis":
        case "strong":
        case "link":
          return inlineText(n.children);
        default:
          return "";
      }
    })
    .join("");
}

function blockText(blocks: ACABlock[]): { text: string; paragraphs: number } {
  let text = "";
  let paragraphs = 0;
  for (const b of blocks) {
    switch (b.kind) {
      case "body":
      case "dialogue":
      case "pullquote":
        text += " " + inlineText(b.children);
        paragraphs += 1;
        break;
      case "chapter-opener":
        text += " " + inlineText(b.title);
        break;
      case "section": {
        if (b.title) text += " " + inlineText(b.title);
        const inner = blockText(b.children);
        text += " " + inner.text;
        paragraphs += inner.paragraphs;
        break;
      }
      case "sidebar":
      case "callout":
      case "report": {
        const inner = blockText(b.children);
        text += " " + inner.text;
        paragraphs += inner.paragraphs;
        break;
      }
      case "citation":
        text += " " + b.value;
        break;
      default:
        break;
    }
  }
  return { text, paragraphs };
}

export function computeReadingStats(blocks: ACABlock[]): ReadingStats {
  const { text, paragraphs } = blockText(blocks);
  const words = (text.trim().match(/\S+/g) ?? []).length;
  return {
    words,
    characters: text.length,
    readingMinutes: Math.max(1, Math.round(words / WPM)),
    paragraphs,
  };
}
