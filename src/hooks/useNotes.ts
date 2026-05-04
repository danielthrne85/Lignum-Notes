import { useState, useEffect, useCallback } from 'react';
import { AppState, Note, Notebook } from '../types';
import { generateId, createNewNote } from '../utils/treeUtils';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  serverTimestamp,
  FieldPath,
  doc as firestoreDoc,
  collection as firestoreCollection,
  arrayUnion,
  arrayRemove,
  updateDoc
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const initialState: AppState = {
  notebooks: {},
  activeNotebookId: '',
  activeNoteId: null,
  searchQuery: '',
  view: 'notebooks',
};

export function useNotes() {
  const [state, setState] = useState<AppState>(initialState);
  const [lastDeletedNote, setLastDeletedNote] = useState<{ note: Note; notebookId: string; index: number } | null>(null);
  const [isSyncing, setIsSyncing] = useState(true);

  // Sync Notebooks
  useEffect(() => {
    const q = query(collection(db, 'notebooks'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setState(s => {
        const notebooks: Record<string, Notebook> = { ...s.notebooks };
        snapshot.docChanges().forEach((change) => {
          const id = change.doc.id;
          if (change.type === 'removed') {
            delete notebooks[id];
          } else {
            const data = change.doc.data();
            notebooks[id] = {
              id,
              name: data.name || '',
              color: data.color || '#71717a',
              rootNoteIds: data.rootNoteIds || [],
              notes: notebooks[id]?.notes || {},
            };
          }
        });

        const newState = { ...s, notebooks };
        if (!s.activeNotebookId && Object.keys(notebooks).length > 0) {
          newState.activeNotebookId = Object.keys(notebooks)[0];
        }
        return newState;
      });
      setIsSyncing(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'notebooks');
    });

    return unsubscribe;
  }, []);

  // Sync Notes for each notebook
  useEffect(() => {
    const notebookIds = Object.keys(state.notebooks);
    const unsubscribes = notebookIds.map(notebookId => {
      const q = query(collection(db, 'notebooks', notebookId, 'notes'));
      return onSnapshot(q, (snapshot) => {
        setState(s => {
          const nb = s.notebooks[notebookId];
          if (!nb) return s;

          const newNotes = { ...nb.notes };
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'removed') {
              delete newNotes[change.doc.id];
            } else {
              const data = change.doc.data();
              newNotes[change.doc.id] = {
                id: change.doc.id,
                title: data.title,
                content: data.content,
                parentId: data.parentId,
                children: data.children || [],
              };
            }
          });

          return {
            ...s,
            notebooks: {
              ...s.notebooks,
              [notebookId]: { ...nb, notes: newNotes }
            }
          };
        });
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `notebooks/${notebookId}/notes`);
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [Object.keys(state.notebooks).join(',')]);

  const activeNotebook = state.notebooks[state.activeNotebookId] || {
    id: '',
    name: '',
    color: '',
    rootNoteIds: [],
    notes: {},
  };

  const setView = useCallback((view: 'notes' | 'search' | 'notebooks') => {
    setState((s) => ({ ...s, view, searchQuery: view === 'search' ? s.searchQuery : '' }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setState((s) => ({ ...s, searchQuery: query, view: 'search' }));
  }, []);

  const setActiveNotebook = useCallback((id: string) => {
    setState((s) => ({ ...s, activeNotebookId: id, activeNoteId: s.notebooks[id]?.rootNoteIds[0] || null, view: 'notes' }));
  }, []);

  const addNotebook = useCallback(async (name: string, color: string) => {
    const id = generateId();
    const nbRef = doc(db, 'notebooks', id);
    try {
      await setDoc(nbRef, {
        name,
        color,
        rootNoteIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `notebooks/${id}`);
    }
  }, []);

  const updateNotebook = useCallback(async (id: string, updates: Partial<Notebook>) => {
    const nbRef = doc(db, 'notebooks', id);
    const firestoreUpdates: any = { ...updates };
    delete firestoreUpdates.notes;
    delete firestoreUpdates.id;
    firestoreUpdates.updatedAt = serverTimestamp();

    try {
      await setDoc(nbRef, firestoreUpdates, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notebooks/${id}`);
    }
  }, []);

  const deleteNotebook = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notebooks', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notebooks/${id}`);
    }
  }, []);

  const setActiveNote = useCallback((id: string | null) => {
    setState((s) => ({ ...s, activeNoteId: id, view: 'notes' }));
  }, []);

  const updateNoteContent = useCallback(async (id: string, content: string) => {
    if (!state.activeNotebookId) return;
    const noteRef = doc(db, 'notebooks', state.activeNotebookId, 'notes', id);
    try {
      await setDoc(noteRef, { content, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notebooks/${state.activeNotebookId}/notes/${id}`);
    }
  }, [state.activeNotebookId]);

  const updateNoteTitle = useCallback(async (id: string, title: string) => {
    if (!state.activeNotebookId) return;
    const noteRef = doc(db, 'notebooks', state.activeNotebookId, 'notes', id);
    try {
      await setDoc(noteRef, { title, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notebooks/${state.activeNotebookId}/notes/${id}`);
    }
  }, [state.activeNotebookId]);

  const addNote = useCallback(async (parentId: string | null = null, title: string = 'Ny anteckning') => {
    if (!state.activeNotebookId) {
      console.warn('Tryckte på lägg till anteckning men ingen anteckningsbok är aktiv.');
      return;
    }
    const nbId = state.activeNotebookId;
    const newNote = createNewNote(parentId, title);
    const newNoteId = newNote.id;
    
    try {
      // 1. Create the note
      const noteRef = doc(db, 'notebooks', nbId, 'notes', newNoteId);
      await setDoc(noteRef, {
        notebookId: nbId,
        title: newNote.title,
        content: newNote.content,
        parentId: newNote.parentId,
        children: newNote.children,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2. Update parent or rootIds using atomic operations
      if (parentId === null) {
        const nbRef = doc(db, 'notebooks', nbId);
        await updateDoc(nbRef, { 
          rootNoteIds: arrayUnion(newNoteId), 
          updatedAt: serverTimestamp() 
        });
      } else {
        const parentRef = doc(db, 'notebooks', nbId, 'notes', parentId);
        await updateDoc(parentRef, { 
          children: arrayUnion(newNoteId), 
          updatedAt: serverTimestamp() 
        });
      }

      setState(s => ({ ...s, activeNoteId: newNoteId }));
      return newNoteId;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `notebooks/${nbId}/notes/${newNoteId}`);
    }
  }, [state.activeNotebookId]);

  const deleteNote = useCallback(async (id: string) => {
    if (!state.activeNotebookId) return;
    const nbId = state.activeNotebookId;
    const nb = state.notebooks[nbId];
    if (!nb) return;
    const noteToDelete = nb.notes[id];
    if (!noteToDelete) return;

    try {
      // 1. Remove from parent/rootIds
      if (noteToDelete.parentId === null) {
        await updateDoc(doc(db, 'notebooks', nbId), { 
          rootNoteIds: arrayRemove(id), 
          updatedAt: serverTimestamp() 
        });
      } else {
        await updateDoc(doc(db, 'notebooks', nbId, 'notes', noteToDelete.parentId), { 
          children: arrayRemove(id), 
          updatedAt: serverTimestamp() 
        });
      }

      // 2. Delete the note
      await deleteDoc(doc(db, 'notebooks', nbId, 'notes', id));
      
      setLastDeletedNote({ note: noteToDelete, notebookId: nbId, index: -1 });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notebooks/${nbId}/notes/${id}`);
    }
  }, [state.activeNotebookId, state.notebooks]);

  const undoDelete = useCallback(async () => {
    if (!lastDeletedNote || !lastDeletedNote.note) return;
    const { note, notebookId } = lastDeletedNote;
    
    try {
      await setDoc(doc(db, 'notebooks', notebookId, 'notes', note.id), {
        ...note,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (note.parentId === null) {
        await updateDoc(doc(db, 'notebooks', notebookId), { 
          rootNoteIds: arrayUnion(note.id), 
          updatedAt: serverTimestamp() 
        });
      } else {
        await updateDoc(doc(db, 'notebooks', notebookId, 'notes', note.parentId), { 
          children: arrayUnion(note.id), 
          updatedAt: serverTimestamp() 
        });
      }
      setLastDeletedNote(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `notebooks/${notebookId}/notes/${note.id}`);
    }
  }, [lastDeletedNote]);

  const reorderNotes = useCallback(async (parentId: string | null, newChildrenOrder: string[]) => {
    if (!state.activeNotebookId) return;
    const nbId = state.activeNotebookId;

    try {
      if (parentId === null) {
        await updateDoc(doc(db, 'notebooks', nbId), { 
          rootNoteIds: newChildrenOrder, 
          updatedAt: serverTimestamp() 
        });
      } else {
        await updateDoc(doc(db, 'notebooks', nbId, 'notes', parentId), { 
          children: newChildrenOrder, 
          updatedAt: serverTimestamp() 
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, parentId ? `notebooks/${nbId}/notes/${parentId}` : `notebooks/${nbId}`);
    }
  }, [state.activeNotebookId]);

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
    reorderNotes,
    isSyncing
  };
}
