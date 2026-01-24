import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';

/**
 * Base editor configuration for the Notes feature
 * Includes StarterKit (bold, lists, etc.) and Link extensions
 * 
 * Note: We create Link extensions with unique names to avoid Tiptap warnings
 * about duplicate extension names when multiple editors exist on the same page
 */
export const createEditorConfig = (content?: string, editorId?: string) => {
  // Create a unique Link extension instance to avoid duplicate name warnings
  const LinkExtension = Link.extend({
    name: editorId ? `link-${editorId}` : 'link',
  });

  return {
    extensions: [
      StarterKit.configure({
        // Configure StarterKit extensions - use empty object to enable, false to disable
        heading: false, // Disable headings for notes
        blockquote: false, // Disable blockquotes for notes
        code: false, // Disable code blocks for notes
        codeBlock: false,
        horizontalRule: false,
      }),
      LinkExtension.configure({
        openOnClick: false, // Don't open links while editing
        HTMLAttributes: {
          class: 'text-blue-600 underline cursor-pointer',
        },
      }),
    ],
    content: content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm focus:outline-none min-h-[100px] p-3',
      },
    },
  };
};

/**
 * Hook to create a Tiptap editor instance with base configuration
 */
export const useNoteEditor = (initialContent?: string, editorId?: string) => {
  const editor = useEditor(createEditorConfig(initialContent, editorId));
  return editor;
};
