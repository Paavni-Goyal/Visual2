import { addressLabel } from "../utils/helpers";

export class FormulaBar {
  private root: HTMLElement;
  private addressEl: HTMLElement;
  private inputEl: HTMLInputElement;
  private onCommit: (value: string) => void;
  private onChange: (value: string) => void;

  constructor(
    parent: HTMLElement,
    onCommit: (value: string) => void,
    onChange: (value: string) => void
  ) {
    this.onCommit = onCommit;
    this.onChange = onChange;
    this.root = document.createElement("div");
    this.root.className = "esp-formula-bar";

    this.addressEl = document.createElement("div");
    this.addressEl.className = "esp-cell-address";
    this.addressEl.textContent = "A1";

    const fx = document.createElement("span");
    fx.className = "esp-fx";
    fx.textContent = "fx";

    this.inputEl = document.createElement("input");
    this.inputEl.type = "text";
    this.inputEl.className = "esp-formula-input";
    this.inputEl.placeholder = "Enter value or formula...";
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.onCommit(this.inputEl.value);
      }
    });
    this.inputEl.addEventListener("input", () => this.onChange(this.inputEl.value));

    this.root.appendChild(this.addressEl);
    this.root.appendChild(fx);
    this.root.appendChild(this.inputEl);
    parent.appendChild(this.root);
  }

  setAddress(row: number, col: number): void {
    this.addressEl.textContent = addressLabel(row, col);
  }

  setValue(value: string, editing = false): void {
    if (!editing || document.activeElement !== this.inputEl) {
      this.inputEl.value = value;
    }
  }

  focus(): void {
    this.inputEl.focus();
    this.inputEl.select();
  }

  getValue(): string {
    return this.inputEl.value;
  }
}
