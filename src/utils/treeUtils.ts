import { Note } from '../types';

export const findNotePath = (notes: Record<string, Note>, targetId: string): string[] => {
  const note = notes[targetId];
  if (!note) return [];
  if (note.parentId === null) return [targetId];
  return [...findNotePath(notes, note.parentId), targetId];
};

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const createNewNote = (parentId: string | null = null, title: string = 'New Note'): Note => ({
  id: generateId(),
  title,
  content: '',
  parentId,
  children: [],
});

export const removeNoteFromTree = (
  notes: Record<string, Note>,
  rootIds: string[],
  noteId: string
): { notes: Record<string, Note>; rootIds: string[] } => {
  const newNotes = { ...notes };
  let newRootIds = [...rootIds];
  const noteToRemove = newNotes[noteId];

  if (!noteToRemove) return { notes, rootIds };

  if (noteToRemove.parentId === null) {
    newRootIds = newRootIds.filter((id) => id !== noteId);
  } else {
    const parent = newNotes[noteToRemove.parentId];
    if (parent) {
      newNotes[parent.id] = {
        ...parent,
        children: parent.children.filter((id) => id !== noteId),
      };
    }
  }

  // Note: We don't delete children here because we might want to move them or delete them recursively
  // For simplicity in this first version, let's keep them and orphaned notes could be a problem
  // but usually users delete the whole branch.
  
  delete newNotes[noteId];
  return { notes: newNotes, rootIds: newRootIds };
};
