interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

class PwaState {
  installPrompt = $state<BeforeInstallPromptEvent | null>(null);

  get isInstalled(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    );
  }

  get canInstall(): boolean {
    return !this.isInstalled && this.installPrompt !== null;
  }

  async triggerInstall(): Promise<void> {
    if (!this.installPrompt) return;
    await this.installPrompt.prompt();
    this.installPrompt = null;
  }
}

export const pwaState = new PwaState();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  pwaState.installPrompt = e as BeforeInstallPromptEvent;
});

window.addEventListener('appinstalled', () => {
  pwaState.installPrompt = null;
});
