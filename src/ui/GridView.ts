import { Workbook } from "../model/Workbook";
import { SelectionRange, CellFormat } from "../types";
import { addressLabel, cellKey, colToLetter, clamp } from "../utils/helpers";
import {
  DEFAULT_COL_WIDTH,
  DEFAULT_ROW_HEIGHT,
  HEADER_COL_WIDTH,
  HEADER_ROW_HEIGHT
} from "../constants";

export interface GridCallbacks {
  onSelectionChange: (sel: SelectionRange) => void;
  onCellEdit: (row: number, col: number, value: string) => void;
  onFormulaBarUpdate: (row: number, col: number, value: string) => void;
}

export class GridView {
  private container: HTMLElement;
  private scrollEl: HTMLElement;
  private tableEl: HTMLTableElement;
  private workbook: Workbook;
  private callbacks: GridCallbacks;
  private sel: SelectionRange = { startRow: 0, startCol: 0, endRow: 0, endCol: 0 };
  private editingCell: { row: number; col: number } | null = null;
  private dragFillStart: { row: number; col: number; value: string } | null = null;
  private visibleRows = 50;
  private visibleCols = 20;
  private scrollRow = 0;
  private scrollCol = 0;

  constructor(parent: HTMLElement, workbook: Workbook, callbacks: GridCallbacks) {
    this.workbook = workbook;
    this.callbacks = callbacks;
    this.container = document.createElement("div");
    this.container.className = "esp-grid-container";
    this.scrollEl = document.createElement("div");
    this.scrollEl.className = "esp-grid-scroll";
    this.tableEl = document.createElement("table");
    this.tableEl.className = "esp-grid-table";
    this.scrollEl.appendChild(this.tableEl);
    this.container.appendChild(this.scrollEl);
    parent.appendChild(this.container);

    this.scrollEl.addEventListener("scroll", () => this.onScroll());
    document.addEventListener("keydown", (e) => this.onKeyDown(e));
  }

  getSelection(): SelectionRange {
    return { ...this.sel };
  }

  setSelection(sel: SelectionRange): void {
    this.sel = { ...sel };
    this.callbacks.onSelectionChange(this.sel);
    this.render();
  }

  refresh(): void {
    this.render();
  }

  private onScroll(): void {
    const sheet = this.workbook.getActiveSheet();
    this.scrollRow = Math.floor(this.scrollEl.scrollTop / DEFAULT_ROW_HEIGHT);
    this.scrollCol = Math.floor((this.scrollEl.scrollLeft - HEADER_COL_WIDTH) / DEFAULT_COL_WIDTH);
    this.scrollRow = clamp(this.scrollRow, 0, sheet.rowCount - this.visibleRows);
    this.scrollCol = clamp(this.scrollCol, 0, sheet.colCount - this.visibleCols);
    this.renderBody();
  }

  render(): void {
    const sheet = this.workbook.getActiveSheet();
    this.visibleRows = Math.min(50, sheet.rowCount);
    this.visibleCols = Math.min(20, sheet.colCount);
    this.tableEl.innerHTML = "";
    this.renderHeader();
    this.renderBody();
    this.updateScrollSize(sheet);
  }

  private updateScrollSize(sheet: { rowCount: number; colCount: number }): void {
    const h = HEADER_ROW_HEIGHT + sheet.rowCount * DEFAULT_ROW_HEIGHT;
    const w = HEADER_COL_WIDTH + sheet.colCount * DEFAULT_COL_WIDTH;
    this.scrollEl.style.minHeight = `${Math.min(h, 600)}px`;
    this.tableEl.style.width = `${w}px`;
  }

  private renderHeader(): void {
    const sheet = this.workbook.getActiveSheet();
    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    const corner = document.createElement("th");
    corner.className = "esp-corner esp-sticky";
    hr.appendChild(corner);
    for (let c = this.scrollCol; c < this.scrollCol + this.visibleCols && c < sheet.colCount; c++) {
      const th = document.createElement("th");
      th.className = "esp-col-header esp-sticky-top";
      th.textContent = colToLetter(c);
      th.style.width = `${sheet.columnWidths[c] || DEFAULT_COL_WIDTH}px`;
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    this.tableEl.appendChild(thead);
  }

  private renderBody(): void {
    const sheet = this.workbook.getActiveSheet();
    let tbody = this.tableEl.querySelector("tbody");
    if (!tbody) {
      tbody = document.createElement("tbody");
      this.tableEl.appendChild(tbody);
    }
    tbody.innerHTML = "";
    const sheetId = sheet.id;

    for (let r = this.scrollRow; r < this.scrollRow + this.visibleRows && r < sheet.rowCount; r++) {
      const tr = document.createElement("tr");
      tr.style.height = `${sheet.rowHeights[r] || DEFAULT_ROW_HEIGHT}px`;
      const rowHeader = document.createElement("th");
      rowHeader.className = "esp-row-header esp-sticky-left";
      rowHeader.textContent = String(r + 1);
      tr.appendChild(rowHeader);

      for (let c = this.scrollCol; c < this.scrollCol + this.visibleCols && c < sheet.colCount; c++) {
        const td = document.createElement("td");
        const key = cellKey(r, c);
        const fmt = { ...this.workbook.getFormat(sheetId, r, c), ...this.workbook.applyConditionalFormatting(sheetId, r, c) };
        const display = this.workbook.getDisplayValue(sheetId, r, c);
        const isSelected = this.isCellInSelection(r, c);
        const isActive = this.sel.startRow === r && this.sel.startCol === c && this.sel.endRow === r && this.sel.endCol === c;

        td.className = [
          "esp-cell",
          isSelected ? "selected" : "",
          isActive ? "active" : "",
          fmt.locked ? "locked" : ""
        ].filter(Boolean).join(" ");
        td.dataset.row = String(r);
        td.dataset.col = String(c);
        this.applyCellStyle(td, fmt);

        if (this.editingCell?.row === r && this.editingCell?.col === c) {
          const input = document.createElement("input");
          input.className = "esp-cell-editor";
          const cell = this.workbook.getCell(sheetId, r, c);
          input.value = cell?.formula || cell?.raw || "";
          input.addEventListener("blur", () => this.commitEdit(r, c, input.value));
          input.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              this.commitEdit(r, c, input.value);
            } else if (ev.key === "Escape") {
              this.editingCell = null;
              this.render();
            }
          });
          td.appendChild(input);
          setTimeout(() => input.focus(), 0);
        } else {
          td.textContent = display;
        }

        td.addEventListener("mousedown", (e) => this.onCellMouseDown(e, r, c));
        td.addEventListener("dblclick", () => this.startEdit(r, c));
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    this.applyFreezePanes(sheet.frozenRows, sheet.frozenCols);
  }

  private applyFreezePanes(frozenRows: number, frozenCols: number): void {
    this.tableEl.querySelectorAll(".esp-frozen-row").forEach((el) => el.classList.remove("esp-frozen-row"));
    this.tableEl.querySelectorAll(".esp-frozen-col").forEach((el) => el.classList.remove("esp-frozen-col"));
    if (frozenRows > 0 || frozenCols > 0) {
      this.container.classList.add("esp-freeze-active");
    } else {
      this.container.classList.remove("esp-freeze-active");
    }
  }

  private applyCellStyle(td: HTMLElement, fmt: CellFormat): void {
    if (fmt.bold) td.style.fontWeight = "bold";
    if (fmt.italic) td.style.fontStyle = "italic";
    if (fmt.underline) td.style.textDecoration = "underline";
    if (fmt.fontSize) td.style.fontSize = `${fmt.fontSize}px`;
    if (fmt.fontColor) td.style.color = fmt.fontColor;
    if (fmt.backgroundColor) td.style.backgroundColor = fmt.backgroundColor;
    if (fmt.align) td.style.textAlign = fmt.align;
    if (fmt.borderTop) td.style.borderTop = fmt.borderTop;
    if (fmt.borderRight) td.style.borderRight = fmt.borderRight;
    if (fmt.borderBottom) td.style.borderBottom = fmt.borderBottom;
    if (fmt.borderLeft) td.style.borderLeft = fmt.borderLeft;
  }

  private isCellInSelection(r: number, c: number): boolean {
    const r0 = Math.min(this.sel.startRow, this.sel.endRow);
    const r1 = Math.max(this.sel.startRow, this.sel.endRow);
    const c0 = Math.min(this.sel.startCol, this.sel.endCol);
    const c1 = Math.max(this.sel.startCol, this.sel.endCol);
    return r >= r0 && r <= r1 && c >= c0 && c <= c1;
  }

  private onCellMouseDown(e: MouseEvent, row: number, col: number): void {
    if (e.shiftKey) {
      this.sel = { ...this.sel, endRow: row, endCol: col };
    } else {
      this.sel = { startRow: row, startCol: col, endRow: row, endCol: col };
      if (e.button === 0 && !this.workbook.getFormat(this.workbook.activeSheetId, row, col).locked) {
        this.dragFillStart = { row, col, value: this.workbook.getCell(this.workbook.activeSheetId, row, col)?.raw || "" };
      }
    }
    this.callbacks.onSelectionChange(this.sel);
    const val = this.workbook.getCell(this.workbook.activeSheetId, row, col);
    this.callbacks.onFormulaBarUpdate(row, col, val?.formula || val?.raw || "");
    this.render();

    const onMouseUp = () => {
      document.removeEventListener("mouseup", onMouseUp);
      this.dragFillStart = null;
    };
    document.addEventListener("mouseup", onMouseUp);
  }

  startEdit(row: number, col: number): void {
    if (this.workbook.getFormat(this.workbook.activeSheetId, row, col).locked) return;
    this.editingCell = { row, col };
    this.render();
  }

  commitEdit(row: number, col: number, value: string): void {
    this.editingCell = null;
    this.callbacks.onCellEdit(row, col, value);
    this.render();
  }

  private onKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" && target.classList.contains("esp-formula-input")) return;

    let { startRow, startCol, endRow, endCol } = this.sel;
    const sheet = this.workbook.getActiveSheet();

    switch (e.key) {
      case "ArrowUp":
        startRow = clamp(startRow - 1, 0, sheet.rowCount - 1);
        endRow = startRow;
        e.preventDefault();
        break;
      case "ArrowDown":
        startRow = clamp(startRow + 1, 0, sheet.rowCount - 1);
        endRow = startRow;
        e.preventDefault();
        break;
      case "ArrowLeft":
        startCol = clamp(startCol - 1, 0, sheet.colCount - 1);
        endCol = startCol;
        e.preventDefault();
        break;
      case "ArrowRight":
        startCol = clamp(startCol + 1, 0, sheet.colCount - 1);
        endCol = startCol;
        e.preventDefault();
        break;
      case "Tab":
        startCol = clamp(startCol + (e.shiftKey ? -1 : 1), 0, sheet.colCount - 1);
        endCol = startCol;
        e.preventDefault();
        break;
      case "Enter":
        if (!this.editingCell) this.startEdit(startRow, startCol);
        e.preventDefault();
        return;
      case "F2":
        this.startEdit(startRow, startCol);
        e.preventDefault();
        return;
      default:
        return;
    }

    this.sel = { startRow, startCol, endRow, endCol };
    this.callbacks.onSelectionChange(this.sel);
    const cell = this.workbook.getCell(this.workbook.activeSheetId, startRow, startCol);
    this.callbacks.onFormulaBarUpdate(startRow, startCol, cell?.formula || cell?.raw || "");
    this.render();
  }

  performDragFill(endRow: number, endCol: number): void {
    if (!this.dragFillStart) return;
    const { row, col, value } = this.dragFillStart;
    const sheetId = this.workbook.activeSheetId;
    const num = parseFloat(value);
    const isNum = !isNaN(num) && !value.startsWith("=");

    if (row === endRow && col !== endCol) {
      const step = endCol > col ? 1 : -1;
      for (let c = col + step; step > 0 ? c <= endCol : c >= endCol; c += step) {
        const fillVal = isNum ? String(num + (c - col) * step) : value;
        this.callbacks.onCellEdit(row, c, fillVal);
      }
    } else if (col === endCol && row !== endRow) {
      const step = endRow > row ? 1 : -1;
      for (let r = row + step; step > 0 ? r <= endRow : r >= endRow; r += step) {
        const fillVal = isNum ? String(num + (r - row) * step) : value;
        this.callbacks.onCellEdit(r, col, fillVal);
      }
    }
    this.render();
  }
}
