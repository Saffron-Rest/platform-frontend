import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { OnboardingTour } from "../components/onboarding/OnboardingTour";
import { isQuickGuideDismissed } from "../lib/onboarding";

type OnboardingContextValue = {
  openQuickGuide: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

type ProviderProps = {
  children: ReactNode;
  onOpenMoreMenu?: () => void;
};

export function OnboardingProvider({ children, onOpenMoreMenu }: ProviderProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (isQuickGuideDismissed(user.role, user.id)) return;

    const t = window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        setOpen(true);
      }
    }, 1200);
    return () => window.clearTimeout(t);
  }, [user?.id, user?.role]);

  const openQuickGuide = useCallback(() => setOpen(true), []);

  const value = useMemo(() => ({ openQuickGuide }), [openQuickGuide]);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {user && open && typeof document !== "undefined" && (
        <OnboardingTour
          role={user.role}
          userId={user.id}
          onClose={() => setOpen(false)}
          onOpenMoreMenu={onOpenMoreMenu}
        />
      )}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    return { openQuickGuide: () => {} };
  }
  return ctx;
}
