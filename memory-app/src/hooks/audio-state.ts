/** Keep text requests within the local speech runtime's 500-character limit. */
export function speechChunks(text: string, limit = 450): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const character of text.trim()) {
    current += character;
    if (current.length >= limit) {
      chunks.push(current);
      current = "";
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
/** A retry must keep its id when the submitted text has not changed. */
export function turnIdentity(
  previous: { text: string; id: string } | null,
  text: string,
  createId: () => string,
) {
  return previous?.text === text ? previous : { text, id: createId() };
}
