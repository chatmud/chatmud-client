class UiState {
  sidebarOpen = $state(false);
  editorOpen = $state(false);
  preferencesOpen = $state(false);

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleEditor(): void {
    this.editorOpen = !this.editorOpen;
  }

  togglePreferences(): void {
    this.preferencesOpen = !this.preferencesOpen;
  }
}

export const uiState = new UiState();
