import React, { useState } from 'react';
import { Notebook } from '../types';
import { Plus, Trash2, Edit3, Check } from 'lucide-react';
import { motion } from 'motion/react';

interface NotebooksViewProps {
  notebooks: Record<string, Notebook>;
  activeNotebookId: string;
  onSelect: (id: string) => void;
  onAdd: (name: string, color: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Notebook>) => void;
}

const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
  '#8b5cf6', '#ec4899', '#6366f1', '#06b6d4'
];

export const NotebooksView = ({ 
  notebooks, 
  activeNotebookId, 
  onSelect, 
  onAdd, 
  onDelete,
  onUpdate
}: NotebooksViewProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLORS[2]); // Default to green

  const handleAdd = () => {
    if (newName.trim()) {
      onAdd(newName, newColor);
      setNewName('');
      setIsAdding(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-6 landscape:p-4 md:p-8 lg:p-12 bg-zinc-50/10">
      <div className="max-w-6xl mx-auto min-h-full flex flex-col">
        <div className="mb-8 landscape:mb-6 shrink-0">
          <h1 className="text-2xl md:text-4xl font-black text-zinc-950 mb-2 tracking-tight">Mina Anteckningsböcker</h1>
          <p className="text-zinc-700/60 font-medium">Välj en samling för att börja skriva.</p>
        </div>

        <div className="grid grid-cols-2 landscape:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-40">
          {Object.values(notebooks).map((notebook) => (
            <motion.div
              layoutId={notebook.id}
              key={notebook.id}
              onClick={() => onSelect(notebook.id)}
              whileHover={{ y: -4, scale: 1.02 }}
              className={`group relative p-4 landscape:p-3 rounded-[1.5rem] landscape:rounded-xl cursor-pointer transition-all border-2 ${
                activeNotebookId === notebook.id 
                  ? 'bg-white border-zinc-400 shadow-xl z-10' 
                  : 'bg-white/80 border-transparent hover:border-zinc-100 hover:bg-white hover:shadow-lg'
              }`}
            >
              <div 
                className="w-full aspect-[3/4] landscape:aspect-[4/5] rounded-xl landscape:rounded-lg mb-4 landscape:mb-2 shadow-lg flex flex-col justify-end p-3 landscape:p-2 transform group-hover:rotate-2 transition-transform"
                style={{ backgroundColor: notebook.color }}
              >
                <div className="w-full h-1 bg-white/30 rounded-full mb-1" />
                <div className="w-2/3 h-1 bg-white/30 rounded-full" />
              </div>
              
              <h3 className="text-lg landscape:text-sm font-black text-zinc-950 mb-1 group-hover:text-zinc-600 transition-colors tracking-tight truncate">
                {notebook.name}
              </h3>
              <p className="text-zinc-700/50 font-bold uppercase tracking-widest text-[9px] landscape:text-[8px]">
                {notebook.rootNoteIds.length} sidor
              </p>

              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(notebook.id);
                  }}
                  className="p-2 bg-white/90 text-zinc-400 hover:text-red-500 rounded-lg transition-all shadow-sm"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              

            </motion.div>
          ))}

          {isAdding ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 landscape:p-3 rounded-[1.5rem] landscape:rounded-xl border-2 border-dashed border-zinc-200 bg-white/50 flex flex-col gap-4 landscape:gap-2 shadow-inner"
            >
              <input 
                type="text" 
                placeholder="Namn..."
                className="w-full bg-transparent border-b-2 border-zinc-100 text-lg landscape:text-sm font-bold py-1 focus:ring-0 focus:border-zinc-500 placeholder:text-zinc-200"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <div className="flex flex-wrap gap-2 landscape:gap-1">
                {COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setNewColor(color)}
                    className={`w-6 h-6 landscape:w-4 landscape:h-4 rounded-full transition-all ${newColor === color ? 'ring-2 ring-offset-2 ring-zinc-200 scale-110 shadow-md' : 'hover:scale-110 opacity-80'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex gap-2 mt-auto">
                <button 
                  onClick={handleAdd}
                  className="flex-1 py-2 bg-zinc-800 text-white rounded-lg text-xs font-black shadow-lg shadow-zinc-800/20 active:scale-95 transition-all"
                >
                  KLAR
                </button>
                <button 
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-2 text-zinc-400 hover:text-zinc-600 text-xs font-bold transition-colors"
                >
                  X
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsAdding(true)}
              className="p-5 rounded-[1.5rem] landscape:rounded-xl border-2 border-dashed border-zinc-200 hover:border-zinc-300 bg-white/30 hover:bg-white/50 flex flex-col items-center justify-center gap-3 landscape:gap-2 transition-all text-zinc-400 hover:text-zinc-600 min-h-[220px] landscape:min-h-0 landscape:aspect-[4/5]"
            >
              <div className="p-3 landscape:p-2 bg-zinc-100 rounded-full">
                <Plus size={32} className="landscape:w-5 landscape:h-5" />
              </div>
              <span className="font-bold text-sm tracking-tight text-center landscape:text-[10px]">Ny bok</span>
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
};
