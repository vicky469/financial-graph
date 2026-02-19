import { useState, useMemo } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { db } from '../../db/client';
import { NoteCard, type TiptapJSON } from './NoteCard';
import { NoteEditor } from './NoteEditor';
import { Button } from '../ui/button';
import { ConfirmationDialog } from '../ui/confirmation-dialog';
import { useNotes } from '../../hooks/useNotes';
import { notesForUserQuery, getNotesForCompany, type ExtendedNoteResult } from 'financial-graph-shared/db';

interface NotesSectionProps {
  companyId: string;
  userId: string;
  onShowAll?: () => void;
}

/**
 * NotesSection component displays notes for a company in the DetailPanel
 * 
 * Features:
 * - Displays up to 3 most recent notes
 * - "Create Note" button to add new notes
 * - "Show All" button when more than 3 notes exist
 * - Empty state when no notes exist
 * - Optimistic updates for create/edit/delete operations
 * 
 */
export function NotesSection({ companyId, userId, onShowAll }: NotesSectionProps) {
  const [showEditor, setShowEditor] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    noteId: string | null;
  }>({
    isOpen: false,
    noteId: null,
  });
  
  // Use the custom hook for CRUD operations and error handling
  const { createNote, updateNote, deleteNote, errorMessage, clearError } = useNotes();

  // Query ALL notes for the user (both direct and potential backlinks)
  // Using shared query definition with proper types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading, error } = db.useQuery(notesForUserQuery(userId) as any);

  // Transform data to Note type and filter for relevant notes (direct or backlinks)
  // Using shared helper function with proper types
  const allNotes: ExtendedNoteResult[] = useMemo(() => {
    return getNotesForCompany(data, companyId);
  }, [data, companyId]);

  // Display up to 5 most recent notes
  const displayedNotes = allNotes.slice(0, 5);
  const hasMoreNotes = allNotes.length > 5;

  // Handle create note
  const handleCreateNote = async (content: TiptapJSON, visibility: 'private' | 'public') => {
    // Optimistic update - create note immediately in UI
    await createNote(companyId, userId, content, visibility);
    setShowEditor(false);
  };

  // Handle edit note - opens editor with existing content
  const handleEditNote = (noteId: string) => {
    setEditingNoteId(noteId);
    setShowEditor(true);
  };

  // Handle update note
  const handleUpdateNote = async (content: TiptapJSON, visibility: 'private' | 'public') => {
    if (!editingNoteId) return;
    
    // Optimistic update - update note immediately in UI
    await updateNote(editingNoteId, content, visibility);
    setShowEditor(false);
    setEditingNoteId(null);
  };

  // Handle delete note - show confirmation dialog before deletion
  const handleDeleteNote = (noteId: string) => {
    setDeleteConfirmation({
      isOpen: true,
      noteId,
    });
  };

  // Confirm delete note
  const confirmDeleteNote = async () => {
    if (!deleteConfirmation.noteId) return;

    // Optimistic update - remove note immediately from UI
    await deleteNote(deleteConfirmation.noteId);
    setDeleteConfirmation({ isOpen: false, noteId: null });
  };

  // Cancel delete confirmation
  const cancelDeleteNote = () => {
    setDeleteConfirmation({ isOpen: false, noteId: null });
  };

  // Handle cancel editor
  const handleCancelEditor = () => {
    setShowEditor(false);
    setEditingNoteId(null);
    clearError();
  };

  // Handle show all notes - will be used by parent component
  const handleShowAll = () => {
    // This will be handled by the parent component (DetailPanel)
    // by switching to NotesView
    if (onShowAll) {
      onShowAll();
    }
  };

  return (
    <div
      className="notes-section"
      style={{
        padding: '0 16px 16px 16px',
      }}
    >
      {/* Confirmation Dialog - Requirement 5.6 */}
      <ConfirmationDialog
        isOpen={deleteConfirmation.isOpen}
        onClose={cancelDeleteNote}
        onConfirm={confirmDeleteNote}
        title="Delete Note"
        message="Are you sure you want to delete this note? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
      {/* Section header with create button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          marginTop: '16px',
        }}
      >
        <h3
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            margin: 0,
          }}
        >
          Notes
        </h3>
        {!showEditor && (
          <button
            onClick={() => {
              setEditingNoteId(null);
              setShowEditor(true);
              clearError();
            }}
            className="create-note-button"
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              color: 'rgba(96, 165, 250, 0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(96, 165, 250, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label="Create note"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      {/* Error message display - Requirement 10.1, 10.2, 10.3 */}
      {errorMessage && (
        <div
          className="note-error-message"
          style={{
            padding: '8px 12px',
            marginBottom: '12px',
            borderRadius: '6px',
            backgroundColor: 'rgba(248, 113, 113, 0.1)',
            border: '1px solid rgba(248, 113, 113, 0.3)',
            fontSize: '12px',
            color: '#f87171',
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="notes-loading">
          <div className="notes-loading-spinner" />
          <div className="notes-loading-text">Loading notes...</div>
        </div>
      )}

      {/* Error state - Requirement 10.5 */}
      {error && (
        <div
          style={{
            padding: '12px',
            borderRadius: '6px',
            backgroundColor: 'rgba(248, 113, 113, 0.1)',
            border: '1px solid rgba(248, 113, 113, 0.3)',
            fontSize: '12px',
            color: '#f87171',
            marginBottom: '12px',
          }}
        >
          Unable to load notes. Please check your connection and try again.
        </div>
      )}

      {/* Notes list or empty state */}
      {!isLoading && !error && (
        <>
          {/* Requirement 1.4: Empty state */}
          {allNotes.length === 0 && !showEditor && (
            <div
              style={{
                padding: '20px 12px',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.4)',
                fontSize: '12px',
                fontStyle: 'italic',
              }}
            >
              <div>No notes yet. Create your first note to get started.</div>
              <div style={{ marginTop: '6px' }}>Tag @admin in the note if you see any data issue.</div>
            </div>
          )}

          {/* Requirement 1.1, 1.2: Display up to 3 notes */}
          {displayedNotes.map((note) => {
            // Show editor inline when editing this specific note
            if (editingNoteId === note.id && showEditor) {
              return (
                <NoteEditor
                  key={note.id}
                  companyId={companyId}
                  userId={userId}
                  initialContent={note.content}
                  initialVisibility={note.visibility}
                  noteId={note.id}
                  onSave={handleUpdateNote}
                  onCancel={handleCancelEditor}
                />
              );
            }
            
            return (
              <NoteCard
                key={note.id}
                note={note}
                currentUserId={userId}
                onEdit={handleEditNote}
                onDelete={handleDeleteNote}
              />
            );
          })}

          {/* Note editor for creating new notes - Requirement 2.1 */}
          {showEditor && !editingNoteId && (
            <NoteEditor
              companyId={companyId}
              userId={userId}
              initialContent={undefined}
              initialVisibility={undefined}
              noteId={undefined}
              onSave={handleCreateNote}
              onCancel={handleCancelEditor}
            />
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            {/* Show All button - Requirement 1.3 */}
            {hasMoreNotes && !showEditor && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShowAll}
                className="show-all-button"
                style={{
                  fontSize: '12px',
                  color: 'rgba(96, 165, 250, 0.9)',
                  width: '100%',
                }}
              >
                Show All ({allNotes.length})
                <ChevronRight size={14} />
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
