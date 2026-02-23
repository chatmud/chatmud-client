class UiState {
  sidebarOpen = $state(false);
  editorOpen = $state(false);
  preferencesOpen = $state(false);
  preferencesSection = $state<string | null>(null);

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleEditor(): void {
    this.editorOpen = !this.editorOpen;
  }

  togglePreferences(): void {
    this.preferencesOpen = !this.preferencesOpen;
    if (!this.preferencesOpen) this.preferencesSection = null;
  }

  openPreferencesTo(section: string): void {
    this.preferencesSection = section;
    this.preferencesOpen = true;
  }
}

export const uiState = new UiState();
