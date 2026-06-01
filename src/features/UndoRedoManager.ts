import { MAX_UNDO } from "../constants";
import { UndoAction } from "../types";

export class UndoRedoManager {
  private undoStack: UndoAction[] = [];
  private redoStack: UndoAction[] = [];

  push(action: UndoAction): void {
    this.undoStack.push(action);
    if (this.undoStack.length > MAX_UNDO) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo(): UndoAction | undefined {
    const action = this.undoStack.pop();
    if (action) this.redoStack.push(action);
    return action;
  }

  redo(): UndoAction | undefined {
    const action = this.redoStack.pop();
    if (action) this.undoStack.push(action);
    return action;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
