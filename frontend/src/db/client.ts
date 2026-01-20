// InstantDB Client Initialization and Shared Utilities

import { init, tx, id } from "@instantdb/react";
import { schema } from "financial-graph-shared";

const APP_ID = import.meta.env.VITE_INSTANTDB_APP_ID;

// Initialize with schema - Google OAuth is handled separately
export const db = init({ 
  appId: APP_ID,
  schema,
});

// Google OAuth configuration
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const GOOGLE_CLIENT_NAME = import.meta.env.VITE_GOOGLE_CLIENT_NAME;

// Current user context (set from state machine)
let currentUser = { userId: "", userName: "" };

export const setCurrentUser = (userId: string, userName: string) => {
  currentUser = { userId, userName };
};

export const getCurrentUser = () => currentUser;

// Session management utilities
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
const SESSION_KEY = 'financial_graph_session';

export const setSession = (user: { id: string; email?: string; imageURL?: string }) => {
  const session = {
    user,
    timestamp: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const getSession = () => {
  try {
    const sessionData = localStorage.getItem(SESSION_KEY);
    if (!sessionData) return null;
    
    const session = JSON.parse(sessionData);
    if (Date.now() > session.expiresAt) {
      clearSession();
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('Error reading session:', error);
    clearSession();
    return null;
  }
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

export const isSessionValid = () => {
  const session = getSession();
  return session !== null;
};

export { tx, id };
