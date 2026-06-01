import { CellFormat } from "../types";

export interface RibbonActions {
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onFontSize: (size: number) => void;
  onFontColor: (color: string) => void;
  onFillColor: (color: string) => void;
  onAlign: (align: CellFormat["align"]) => void;
  onNumberFormat: (fmt: CellFormat["numberFormat"]) => void;
  onMerge: () => void;
  onFreeze: () => void;
  onBorder: (style: string) => void;
  onLock: () => void;
  onConditionalFormat: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onExportCsv: () => void;
  onInsertChart: (type: "bar" | "line" | "pie") => void;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onFilter: () => void;
}

export class RibbonToolbar {
  private root: HTMLElement;

  constructor(parent: HTMLElement, actions: RibbonActions) {
    this.root = document.createElement("div");
    this.root.className = "esp-ribbon";

    const groups = [
      this.group("Clipboard", [
        btn("Undo", "↶", actions.onUndo),
        btn("Redo", "↷", actions.onRedo),
        btn("Copy", "Copy", actions.onCopy),
        btn("Paste", "Paste", actions.onPaste)
      ]),
      this.group("Font", [
        btn("B", "Bold", actions.onBold, "esp-btn-bold"),
        btn("I", "Italic", actions.onItalic, "esp-btn-italic"),
        btn("U", "Underline", actions.onUnderline, "esp-btn-underline"),
        selectFontSize(actions.onFontSize),
        colorInput("Font color", actions.onFontColor),
        colorInput("Fill", actions.onFillColor, "#fff8dc")
      ]),
      this.group("Alignment", [
        btn("Left", "⬅", () => actions.onAlign("left")),
        btn("Center", "⬌", () => actions.onAlign("center")),
        btn("Right", "➡", () => actions.onAlign("right")),
        btn("Merge", "Merge", actions.onMerge)
      ]),
      this.group("Number", [
        btn("$", "Currency", () => actions.onNumberFormat("currency")),
        btn("%", "Percent", () => actions.onNumberFormat("percent")),
        btn("0.00", "Decimal", () => actions.onNumberFormat("decimal")),
        btn("#", "Number", () => actions.onNumberFormat("number"))
      ]),
      this.group("Cells", [
        btn("Border", "Border", () => actions.onBorder("1px solid #888")),
        btn("Freeze", "Freeze", actions.onFreeze),
        btn("Lock", "Lock", actions.onLock),
        btn("Cond.", "Conditional", actions.onConditionalFormat)
      ]),
      this.group("Data", [
        btn("A→Z", "Sort asc", actions.onSortAsc),
        btn("Z→A", "Sort desc", actions.onSortDesc),
        btn("Filter", "Filter", actions.onFilter),
        btn("CSV", "Export CSV", actions.onExportCsv)
      ]),
      this.group("Charts", [
        btn("Bar", "Bar chart", () => actions.onInsertChart("bar")),
        btn("Line", "Line chart", () => actions.onInsertChart("line")),
        btn("Pie", "Pie chart", () => actions.onInsertChart("pie"))
      ])
    ];

    groups.forEach((g) => this.root.appendChild(g));
    parent.appendChild(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? "flex" : "none";
  }

  private group(title: string, items: HTMLElement[]): HTMLElement {
    const g = document.createElement("div");
    g.className = "esp-ribbon-group";
    const label = document.createElement("span");
    label.className = "esp-ribbon-group-label";
    label.textContent = title;
    const row = document.createElement("div");
    row.className = "esp-ribbon-group-items";
    items.forEach((i) => row.appendChild(i));
    g.appendChild(row);
    g.appendChild(label);
    return g;
  }
}

function btn(label: string, title: string, onClick: () => void, className = ""): HTMLElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `esp-ribbon-btn ${className}`.trim();
  b.title = title;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function selectFontSize(onChange: (n: number) => void): HTMLElement {
  const sel = document.createElement("select");
  sel.className = "esp-ribbon-select";
  [10, 11, 12, 14, 16, 18, 24].forEach((n) => {
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = String(n);
    sel.appendChild(o);
  });
  sel.value = "11";
  sel.addEventListener("change", () => onChange(parseInt(sel.value, 10)));
  return sel;
}

function colorInput(label: string, onChange: (c: string) => void, defaultColor = "#000000"): HTMLElement {
  const wrap = document.createElement("label");
  wrap.className = "esp-color-wrap";
  wrap.title = label;
  const inp = document.createElement("input");
  inp.type = "color";
  inp.value = defaultColor;
  inp.addEventListener("input", () => onChange(inp.value));
  wrap.appendChild(inp);
  return wrap;
}
