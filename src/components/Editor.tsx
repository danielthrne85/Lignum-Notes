import React, { useCallback, useEffect, useState } from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import { motion, AnimatePresence } from 'motion/react';
import StarterKit from '@tiptap/starter-kit';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import { Extension } from '@tiptap/core';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Plugin, PluginKey } from '@tiptap/pm/state';

// Custom Search Highlight Extension
const SearchHighlight = Extension.create({
  name: 'searchHighlight',

  addOptions() {
    return {
      searchQuery: '',
      className: 'bg-yellow-200 dark:bg-yellow-900/50 rounded-sm px-0.5 border-b border-yellow-400',
    }
  },

  addProseMirrorPlugins() {
    const { searchQuery, className } = this.options;

    return [
      new Plugin({
        key: new PluginKey('searchHighlight'),
        state: {
          init() { return DecorationSet.empty },
          apply(tr, oldState) {
            const { doc } = tr;
            if (!searchQuery || searchQuery.length < 2) return DecorationSet.empty;
            
            const decorations: Decoration[] = [];
            let regex: RegExp;
            try {
              regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            } catch (e) {
              return DecorationSet.empty;
            }

            doc.descendants((node, pos) => {
              if (node.isText) {
                const text = node.text || '';
                let match;
                while ((match = regex.exec(text)) !== null) {
                  decorations.push(
                    Decoration.inline(pos + match.index, pos + match.index + match[0].length, {
                      class: className,
                    })
                  );
                }
              }
            });

            return DecorationSet.create(doc, decorations);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ]
  },
});

// Custom Font Size Extension
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize: fontSize => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize })
          .run();
      },
      unsetFontSize: () => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize: null })
          .removeEmptyTextStyle()
          .run();
      },
    };
  },
});

// Custom ListItem som stöder indrag
const CustomListItem = ListItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      indent: {
        default: 0,
        parseHTML: element => parseInt(element.style.marginLeft, 10) / 20 || 0,
        renderHTML: attributes => {
          if (!attributes.indent) {
            return {};
          }
          return {
            style: `margin-left: ${attributes.indent * 20}px`,
          };
        },
      },
    };
  },
});

// Custom extension för att hantera Tab och Backspace i listor
const ListKeymap = Extension.create({
  name: 'listKeymap',
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const { state } = this.editor;
        const { selection } = state;
        let tr = state.tr;
        let modified = false;

        state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
          if (node.type.name === 'listItem') {
            const indent = (node.attrs.indent || 0) + 1;
            tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent });
            modified = true;
          }
        });

        if (modified) {
          this.editor.view.dispatch(tr);
          return true;
        }
        return false;
      },
      Backspace: () => {
        const { selection } = this.editor.state;
        if (!selection.empty || selection.$from.parentOffset !== 0) {
          return false;
        }

        const { state } = this.editor;
        let tr = state.tr;
        let modified = false;

        const $pos = selection.$from;
        for (let d = $pos.depth; d > 0; d--) {
          const node = $pos.node(d);
          if (node.type.name === 'listItem') {
            const pos = $pos.before(d);
            const indent = node.attrs.indent || 0;
            if (indent > 0) {
              tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: indent - 1 });
              modified = true;
              break;
            }
          }
        }

        if (modified) {
          this.editor.view.dispatch(tr);
          return true;
        }
        return false;
      },
    };
  },
});

import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Youtube as YoutubeIcon, 
  PlusCircle,
  Link as LinkIcon,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronDown
} from 'lucide-react';
import { Note } from '../types';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

interface EditorProps {
  note: Note;
  onUpdateContent: (content: string) => void;
  onUpdateTitle: (title: string) => void;
  onCreateSubPage: (title: string) => void;
  searchQuery?: string;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  onBack?: () => void;
}

export const Editor = ({ 
  note, 
  onUpdateContent, 
  onUpdateTitle,
  onCreateSubPage,
  searchQuery = '',
  isFullScreen,
  onToggleFullScreen,
  onBack
}: EditorProps) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showFontSizes, setShowFontSizes] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: false,
        orderedList: false,
      }),
      BulletList.configure({
        HTMLAttributes: {
          class: 'bullet-list',
        },
      }),
      OrderedList.configure({
        HTMLAttributes: {
          class: 'ordered-list',
        },
      }),
      CustomListItem,
      ListKeymap,
      Placeholder.configure({
        placeholder: 'Börja skriva din anteckning här...',
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        HTMLAttributes: {
          class: 'text-zinc-600 underline cursor-pointer hover:text-zinc-900 transition-colors',
        },
      }),
      TextStyle,
      FontSize,
      SearchHighlight.configure({
        searchQuery,
      }),
    ],
    content: note.content,
    onUpdate: ({ editor }) => {
      onUpdateContent(editor.getHTML());
      setShowFontSizes(false);
    },
    onFocus: () => {
      if (isMobile && !isFullScreen) {
        onToggleFullScreen();
      }
    }
  });

  const currentFontSize = editor?.getAttributes('textStyle').fontSize || '16px';

  // Update search query in editor when it changes
  useEffect(() => {
    if (editor && searchQuery !== undefined) {
      editor.setOptions({
        extensions: [
          ...editor.options.extensions.filter(ext => ext.name !== 'searchHighlight'),
          SearchHighlight.configure({ searchQuery })
        ]
      });
      // Force re-render of decorations
      editor.view.dispatch(editor.state.tr);
    }
  }, [editor, searchQuery]);

  useEffect(() => {
    if (editor && note.id) {
      if (note.content !== editor.getHTML()) {
        editor.commands.setContent(note.content);
      }
    }
  }, [note.id, editor]);

  const addYoutubeLink = useCallback(() => {
    const url = prompt('Klistra in länk (t.ex. Youtube):');
    if (!url || !editor) return;

    const { from, to } = editor.state.selection;
    const isSelectionEmpty = from === to;

    if (isSelectionEmpty) {
      // If no text selected, insert the URL as text and link it
      editor.chain().focus().insertContent(url).setLink({ href: url }).run();
    } else {
      // If text is selected, turn it into a link
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const toggleLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    
    if (previousUrl) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    const url = prompt('Ange URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const changeFontSize = useCallback((size: string) => {
    if (editor) {
      editor.chain().focus().setFontSize(size).run();
    }
  }, [editor]);

  const createSubPageFromSelection = useCallback(() => {
    if (editor) {
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, ' ');
      if (text) {
        onCreateSubPage(text);
      }
    }
  }, [editor, onCreateSubPage]);

  if (!editor) return null;

  return (
    <div className="flex-1 flex flex-col bg-zinc-50/30 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-3 border-b border-zinc-100 bg-white/60 backdrop-blur-md flex-wrap sticky top-0 z-20">
        {isMobile && onBack && (
          <button 
            onClick={onBack}
            className="p-2 mr-1 hover:bg-zinc-100 rounded-xl text-zinc-600 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        <input 
          type="text" 
          value={note.title}
          onChange={(e) => onUpdateTitle(e.target.value)}
          className="flex-1 min-w-[150px] bg-transparent border-none focus:ring-0 text-xl md:text-2xl font-bold px-2 py-1 placeholder:text-zinc-200 text-zinc-900 tracking-tight"
          placeholder="Titel..."
        />
        
        <div className="h-6 w-px bg-zinc-100 mx-2 hidden sm:block" />

        <div className="flex items-center gap-1 bg-zinc-100/50 p-1 rounded-2xl">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-2 rounded-xl transition-all ${editor.isActive('bold') ? 'bg-white text-zinc-900 shadow-sm' : 'hover:bg-white/50 text-zinc-400'}`}
          >
            <Bold size={18} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-2 rounded-xl transition-all ${editor.isActive('italic') ? 'bg-white text-zinc-900 shadow-sm' : 'hover:bg-white/50 text-zinc-400'}`}
          >
            <Italic size={18} />
          </button>
          
          <div className="h-6 w-px bg-zinc-200/50 mx-1" />

          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-2 rounded-xl transition-all ${editor.isActive('bulletList') ? 'bg-white text-zinc-900 shadow-sm' : 'hover:bg-white/50 text-zinc-400'}`}
          >
            <List size={18} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-2 rounded-xl transition-all ${editor.isActive('orderedList') ? 'bg-white text-zinc-900 shadow-sm' : 'hover:bg-white/50 text-zinc-400'}`}
          >
            <ListOrdered size={18} />
          </button>

          <div className="h-6 w-px bg-zinc-200/50 mx-1" />

          <div className="relative">
            <button 
              onClick={() => setShowFontSizes(!showFontSizes)}
              className="flex items-center gap-1 px-3 py-1.5 hover:bg-white text-zinc-700 bg-zinc-100/50 rounded-xl font-bold text-xs md:text-sm min-w-[60px] md:min-w-[70px] justify-between transition-all active:scale-95"
            >
              <span>{currentFontSize}</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${showFontSizes ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
              {showFontSizes && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowFontSizes(false)} 
                  />
                  <motion.div 
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    className="absolute top-full mt-2 left-0 bg-white border border-zinc-100 shadow-2xl rounded-2xl overflow-y-auto max-h-[160px] w-24 z-50 p-1 flex flex-col gap-0.5"
                  >
                    {[12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42].map(size => {
                      const sizePx = `${size}px`;
                      return (
                        <button
                          key={size}
                          onClick={() => {
                            changeFontSize(sizePx);
                            setShowFontSizes(false);
                          }}
                          className={`w-full px-3 py-2 text-xs md:text-sm font-bold text-left rounded-xl transition-colors ${currentFontSize === sizePx ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'}`}
                        >
                          {size}px
                        </button>
                      );
                    })}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {!isMobile && (
            <>
              <div className="h-6 w-px bg-zinc-200/50 mx-1" />

              <button
                onClick={onToggleFullScreen}
                className="p-2 rounded-xl hover:bg-white/50 transition-all text-zinc-400 active:scale-95"
                title={isFullScreen ? "Lämna helskärm" : "Helskärm"}
              >
                {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} /> }
              </button>
            </>
          )}
        </div>
      </div>

      {/* Editor Surface */}
      <div 
        className="flex-1 overflow-y-auto overflow-x-hidden cursor-text focus:outline-none bg-white p-4"
        onClick={() => editor.chain().focus().run()}
      >
        <div className="max-w-4xl mx-auto p-4 lg:p-8 prose prose-zinc prose-lg lg:prose-xl max-w-none min-h-full break-words">
          <EditorContent editor={editor} className="min-h-full [&_.tiptap]:outline-none [&_.tiptap]:min-h-[600px] text-zinc-800 break-words" />
        </div>
      </div>
        
        {editor && (
          <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
            <div className="flex items-center gap-1 bg-zinc-900 text-white rounded-lg p-1 shadow-xl border border-white/10">
              <button
                onClick={createSubPageFromSelection}
                className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-white/10 rounded-md text-xs font-medium"
              >
                <PlusCircle size={14} />
                Skapa undersida
              </button>
              
              <div className="w-px h-4 bg-white/20 mx-1" />
              
              <button
                onClick={toggleLink}
                className={`flex items-center gap-1.5 px-2 py-1.5 hover:bg-white/10 rounded-md text-xs font-medium ${editor.isActive('link') ? 'text-blue-400' : ''}`}
              >
                <LinkIcon size={14} />
                {editor.isActive('link') ? 'Ta bort länk' : 'Länka'}
              </button>
            </div>
          </BubbleMenu>
        )}
      </div>
  );
};
