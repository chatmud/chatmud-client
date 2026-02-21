import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

(globalThis as Record<string, unknown>).MonacoEnvironment = {
  getWorker(_: string, _label: string) {
    return new editorWorker();
  },
};
