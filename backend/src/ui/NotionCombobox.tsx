import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface NotionOption {
  value: string;
  label: string;
  color: 'gray' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'red';
}

interface NotionComboboxProps {
  options: NotionOption[];
  value: string | null;
  onChange: (value: string | null, option?: NotionOption) => void;
  onCreateOption?: (newOption: NotionOption) => void;
  onDeleteOption?: (value: string) => void;
  onUpdateOption?: (value: string, updates: Partial<NotionOption>) => void;
  placeholder?: string;
  creatable?: boolean;
  label?: string;
}

// Dark theme optimized colors - higher contrast, more vibrant
const NOTION_COLORS: Record<NotionOption['color'], { text: string; bg: string; border: string }> = {
  gray: { text: '#e5e7eb', bg: 'rgba(75, 85, 99, 0.4)', border: 'rgba(156, 163, 175, 0.4)' },
  brown: { text: '#fdba74', bg: 'rgba(180, 83, 9, 0.35)', border: 'rgba(251, 146, 60, 0.5)' },
  orange: { text: '#fb923c', bg: 'rgba(234, 88, 12, 0.35)', border: 'rgba(251, 146, 60, 0.5)' },
  yellow: { text: '#fcd34d', bg: 'rgba(202, 138, 4, 0.35)', border: 'rgba(252, 211, 77, 0.5)' },
  green: { text: '#86efac', bg: 'rgba(22, 163, 74, 0.35)', border: 'rgba(134, 239, 172, 0.5)' },
  blue: { text: '#93c5fd', bg: 'rgba(37, 99, 235, 0.35)', border: 'rgba(147, 197, 253, 0.5)' },
  purple: { text: '#d8b4fe', bg: 'rgba(147, 51, 234, 0.35)', border: 'rgba(216, 180, 254, 0.5)' },
  pink: { text: '#f9a8d4', bg: 'rgba(219, 39, 119, 0.35)', border: 'rgba(249, 168, 212, 0.5)' },
  red: { text: '#fca5a5', bg: 'rgba(220, 38, 38, 0.35)', border: 'rgba(252, 165, 165, 0.5)' },
};

const COLOR_ORDER: NotionOption['color'][] = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];

export function NotionCombobox({
  options,
  value,
  onChange,
  onCreateOption,
  onDeleteOption,
  onUpdateOption,
  placeholder = 'Select an option or create one',
  creatable = true,
  label,
}: NotionComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [filteredOptions, setFilteredOptions] = useState<NotionOption[]>(options);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  // Ensure selected option has a valid color
  const selectedColor = selectedOption?.color && NOTION_COLORS[selectedOption.color] 
    ? selectedOption.color 
    : 'gray';

  // Filter options based on input
  useEffect(() => {
    const filtered = options.filter(opt =>
      opt.label.toLowerCase().includes(inputValue.toLowerCase()) ||
      opt.value.toLowerCase().includes(inputValue.toLowerCase())
    );
    setFilteredOptions(filtered);
    setActiveIndex(0);
  }, [inputValue, options]);

  // Scroll dropdown into view when it opens
  useEffect(() => {
    if (isOpen && listboxRef.current) {
      setTimeout(() => {
        listboxRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest',
          inline: 'nearest'
        });
      }, 100);
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll active option into view
  useEffect(() => {
    if (isOpen && listboxRef.current) {
      const activeElement = listboxRef.current.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsOpen(true);
  };

  const handleSelect = useCallback((option: NotionOption) => {
    onChange(option.value, option);
    setInputValue('');
    setIsOpen(false);
    setMenuOpen(null);
    inputRef.current?.blur();
  }, [onChange]);

  const handleCreate = useCallback(() => {
    if (!inputValue.trim() || !creatable) return;
    
    const existing = options.find(opt => 
      opt.label.toLowerCase() === inputValue.trim().toLowerCase()
    );
    if (existing) {
      handleSelect(existing);
      return;
    }

    const newOption: NotionOption = {
      value: inputValue.trim().toLowerCase().replace(/\s+/g, '_'),
      label: inputValue.trim(),
      color: 'gray',
    };
    onCreateOption?.(newOption);
    onChange(newOption.value, newOption);
    setInputValue('');
    setIsOpen(false);
    inputRef.current?.blur();
  }, [inputValue, creatable, options, onCreateOption, onChange, handleSelect]);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setInputValue('');
    inputRef.current?.focus();
  };

  const handleDelete = (e: React.MouseEvent, optionValue: string) => {
    e.stopPropagation();
    onDeleteOption?.(optionValue);
    setMenuOpen(null);
    if (value === optionValue) {
      onChange(null);
    }
  };

  const handleColorChange = (e: React.MouseEvent, optionValue: string, color: NotionOption['color']) => {
    e.stopPropagation();
    onUpdateOption?.(optionValue, { color });
    setMenuOpen(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setActiveIndex(prev => 
            prev < filteredOptions.length - (canCreate ? 0 : 1) ? prev + 1 : prev
          );
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (isOpen) {
          if (activeIndex < filteredOptions.length) {
            handleSelect(filteredOptions[activeIndex]);
          } else if (canCreate && inputValue.trim()) {
            handleCreate();
          }
        } else {
          setIsOpen(true);
        }
        break;
      case 'Escape':
        e.preventDefault();
        if (menuOpen) {
          setMenuOpen(null);
        } else {
          setIsOpen(false);
          inputRef.current?.blur();
        }
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      case 'Backspace':
        if (!inputValue && selectedOption) {
          e.preventDefault();
          onChange(null);
        }
        break;
    }
  };

  const canCreate = creatable && 
    inputValue.trim() && 
    !options.some(opt => opt.label.toLowerCase() === inputValue.trim().toLowerCase());

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {label && (
        <label style={{
          display: 'block',
          fontSize: '14px',
          fontWeight: 500,
          color: '#e5e7eb',
          marginBottom: '8px',
        }}>
          {label}
        </label>
      )}
      
      {/* Input Container */}
      <div
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '6px',
          minHeight: '36px',
          padding: '4px 8px',
          background: '#1a1a1a',
          border: isOpen ? '1px solid #3b82f6' : '1px solid #2a2a2a',
          borderRadius: '6px',
          cursor: 'text',
          transition: 'all 0.15s ease',
          boxShadow: isOpen ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none',
        }}
      >
        {/* Selected Chip */}
        {selectedOption && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: '22px',
              padding: '0 6px',
              borderRadius: '4px',
              background: NOTION_COLORS[selectedColor].bg,
              color: NOTION_COLORS[selectedColor].text,
              fontSize: '13px',
              fontWeight: 500,
              lineHeight: '1',
              whiteSpace: 'nowrap',
              gap: '4px',
              userSelect: 'text',
              WebkitUserSelect: 'text',
            }}
          >
            <span style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>{selectedOption.label}</span>
            <button
              type="button"
              onClick={handleClear}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '16px',
                height: '16px',
                padding: 0,
                margin: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderRadius: '3px',
                color: 'inherit',
                opacity: 0.6,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
              aria-label="Remove"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 8.707l3.146 3.147a.5.5 0 0 0 .708-.708L8.707 8l3.147-3.146a.5.5 0 0 0-.708-.708L8 7.293 4.854 4.146a.5.5 0 1 0-.708.708L7.293 8l-3.147 3.146a.5.5 0 0 0 .708.708L8 8.707z"/>
              </svg>
            </button>
          </span>
        )}

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={!selectedOption ? placeholder : ''}
          style={{
            flex: 1,
            minWidth: '60px',
            height: '26px',
            padding: '0',
            border: 'none',
            background: 'transparent',
            color: '#e5e7eb',
            fontSize: '14px',
            outline: 'none',
            fontFamily: 'inherit',
          }}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls="notion-combobox-listbox"
          aria-activedescendant={isOpen ? `option-${activeIndex}` : undefined}
        />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={listboxRef}
          id="notion-combobox-listbox"
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            padding: '6px',
            overflow: 'visible',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 8px 6px',
            color: '#9ca3af',
            fontSize: '11px',
            fontWeight: 500,
          }}>
            <span>{placeholder}</span>
          </div>

          {/* Options */}
          {filteredOptions.length === 0 && !canCreate ? (
            <div style={{
              padding: '8px',
              color: '#6b7280',
              fontSize: '13px',
              textAlign: 'center',
            }}>
              No options found
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'visible' }}>
              {filteredOptions.map((option, index) => {
                const isActive = index === activeIndex;
                const isMenuOpen = menuOpen === option.value;
                const optionColor = option.color && NOTION_COLORS[option.color] ? option.color : 'gray';
                const colors = NOTION_COLORS[optionColor];
                return (
                  <div
                    key={option.value}
                    id={`option-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={value === option.value}
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setActiveIndex(index)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      background: isActive ? '#222222' : 'transparent',
                      transition: 'background 0.15s ease',
                      position: 'relative',
                    }}
                  >
                    {/* Colored Badge or Edit Input */}
                    {editingOption === option.value ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.stopPropagation();
                            if (editValue.trim()) {
                              onUpdateOption?.(option.value, { label: editValue.trim() });
                            }
                            setEditingOption(null);
                          } else if (e.key === 'Escape') {
                            e.stopPropagation();
                            setEditingOption(null);
                          }
                        }}
                        onBlur={() => {
                          if (editValue.trim() && editValue !== option.label) {
                            onUpdateOption?.(option.value, { label: editValue.trim() });
                          }
                          setEditingOption(null);
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          flex: 1,
                          height: '24px',
                          padding: '0 8px',
                          borderRadius: '4px',
                          background: colors.bg,
                          color: colors.text,
                          fontSize: '13px',
                          fontWeight: 500,
                          border: `1px solid ${colors.border}`,
                          outline: 'none',
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          height: '24px',
                          padding: '0 8px',
                          borderRadius: '4px',
                          background: colors.bg,
                          color: colors.text,
                          fontSize: '13px',
                          fontWeight: 500,
                          lineHeight: '1',
                          whiteSpace: 'nowrap',
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        {option.label}
                      </span>
                    )}

                    {/* Spacer */}
                    <span style={{ flex: 1 }} />

                    {/* Three Dots Menu Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(isMenuOpen ? null : option.value);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        padding: 0,
                        border: 'none',
                        background: isMenuOpen ? '#333' : 'transparent',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        color: '#6b7280',
                        opacity: 1,
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#333';
                        e.currentTarget.style.color = '#9ca3af';
                      }}
                      onMouseLeave={(e) => {
                        if (!isMenuOpen) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = '#6b7280';
                        }
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
                      </svg>
                    </button>

                    {/* Menu Popup */}
                    {isMenuOpen && (
                      <div
                        style={{
                          position: 'fixed',
                          background: '#252525',
                          border: '1px solid #333',
                          borderRadius: '8px',
                          padding: '6px',
                          zIndex: 10000,
                          minWidth: '160px',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                        }}
                        ref={(el) => {
                          if (el) {
                            const button = el.previousElementSibling as HTMLElement;
                            if (button) {
                              const rect = button.getBoundingClientRect();
                              el.style.left = `${rect.right - 160}px`;
                              el.style.top = `${rect.bottom + 4}px`;
                            }
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Color Picker */}
                        <div style={{ padding: '4px 6px 8px', borderBottom: '1px solid #333' }}>
                          <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px', fontWeight: 500 }}>
                            Color
                          </div>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {COLOR_ORDER.map((color) => (
                              <button
                                key={color}
                                type="button"
                                onClick={(e) => handleColorChange(e, option.value, color)}
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '4px',
                                  border: optionColor === color ? '2px solid #fff' : '2px solid transparent',
                                  background: NOTION_COLORS[color].bg,
                                  cursor: 'pointer',
                                  padding: 0,
                                }}
                                title={color}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Edit Option */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingOption(option.value);
                            setEditValue(option.label);
                            setMenuOpen(null);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            width: '100%',
                            padding: '8px 10px',
                            marginTop: '4px',
                            border: 'none',
                            background: 'transparent',
                            color: '#e5e7eb',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            fontSize: '13px',
                            fontWeight: 500,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#333')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                          </svg>
                          Edit
                        </button>

                        {/* Copy Option */}
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const text = option.label;
                            try {
                              await navigator.clipboard.writeText(text);
                              setMenuOpen(null);
                            } catch (err) {
                              // Fallback for older browsers
                              const textArea = document.createElement('textarea');
                              textArea.value = text;
                              textArea.style.position = 'fixed';
                              textArea.style.left = '-999999px';
                              document.body.appendChild(textArea);
                              textArea.select();
                              try {
                                document.execCommand('copy');
                                setMenuOpen(null);
                              } catch (err2) {
                                console.error('Failed to copy');
                              }
                              document.body.removeChild(textArea);
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            width: '100%',
                            padding: '8px 10px',
                            marginTop: '4px',
                            border: 'none',
                            background: 'transparent',
                            color: '#e5e7eb',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            fontSize: '13px',
                            fontWeight: 500,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#333')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                            <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                          </svg>
                          Copy
                        </button>

                        {/* Delete Option */}
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, option.value)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            width: '100%',
                            padding: '8px 10px',
                            border: 'none',
                            background: 'transparent',
                            color: '#ef4444',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            fontSize: '13px',
                            fontWeight: 500,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#333')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                            <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1 0-2h3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1h3a1 1 0 0 1 1 1V3zM4.5 4v9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4h-8z"/>
                          </svg>
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Create Option */}
              {canCreate && (
                <div
                  id={`option-${filteredOptions.length}`}
                  data-index={filteredOptions.length}
                  role="option"
                  onClick={handleCreate}
                  onMouseEnter={() => setActiveIndex(filteredOptions.length)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: activeIndex === filteredOptions.length ? '#222222' : 'transparent',
                    borderTop: '1px solid #2a2a2a',
                    marginTop: '4px',
                    paddingTop: '12px',
                  }}
                >
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '20px',
                    height: '20px',
                    borderRadius: '4px',
                    background: '#2a2a2a',
                    color: '#9ca3af',
                  }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
                    </svg>
                  </span>
                  <span style={{ color: '#e5e7eb', fontSize: '14px' }}>
                    Create "{inputValue.trim()}"
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
