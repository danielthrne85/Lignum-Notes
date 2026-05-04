import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { NotebooksView } from './components/NotebooksView';
import { useNotes } from './hooks/useNotes';
import { Note } from './types';
import { Search as SearchIcon, FolderTree, BookOpen, FileText, Maximize2, Minimize2, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from './lib/firebase';

export default function App() {
  const {
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
    clearLastDeletedNote,
    reorderNotes,
    isSyncing
  } = useNotes();

  const [sidebarWidth, setSidebarWidth] = useState(288);
  const [isResizing, setIsResizing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showUndo, setShowUndo] = useState(false);
  const [showCopyPrompt, setShowCopyPrompt] = useState(false);
  const [lastNoteContent, setLastNoteContent] = useState<string | null>(null);
  const undoTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (lastDeletedNote) {
      setShowUndo(true);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = setTimeout(() => {
        setShowUndo(false);
        clearLastDeletedNote();
      }, 5000);
    }
  }, [lastDeletedNote, clearLastDeletedNote]);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sidebarRef = useRef<HTMLDivElement>(null);

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (clientX: number) => {
      if (isResizing) {
        const newWidth = clientX - 64; // Account for the 16 unit (64px) slim rail
        if (newWidth > 150 && newWidth < 600) {
          setSidebarWidth(newWidth);
        }
      }
    },
    [isResizing]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => resize(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) resize(e.touches[0].clientX);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', stopResizing);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', stopResizing);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResizing);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  const activeNote = state.activeNoteId ? activeNotebook.notes[state.activeNoteId] : null;

  const handleAddNote = (parentId: string | null = null, title: string = 'Ny anteckning') => {
    // Find the last note modified to get its content
    const notes = Object.values(activeNotebook.notes) as Note[];
    const lastNote = notes.length > 0 ? notes[notes.length - 1] : null;
    
    if (lastNote && lastNote.content && lastNote.content !== '<p></p>' && lastNote.content !== '') {
      setLastNoteContent(lastNote.content);
      setShowCopyPrompt(true);
      addNote(parentId, title);
    } else {
      addNote(parentId, title);
    }
  };

  const handleCreateSubPage = (title: string) => {
    if (state.activeNoteId) {
      handleAddNote(state.activeNoteId, title);
    }
  };

  const confirmCopyContent = () => {
    if (state.activeNoteId && lastNoteContent) {
      updateNoteContent(state.activeNoteId, lastNoteContent);
    }
    setShowCopyPrompt(false);
  };

  return (
    <div className="h-screen w-full bg-zinc-100/50 p-3 lg:p-0 transition-all duration-500">
      <div className={`flex h-full w-full bg-zinc-50 text-zinc-950 font-sans overflow-hidden shadow-2xl rounded-3xl lg:rounded-none border-zinc-200/80 border lg:border-0 ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
        {/* App Sidebar Rail (Slim) - Visible unless in full screen editor on mobile */}
      {!isFullScreen && (!isMobile || !activeNote || state.view === 'notebooks') && (
        <div className="w-16 flex flex-col items-center py-4 bg-zinc-100/80 border-r border-zinc-200/50 shrink-0 backdrop-blur-md z-50">
          <button 
            onClick={() => setView('notebooks')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white mb-8 shadow-lg transition-all ${state.view === 'notebooks' ? 'scale-110 shadow-zinc-500/40 ring-2 ring-offset-2 ring-zinc-500' : 'hover:scale-105 shadow-zinc-500/10'}`}
            style={{ backgroundColor: activeNotebook.color || '#71717a' }}
          >
            <BookOpen size={24} />
          </button>
          
          <div className="flex flex-col gap-4">
            <button 
              onClick={() => setView('notes')}
              className={`p-3 rounded-2xl transition-all ${state.view === 'notes' ? 'text-zinc-900 bg-white shadow-md ring-1 ring-zinc-100' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              <FolderTree size={20} />
            </button>
            <button 
              onClick={() => setView('search')}
              className={`p-3 rounded-2xl transition-all ${state.view === 'search' ? 'text-zinc-900 bg-white shadow-md ring-1 ring-zinc-100' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              <SearchIcon size={20} />
            </button>
          </div>

          <div className="mt-auto flex flex-col items-center gap-4">
            {isSyncing && (
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" title="Synkroniserar..." />
            )}
            <button 
              onClick={() => auth.signOut()}
              className="p-3 rounded-2xl text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-all"
              title="Logga ut"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      )}

      {!isFullScreen && state.view !== 'notebooks' && (!isMobile || !activeNote || state.view === 'search') && (
        <>
          <div 
            style={{ width: isMobile ? 'calc(100% - 64px)' : sidebarWidth }} 
            className={`shrink-0 h-full bg-zinc-50/50 transition-all ${isMobile ? 'fixed inset-y-0 right-0 z-40 shadow-2xl' : ''}`}
          >
            <Sidebar 
              notes={activeNotebook.notes}
              rootIds={activeNotebook.rootNoteIds}
              activeNoteId={state.activeNoteId}
              onSelectNote={setActiveNote}
              onAddNote={handleAddNote}
              onDeleteNote={deleteNote}
              onReorder={reorderNotes}
              searchQuery={state.searchQuery}
              onSearch={setSearchQuery}
              view={state.view}
              onClose={() => {
                if (state.view === 'search') {
                  setView('notes');
                } else {
                  setView('notebooks');
                }
              }}
            />
          </div>
          
          {/* Resize Handle - Hide on mobile */}
          {!isMobile && (
            <div 
              className={`group relative w-1 cursor-col-resize hover:bg-zinc-500/50 transition-colors shrink-0 z-20 flex items-center justify-center ${isResizing ? 'bg-zinc-500' : 'bg-transparent'}`}
              onMouseDown={startResizing}
              onTouchStart={startResizing}
            >
              {/* Soft indicator in the middle */}
              <div className={`w-1.5 h-12 bg-zinc-200 rounded-full transition-opacity group-hover:opacity-100 ${isResizing ? 'opacity-100' : 'opacity-40'}`} />
            </div>
          )}
        </>
      )}

      <main className={`flex-1 min-w-0 flex flex-col relative h-full bg-white shadow-[0_0_50px_-12px_rgba(0,0,0,0.1)] z-10 overflow-hidden transition-all duration-300 ${
        isMobile && activeNote && !isFullScreen && state.view !== 'notebooks' ? "fixed inset-0 z-50" : ""
      } ${
        isMobile && !activeNote && state.view !== 'notebooks' ? "hidden md:flex" : ""
      }`}>
        <AnimatePresence mode="wait">
          {state.view === 'notebooks' ? (
            <motion.div
              key="notebooks"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col h-full overflow-hidden"
            >
              <NotebooksView 
                notebooks={state.notebooks}
                activeNotebookId={state.activeNotebookId}
                onSelect={(id) => {
                  setActiveNotebook(id);
                  setView('notes');
                }}
                onAdd={addNotebook}
                onDelete={deleteNotebook}
                onUpdate={updateNotebook}
              />
            </motion.div>
          ) : activeNote ? (
            <motion.div 
              key={activeNote.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex-1 flex flex-col h-full"
            >
              <Editor 
                note={activeNote}
                onUpdateContent={(content) => updateNoteContent(activeNote.id, content)}
                onUpdateTitle={(title) => updateNoteTitle(activeNote.id, title)}
                onCreateSubPage={handleCreateSubPage}
                searchQuery={state.searchQuery}
                isFullScreen={isFullScreen}
                onToggleFullScreen={() => setIsFullScreen(!isFullScreen)}
                onBack={() => {
                  setActiveNote(null);
                  if (isFullScreen) setIsFullScreen(false);
                }}
              />
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 p-8 text-center bg-zinc-50 dark:bg-zinc-950">
              <div className="w-24 h-24 rounded-3xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-4">
                <FileText size={48} className="opacity-20" />
              </div>
              <h3 className="text-lg font-medium text-zinc-600 dark:text-zinc-300 mb-2">
                Ingen anteckning vald
              </h3>
              <p className="max-w-xs text-sm">
                Välj en anteckning i sidomenyn eller skapa en ny för att börja skriva.
              </p>
              <button 
                onClick={() => addNote(null)}
                className="mt-6 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium shadow-lg shadow-blue-500/20"
              >
                Skapa din första anteckning
              </button>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Undo Toast */}
      <AnimatePresence>
        {showUndo && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-4 bg-zinc-900 text-white px-6 py-3 rounded-full shadow-2xl"
          >
            <span className="text-sm font-medium">Anteckningen raderades</span>
            <button 
              onClick={() => {
                undoDelete();
                setShowUndo(false);
              }}
              className="text-blue-400 hover:text-blue-300 text-sm font-bold uppercase tracking-wider"
            >
              Ångra
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Copy Content Prompt */}
      <AnimatePresence>
        {showCopyPrompt && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-6 rounded-3xl shadow-2xl max-w-sm w-full border border-zinc-100"
            >
              <h3 className="text-lg font-bold text-zinc-950 mb-2">Ny anteckning</h3>
              <p className="text-zinc-600 text-sm mb-6">Vill du kopiera texten från din förra anteckning?</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowCopyPrompt(false)}
                  className="flex-1 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl font-bold transition-all"
                >
                  Nej tack
                </button>
                <button 
                  onClick={confirmCopyContent}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20"
                >
                  Ja, kopiera
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}

