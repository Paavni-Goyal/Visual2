export function colToLetter(col: number): string {
  let n = col;
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

export function letterToCol(letters: string): number {
  let col = 0;
  const u = letters.toUpperCase();
  for (let i = 0; i < u.length; i++) {
    col = col * 26 + (u.charCodeAt(i) - 64);
  }
  return col - 1;
}

export function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

export function addressLabel(row: number, col: number): string {
  return `${colToLetter(col)}${row + 1}`;
}

export function parseRange(ref: string): { startRow: number; startCol: number; endRow: number; endCol: number } | null {
  const m = ref.trim().toUpperCase().match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
  if (!m) return null;
  const startCol = letterToCol(m[1]);
  const startRow = parseInt(m[2], 10) - 1;
  if (m[3] && m[4]) {
    return {
      startCol,
      startRow,
      endCol: letterToCol(m[3]),
      endRow: parseInt(m[4], 10) - 1
    };
  }
  return { startCol, startRow, endCol: startCol, endRow: startRow };
}

export function escapeHtml(text: string): string {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function generateId(): string {
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function isFormula(value: string): boolean {
  return typeof value === "string" && value.trim().startsWith("=");
}
