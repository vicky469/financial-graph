import { describe, it, expect } from 'vitest';
import { extractMentionedCompanies } from './mentionExtraction';
import type { TiptapJSON } from '../../../shared/types/types';

describe('extractMentionedCompanies', () => {
  it('should return empty array for empty document', () => {
    const content: TiptapJSON = {
      type: 'doc',
      content: [],
    };

    const result = extractMentionedCompanies(content);
    expect(result).toEqual([]);
  });

  it('should return empty array for document with no mentions', () => {
    const content: TiptapJSON = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'This is a note without any company mentions.' },
          ],
        },
      ],
    };

    const result = extractMentionedCompanies(content);
    expect(result).toEqual([]);
  });

  it('should extract single company mention', () => {
    const content: TiptapJSON = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'MSCI used to be part of ' },
            {
              type: 'companyMention',
              attrs: {
                companyId: 'jp-morgan-123',
                companyName: 'JP Morgan',
              },
            },
            { type: 'text', text: ' before spinning off in 2007.' },
          ],
        },
      ],
    };

    const result = extractMentionedCompanies(content);
    expect(result).toEqual(['jp-morgan-123']);
  });

  it('should extract multiple company mentions', () => {
    const content: TiptapJSON = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'companyMention',
              attrs: {
                companyId: 'company-a',
                companyName: 'Company A',
              },
            },
            { type: 'text', text: ' acquired ' },
            {
              type: 'companyMention',
              attrs: {
                companyId: 'company-b',
                companyName: 'Company B',
              },
            },
            { type: 'text', text: ' in 2020.' },
          ],
        },
      ],
    };

    const result = extractMentionedCompanies(content);
    expect(result).toEqual(['company-a', 'company-b']);
  });

  it('should remove duplicate company IDs', () => {
    const content: TiptapJSON = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'companyMention',
              attrs: {
                companyId: 'company-a',
                companyName: 'Company A',
              },
            },
            { type: 'text', text: ' and ' },
            {
              type: 'companyMention',
              attrs: {
                companyId: 'company-a',
                companyName: 'Company A',
              },
            },
          ],
        },
      ],
    };

    const result = extractMentionedCompanies(content);
    expect(result).toEqual(['company-a']);
  });

  it('should handle nested content structures', () => {
    const content: TiptapJSON = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'First paragraph with ' },
            {
              type: 'companyMention',
              attrs: {
                companyId: 'company-1',
                companyName: 'Company 1',
              },
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'List item with ' },
                    {
                      type: 'companyMention',
                      attrs: {
                        companyId: 'company-2',
                        companyName: 'Company 2',
                      },
                    },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Another item with ' },
                    {
                      type: 'companyMention',
                      attrs: {
                        companyId: 'company-3',
                        companyName: 'Company 3',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = extractMentionedCompanies(content);
    expect(result).toEqual(['company-1', 'company-2', 'company-3']);
  });

  it('should handle deeply nested structures', () => {
    const content: TiptapJSON = {
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'companyMention',
                      attrs: {
                        companyId: 'deep-company',
                        companyName: 'Deep Company',
                      },
                    },
                  ],
                },
                {
                  type: 'bulletList',
                  content: [
                    {
                      type: 'listItem',
                      content: [
                        {
                          type: 'paragraph',
                          content: [
                            {
                              type: 'companyMention',
                              attrs: {
                                companyId: 'nested-company',
                                companyName: 'Nested Company',
                              },
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = extractMentionedCompanies(content);
    expect(result).toEqual(['deep-company', 'nested-company']);
  });

  it('should ignore companyMention nodes without companyId', () => {
    const content: TiptapJSON = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'companyMention',
              attrs: {
                companyName: 'Company Without ID',
              },
            },
            { type: 'text', text: ' and ' },
            {
              type: 'companyMention',
              attrs: {
                companyId: 'valid-company',
                companyName: 'Valid Company',
              },
            },
          ],
        },
      ],
    };

    const result = extractMentionedCompanies(content);
    expect(result).toEqual(['valid-company']);
  });

  it('should handle document with no content array', () => {
    const content: TiptapJSON = {
      type: 'doc',
    };

    const result = extractMentionedCompanies(content);
    expect(result).toEqual([]);
  });

  it('should handle mixed content with bold text and links', () => {
    const content: TiptapJSON = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Bold text',
              marks: [{ type: 'bold' }],
            },
            { type: 'text', text: ' with ' },
            {
              type: 'companyMention',
              attrs: {
                companyId: 'company-x',
                companyName: 'Company X',
              },
            },
            { type: 'text', text: ' and a ' },
            {
              type: 'text',
              text: 'link',
              marks: [
                {
                  type: 'link',
                  attrs: { href: 'https://example.com' },
                },
              ],
            },
          ],
        },
      ],
    };

    const result = extractMentionedCompanies(content);
    expect(result).toEqual(['company-x']);
  });

  it('should extract mentions from multiple paragraphs', () => {
    const content: TiptapJSON = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'First paragraph mentions ' },
            {
              type: 'companyMention',
              attrs: {
                companyId: 'company-1',
                companyName: 'Company 1',
              },
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Second paragraph mentions ' },
            {
              type: 'companyMention',
              attrs: {
                companyId: 'company-2',
                companyName: 'Company 2',
              },
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Third paragraph mentions ' },
            {
              type: 'companyMention',
              attrs: {
                companyId: 'company-3',
                companyName: 'Company 3',
              },
            },
          ],
        },
      ],
    };

    const result = extractMentionedCompanies(content);
    expect(result).toEqual(['company-1', 'company-2', 'company-3']);
  });

  it('should handle complex real-world document structure', () => {
    const content: TiptapJSON = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Investment Analysis',
              marks: [{ type: 'bold' }],
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Key players in this space include ' },
            {
              type: 'companyMention',
              attrs: {
                companyId: 'microsoft-123',
                companyName: 'Microsoft',
              },
            },
            { type: 'text', text: ' and ' },
            {
              type: 'companyMention',
              attrs: {
                companyId: 'google-456',
                companyName: 'Google',
              },
            },
            { type: 'text', text: '.' },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'companyMention',
                      attrs: {
                        companyId: 'microsoft-123',
                        companyName: 'Microsoft',
                      },
                    },
                    { type: 'text', text: ' has strong cloud presence' },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'companyMention',
                      attrs: {
                        companyId: 'amazon-789',
                        companyName: 'Amazon',
                      },
                    },
                    { type: 'text', text: ' dominates e-commerce' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = extractMentionedCompanies(content);
    // Should deduplicate microsoft-123 which appears twice
    expect(result).toEqual(['microsoft-123', 'google-456', 'amazon-789']);
  });
});
