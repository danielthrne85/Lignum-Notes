export interface Note {
  id: string;
  notebookId: string;
  title: string;
  content: string;
  parentId: string | null;
  children: string[]; // Order of children IDs
}

export interface Notebook {
  id: string;
  name: string;
  color: string;
  rootNoteIds: string[];
  notes: Record<string, Note>;
}

export interface AppState {
  notebooks: Record<string, Notebook>;
  activeNotebookId: string;
  activeNoteId: string | null;
  searchQuery: string;
  view: 'notes' | 'search' | 'notebooks';
}
