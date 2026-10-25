import { useEffect, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';

/** Native modal: focus trapping, Escape and background inertness stay in the browser. */
export function Dialog({
  open,
  title,
  onClose,
  children,
  sheet = false,
  returnFocus,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  sheet?: boolean;
  returnFocus?: RefObject<HTMLElement | null>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    if (!open) {
      if (element.open) element.close();
      return;
    }
    const previous = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      const restored = returnFocus?.current ?? previous;
      if (restored instanceof HTMLElement && restored.isConnected)
        restored.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className={`dialog ${sheet ? 'detail-sheet' : ''}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button autoFocus aria-label={`${title}を閉じる`} onClick={onClose}>
          閉じる ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
