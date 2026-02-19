import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '../../db/client';
import { NoteCard, type TiptapJSON } from './NoteCard';
import { NoteEditor } from './NoteEditor';
import { Button } from '../ui/button';
import { ConfirmationDialog } from '../ui/confirmation-dialog';
import { useNotes } from '../../hooks/useNotes';
import { useIsAdminUser } from '../../hooks/useIsAdminUser';
import { notesForUserQuery, getNotesForCompany, type ExtendedNoteResult } from 'financial-graph-shared/db';

interface NotesViewProps {
  companyId: string;
  userId: string;
  onBack: () => void;
  initialNoteId?: string | null;
}

const NOTES_PER_PAGE = 20;

/**
 * NotesView component displays all notes for a company with pagination
 * 
 * Features:
 * - Displays all notes ordered by creation timestamp descending
 * - Pagination with 20 notes per page
 * - Previous/next and page number controls
 * - Back button to return to DetailPanel
 * - Reuses NoteCard component for display
 * 
 */
export function NotesView({ companyId, userId, onBack, initialNoteId = null }: NotesViewProps) {
  const [manualPage, setManualPage] = useState<number | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    noteId: string | null;
  }>({
    isOpen: false,
    noteId: null,
  });
  
  // Use the custom hook for CRUD operations
  const { updateNote, markReportDone, resolveReportedIssue, deleteNote, errorMessage, clearError } = useNotes();
  const { isAdmin } = useIsAdminUser(userId);

  // Query ALL notes for the user (both direct and potential backlinks)
  // Using shared query definition with proper types
  // Order by creation timestamp descending (newest first)
  const { data, isLoading, error } = db.useQuery(
    notesForUserQuery(userId, { includeOpenReports: isAdmin })
  );

  // Transform data to Note type and filter for relevant notes (direct or backlinks)
  // Using shared helper function with proper types
  const allNotes: ExtendedNoteResult[] = useMemo(() => {
    return getNotesForCompany(data, companyId);
  }, [data, companyId]);

  // Pagination logic
  const totalNotes = allNotes.length;
  const totalPages = Math.max(1, Math.ceil(totalNotes / NOTES_PER_PAGE));
  const targetNoteIndex = initialNoteId ? allNotes.findIndex((note) => note.id === initialNoteId) : -1;
  const targetPage = targetNoteIndex >= 0 ? Math.floor(targetNoteIndex / NOTES_PER_PAGE) + 1 : null;
  const preferredPage = manualPage ?? targetPage ?? 1;
  const currentPage = Math.min(Math.max(preferredPage, 1), totalPages);
  const startIndex = (currentPage - 1) * NOTES_PER_PAGE;
  const endIndex = startIndex + NOTES_PER_PAGE;
  const paginatedNotes = allNotes.slice(startIndex, endIndex);

  // Scroll to the target note once it is rendered on the active page.
  useEffect(() => {
    if (!initialNoteId) return;

    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector(`[data-note-id="${initialNoteId}"]`);
      if (target instanceof HTMLElement) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [initialNoteId, currentPage, paginatedNotes.length]);

  // Handle page navigation
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setManualPage(page);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setManualPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setManualPage(currentPage + 1);
    }
  };

  // Handle edit note
  const handleEditNote = (noteId: string) => {
    setEditingNoteId(noteId);
  };

  // Handle update note
  const handleUpdateNote = async (content: TiptapJSON, visibility: 'private' | 'public') => {
    if (!editingNoteId) return;
    
    const existingReportStatus = allNotes.find((note) => note.id === editingNoteId)?.reportStatus;
    await updateNote(editingNoteId, content, visibility, { existingReportStatus });
    setEditingNoteId(null);
    clearError();
  };

  const handleMarkDone = async (noteId: string) => {
    await markReportDone(noteId);
  };

  const handleResolveIssue = async (noteId: string) => {
    await resolveReportedIssue(noteId);
  };

  // Handle cancel editor
  const handleCancelEditor = () => {
    setEditingNoteId(null);
    clearError();
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

    await deleteNote(deleteConfirmation.noteId);
    
    // If we deleted the last note on the current page and we're not on page 1,
    // go back one page
    if (paginatedNotes.length === 1 && currentPage > 1) {
      setManualPage(currentPage - 1);
    }
    
    setDeleteConfirmation({ isOpen: false, noteId: null });
  };

  // Cancel delete confirmation
  const cancelDeleteNote = () => {
    setDeleteConfirmation({ isOpen: false, noteId: null });
  };

  // Generate page numbers to display
  const getPageNumbers = (): number[] => {
    const pages: number[] = [];
    const maxPagesToShow = 7;
    
    if (totalPages <= maxPagesToShow) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first page, last page, current page, and surrounding pages
      pages.push(1);
      
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);
      
      if (currentPage <= 3) {
        endPage = 5;
      } else if (currentPage >= totalPages - 2) {
        startPage = totalPages - 4;
      }
      
      if (startPage > 2) {
        pages.push(-1); // Ellipsis marker
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      if (endPage < totalPages - 1) {
        pages.push(-1); // Ellipsis marker
      }
      
      pages.push(totalPages);
    }
    
    return pages;
  };

  return (
    <div
      className="notes-view flex flex-col h-full"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
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
      {/* Header with back button - Requirement 4.5, 4.6 */}
      <div
        className="notes-view-header"
        style={{
          padding: '16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <button
          onClick={onBack}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.03)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
          }}
          aria-label="Back to detail panel"
        >
          <ArrowLeft size={16} color="rgba(255,255,255,0.6)" />
        </button>
        <div>
          <h2
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.95)',
              marginBottom: '2px',
            }}
          >
            All Notes
          </h2>
          <p
            style={{
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.5)',
            }}
          >
            {totalNotes} {totalNotes === 1 ? 'note' : 'notes'}
          </p>
        </div>
      </div>

      {/* Error message display */}
      {errorMessage && (
        <div
          className="note-error-message"
          style={{
            margin: '16px',
            padding: '8px 12px',
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '40px',
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '12px',
          }}
        >
          Loading notes...
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          style={{
            margin: '16px',
            padding: '12px',
            borderRadius: '6px',
            backgroundColor: 'rgba(248, 113, 113, 0.1)',
            border: '1px solid rgba(248, 113, 113, 0.3)',
            fontSize: '12px',
            color: '#f87171',
          }}
        >
          Unable to load notes. Please check your connection and try again.
        </div>
      )}

      {/* Notes list - Requirement 4.1, 4.2 */}
      {!isLoading && !error && (
        <>
          {/* Empty state */}
          {totalNotes === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '40px 20px',
                textAlign: 'center',
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '12px',
                fontStyle: 'italic',
              }}
            >
              <div>No notes yet. Go back and create your first note.</div>
              <div style={{ marginTop: '6px' }}>Tag @admin in the note if you see any data issue.</div>
            </div>
          )}

          {/* Paginated notes list */}
          {totalNotes > 0 && (
            <>
              <div
                className="flex-1 overflow-y-auto"
                style={{
                  padding: '16px',
                  scrollbarWidth: 'thin',
                  scrollbarGutter: 'stable',
                }}
              >
                {paginatedNotes.map((note) => {
                  // Show editor inline when editing this specific note
                  if (editingNoteId === note.id) {
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
                    <div
                      key={note.id}
                      data-note-id={note.id}
                      style={{
                        borderRadius: '8px',
                        outline: note.id === initialNoteId ? '1px solid rgba(96, 165, 250, 0.6)' : 'none',
                        boxShadow: note.id === initialNoteId ? '0 0 0 2px rgba(96, 165, 250, 0.18)' : 'none',
                      }}
                    >
                      <NoteCard
                        note={note}
                        currentUserId={userId}
                        isAdminUser={isAdmin}
                        onEdit={handleEditNote}
                        onDelete={handleDeleteNote}
                        onMarkDone={handleMarkDone}
                        onResolveIssue={handleResolveIssue}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Pagination controls - Requirement 4.4 */}
              {totalPages > 1 && (
                <div
                  style={{
                    padding: '16px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  {/* Previous button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                    className="pagination-button"
                    style={{
                      fontSize: '12px',
                      padding: '6px 12px',
                    }}
                  >
                    <ChevronLeft size={14} />
                    Previous
                  </Button>

                  {/* Page numbers */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      flex: 1,
                      justifyContent: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    {getPageNumbers().map((pageNum, index) => {
                      if (pageNum === -1) {
                        // Ellipsis
                        return (
                          <span
                            key={`ellipsis-${index}`}
                            style={{
                              padding: '6px 8px',
                              fontSize: '12px',
                              color: 'rgba(255, 255, 255, 0.3)',
                            }}
                          >
                            ...
                          </span>
                        );
                      }

                      const isActive = pageNum === currentPage;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => goToPage(pageNum)}
                          className="pagination-page-button"
                          style={{
                            padding: '6px 10px',
                            fontSize: '12px',
                            borderRadius: '4px',
                            border: isActive
                              ? '1px solid rgba(96, 165, 250, 0.5)'
                              : '1px solid rgba(255, 255, 255, 0.1)',
                            backgroundColor: isActive
                              ? 'rgba(96, 165, 250, 0.2)'
                              : 'rgba(255, 255, 255, 0.02)',
                            color: isActive
                              ? '#60a5fa'
                              : 'rgba(255, 255, 255, 0.7)',
                            cursor: 'pointer',
                            fontWeight: isActive ? 600 : 400,
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                            }
                          }}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  {/* Next button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                    className="pagination-button"
                    style={{
                      fontSize: '12px',
                      padding: '6px 12px',
                    }}
                  >
                    Next
                    <ChevronRight size={14} />
                  </Button>
                </div>
              )}

              {/* Page info */}
              <div
                style={{
                  padding: '8px 16px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.4)',
                  textAlign: 'center',
                }}
              >
                Showing {startIndex + 1}-{Math.min(endIndex, totalNotes)} of {totalNotes}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
