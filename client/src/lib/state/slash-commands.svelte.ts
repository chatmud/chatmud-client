import { filterCommands } from '../commands/registry';
import type { SlashCommand } from '../commands/registry';

class SlashCommandState {
  isOpen = $state(false);
  query = $state('');
  selectedIndex = $state(0);

  suggestions = $derived(filterCommands(this.query));

  open(query: string): void {
    this.isOpen = true;
    this.query = query;
    this.selectedIndex = 0;
  }

  close(): void {
    this.isOpen = false;
    this.query = '';
    this.selectedIndex = 0;
  }

  selectNext(): void {
    if (this.suggestions.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.suggestions.length;
  }

  selectPrev(): void {
    if (this.suggestions.length === 0) return;
    this.selectedIndex = (this.selectedIndex - 1 + this.suggestions.length) % this.suggestions.length;
  }

  get selectedCommand(): SlashCommand | undefined {
    return this.suggestions[this.selectedIndex];
  }
}

export const slashCommandState = new SlashCommandState();
