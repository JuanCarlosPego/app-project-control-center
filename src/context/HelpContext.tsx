// ─────────────────────────────────────────────────────────
//  src/context/HelpContext.tsx
//  Contexto para el panel de ayuda contextual.
//  Controla únicamente el estado abierto/cerrado del panel.
//  El panel mismo lee la ruta actual para derivar el screenId.
// ─────────────────────────────────────────────────────────

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

interface HelpContextValue {
  isOpen: boolean;
  open:   () => void;
  close:  () => void;
  toggle: () => void;
  /** null = verificando, true = hay ayuda activa para esta pantalla, false = no hay */
  hasContent: boolean | null;
  setHasContent: (v: boolean | null) => void;
}

const HelpContext = createContext<HelpContextValue>({
  isOpen:      false,
  open:        () => undefined,
  close:       () => undefined,
  toggle:      () => undefined,
  hasContent:  null,
  setHasContent: () => undefined,
});

export const useHelp = () => useContext(HelpContext);

export const HelpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen,      setIsOpen]      = useState(false);
  const [hasContent,  setHasContent]  = useState<boolean | null>(null);

  const open   = useCallback(() => setIsOpen(true),  []);
  const close  = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const value = useMemo(
    () => ({ isOpen, open, close, toggle, hasContent, setHasContent }),
    [isOpen, open, close, toggle, hasContent],
  );

  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
};
