export interface SheetTabsCallbacks {
  onSelect: (sheetId: string) => void;
  onAdd: () => void;
  onRename: (sheetId: string, name: string) => void;
}

export class SheetTabs {
  private root: HTMLElement;
  private tabsEl: HTMLElement;
  private callbacks: SheetTabsCallbacks;

  constructor(parent: HTMLElement, callbacks: SheetTabsCallbacks) {
    this.callbacks = callbacks;
    this.root = document.createElement("div");
    this.root.className = "esp-sheet-tabs";
    this.tabsEl = document.createElement("div");
    this.tabsEl.className = "esp-tabs-list";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "esp-tab-add";
    addBtn.title = "Add sheet";
    addBtn.textContent = "+";
    addBtn.addEventListener("click", () => this.callbacks.onAdd());
    this.root.appendChild(this.tabsEl);
    this.root.appendChild(addBtn);
    parent.appendChild(this.root);
  }

  render(sheets: { id: string; name: string }[], activeId: string): void {
    this.tabsEl.innerHTML = "";
    sheets.forEach((s) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = `esp-tab${s.id === activeId ? " active" : ""}`;
      tab.textContent = s.name;
      tab.addEventListener("click", () => this.callbacks.onSelect(s.id));
      tab.addEventListener("dblclick", () => {
        const name = prompt("Sheet name:", s.name);
        if (name) this.callbacks.onRename(s.id, name);
      });
      this.tabsEl.appendChild(tab);
    });
  }
}
