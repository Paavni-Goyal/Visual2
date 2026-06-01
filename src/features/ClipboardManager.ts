import { CellData } from "../types";
import { cellKey } from "../utils/helpers";

export interface ClipboardPayload {
  cells: Map<string, CellData>;
  width: number;
  height: number;
}

export class ClipboardManager {
  private buffer: ClipboardPayload | null = null;

  copy(
    getCell: (row: number, col: number) => CellData | undefined,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number
  ): void {
    const r0 = Math.min(startRow, endRow);
    const r1 = Math.max(startRow, endRow);
    const c0 = Math.min(startCol, endCol);
    const c1 = Math.max(startCol, endCol);
    const cells = new Map<string, CellData>();
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const cell = getCell(r, c);
        if (cell) {
          cells.set(cellKey(r - r0, c - c0), { ...cell, format: { ...cell.format } });
        }
      }
    }
    this.buffer = { cells, width: c1 - c0 + 1, height: r1 - r0 + 1 };
  }

  paste(
    setCell: (row: number, col: number, raw: string, format: CellData["format"]) => void,
    startRow: number,
    startCol: number
  ): void {
    if (!this.buffer) return;
    this.buffer.cells.forEach((cell, key) => {
      const [r, c] = key.split(":").map(Number);
      setCell(startRow + r, startCol + c, cell.raw, cell.format);
    });
  }

  hasData(): boolean {
    return this.buffer !== null;
  }

  toTsv(): string {
    if (!this.buffer) return "";
    const lines: string[] = [];
    for (let r = 0; r < this.buffer.height; r++) {
      const cols: string[] = [];
      for (let c = 0; c < this.buffer.width; c++) {
        const cell = this.buffer.cells.get(cellKey(r, c));
        cols.push(cell?.raw ?? "");
      }
      lines.push(cols.join("\t"));
    }
    return lines.join("\n");
  }

  fromTsv(text: string): ClipboardPayload {
    const rows = text.split(/\r?\n/).filter((l) => l.length > 0);
    const cells = new Map<string, CellData>();
    let maxC = 0;
    rows.forEach((line, ri) => {
      const cols = line.split("\t");
      maxC = Math.max(maxC, cols.length);
      cols.forEach((val, ci) => {
        cells.set(cellKey(ri, ci), { raw: val, format: {} });
      });
    });
    return { cells, width: maxC, height: rows.length };
  }

  setBuffer(payload: ClipboardPayload): void {
    this.buffer = payload;
  }
}
