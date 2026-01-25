import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Edit2, Trash2, Lock, Globe } from 'lucide-react';
import { Button } from '../ui/button';
import { CompanyMention } from './CompanyMentionExtension';
import { useClickOutside } from '../../hooks/useClickOutside';
import type { TiptapJSON, Note } from 'financial-graph-shared/types';

// Extended Note type to include backlink metadata
export interface ExtendedNote extends Note {
  isBacklink?: boolean;
  sourceCompanyId?: string;
  sourceCompanyName?: string;
}

// Re-export TiptapJSON for convenience
export type { TiptapJSON };

interface NoteCardProps {
  note: Note | ExtendedNote;
  currentUserId: string;
  onEdit?: (noteId: string) => void;
  onDelete?: (noteId: string) => void;
}

/**
 * NoteCard component displays a single note with metadata and actions
 * 
 * Features:
 * - Renders note content using Tiptap in read-only mode
 * - Displays creation timestamp and creator identifier
 * - Shows edit/delete buttons for user's own notes
 * - Visually distinguishes system notes from user notes
 * - Shows backlink badge for notes that mention the current company
 * - Displays visibility indicator (lock for private, globe for public)
 * - Shows creator name for public notes from other users
 * 
 */
export function NoteCard({ note, currentUserId, onEdit, onDelete }: NoteCardProps) {
  const [isClicked, setIsClicked] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  
  // Close buttons when clicking outside the card
  useClickOutside(cardRef, () => setIsClicked(false), isClicked);
  
  // Create a unique Link extension for this note card to avoid duplicate name warnings
  const LinkExtension = Link.extend({
    name: `link-notecard-${note.id}`,
  });
  
  // Initialize read-only Tiptap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      LinkExtension.configure({
        openOnClick: true, // Allow clicking links in read-only mode
        HTMLAttributes: {
          class: 'text-blue-400 underline cursor-pointer hover:text-blue-300',
        },
      }),
      // Add CompanyMention extension for rendering company links
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
    content: note.content,
    editable: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm prose-invert max-w-none text-xs',
        style: 'font-size: 13px; line-height: 1.5;',
      },
      handleClick: (_view, _pos, event) => {
        // Check if the click was on a company mention link
        const target = event.target as HTMLElement;
        const link = target.closest('a[data-type="company-mention"]');
        
        if (link) {
          event.preventDefault();
          const companyId = link.getAttribute('data-company-id');
          if (companyId) {
            navigate(`/company/${companyId}`);
          }
          return true;
        }
        
        return false;
      },
    },
  });

  // Check if this is a backlink note
  const extendedNote = note as ExtendedNote;
  const isBacklink = extendedNote.isBacklink || false;
  const sourceCompanyName = extendedNote.sourceCompanyName;
  const sourceCompanyId = extendedNote.sourceCompanyId;

  // Determine if current user can edit/delete this note
  // Show buttons only for user's own user notes
  // Backlink notes are read-only - user must navigate to source company to edit
  const isUserNote = note.createdBy === 'user';
  const isOwnNote = note.user?.id === currentUserId;
  const canModify = isUserNote && isOwnNote && !isBacklink;

  // Determine visibility
  const visibility = note.visibility || 'private';
  const isPublicNote = visibility === 'public';

  // Format timestamp for display
  const formatTimestamp = (timestamp: number): string => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    } catch {
      return String(timestamp);
    }
  };

  // Get creator display name
  // Show creator name for public notes from other users
  // InstantDB returns full user object when querying through links
  const creatorName = note.createdBy === 'system' 
    ? 'System' 
    : (note.user?.email?.split('@')[0] || note.user?.id?.split('@')[0] || 'User');

  // Visual distinction for system notes
  // Different background color for backlink notes
  const getCardBackground = () => {
    if (isBacklink) {
      return 'rgba(59, 130, 246, 0.08)'; // Blue tint for backlinks
    }
    if (note.createdBy === 'system') {
      return 'rgba(168, 85, 247, 0.05)'; // Purple tint for system notes
    }
    return 'rgba(255, 255, 255, 0.02)'; // Default
  };

  const getCardBorder = () => {
    if (isBacklink) {
      return '1px solid rgba(59, 130, 246, 0.3)';
    }
    if (note.createdBy === 'system') {
      return '1px solid rgba(168, 85, 247, 0.3)';
    }
    return '1px solid rgba(255, 255, 255, 0.1)';
  };

  const cardClassName = note.createdBy === 'system'
    ? 'note-card note-card-system'
    : isBacklink
    ? 'note-card note-card-backlink'
    : 'note-card note-card-user';

  // Handle source company navigation
  // Make source company name clickable
  const handleSourceCompanyClick = () => {
    if (sourceCompanyId) {
      // Navigate to the source company's detail page using React Router
      navigate(`/company/${sourceCompanyId}`);
    }
  };

  return (
    <div
      ref={cardRef}
      className={cardClassName}
      style={{
        padding: '10px',
        borderRadius: '6px',
        border: getCardBorder(),
        background: getCardBackground(),
        marginBottom: '10px',
        cursor: isBacklink ? 'default' : 'pointer',
        transition: 'all 0.2s ease',
      }}
      onClick={() => {
        if (!isBacklink) {
          setIsClicked(!isClicked);
        }
      }}
      title={isBacklink ? 'This is a backlink note. Click the source company name to view and edit the original note.' : undefined}
    >
      {/* Requirement 11.3: Backlink badge showing source company */}
      {isBacklink && sourceCompanyName && (
        <div
          className="backlink-badge"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '6px',
            fontSize: '10px',
            color: 'rgba(96, 165, 250, 0.9)',
            fontWeight: 500,
          }}
        >
          <span>📎</span>
          <span>Mentioned in note about</span>
          {/* Clickable source company name */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSourceCompanyClick();
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'rgba(96, 165, 250, 1)',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontWeight: 600,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'rgba(147, 197, 253, 1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(96, 165, 250, 1)';
            }}
            title="Click to view the original note"
          >
            {sourceCompanyName}
          </button>
        </div>
      )}

      {/* Note content - Requirement 1.2 */}
      <div style={{ marginBottom: '6px' }}>
        <EditorContent editor={editor} />
      </div>

      {/* Metadata and actions - Requirement 1.2 */}
      <div
        className="note-card-metadata"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: 'rgba(255, 255, 255, 0.5)',
          marginTop: '6px',
        }}
      >
        {/* Creator, timestamp, and visibility indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontWeight: 500 }}>
            {creatorName}
          </span>
          <span>•</span>
          <span>{formatTimestamp(note.createdAt)}</span>
          {note.updatedAt !== note.createdAt && (
            <>
              <span>•</span>
              <span style={{ fontStyle: 'italic' }}>edited</span>
            </>
          )}
          {/* Visibility indicator */}
          <span>•</span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
            }}
            title={isPublicNote ? 'Public note' : 'Private note'}
          >
            {isPublicNote ? (
              <>
                <Globe size={10} style={{ color: 'rgba(34, 197, 94, 0.8)' }} />
                <span style={{ color: 'rgba(34, 197, 94, 0.8)' }}>Public</span>
              </>
            ) : (
              <>
                <Lock size={10} style={{ color: 'rgba(156, 163, 175, 0.8)' }} />
                <span style={{ color: 'rgba(156, 163, 175, 0.8)' }}>Private</span>
              </>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {canModify && isClicked && (onEdit || onDelete) && (
          <div style={{ display: 'flex', gap: '4px' }}>
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent card click
                  onEdit(note.id);
                }}
                className="note-action-button"
                style={{
                  height: '22px',
                  padding: '0 6px',
                  fontSize: '10px',
                  color: 'rgba(96, 165, 250, 0.9)', // Blue color for edit
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(96, 165, 250, 0.2)';
                  e.currentTarget.style.color = 'rgba(96, 165, 250, 1)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'rgba(96, 165, 250, 0.9)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                aria-label="Edit note"
              >
                <Edit2 size={11} />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent card click
                  onDelete(note.id);
                }}
                className="note-action-button"
                style={{
                  height: '22px',
                  padding: '0 6px',
                  fontSize: '10px',
                  color: 'rgba(248, 113, 113, 0.9)', // Red color for delete
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(248, 113, 113, 0.2)';
                  e.currentTarget.style.color = 'rgba(248, 113, 113, 1)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'rgba(248, 113, 113, 0.9)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                aria-label="Delete note"
              >
                <Trash2 size={11} />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
