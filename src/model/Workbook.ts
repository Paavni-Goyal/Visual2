import {
  CellData,
  CellFormat,
  ChartConfig,
  ConditionalRule,
  SelectionRange,
  WorksheetState
} from "../types";
import { DEFAULT_COLS, DEFAULT_ROWS } from "../constants";
import { cellKey, generateId as genId } from "../utils/helpers";
import { FormulaEngine } from "../formula/FormulaEngine";
import { isFormula } from "../utils/helpers";

export class Workbook {
  sheets: WorksheetState[] = [];
  activeSheetId: string;
  formulaEngine: FormulaEngine;
  conditionalRules: ConditionalRule[] = [];
  charts: ChartConfig[] = [];
  selection: SelectionRange = { startRow: 0, startCol: 0, endRow: 0, endCol: 0 };

  constructor(rowCount = DEFAULT_ROWS, colCount = DEFAULT_COLS) {
    this.formulaEngine = new FormulaEngine();
    const id = genId();
    this.sheets = [this.createSheet("Sheet1", id, rowCount, colCount)];
    this.activeSheetId = id;
    this.formulaEngine.initialize([id]);
  }

  createSheet(name: string, id?: string, rowCount = DEFAULT_ROWS, colCount = DEFAULT_COLS): WorksheetState {
    return {
      id: id || genId(),
      name,
      rowCount,
      colCount,
      frozenRows: 0,
      frozenCols: 0,
      cells: new Map(),
      formats: new Map(),
      columnWidths: Array(colCount).fill(88),
      rowHeights: Array(rowCount).fill(24),
      filters: new Map()
    };
  }

  getActiveSheet(): WorksheetState {
    return this.sheets.find((s) => s.id === this.activeSheetId) || this.sheets[0];
  }

  addSheet(name?: string): WorksheetState {
    const n = name || `Sheet${this.sheets.length + 1}`;
    const sheet = this.createSheet(n);
    this.sheets.push(sheet);
    this.formulaEngine.ensureSheet(sheet.id);
    return sheet;
  }

  removeSheet(id: string): boolean {
    if (this.sheets.length <= 1) return false;
    const idx = this.sheets.findIndex((s) => s.id === id);
    if (idx < 0) return false;
    this.sheets.splice(idx, 1);
    if (this.activeSheetId === id) {
      this.activeSheetId = this.sheets[Math.max(0, idx - 1)].id;
    }
    return true;
  }

  setActiveSheet(id: string): void {
    if (this.sheets.some((s) => s.id === id)) {
      this.activeSheetId = id;
    }
  }

  getCell(sheetId: string, row: number, col: number): CellData | undefined {
    const sheet = this.sheets.find((s) => s.id === sheetId);
    if (!sheet) return undefined;
    return sheet.cells.get(cellKey(row, col));
  }

  getFormat(sheetId: string, row: number, col: number): CellFormat {
    const sheet = this.sheets.find((s) => s.id === sheetId)!;
    return sheet.formats.get(cellKey(row, col)) || {};
  }

  setCellRaw(sheetId: string, row: number, col: number, raw: string): void {
    const sheet = this.sheets.find((s) => s.id === sheetId)!;
    const key = cellKey(row, col);
    const fmt = sheet.formats.get(key) || {};
    if (fmt.locked) return;

    let formula: string | undefined;
    let valueToSet: string | number = raw;

    if (isFormula(raw)) {
      formula = raw;
      valueToSet = raw;
    }

    sheet.cells.set(key, { raw, formula, format: fmt });
    this.formulaEngine.setCellValue(sheetId, row, col, valueToSet);
  }

  getDisplayValue(sheetId: string, row: number, col: number): string {
    const sheet = this.sheets.find((s) => s.id === sheetId)!;
    const key = cellKey(row, col);
    const cell = sheet.cells.get(key);
    const fmt = sheet.formats.get(key) || {};
    let display = this.formulaEngine.getDisplayValue(sheetId, row, col);
    if (!display && cell) display = cell.raw;
    if (fmt.numberFormat && fmt.numberFormat !== "general") {
      display = FormulaEngine.formatWithNumberFormat(display, fmt.numberFormat, fmt.decimalPlaces ?? 2);
    }
    return display;
  }

  setFormat(sheetId: string, range: SelectionRange, partial: Partial<CellFormat>): void {
    const sheet = this.sheets.find((s) => s.id === sheetId)!;
    const r0 = Math.min(range.startRow, range.endRow);
    const r1 = Math.max(range.startRow, range.endRow);
    const c0 = Math.min(range.startCol, range.endCol);
    const c1 = Math.max(range.startCol, range.endCol);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const key = cellKey(r, c);
        const existing = sheet.formats.get(key) || {};
        sheet.formats.set(key, { ...existing, ...partial });
        const cell = sheet.cells.get(key);
        if (cell) cell.format = sheet.formats.get(key)!;
      }
    }
  }

  mergeCells(sheetId: string, range: SelectionRange): void {
    const root = { row: Math.min(range.startRow, range.endRow), col: Math.min(range.startCol, range.endCol) };
    this.setFormat(sheetId, range, { merged: true, mergeRoot: root });
  }

  applyConditionalFormatting(sheetId: string, row: number, col: number): Partial<CellFormat> {
    const val = parseFloat(this.getDisplayValue(sheetId, row, col));
    const text = this.getDisplayValue(sheetId, row, col);
    for (const rule of this.conditionalRules) {
      let match = false;
      switch (rule.type) {
        case "greater":
          match = !isNaN(val) && val > Number(rule.value1);
          break;
        case "less":
          match = !isNaN(val) && val < Number(rule.value1);
          break;
        case "between":
          match = !isNaN(val) && val >= Number(rule.value1) && val <= Number(rule.value2);
          break;
        case "equal":
          match = text === String(rule.value1);
          break;
        case "text":
          match = text.toLowerCase().includes(String(rule.value1).toLowerCase());
          break;
      }
      if (match) {
        return { backgroundColor: rule.backgroundColor, fontColor: rule.fontColor };
      }
    }
    return {};
  }

  sortColumn(sheetId: string, col: number, ascending = true): void {
    const sheet = this.sheets.find((s) => s.id === sheetId)!;
    sheet.sortCol = col;
    sheet.sortAsc = ascending;
    const rows: { row: number; sortKey: string }[] = [];
    for (let r = 0; r < sheet.rowCount; r++) {
      const v = this.getDisplayValue(sheetId, r, col);
      if (v) rows.push({ row: r, sortKey: v });
    }
    rows.sort((a, b) => {
      const na = parseFloat(a.sortKey);
      const nb = parseFloat(b.sortKey);
      const cmp = !isNaN(na) && !isNaN(nb) ? na - nb : a.sortKey.localeCompare(b.sortKey);
      return ascending ? cmp : -cmp;
    });
    const snapshot = this.snapshotRows(sheetId, rows.map((x) => x.row));
    this.restoreRows(sheetId, snapshot, 0);
  }

  private snapshotRows(sheetId: string, rowIndices: number[]): Map<string, CellData>[] {
    const sheet = this.sheets.find((s) => s.id === sheetId)!;
    return rowIndices.map((r) => {
      const m = new Map<string, CellData>();
      for (let c = 0; c < sheet.colCount; c++) {
        const k = cellKey(r, c);
        const cell = sheet.cells.get(k);
        if (cell) m.set(String(c), { ...cell });
      }
      return m;
    });
  }

  private restoreRows(sheetId: string, snapshots: Map<string, CellData>[], startRow: number): void {
    const sheet = this.sheets.find((s) => s.id === sheetId)!;
    snapshots.forEach((snap, i) => {
      const r = startRow + i;
      snap.forEach((cell, cStr) => {
        const c = parseInt(cStr, 10);
        this.setCellRaw(sheetId, r, c, cell.raw);
        sheet.formats.set(cellKey(r, c), cell.format);
      });
    });
  }

  importMatrix(sheetId: string, matrix: (string | number | null)[][], startRow = 0, startCol = 0): void {
    matrix.forEach((row, ri) => {
      row.forEach((val, ci) => {
        if (val !== null && val !== "") {
          this.setCellRaw(sheetId, startRow + ri, startCol + ci, String(val));
        }
      });
    });
  }

  exportCsv(sheetId: string): string {
    const sheet = this.sheets.find((s) => s.id === sheetId)!;
    const lines: string[] = [];
    for (let r = 0; r < sheet.rowCount; r++) {
      const cols: string[] = [];
      let hasData = false;
      for (let c = 0; c < sheet.colCount; c++) {
        const v = this.getDisplayValue(sheetId, r, c);
        if (v) hasData = true;
        const escaped = v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
        cols.push(escaped);
      }
      if (hasData) lines.push(cols.join(","));
      else if (lines.length > 0) break;
    }
    return lines.join("\n");
  }

  getRangeValues(sheetId: string, range: SelectionRange): number[][] {
    const r0 = Math.min(range.startRow, range.endRow);
    const r1 = Math.max(range.startRow, range.endRow);
    const c0 = Math.min(range.startCol, range.endCol);
    const c1 = Math.max(range.startCol, range.endCol);
    const data: number[][] = [];
    for (let r = r0; r <= r1; r++) {
      const row: number[] = [];
      for (let c = c0; c <= c1; c++) {
        const v = parseFloat(this.getDisplayValue(sheetId, r, c));
        row.push(isNaN(v) ? 0 : v);
      }
      data.push(row);
    }
    return data;
  }
}
