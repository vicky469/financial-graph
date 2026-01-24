import { Button } from './button';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'default';
}

/**
 * ConfirmationDialog component - Reusable confirmation dialog
 * 
 * Provides a better UX than window.confirm() with:
 * - Styled modal dialog
 * - Customizable messages and button text
 * - Danger variant for destructive actions
 * - Keyboard support (Escape to cancel, Enter to confirm)
 */
export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'grid',
        placeItems: 'center',
        padding: '16px',
      }}
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="confirmation-dialog"
        style={{
          backgroundColor: 'rgba(30, 30, 35, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
          minWidth: '320px',
          maxWidth: '420px',
          width: '100%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <h3
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.95)',
              margin: 0,
            }}
          >
            {title}
          </h3>
        </div>

        {/* Message */}
        <div
          style={{
            padding: '20px',
            fontSize: '13px',
            lineHeight: '1.6',
            color: 'rgba(255, 255, 255, 0.8)',
          }}
        >
          {message}
        </div>

        {/* Actions */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            style={{
              fontSize: '13px',
              padding: '8px 16px',
            }}
          >
            {cancelText}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleConfirm}
            style={{
              fontSize: '13px',
              padding: '8px 16px',
              backgroundColor: variant === 'danger' 
                ? 'rgba(239, 68, 68, 0.9)' 
                : 'rgba(96, 165, 250, 0.9)',
              color: 'white',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = variant === 'danger'
                ? 'rgba(239, 68, 68, 1)'
                : 'rgba(96, 165, 250, 1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = variant === 'danger'
                ? 'rgba(239, 68, 68, 0.9)'
                : 'rgba(96, 165, 250, 0.9)';
            }}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
