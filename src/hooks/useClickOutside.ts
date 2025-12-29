import { useEffect, useRef, type RefObject } from "react";

/**
 * Custom hook to detect clicks outside of a referenced element
 * Useful for closing dropdowns, modals, and panels when clicking outside
 *
 * @param ref - React ref object pointing to the element to monitor
 * @param handler - Callback function to execute when click outside is detected
 * @param enabled - Optional flag to enable/disable the listener (default: true)
 */
export const useClickOutside = <T extends HTMLElement | null = HTMLElement>(
  ref: RefObject<T>,
  handler: () => void,
  enabled: boolean = true
) => {
  const handlerRef = useRef(handler);

  // Update handler ref when it changes
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handlerRef.current();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [ref, enabled]);
};
