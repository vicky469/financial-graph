/**
 * Notes and Tiptap Types
 * 
 * Types for the notes system and Tiptap editor
 */

import type { InstaQLEntity } from "@instantdb/core";
import type schema from "../instant.schema";

// ============================================================================
// RAW TYPES
// ============================================================================

export type NoteRaw = InstaQLEntity<typeof schema, "notes">;

// ============================================================================
// TIPTAP JSON TYPES
// ============================================================================

/** Tiptap mark (formatting like bold, italic, link) */
export interface TiptapMark {
  type: string;
  attrs?: Record<string, any>;
}

/** Tiptap node (content element like paragraph, text, custom nodes) */
export interface TiptapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
}

/** Tiptap JSON document structure */
export interface TiptapJSON {
  type: "doc";
  content?: TiptapNode[];
}

// ============================================================================
// NOTE INTERFACES
// ============================================================================

/** Note with properly typed `content` (Tiptap JSON) and `createdBy` */
export interface Note extends Omit<NoteRaw, "content" | "createdBy" | "createdAt" | "updatedAt"> {
  content: TiptapJSON;
  createdBy: "user" | "system";
  createdAt: number; // InstantDB returns timestamps as numbers
  updatedAt: number; // InstantDB returns timestamps as numbers
  mentionedCompanyIds?: string[]; // Array of company IDs mentioned in the note
  visibility: "private" | "public"; // Note visibility setting, defaults to 'private'
  user?: {
    id: string;
    email?: string;
  };
  company?: {
    id: string;
    name: string;
  };
}

/** Extended type for displaying backlink notes */
export interface BacklinkNote extends Note {
  isBacklink: boolean; // True if this note mentions the current company
  sourceCompanyId: string; // The primary company this note belongs to
  sourceCompanyName: string; // Name of the source company
}
