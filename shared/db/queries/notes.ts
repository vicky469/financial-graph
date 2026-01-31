/**
 * Notes Query Definitions
 *
 * Reusable query definitions for notes lookups.
 * Can be used with db.useQuery() (frontend) or db.queryOnce() (backend).
 */

import type { Note } from "../../types";

/**
 * Query definition: Get all notes for a user (private + public)
 * 
 * @param userId - The user ID to filter notes for
 * @returns Query object for InstantDB
 */
export function notesForUserQuery(userId: string) {
  return {
    notes: {
      $: {
        where: {
          or: [
            // User's private notes
            { 
              'user.id': userId,
              visibility: 'private'
            },
            // All public notes
            { 
              visibility: 'public'
            },
          ]
        },
        order: {
          serverCreatedAt: 'desc', // Most recent first
        },
      },
      user: {}, // Fetch user relation
      company: {}, // Fetch company relation
    },
  };
}

// Type for the query result - uses Note interface with proper types
export type NotesQueryResult = {
  notes: Note[];
};

/**
 * Extended note type with backlink metadata
 */
export interface ExtendedNoteResult extends Note {
  isBacklink?: boolean;
  sourceCompanyId?: string;
  sourceCompanyName?: string;
}

/**
 * Helper: Filter notes for a specific company (direct notes + backlinks)
 * 
 * @param data - Query result from InstantDB
 * @param companyId - The company ID to filter for
 * @returns Array of notes relevant to the company
 */
export function filterNotesForCompany(
  notes: NotesQueryResult['notes'],
  companyId: string
): ExtendedNoteResult[] {
  return notes
    .filter((note) => {
      // Include if it's a direct note for this company
      const isDirectNote = note.company?.id === companyId;
      
      // Include if this company is mentioned in the note
      const isMentioned = note.mentionedCompanyIds && 
                         Array.isArray(note.mentionedCompanyIds) && 
                         note.mentionedCompanyIds.includes(companyId);
      
      // Include the note if it's either direct or a backlink
      return isDirectNote || isMentioned;
    })
    .map((note) => {
      // Determine if this is a backlink note
      const isDirectNote = note.company?.id === companyId;
      const isMentioned = note.mentionedCompanyIds && 
                         Array.isArray(note.mentionedCompanyIds) && 
                         note.mentionedCompanyIds.includes(companyId);
      const isBacklink = !isDirectNote && isMentioned;
      
      return {
        ...note,
        // Add backlink metadata if this is a backlink
        isBacklink,
        sourceCompanyId: isBacklink ? note.company?.id : undefined,
        sourceCompanyName: isBacklink ? note.company?.name : undefined,
      };
    });
}

/**
 * Helper: Get notes for a specific company with proper typing
 * 
 * @param data - Raw query result from InstantDB
 * @param companyId - The company ID to filter for
 * @returns Typed array of notes for the company
 */
export function getNotesForCompany(
  data: any,
  companyId: string
): ExtendedNoteResult[] {
  if (!data?.notes) return [];
  return filterNotesForCompany(data.notes, companyId);
}
