import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  Plus, 
  Trash2, 
  GripVertical,
  MoreVertical,
  Search,
  ChevronLeft
} from 'lucide-react';
import { Note } from '../types';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  notes: Record<string, Note>;
  rootIds: string[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onAddNote: (parentId: string | null) => void;
  onDeleteNote: (id: string) => void;
  onReorder: (parentId: string | null, newOrder: string[]) => void;
  searchQuery: string;
  onSearch: (query: string) => void;
  view: 'notes' | 'search' | 'notebooks';
  onClose?: () => void;
}

interface TreeItemProps {
  id: string;
  depth: number;
  notes: Record<string, Note>;
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onAddNote: (parentId: string | null) => void;
  onDeleteNote: (id: string) => void;
  onReorder: (parentId: string | null, newOrder: string[]) => void;
  searchQuery: string;
}

const TreeItem: React.FC<TreeItemProps> = ({ 
  id, 
  depth, 
  notes, 
  activeNoteId, 
  onSelectNote, 
  onAddNote, 
  onDeleteNote,
  onReorder,
  searchQuery
}) => {
  const note = notes[id];
  const [isExpanded, setIsExpanded] = useState(true);
  const isActive = activeNoteId === id;

  const matchesSearch = searchQuery 
    ? (note?.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
       note?.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : true;

  const matchingChildren = note?.children.filter(childId => {
    const child = notes[childId];
    if (!child) return false;
    const checkDescendants = (n: Note): boolean => {
      if (n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase())) return true;
      return n.children.some(cid => notes[cid] && checkDescendants(notes[cid]));
    };
    return !searchQuery || checkDescendants(child);
  }) || [];

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    paddingLeft: `${depth * 12}px`,
  };

  if (!note || (searchQuery && !matchesSearch && matchingChildren.length === 0)) return null;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = note.children.indexOf(active.id as string);
      const newIndex = note.children.indexOf(over.id as string);
      onReorder(id, arrayMove(note.children, oldIndex, newIndex));
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="group border-b border-zinc-100/50">
      <div 
        className={cn(
          "flex items-center gap-1 px-3 py-2 cursor-pointer transition-all mx-2 my-0.5 rounded-xl",
          isActive ? "bg-zinc-200/60 text-zinc-900 shadow-sm" : "hover:bg-zinc-100/50 text-zinc-700"
        )}
        onClick={() => onSelectNote(id)}
      >
        <div 
          className="p-1 hover:bg-zinc-200/50 rounded-lg transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          {matchingChildren.length > 0 ? (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <div className="w-3.5" />
          )}
        </div>
        
        <FileText size={16} className={cn("text-zinc-400", isActive && "text-zinc-600")} />
        
        <span className={cn(
          "flex-1 text-sm font-medium truncate",
          searchQuery && note.title.toLowerCase().includes(searchQuery.toLowerCase()) && "bg-yellow-200 rounded px-1"
        )}>
          {note.title || 'Utan titel'}
        </span>

        {!searchQuery && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => { e.stopPropagation(); onAddNote(id); }}
              className="p-1 hover:bg-zinc-200/50 text-zinc-600 rounded-lg"
              title="Lägg till undersida"
            >
              <Plus size={14} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDeleteNote(id); }}
              className="p-1 hover:bg-zinc-200/50 text-zinc-400 hover:text-red-500 rounded-lg"
              title="Ta bort"
            >
              <Trash2 size={14} />
            </button>
            <div {...attributes} {...listeners} className="p-1 cursor-grab active:cursor-grabbing text-zinc-300">
              <GripVertical size={14} />
            </div>
          </div>
        )}
      </div>

      {(isExpanded || searchQuery) && matchingChildren.length > 0 && (
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={matchingChildren}
            strategy={verticalListSortingStrategy}
          >
            <div className="ml-4 border-l border-zinc-100">
              {matchingChildren.map((childId) => (
                <TreeItem 
                  key={childId}
                  id={childId}
                  depth={0} 
                  notes={notes}
                  activeNoteId={activeNoteId}
                  onSelectNote={onSelectNote}
                  onAddNote={onAddNote}
                  onDeleteNote={onDeleteNote}
                  onReorder={onReorder}
                  searchQuery={searchQuery}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};

export const Sidebar = ({ 
  notes, 
  rootIds, 
  activeNoteId, 
  onSelectNote, 
  onAddNote, 
  onDeleteNote,
  onReorder,
  searchQuery,
  onSearch,
  view,
  onClose
}: SidebarProps) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = rootIds.indexOf(active.id as string);
      const newIndex = rootIds.indexOf(over.id as string);
      onReorder(null, arrayMove(rootIds, oldIndex, newIndex));
    }
  };

  const filteredRootIds = rootIds.filter(id => {
    const note = notes[id];
    if (!note) return false;
    const checkDescendants = (n: Note): boolean => {
      if (n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase())) return true;
      return n.children.some(cid => notes[cid] && checkDescendants(notes[cid]));
    };
    return !searchQuery || checkDescendants(note);
  });

  return (
    <div className="w-full bg-zinc-50/30 flex flex-col h-full border-r border-zinc-100/50">
      <div className="p-4 border-b border-zinc-100 bg-white/40 backdrop-blur-md sticky top-0 z-10 transition-colors">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {isMobile && onClose && (
              <button 
                onClick={onClose}
                className="flex items-center gap-1 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold transition-all active:scale-95"
              >
                <ChevronLeft size={14} />
                TILLBAKA
              </button>
            )}
            <h2 className="font-bold text-zinc-900 flex items-center gap-2 tracking-tight">
              {view === 'search' ? 'Sökresultat' : 'Anteckningar'}
            </h2>
          </div>
          {view !== 'search' && (
            <button 
              onClick={() => onAddNote(null)}
              className="p-2 bg-zinc-800 hover:bg-zinc-900 text-white rounded-xl transition-all shadow-lg shadow-zinc-500/20 active:scale-95"
              title="Ny anteckning"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
        
        {view === 'search' && (
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Sök i alla anteckningar..."
              className="w-full bg-zinc-100/50 border-none rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-zinc-500 transition-all font-medium placeholder:text-zinc-400/70"
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              autoFocus
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden pt-3 pb-20">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={filteredRootIds}
            strategy={verticalListSortingStrategy}
          >
            {filteredRootIds.map((id) => (
              <TreeItem 
                key={id}
                id={id}
                depth={1}
                notes={notes}
                activeNoteId={activeNoteId}
                onSelectNote={onSelectNote}
                onAddNote={onAddNote}
                onDeleteNote={onDeleteNote}
                onReorder={onReorder}
                searchQuery={searchQuery}
              />
            ))}
          </SortableContext>
        </DndContext>
        
        {filteredRootIds.length === 0 && (
          <div className="p-8 text-center text-zinc-500 text-sm italic">
            {searchQuery ? 'Inga träffar hittades.' : 'Inga anteckningar ännu.'}
          </div>
        )}
      </div>
    </div>
  );
};
