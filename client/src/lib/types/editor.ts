/** Types of edit content */
export type EditContentType = 'moo-code' | 'string-list' | 'string';

/** A single edit session */
export interface EditSession {
  id: string;
  reference: string;
  name: string;
  type: EditContentType;
  content: string;
  originalContent: string;
  dirty: boolean;
}
