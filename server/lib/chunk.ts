const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + CHUNK_SIZE, text.length);

    if (end < text.length) {
      const lastSpace = text.lastIndexOf(" ", end);
      if (lastSpace > start) end = lastSpace;
    }

    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    start = end;
    if (start < text.length && end < text.length) start -= CHUNK_OVERLAP;
  }

  return chunks;
}
