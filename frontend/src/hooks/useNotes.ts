/**
 * useNotes Hook - CRUD operations for notes with error handling
 * 
 * Provides functions for creating, updating, and deleting notes with:
 * - InstantDB transact operations
 * - Comprehensive error handling
 * - Error message state management
 * - Mention extraction and tracking
 * - Visibility management
 * 
 * Requirements: 2.7, 5.5, 5.6, 5.7, 10.1, 10.2, 10.3, 11.1, 11.6, 12.1, 12.7
 */

import { useState } from "react";
import { db, tx, id } from "../db/client";
import { extractMentionedCompanies } from "../utils/mentionExtraction";
import { hasFeature } from "../config/featureFlags";
import { hasAdminMention } from "../utils/noteReporting";
import type { Note, TiptapJSON } from "financial-graph-shared/types";

interface UpdateNoteOptions {
  existingReportStatus?: Note["reportStatus"];
}

export interface UseNotesReturn {
  createNote: (companyId: string, userId: string, content: TiptapJSON, visibility?: "private" | "public") => Promise<void>;
  updateNote: (
    noteId: string,
    content: TiptapJSON,
    visibility?: "private" | "public",
    options?: UpdateNoteOptions
  ) => Promise<void>;
  markReportDone: (noteId: string) => Promise<void>;
  resolveReportedIssue: (noteId: string) => Promise<void>;
  deleteNote: (noteId: string, onConfirm?: () => void) => Promise<void>;
  errorMessage: string | null;
  clearError: () => void;
}

/**
 * Custom hook for note CRUD operations
 * 
 * @returns Object containing CRUD functions and error state
 */
export function useNotes(): UseNotesReturn {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Create a new note
   * 
   * Store note content, timestamp, and user identifier in InstantDB
   * Display error message on save failure
   * Extract and store mentionedCompanyIds from content
   * Default visibility to 'private'
   * 
   * @param companyId - ID of the company to associate the note with
   * @param userId - ID of the user creating the note
   * @param content - Tiptap JSON content of the note
   * @param visibility - Note visibility ('private' or 'public'), defaults to 'private'
   */
  const createNote = async (
    companyId: string,
    userId: string,
    content: TiptapJSON,
    visibility: "private" | "public" = "private"
  ): Promise<void> => {
    try {
      setErrorMessage(null);

      const effectiveVisibility = hasFeature("workspace") ? visibility : "private";
      const shouldOpenReport = hasAdminMention(content);

      // Generate unique ID for the note
      const noteId = id();
      const now = new Date().toISOString();

      // Extract mentioned company IDs from content
      const mentionedCompanyIds = extractMentionedCompanies(content);

      // Transact to InstantDB with optimistic update
      // Default visibility to 'private'
      await db.transact([
        tx.notes[noteId]
          .update({
            content,
            createdAt: now,
            updatedAt: now,
            createdBy: "user",
            mentionedCompanyIds,
            visibility: effectiveVisibility,
            disabled: false,
            reportStatus: shouldOpenReport ? "open" : undefined,
            adminDoneAt: undefined,
            resolvedAt: undefined,
          })
          .link({ user: userId })
          .link({ company: companyId }),
      ]);
    } catch (err) {
      // Display error message on failure
      const message = err instanceof Error ? err.message : "Unknown error occurred";
      console.error("Failed to create note:", err);
      setErrorMessage(`Failed to create note: ${message}`);
      throw err; // Re-throw to allow caller to handle
    }
  };

  /**
   * Update an existing note
   * 
   * Requirement 5.5: Update note content and updatedAt timestamp
   * Requirement 10.2: Display error message on edit failure and preserve edits
   * Requirement 11.6: Re-extract and update mentionedCompanyIds on edit
   * Requirement 12.7: Allow visibility changes when editing
   * 
   * @param noteId - ID of the note to update
   * @param content - New Tiptap JSON content
   * @param visibility - Optional new visibility setting
   */
  const updateNote = async (
    noteId: string,
    content: TiptapJSON,
    visibility?: "private" | "public",
    options?: UpdateNoteOptions
  ): Promise<void> => {
    try {
      setErrorMessage(null);

      // Update timestamp on edit
      const now = new Date().toISOString();

      // Re-extract mentioned company IDs from updated content
      const mentionedCompanyIds = extractMentionedCompanies(content);
      const shouldOpenReport = hasAdminMention(content);

      // Build update object
      const updateData: any = {
        content,
        updatedAt: now,
        mentionedCompanyIds,
      };

      if (!options?.existingReportStatus && shouldOpenReport) {
        updateData.disabled = false;
        updateData.reportStatus = "open";
        updateData.adminDoneAt = undefined;
        updateData.resolvedAt = undefined;
      }

      if (options?.existingReportStatus === "resolved" && shouldOpenReport) {
        updateData.disabled = false;
        updateData.reportStatus = "open";
        updateData.adminDoneAt = undefined;
        updateData.resolvedAt = undefined;
      }

      if (hasFeature("workspace")) {
        // Update visibility if provided
        if (visibility !== undefined) {
          updateData.visibility = visibility;
        }
      } else {
        // Force private visibility when workspace feature is disabled
        updateData.visibility = "private";
      }

      await db.transact([
        tx.notes[noteId].update(updateData),
      ]);
    } catch (err) {
      // Display error message and preserve user's edits
      const message = err instanceof Error ? err.message : "Unknown error occurred";
      console.error("Failed to update note:", err);
      setErrorMessage(`Failed to update note: ${message}`);
      throw err; // Re-throw to allow caller to handle
    }
  };

  const markReportDone = async (noteId: string): Promise<void> => {
    try {
      setErrorMessage(null);
      const now = new Date().toISOString();

      await db.transact([
        tx.notes[noteId].update({
          disabled: false,
          reportStatus: "done",
          adminDoneAt: now,
          updatedAt: now,
        }),
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error occurred";
      console.error("Failed to mark report as done:", err);
      setErrorMessage(`Failed to mark report as done: ${message}`);
      throw err;
    }
  };

  const resolveReportedIssue = async (noteId: string): Promise<void> => {
    try {
      setErrorMessage(null);
      const now = new Date().toISOString();

      await db.transact([
        tx.notes[noteId].update({
          disabled: true,
          reportStatus: "resolved",
          resolvedAt: now,
          updatedAt: now,
        }),
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error occurred";
      console.error("Failed to resolve report:", err);
      setErrorMessage(`Failed to resolve report: ${message}`);
      throw err;
    }
  };

  /**
   * Delete a note with confirmation
   * 
   * Requirement 5.6: Prompt for confirmation before deletion (handled by caller)
   * Delete a note with confirmation
   * 
   * Removes note from InstantDB and displays error message on failure
   * 
   * @param noteId - ID of the note to delete
   * 
   * Note: Confirmation should be handled by the calling component using ConfirmationDialog
   */
  const deleteNote = async (noteId: string): Promise<void> => {
    try {
      setErrorMessage(null);

      // Remove note from InstantDB
      await db.transact([tx.notes[noteId].delete()]);
    } catch (err) {
      // Display error message on failure
      const message = err instanceof Error ? err.message : "Unknown error occurred";
      console.error("Failed to delete note:", err);
      setErrorMessage(`Failed to delete note: ${message}`);
      throw err; // Re-throw to allow caller to handle
    }
  };

  /**
   * Clear the current error message
   */
  const clearError = () => {
    setErrorMessage(null);
  };

  return {
    createNote,
    updateNote,
    markReportDone,
    resolveReportedIssue,
    deleteNote,
    errorMessage,
    clearError,
  };
}
