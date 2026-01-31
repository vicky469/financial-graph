import React from 'react';
import { MessageType } from '../../hooks/useJobActions';

interface MessageBannerProps {
  message: string;
  type: MessageType;
}

export function MessageBanner({ message, type }: MessageBannerProps) {
  if (!message) return null;

  const className = `message-banner ${
    type === 'error'
      ? 'message-error'
      : type === 'success'
      ? 'message-success'
      : 'message-info'
  }`;

  return <div className={className}>{message}</div>;
}
