/**
 * Minimal, dependency-free reader for the clean HTML that mammoth emits from a
 * .docx (works identically in Node and the browser — no DOM required).
 *
 * We only need two things: the plain text of non-table paragraphs (bulletin
 * header) and the cell grid of each table.
 */

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&[a-z]+;|&#39;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

/** Strip tags from an HTML fragment, turning block/line breaks into newlines. */
function cellText(html: string): string {
  return decodeEntities(
    html
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\/\s*p\s*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{2,}/g, '\n'),
  ).trim();
}

/** All tables in the HTML, each as a grid of cell strings (rows × cells). */
export function htmlTablesToRows(html: string): string[][][] {
  const tables: string[][][] = [];
  const tableRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tm: RegExpExecArray | null;
  while ((tm = tableRe.exec(html)) !== null) {
    const rows: string[][] = [];
    const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rm: RegExpExecArray | null;
    while ((rm = rowRe.exec(tm[1])) !== null) {
      const cells: string[] = [];
      const cellRe = /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi;
      let cm: RegExpExecArray | null;
      while ((cm = cellRe.exec(rm[1])) !== null) cells.push(cellText(cm[1]));
      if (cells.length) rows.push(cells);
    }
    if (rows.length) tables.push(rows);
  }
  return tables;
}

/** Plain text of the document with tables removed (used for header parsing). */
export function htmlNonTableText(html: string): string {
  const withoutTables = html.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, '\n');
  return cellText(withoutTables);
}
