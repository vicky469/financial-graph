import { Node, mergeAttributes } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';

export interface CompanyMentionOptions {
  HTMLAttributes: Record<string, any>;
  renderLabel: (props: { node: any }) => string;
  suggestion: any;
  onNavigate?: (companyId: string) => void; // Add navigation callback
}

export const CompanyMentionPluginKey = new PluginKey('companyMention');

/**
 * CompanyMention Tiptap Extension
 * 
 * Creates a custom node type for company mentions that:
 * - Renders as underlined, clickable links
 * - Navigates to company page in same tab when clicked
 * - Stores company ID and name as attributes
 * 
 */
export const CompanyMention = Node.create<CompanyMentionOptions>({
  name: 'companyMention',

  group: 'inline',

  inline: true,

  selectable: false,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      renderLabel: ({ node }) => `@${node.attrs.companyName}`,
      suggestion: {},
      onNavigate: undefined,
    };
  },

  addAttributes() {
    return {
      companyId: {
        default: null,
        parseHTML: element => element.getAttribute('data-company-id'),
        renderHTML: attributes => {
          if (!attributes.companyId) {
            return {};
          }
          return {
            'data-company-id': attributes.companyId,
          };
        },
      },
      companyName: {
        default: null,
        parseHTML: element => element.getAttribute('data-company-name'),
        renderHTML: attributes => {
          if (!attributes.companyName) {
            return {};
          }
          return {
            'data-company-name': attributes.companyName,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="company-mention"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { companyId, companyName } = node.attrs;
    
    const href = `/company/${companyId}`;

    return [
      'a',
      mergeAttributes(
        {
          'data-type': 'company-mention',
          'data-company-id': companyId,
          'data-company-name': companyName,
          href,
          class: 'company-mention',
          style: 'text-decoration: underline; text-decoration-skip-ink: none; color: #60a5fa; cursor: pointer;',
        },
        HTMLAttributes
      ),
      `@${companyName}`,
    ];
  },

  renderText({ node }) {
    return `@${node.attrs.companyName}`;
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () =>
        this.editor.commands.command(({ tr, state }) => {
          let isMention = false;
          const { selection } = state;
          const { empty, anchor } = selection;

          if (!empty) {
            return false;
          }

          state.doc.nodesBetween(anchor - 1, anchor, (node, pos) => {
            if (node.type.name === this.name) {
              isMention = true;
              tr.insertText('', pos, pos + node.nodeSize);

              return false;
            }
          });

          return isMention;
        }),
    };
  },
});
