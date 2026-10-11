import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** The element in the page header that holds the breadcrumbs (set by the layout). */
export const CrumbsSlot = createContext<HTMLElement | null>(null);

/** Renders the breadcrumbs of a page into the header row, next to the logo. */
export function Crumbs({ children }: { children: ReactNode }) {
  const slot = useContext(CrumbsSlot);
  return slot ? createPortal(<p className="crumbs">{children}</p>, slot) : null;
}
