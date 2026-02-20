import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { 
  Bold, 
  List, 
  ListOrdered, 
  Link as LinkIcon,
  Save,
  X,
  AtSign,
  Lock,
  Globe
} from 'lucide-react';
import { Button } from '../ui/button';
import { useAllCompanies } from '../../db/queries';
import { CompanyMention } from './CompanyMentionExtension';
import { useClickOutside } from '../../hooks/useClickOutside';
import { hasFeature } from '../../config/featureFlags';
import { tiptapToPlainText } from '../../utils/noteType';
import { normalizeTiptapContent } from '../../utils/tiptapContent';
import type { TiptapJSON } from './NoteCard';

interface NoteEditorProps {
  companyId: string;
  userId: string;
  initialContent?: TiptapJSON;
  noteId?: string; // Present when editing existing note
  initialVisibility?: 'private' | 'public'; // Pre-populate visibility when editing
  onSave: (content: TiptapJSON, visibility: 'private' | 'public') => Promise<void>;
  onCancel: () => void;
}

/**
 * NoteEditor component - Rich text editor for creating and editing notes
 * 
 * Features:
 * - Tiptap editor with StarterKit and Link extensions
 * - Toolbar with formatting buttons (bold, lists, links)
 * - Visibility toggle (private/public)
 * - Content validation (non-empty check)
 * - Save and cancel handlers
 * 
 */
export function NoteEditor({ 
  companyId, 
  initialContent, 
  noteId,
  initialVisibility = 'private', // Default to 'private'
  onSave, 
  onCancel 
}: NoteEditorProps) {
  const workspaceEnabled = hasFeature('workspace');
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');
  const [linkEditorPosition, setLinkEditorPosition] = useState<{ top: number; left: number } | null>(null);
  const [linkSelection, setLinkSelection] = useState<{ from: number; to: number } | null>(null);

  const [visibility, setVisibility] = useState<'private' | 'public'>(
    workspaceEnabled ? initialVisibility : 'private'
  );
  const editorRef = useRef<HTMLDivElement>(null);
  const linkEditorRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const normalizedInitialContent = useMemo(
    () => normalizeTiptapContent(initialContent),
    [initialContent]
  );

  const closeLinkEditor = useCallback(() => {
    setShowLinkEditor(false);
    setLinkEditorPosition(null);
    setLinkSelection(null);
  }, []);

  useEffect(() => {
    if (!workspaceEnabled && visibility !== 'private') {
      setVisibility('private');
    }
  }, [workspaceEnabled, visibility]);
  
  // Get all companies for @ mention autocomplete
  const { companies } = useAllCompanies();

  // Filter companies based on mention query
  const filteredCompanies = mentionQuery.trim()
    ? companies.filter(c => 
        c.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
        c.tickers.some((ticker) =>
          ticker.toLowerCase().includes(mentionQuery.toLowerCase()),
        )
      ).slice(0, 10) // Limit to 10 results
    : [];

  // Auto-save when clicking outside the editor
  useClickOutside(editorRef, async () => {
    if (!editor || isSaving) return;
    
    // Check if content is valid before auto-saving.
    // Reuse shared parser so mentions/links are not incorrectly treated as empty.
    const json = editor.getJSON() as TiptapJSON;
    const isEmpty = tiptapToPlainText(json).length === 0;

    // If empty, just cancel without saving
    if (isEmpty) {
      onCancel();
      return;
    }

    // Auto-save if content is valid
    try {
      setIsSaving(true);
      setValidationError(null);
      const content = editor.getJSON() as TiptapJSON;
      const effectiveVisibility = workspaceEnabled ? visibility : 'private';
      await onSave(content, effectiveVisibility);
    } catch (err) {
      console.error('Failed to auto-save note:', err);
      // Error is handled by parent component via useNotes hook
    } finally {
      setIsSaving(false);
    }
  }, true); // Enable the click outside listener
  useClickOutside(linkEditorRef, closeLinkEditor, showLinkEditor);

  // Initialize Tiptap editor with extensions
  // StarterKit provides bold, lists, etc.
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, // Disable headings for notes
        blockquote: false, // Disable blockquotes for notes
        code: false, // Disable inline code for notes
        codeBlock: false, // Disable code blocks for notes
        horizontalRule: false, // Disable horizontal rules for notes
        link: false, // We register Link separately with custom config
      }),
      // Link extension for hyperlinks
      Link.configure({
        openOnClick: false, // Don't open links while editing
        HTMLAttributes: {
          class: 'text-blue-400 underline cursor-pointer',
        },
      }),
      // CompanyMention extension for company links
      CompanyMention.configure({
        HTMLAttributes: {
          class: 'company-mention',
        },
        renderLabel({ node }) {
          return `@${node.attrs.companyName}`;
        },
        suggestion: {
          char: '@',
          pluginKey: 'companyMention',
        },
      }),
    ],
    content: normalizedInitialContent,
    editorProps: {
      attributes: {
        class: 'prose prose-sm prose-invert max-w-none focus:outline-none min-h-[100px] text-xs',
        style: 'padding: 8px 12px; font-size: 13px; line-height: 1.5;',
      },
      handleKeyDown: (_view, event) => {
        const isModK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
        if (isModK) {
          event.preventDefault();
          openInlineLinkEditor();
          return true;
        }

        // Handle @ mention dropdown navigation
        if (showMentionDropdown && filteredCompanies.length > 0) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSelectedMentionIndex(prev => 
              prev < filteredCompanies.length - 1 ? prev + 1 : 0
            );
            return true;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSelectedMentionIndex(prev => 
              prev > 0 ? prev - 1 : filteredCompanies.length - 1
            );
            return true;
          }
          if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault();
            insertCompanyMention(filteredCompanies[selectedMentionIndex]);
            return true;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            closeMentionDropdown();
            return true;
          }
        }
        return false;
      },
    },
    autofocus: 'end',
    onUpdate: ({ editor }) => {
      // Detect @ character and show mention dropdown
      const { state } = editor;
      const { selection } = state;
      const { $from } = selection;
      
      // Get text before cursor
      const textBefore = $from.parent.textBetween(
        Math.max(0, $from.parentOffset - 50),
        $from.parentOffset,
        undefined,
        '\ufffc'
      );
      
      // Check if we're in a mention context
      const mentionMatch = textBefore.match(/@(\w*)$/);
      
      if (mentionMatch) {
        const query = mentionMatch[1];
        setMentionQuery(query);
        setShowMentionDropdown(true);
        setSelectedMentionIndex(0);
        
        // Calculate dropdown position
        const coords = editor.view.coordsAtPos($from.pos);
        if (editorRef.current) {
          const editorRect = editorRef.current.getBoundingClientRect();
          setMentionPosition({
            top: coords.top - editorRect.top + 20,
            left: coords.left - editorRect.left,
          });
        }
      } else {
        closeMentionDropdown();
      }
    },
  });

  // Cleanup editor on unmount
  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  // Close mention dropdown helper
  const closeMentionDropdown = useCallback(() => {
    setShowMentionDropdown(false);
    setMentionQuery('');
    setMentionPosition(null);
    setSelectedMentionIndex(0);
  }, []);

  // Insert company mention
  const insertCompanyMention = useCallback((company: { id: string; name: string }) => {
    if (!editor) return;

    const { state } = editor;
    const { selection } = state;
    const { $from } = selection;
    
    // Find the @ character position
    const textBefore = $from.parent.textBetween(
      Math.max(0, $from.parentOffset - 50),
      $from.parentOffset,
      undefined,
      '\ufffc'
    );
    
    const mentionMatch = textBefore.match(/@(\w*)$/);
    if (!mentionMatch) return;
    
    const mentionStart = $from.pos - mentionMatch[0].length;
    
    // Replace @ and query with company mention node
    editor
      .chain()
      .focus()
      .deleteRange({ from: mentionStart, to: $from.pos })
      .insertContent({
        type: 'companyMention',
        attrs: {
          companyId: company.id,
          companyName: company.name,
        },
      })
      .insertContent(' ') // Add space after mention
      .run();
    
    closeMentionDropdown();
  }, [editor, closeMentionDropdown]);

  const normalizeLinkUrl = useCallback((url: string): string => {
    const trimmed = url.trim();
    if (!trimmed) return '';

    if (/^(https?:\/\/|mailto:|tel:|\/)/i.test(trimmed)) {
      return trimmed;
    }

    return `https://${trimmed}`;
  }, []);

  const openInlineLinkEditor = useCallback((): boolean => {
    if (!editor || !editorRef.current) return false;

    const { selection } = editor.state;
    const hasSelection = !selection.empty;
    const hasActiveLink = editor.isActive('link');

    if (!hasSelection && !hasActiveLink) {
      return false;
    }

    if (!hasSelection && hasActiveLink) {
      editor.chain().focus().extendMarkRange('link').run();
    }

    const { from, to } = editor.state.selection;
    if (from === to) {
      return false;
    }

    const coords = editor.view.coordsAtPos(to);
    const containerRect = editorRef.current.getBoundingClientRect();
    const maxLeft = Math.max(8, editorRef.current.clientWidth - 304);

    setLinkSelection({ from, to });
    setLinkDraft(editor.getAttributes('link').href ?? '');
    setLinkEditorPosition({
      top: Math.max(8, coords.top - containerRect.top - 46),
      left: Math.max(8, Math.min(coords.left - containerRect.left - 150, maxLeft)),
    });
    setShowLinkEditor(true);

    return true;
  }, [editor]);

  const applyInlineLink = useCallback(() => {
    if (!editor) return;

    const normalized = normalizeLinkUrl(linkDraft);
    const chain = editor.chain().focus();

    if (linkSelection) {
      chain.setTextSelection(linkSelection);
    }

    if (!normalized) {
      chain.extendMarkRange('link').unsetLink().run();
      closeLinkEditor();
      return;
    }

    chain.extendMarkRange('link').setLink({ href: normalized }).run();
    closeLinkEditor();
  }, [editor, linkDraft, linkSelection, closeLinkEditor, normalizeLinkUrl]);

  const removeInlineLink = useCallback(() => {
    if (!editor) return;

    const chain = editor.chain().focus();
    if (linkSelection) {
      chain.setTextSelection(linkSelection);
    }
    chain.extendMarkRange('link').unsetLink().run();
    closeLinkEditor();
  }, [editor, linkSelection, closeLinkEditor]);

  useEffect(() => {
    if (!showLinkEditor) return;

    const frame = window.requestAnimationFrame(() => {
      linkInputRef.current?.focus();
      linkInputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [showLinkEditor]);

  // Validate content is not empty
  const validateContent = (): boolean => {
    if (!editor) return false;

    const json = editor.getJSON() as TiptapJSON;
    const isEmpty = tiptapToPlainText(json).length === 0;

    if (isEmpty) {
      setValidationError('Note content cannot be empty');
      return false;
    }

    setValidationError(null);
    return true;
  };

  // Handle save
  const handleSave = async () => {
    if (!editor) return;

    if (!validateContent()) {
      return;
    }

    try {
      setIsSaving(true);
      setValidationError(null);

      const content = editor.getJSON() as TiptapJSON;
      // Pass visibility to save handler
      const effectiveVisibility = workspaceEnabled ? visibility : 'private';
      await onSave(content, effectiveVisibility);
      
      // onSave will handle closing the editor
    } catch (err) {
      console.error('Failed to save note:', err);
      // Error is handled by parent component via useNotes hook
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    onCancel();
  };

  // Toolbar button handlers
  const toggleBold = () => {
    editor?.chain().focus().toggleBold().run();
  };

  // Bulleted list
  const toggleBulletList = () => {
    editor?.chain().focus().toggleBulletList().run();
  };

  // Numbered list
  const toggleOrderedList = () => {
    editor?.chain().focus().toggleOrderedList().run();
  };

  // Hyperlink insertion
  const addLink = () => {
    openInlineLinkEditor();
  };

  // Company mention insertion via toolbar button
  const triggerMentionDropdown = () => {
    if (!editor) return;
    
    // Insert @ character to trigger the dropdown
    editor.chain().focus().insertContent('@').run();
  };

  if (!editor) {
    return (
      <div
        style={{
          padding: '12px',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.5)',
          fontSize: '12px',
        }}
      >
        Loading editor...
      </div>
    );
  }

  return (
    <div
      ref={editorRef}
      className="note-editor"
      data-company-id={companyId}
      style={{
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(255,255,255,0.03)',
        marginBottom: '12px',
        position: 'relative',
      }}
    >
      {/* Toolbar */}
      <div
        className="editor-toolbar"
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '8px',
          paddingBottom: '8px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* Bold button */}
        <button
          onClick={toggleBold}
          className={editor.isActive('bold') ? 'is-active' : ''}
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.2)',
            backgroundColor: editor.isActive('bold') 
              ? 'rgba(96, 165, 250, 0.2)' 
              : 'rgba(255,255,255,0.05)',
            color: editor.isActive('bold') 
              ? 'rgba(96, 165, 250, 1)' 
              : 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!editor.isActive('bold')) {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
            }
          }}
          onMouseLeave={(e) => {
            if (!editor.isActive('bold')) {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
            }
          }}
          aria-label="Bold"
          title="Bold"
        >
          <Bold size={14} />
        </button>

        {/* Bullet list button */}
        <button
          onClick={toggleBulletList}
          className={editor.isActive('bulletList') ? 'is-active' : ''}
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.2)',
            backgroundColor: editor.isActive('bulletList') 
              ? 'rgba(96, 165, 250, 0.2)' 
              : 'rgba(255,255,255,0.05)',
            color: editor.isActive('bulletList') 
              ? 'rgba(96, 165, 250, 1)' 
              : 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!editor.isActive('bulletList')) {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
            }
          }}
          onMouseLeave={(e) => {
            if (!editor.isActive('bulletList')) {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
            }
          }}
          aria-label="Bullet list"
          title="Bullet list"
        >
          <List size={14} />
        </button>

        {/* Ordered list button */}
        <button
          onClick={toggleOrderedList}
          className={editor.isActive('orderedList') ? 'is-active' : ''}
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.2)',
            backgroundColor: editor.isActive('orderedList') 
              ? 'rgba(96, 165, 250, 0.2)' 
              : 'rgba(255,255,255,0.05)',
            color: editor.isActive('orderedList') 
              ? 'rgba(96, 165, 250, 1)' 
              : 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!editor.isActive('orderedList')) {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
            }
          }}
          onMouseLeave={(e) => {
            if (!editor.isActive('orderedList')) {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
            }
          }}
          aria-label="Numbered list"
          title="Numbered list"
        >
          <ListOrdered size={14} />
        </button>

        {/* Link button */}
        <button
          onClick={addLink}
          className={editor.isActive('link') ? 'is-active' : ''}
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.2)',
            backgroundColor: editor.isActive('link') 
              ? 'rgba(96, 165, 250, 0.2)' 
              : 'rgba(255,255,255,0.05)',
            color: editor.isActive('link') 
              ? 'rgba(96, 165, 250, 1)' 
              : 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!editor.isActive('link')) {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
            }
          }}
          onMouseLeave={(e) => {
            if (!editor.isActive('link')) {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
            }
          }}
          aria-label="Add link"
          title="Add link (Cmd/Ctrl + K)"
        >
          <LinkIcon size={14} />
        </button>

        {/* Company mention button */}
        <button
          onClick={triggerMentionDropdown}
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.2)',
            backgroundColor: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
          }}
          aria-label="Mention company"
          title="Mention company (@)"
        >
          <AtSign size={14} />
        </button>

        {/* Spacer to separate formatting from visibility */}
        <div style={{ flex: 1 }} />

        {/* Visibility toggle */}
        {workspaceEnabled && (
          <button
            onClick={() => setVisibility(visibility === 'private' ? 'public' : 'private')}
            className="visibility-toggle"
            style={{
              padding: '6px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.2)',
              backgroundColor: visibility === 'public' 
                ? 'rgba(96, 165, 250, 0.2)' 
                : 'rgba(255,255,255,0.05)',
              color: visibility === 'public' 
                ? 'rgba(96, 165, 250, 1)' 
                : 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s ease',
              fontSize: '11px',
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              if (visibility === 'private') {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (visibility === 'private') {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
              }
            }}
            aria-label={`Visibility: ${visibility}`}
            title={visibility === 'private' ? 'Private (only you can see)' : 'Public (visible to all users)'}
          >
            {visibility === 'private' ? (
              <>
                <Lock size={14} />
                <span>Private</span>
              </>
            ) : (
              <>
                <Globe size={14} />
                <span>Public</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Editor content */}
      <div
        style={{
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '4px',
          backgroundColor: 'rgba(0,0,0,0.2)',
          marginBottom: '8px',
        }}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Inline link editor */}
      {showLinkEditor && linkEditorPosition && (
        <div
          ref={linkEditorRef}
          style={{
            position: 'absolute',
            top: linkEditorPosition.top,
            left: linkEditorPosition.left,
            zIndex: 1001,
            width: '296px',
            padding: '8px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(20,20,24,0.96)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.5)',
              marginBottom: '6px',
            }}
          >
            Link
          </div>
          <div
            style={{
              display: 'flex',
              gap: '6px',
            }}
          >
            <input
              ref={linkInputRef}
              type="text"
              value={linkDraft}
              onChange={(event) => setLinkDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  applyInlineLink();
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  closeLinkEditor();
                }
              }}
              placeholder="Paste or type a URL"
              style={{
                flex: 1,
                minWidth: 0,
                height: '30px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(0,0,0,0.3)',
                color: 'rgba(255,255,255,0.9)',
                padding: '0 10px',
                fontSize: '12px',
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={applyInlineLink}
              style={{
                height: '30px',
                padding: '0 10px',
                fontSize: '11px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.9)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              Apply
            </Button>
          </div>
          <div
            style={{
              marginTop: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={removeInlineLink}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'rgba(248, 113, 113, 0.86)',
                fontSize: '11px',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Remove link
            </button>
            <div
              style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: '10px',
              }}
            >
              Enter to save
            </div>
          </div>
        </div>
      )}

      {/* Company mention dropdown - Notion-style autocomplete */}
      {showMentionDropdown && mentionPosition && filteredCompanies.length > 0 && (
        <div
          className="mention-dropdown"
          style={{
            position: 'absolute',
            top: mentionPosition.top,
            left: mentionPosition.left,
            zIndex: 1000,
            backgroundColor: 'rgba(30, 30, 30, 0.98)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            maxHeight: '200px',
            overflowY: 'auto',
            minWidth: '250px',
          }}
        >
          {filteredCompanies.map((company, index) => (
            <div
              key={company.id}
              onClick={() => insertCompanyMention(company)}
              className="mention-dropdown-item"
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                backgroundColor: index === selectedMentionIndex 
                  ? 'rgba(96, 165, 250, 0.2)' 
                  : 'transparent',
                borderBottom: index < filteredCompanies.length - 1 
                  ? '1px solid rgba(255,255,255,0.1)' 
                  : 'none',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={() => setSelectedMentionIndex(index)}
            >
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                {company.name}
              </div>
              {company.tickers.length > 0 && (
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                  {company.tickers.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Validation error */}
      {validationError && (
        <div
          className="note-error-message"
          style={{
            padding: '8px 12px',
            marginBottom: '8px',
            borderRadius: '4px',
            backgroundColor: 'rgba(248, 113, 113, 0.1)',
            border: '1px solid rgba(248, 113, 113, 0.3)',
            fontSize: '12px',
            color: '#f87171',
          }}
        >
          {validationError}
        </div>
      )}

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end',
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={isSaving}
          style={{ 
            fontSize: '12px',
            color: 'rgba(0, 0, 0, 0.8)',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 1)';
            e.currentTarget.style.transform = 'scale(1.02)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <X size={14} />
          Cancel
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          style={{ 
            fontSize: '12px',
            backgroundColor: 'rgba(96, 165, 250, 0.9)',
            color: 'rgba(0, 0, 0, 0.9)',
            border: 'none',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(96, 165, 250, 1)';
            e.currentTarget.style.transform = 'scale(1.02)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(96, 165, 250, 0.9)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <Save size={14} />
          {isSaving ? 'Saving...' : noteId ? 'Update' : 'Save Note'}
        </Button>
      </div>
    </div>
  );
}
