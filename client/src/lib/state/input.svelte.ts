class InputState {
  currentInput = $state('');
  history = $state<string[]>([]);
  historyIndex = $state(-1);
  echoMode = $state(true); // false = password mode

  private savedInput = '';

  addToHistory(command: string): void {
    if (command.trim() && (this.history.length === 0 || this.history[this.history.length - 1] !== command)) {
      this.history = [...this.history, command];
    }
    this.historyIndex = -1;
    this.savedInput = '';
  }

  navigateHistory(direction: 'up' | 'down'): string {
    if (this.history.length === 0) return this.currentInput;

    if (direction === 'up') {
      if (this.historyIndex === -1) {
        this.savedInput = this.currentInput;
        this.historyIndex = this.history.length - 1;
      } else if (this.historyIndex > 0) {
        this.historyIndex--;
      }
      return this.history[this.historyIndex];
    } else {
      if (this.historyIndex === -1) return this.currentInput;
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        return this.history[this.historyIndex];
      } else {
        this.historyIndex = -1;
        return this.savedInput;
      }
    }
  }
}

export const inputState = new InputState();
