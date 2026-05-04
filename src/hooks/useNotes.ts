import { useState, useEffect, useCallback } from 'react';
import { AppState, Note, Notebook } from '../types';
import { generateId, createNewNote } from '../utils/treeUtils';

const STORAGE_KEY = 'lignum_notes_state_v2';

const initialNotebookId = generateId();
const initialNoteId = generateId();

const defaultNote: Note = {
  id: initialNoteId,
  title: 'Välkommen',
  content: '<h1>Välkommen till din nya anteckningsbok!</h1><p>Här kan du skriva vad du vill.</p>',
  parentId: null,
  children: [],
};

const defaultNotebook: Notebook = {
  id: initialNotebookId,
  name: 'Min Första Bok',
  color: '#3b82f6',
  rootNoteIds: [initialNoteId],
  notes: { [initialNoteId]: defaultNote },
};

const initialState: AppState = {
  notebooks: { [initialNotebookId]: defaultNotebook },
  activeNotebookId: initialNotebookId,
  activeNoteId: initialNoteId,
  searchQuery: '',
  view: 'notes',
};

export function useNotes() {
  const [state, setState] = useState<AppState>(initialState);
  const [lastDeletedNote, setLastDeletedNote] = useState<{ note: Note; notebookId: string; index: number } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setState(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load state', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const activeNotebook = state.notebooks[state.activeNotebookId];

  const setView = useCallback((view: 'notes' | 'search' | 'notebooks') => {
    setState((s) => ({ ...s, view, searchQuery: view === 'search' ? s.searchQuery : '' }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setState((s) => ({ ...s, searchQuery: query, view: 'search' }));
  }, []);

  const setActiveNotebook = useCallback((id: string) => {
    setState((s) => ({ ...s, activeNotebookId: id, activeNoteId: s.notebooks[id].rootNoteIds[0] || null, view: 'notes' }));
  }, []);

  const addNotebook = useCallback((name: string, color: string) => {
    const id = generateId();
    const newNotebook: Notebook = {
      id,
      name,
      color,
      rootNoteIds: [],
      notes: {},
    };
    setState((s) => ({
      ...s,
      notebooks: { ...s.notebooks, [id]: newNotebook },
      activeNotebookId: id,
      activeNoteId: null,
      view: 'notes'
    }));
    return id;
  }, []);

  const updateNotebook = useCallback((id: string, updates: Partial<Notebook>) => {
    setState((s) => ({
      ...s,
      notebooks: {
        ...s.notebooks,
        [id]: { ...s.notebooks[id], ...updates }
      }
    }));
  }, []);

  const deleteNotebook = useCallback((id: string) => {
    setState((s) => {
      const remainingIds = Object.keys(s.notebooks).filter(nbId => nbId !== id);
      if (remainingIds.length === 0) return s; // Keep at least one

      const nextActiveId = remainingIds[0];
      const newNotebooks = { ...s.notebooks };
      delete newNotebooks[id];

      return {
        ...s,
        notebooks: newNotebooks,
        activeNotebookId: s.activeNotebookId === id ? nextActiveId : s.activeNotebookId,
        activeNoteId: s.activeNotebookId === id ? (s.notebooks[nextActiveId].rootNoteIds[0] || null) : s.activeNoteId,
      };
    });
  }, []);

  const setActiveNote = useCallback((id: string | null) => {
    setState((s) => ({ ...s, activeNoteId: id, view: 'notes' }));
  }, []);

  const updateNoteContent = useCallback((id: string, content: string) => {
    setState((s) => {
      const nb = s.notebooks[s.activeNotebookId];
      if (!nb.notes[id]) return s;
      return {
        ...s,
        notebooks: {
          ...s.notebooks,
          [s.activeNotebookId]: {
            ...nb,
            notes: {
              ...nb.notes,
              [id]: { ...nb.notes[id], content }
            }
          }
        }
      };
    });
  }, []);

  const updateNoteTitle = useCallback((id: string, title: string) => {
    setState((s) => {
      const nb = s.notebooks[s.activeNotebookId];
      if (!nb.notes[id]) return s;
      return {
        ...s,
        notebooks: {
          ...s.notebooks,
          [s.activeNotebookId]: {
            ...nb,
            notes: {
              ...nb.notes,
              [id]: { ...nb.notes[id], title }
            }
          }
        }
      };
    });
  }, []);

  const addNote = useCallback((parentId: string | null = null, title: string = 'Ny anteckning') => {
    const newNote = createNewNote(parentId, title);
    setState((s) => {
      const nb = s.notebooks[s.activeNotebookId];
      const newNotes = { ...nb.notes, [newNote.id]: newNote };
      let newRootIds = [...nb.rootNoteIds];

      if (parentId === null) {
        newRootIds.push(newNote.id);
      } else {
        const parent = newNotes[parentId];
        if (parent) {
          newNotes[parentId] = {
            ...parent,
            children: [...parent.children, newNote.id],
          };
        }
      }

      return {
        ...s,
        activeNoteId: newNote.id,
        notebooks: {
          ...s.notebooks,
          [s.activeNotebookId]: {
            ...nb,
            notes: newNotes,
            rootNoteIds: newRootIds,
          }
        }
      };
    });
    return newNote.id;
  }, []);

  const deleteNote = useCallback((id: string) => {
    setState((s) => {
      const nb = s.notebooks[s.activeNotebookId];
      const newNotes = { ...nb.notes };
      const noteToDelete = newNotes[id];
      if (!noteToDelete) return s;

      const parentId = noteToDelete.parentId;
      let index = -1;
      if (parentId === null) {
        index = nb.rootNoteIds.indexOf(id);
      } else {
        index = nb.notes[parentId].children.indexOf(id);
      }

      setLastDeletedNote({ note: noteToDelete, notebookId: s.activeNotebookId, index });

      let newRootIds = [...nb.rootNoteIds];

      if (noteToDelete.parentId === null) {
        newRootIds = newRootIds.filter((rid) => rid !== id);
      } else {
        const parent = newNotes[noteToDelete.parentId];
        if (parent) {
          newNotes[parent.id] = {
            ...parent,
            children: parent.children.filter((cid) => cid !== id),
          };
        }
      }

      delete newNotes[id];

      return {
        ...s,
        activeNoteId: s.activeNoteId === id ? (newRootIds[0] || null) : s.activeNoteId,
        notebooks: {
          ...s.notebooks,
          [s.activeNotebookId]: {
            ...nb,
            notes: newNotes,
            rootNoteIds: newRootIds,
          }
        }
      };
    });
  }, []);

  const undoDelete = useCallback(() => {
    if (!lastDeletedNote) return;

    const { note, notebookId, index } = lastDeletedNote;

    setState((s) => {
      const nb = s.notebooks[notebookId];
      if (!nb) return s;

      const newNotes = { ...nb.notes, [note.id]: note };
      let newRootIds = [...nb.rootNoteIds];

      if (note.parentId === null) {
        newRootIds.splice(index, 0, note.id);
      } else {
        const parent = newNotes[note.parentId];
        if (parent) {
          const newChildren = [...parent.children];
          newChildren.splice(index, 0, note.id);
          newNotes[note.parentId] = {
            ...parent,
            children: newChildren,
          };
        }
      }

      return {
        ...s,
        activeNoteId: note.id,
        notebooks: {
          ...s.notebooks,
          [notebookId]: {
            ...nb,
            notes: newNotes,
            rootNoteIds: newRootIds,
          }
        }
      };
    });

    setLastDeletedNote(null);
  }, [lastDeletedNote]);

  const reorderNotes = useCallback((parentId: string | null, newChildrenOrder: string[]) => {
    setState((s) => {
      const nb = s.notebooks[s.activeNotebookId];
      if (parentId === null) {
        return {
          ...s,
          notebooks: {
            ...s.notebooks,
            [s.activeNotebookId]: { ...nb, rootNoteIds: newChildrenOrder }
          }
        };
      } else {
        return {
          ...s,
          notebooks: {
            ...s.notebooks,
            [s.activeNotebookId]: {
              ...nb,
              notes: {
                ...nb.notes,
                [parentId]: { ...nb.notes[parentId], children: newChildrenOrder }
              }
            }
          }
        };
      }
    });
  }, []);

  return {
    state,
    activeNotebook,
    setView,
    setSearchQuery,
    setActiveNotebook,
    addNotebook,
    updateNotebook,
    deleteNotebook,
    setActiveNote,
    updateNoteContent,
    updateNoteTitle,
    addNote,
    deleteNote,
    undoDelete,
    lastDeletedNote,
    clearLastDeletedNote: () => setLastDeletedNote(null),
    reorderNotes
  };
}
