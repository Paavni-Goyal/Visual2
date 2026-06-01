"use strict";

import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import DataView = powerbi.DataView;

import { Workbook } from "./model/Workbook";
import { RibbonToolbar, RibbonActions } from "./ui/RibbonToolbar";
import { FormulaBar } from "./ui/FormulaBar";
import { SheetTabs } from "./ui/SheetTabs";
import { GridView } from "./ui/GridView";
import { ChartManager } from "./charts/ChartManager";
import { ClipboardManager } from "./features/ClipboardManager";
import { UndoRedoManager } from "./features/UndoRedoManager";
import { PowerBIDataBinder } from "./data/PowerBIDataBinder";
import { parseVisualSettings } from "./settings";
import { VisualSettings, SelectionRange, ThemeMode } from "./types";
import { downloadCsv, generateId } from "./utils/helpers";

export class Visual implements IVisual {
  private target: HTMLElement;
  private host: powerbi.extensibility.visual.IVisualHost;
  private workbook: Workbook;
  private settings: VisualSettings;
  private clipboard: ClipboardManager;
  private undoRedo: UndoRedoManager;
  private gridView: GridView | null = null;
  private formulaBar: FormulaBar | null = null;
  private ribbon: RibbonToolbar | null = null;
  private sheetTabs: SheetTabs | null = null;
  private chartManager: ChartManager | null = null;
  private chartPanel: HTMLElement | null = null;
  private rootEl: HTMLElement;
  private mainEl: HTMLElement;
  private lastDataView: DataView | undefined;
  private editingFromFormulaBar = false;

  constructor(options?: VisualConstructorOptions) {
    if (!options) {
      throw new Error("Visual constructor options are required.");
    }
    this.target = options.element;
    this.host = options.host;
    this.settings = parseVisualSettings(undefined);
    this.workbook = new Workbook(this.settings.defaultRowCount, this.settings.defaultColCount);
    this.clipboard = new ClipboardManager();
    this.undoRedo = new UndoRedoManager();

    this.rootEl = document.createElement("div");
    this.rootEl.className = "esp-root esp-light";
    this.target.appendChild(this.rootEl);

    this.mainEl = document.createElement("div");
    this.mainEl.className = "esp-main";
    this.rootEl.appendChild(this.mainEl);

    this.buildUi();
    this.applyTheme(this.settings.themeMode);
    this.target.addEventListener("keydown", (e) => this.onGlobalKeyDown(e as KeyboardEvent));
  }

  private onGlobalKeyDown(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "c") {
        e.preventDefault();
        this.copySelection();
      } else if (e.key === "v") {
        e.preventDefault();
        this.pasteSelection();
      } else if (e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) this.handleRedo();
        else this.handleUndo();
      }
    }
  }

  private buildUi(): void {
    const ribbonHost = document.createElement("div");
    ribbonHost.className = "esp-ribbon-host";
    this.mainEl.appendChild(ribbonHost);

    const formulaHost = document.createElement("div");
    formulaHost.className = "esp-formula-host";
    this.mainEl.appendChild(formulaHost);

    const content = document.createElement("div");
    content.className = "esp-content";
    const gridHost = document.createElement("div");
    gridHost.className = "esp-grid-host";
    this.chartPanel = document.createElement("div");
    this.chartPanel.className = "esp-chart-panel";
    content.appendChild(gridHost);
    content.appendChild(this.chartPanel);
    this.mainEl.appendChild(content);

    const tabsHost = document.createElement("div");
    tabsHost.className = "esp-tabs-host";
    this.mainEl.appendChild(tabsHost);

    const actions = this.createRibbonActions();

    this.ribbon = new RibbonToolbar(ribbonHost, actions);
    this.formulaBar = new FormulaBar(
      formulaHost,
      (value) => this.commitFormulaBar(value),
      (value) => this.onFormulaBarChange(value)
    );

    this.gridView = new GridView(gridHost, this.workbook, {
      onSelectionChange: (sel) => this.onSelectionChange(sel),
      onCellEdit: (row, col, value) => this.setCellWithUndo(row, col, value),
      onFormulaBarUpdate: (row, col, value) => {
        this.formulaBar?.setAddress(row, col);
        this.formulaBar?.setValue(value, this.editingFromFormulaBar);
      }
    });

    this.chartManager = new ChartManager(this.chartPanel);

    this.sheetTabs = new SheetTabs(tabsHost, {
      onSelect: (id) => {
        this.workbook.setActiveSheet(id);
        this.refreshAll();
      },
      onAdd: () => {
        const sheet = this.workbook.addSheet();
        this.workbook.setActiveSheet(sheet.id);
        this.refreshAll();
      },
      onRename: (id, name) => {
        const s = this.workbook.sheets.find((x) => x.id === id);
        if (s) s.name = name;
        this.refreshTabs();
      }
    });

    this.refreshAll();
  }

  private createRibbonActions(): RibbonActions {
    return {
      onBold: () => this.applyFormat({ bold: true }),
      onItalic: () => this.applyFormat({ italic: true }),
      onUnderline: () => this.applyFormat({ underline: true }),
      onFontSize: (size) => this.applyFormat({ fontSize: size }),
      onFontColor: (color) => this.applyFormat({ fontColor: color }),
      onFillColor: (color) => this.applyFormat({ backgroundColor: color }),
      onAlign: (align) => this.applyFormat({ align }),
      onNumberFormat: (numberFormat) => this.applyFormat({ numberFormat }),
      onMerge: () => {
        const sel = this.gridView?.getSelection();
        if (sel) this.workbook.mergeCells(this.workbook.activeSheetId, sel);
        this.gridView?.refresh();
      },
      onFreeze: () => {
        const sheet = this.workbook.getActiveSheet();
        const sel = this.gridView?.getSelection();
        if (sel) {
          sheet.frozenRows = sel.endRow + 1;
          sheet.frozenCols = sel.endCol + 1;
        }
        this.gridView?.refresh();
      },
      onBorder: (style) => {
        this.applyFormat({
          borderTop: style,
          borderRight: style,
          borderBottom: style,
          borderLeft: style
        });
      },
      onLock: () => this.applyFormat({ locked: true }),
      onConditionalFormat: () => {
        const val = prompt("Highlight cells greater than (number):", "0");
        if (val !== null) {
          this.workbook.conditionalRules.push({
            id: generateId(),
            range: "A1:Z100",
            type: "greater",
            value1: parseFloat(val) || 0,
            backgroundColor: "#fff3cd",
            fontColor: "#856404"
          });
          this.gridView?.refresh();
        }
      },
      onUndo: () => this.handleUndo(),
      onRedo: () => this.handleRedo(),
      onCopy: () => this.copySelection(),
      onPaste: () => this.pasteSelection(),
      onExportCsv: () => {
        const csv = this.workbook.exportCsv(this.workbook.activeSheetId);
        downloadCsv(`${this.workbook.getActiveSheet().name}.csv`, csv);
      },
      onInsertChart: (type) => this.insertChart(type),
      onSortAsc: () => {
        const sel = this.gridView?.getSelection();
        if (sel) this.workbook.sortColumn(this.workbook.activeSheetId, sel.startCol, true);
        this.gridView?.refresh();
      },
      onSortDesc: () => {
        const sel = this.gridView?.getSelection();
        if (sel) this.workbook.sortColumn(this.workbook.activeSheetId, sel.startCol, false);
        this.gridView?.refresh();
      },
      onFilter: () => {
        const sel = this.gridView?.getSelection();
        if (sel) {
          const sheet = this.workbook.getActiveSheet();
          sheet.filters.set(sel.startCol, { enabled: true, values: new Set() });
        }
        this.gridView?.refresh();
      }
    };
  }

  public update(options: VisualUpdateOptions): void {
    const dataView = options.dataViews?.[0];
    this.lastDataView = dataView;
    this.settings = parseVisualSettings(dataView);
    this.applyTheme(this.settings.themeMode);
    this.ribbon?.setVisible(this.settings.showRibbon);

    if (dataView) {
      this.bindPowerBIData(dataView);
    }

    this.gridView?.refresh();
    this.refreshTabs();
  }

  private bindPowerBIData(dataView: DataView): void {
    const dataset = PowerBIDataBinder.extract(dataView);
    if (!dataset || dataset.rows.length === 0) return;

    const matrix = PowerBIDataBinder.toMatrix(dataset, dataset.categoryLabels.length > 0);
    const sheet = this.workbook.getActiveSheet();
    this.workbook.importMatrix(sheet.id, matrix, 0, 0);
    this.workbook.formulaEngine.bulkSetSheet(sheet.id, matrix);
    this.gridView?.refresh();
  }

  private applyTheme(mode: ThemeMode): void {
    let resolved: "light" | "dark" = mode === "dark" ? "dark" : "light";
    if (mode === "auto") {
      const bg = this.host.colorPalette?.background?.value;
      if (bg) {
        const hex = bg.replace("#", "");
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        resolved = luminance < 0.5 ? "dark" : "light";
      }
    }
    this.rootEl.classList.remove("esp-light", "esp-dark");
    this.rootEl.classList.add(resolved === "dark" ? "esp-dark" : "esp-light");
    document.body.classList.toggle("esp-dark", resolved === "dark");
    this.rootEl.style.setProperty("--esp-accent", this.settings.accentColor);
  }

  private onSelectionChange(sel: SelectionRange): void {
    this.workbook.selection = sel;
    this.formulaBar?.setAddress(sel.startRow, sel.startCol);
    const cell = this.workbook.getCell(this.workbook.activeSheetId, sel.startRow, sel.startCol);
    this.formulaBar?.setValue(cell?.formula || cell?.raw || "");
  }

  private setCellWithUndo(row: number, col: number, value: string): void {
    const sheetId = this.workbook.activeSheetId;
    const prev = this.workbook.getCell(sheetId, row, col)?.raw ?? "";
    this.undoRedo.push({ type: "cell", payload: { sheetId, row, col, prev, next: value } });
    this.workbook.setCellRaw(sheetId, row, col, value);
    this.gridView?.refresh();
  }

  private commitFormulaBar(value: string): void {
    const sel = this.gridView?.getSelection();
    if (!sel) return;
    this.setCellWithUndo(sel.startRow, sel.startCol, value);
    this.formulaBar?.setValue(value);
    this.editingFromFormulaBar = false;
  }

  private onFormulaBarChange(value: string): void {
    this.editingFromFormulaBar = true;
    const sel = this.gridView?.getSelection();
    if (sel) {
      this.workbook.setCellRaw(this.workbook.activeSheetId, sel.startRow, sel.startCol, value);
      this.gridView?.refresh();
    }
  }

  private applyFormat(partial: Parameters<Workbook["setFormat"]>[2]): void {
    const sel = this.gridView?.getSelection();
    if (sel) {
      this.workbook.setFormat(this.workbook.activeSheetId, sel, partial);
      this.gridView?.refresh();
    }
  }

  private copySelection(): void {
    const sel = this.gridView?.getSelection();
    if (!sel) return;
    const sheetId = this.workbook.activeSheetId;
    this.clipboard.copy(
      (r, c) => this.workbook.getCell(sheetId, r, c),
      sel.startRow,
      sel.startCol,
      sel.endRow,
      sel.endCol
    );
  }

  private pasteSelection(): void {
    const sel = this.gridView?.getSelection();
    if (!sel) return;
    const sheetId = this.workbook.activeSheetId;
    this.clipboard.paste((row, col, raw, format) => {
      this.workbook.setCellRaw(sheetId, row, col, raw);
      this.workbook.setFormat(sheetId, { startRow: row, startCol: col, endRow: row, endCol: col }, format);
    }, sel.startRow, sel.startCol);
    this.gridView?.refresh();
  }

  private handleUndo(): void {
    const action = this.undoRedo.undo();
    if (action?.type === "cell") {
      const p = action.payload as { sheetId: string; row: number; col: number; prev: string };
      this.workbook.setCellRaw(p.sheetId, p.row, p.col, p.prev);
      this.gridView?.refresh();
    }
  }

  private handleRedo(): void {
    const action = this.undoRedo.redo();
    if (action?.type === "cell") {
      const p = action.payload as { sheetId: string; row: number; col: number; next: string };
      this.workbook.setCellRaw(p.sheetId, p.row, p.col, p.next);
      this.gridView?.refresh();
    }
  }

  private insertChart(type: "bar" | "line" | "pie"): void {
    const sel = this.gridView?.getSelection();
    if (!sel || !this.chartManager) return;
    const sheetId = this.workbook.activeSheetId;
    const data = this.workbook.getRangeValues(sheetId, sel);
    const labels: string[] = data[0]?.map((_, i) => `S${i + 1}`) || [];
    const values = data.length > 1 ? data[1] : data[0] || [];
    const config = {
      id: generateId(),
      type,
      sheetId,
      range: "",
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Chart`
    };
    this.workbook.charts.push(config);
    this.chartManager.render(config, labels, values);
  }

  private refreshAll(): void {
    this.gridView?.render();
    this.refreshTabs();
  }

  private refreshTabs(): void {
    this.sheetTabs?.render(
      this.workbook.sheets.map((s) => ({ id: s.id, name: s.name })),
      this.workbook.activeSheetId
    );
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return { cards: [] };
  }

  public destroy(): void {
    this.workbook.formulaEngine.destroy();
  }
}
