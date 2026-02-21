import type { EditSession } from '../types/editor';

class EditorState {
  sessions = $state<EditSession[]>([]);
  activeSessionId = $state<string | null>(null);

  readonly activeSession = $derived(
    this.sessions.find((s) => s.id === this.activeSessionId) ?? null
  );

  readonly hasOpenSessions = $derived(this.sessions.length > 0);

  openSession(session: EditSession): void {
    // Replace existing session with same reference, or add new
    const existing = this.sessions.findIndex((s) => s.reference === session.reference);
    if (existing >= 0) {
      this.sessions = this.sessions.map((s, i) => (i === existing ? session : s));
    } else {
      this.sessions = [...this.sessions, session];
    }
    this.activeSessionId = session.id;
  }

  closeSession(id: string): void {
    this.sessions = this.sessions.filter((s) => s.id !== id);
    if (this.activeSessionId === id) {
      this.activeSessionId = this.sessions.length > 0 ? this.sessions[0].id : null;
    }
  }

  updateContent(id: string, content: string): void {
    this.sessions = this.sessions.map((s) =>
      s.id === id ? { ...s, content, dirty: content !== s.originalContent } : s
    );
  }

  reset(): void {
    this.sessions = [];
    this.activeSessionId = null;
  }
}

export const editorState = new EditorState();
