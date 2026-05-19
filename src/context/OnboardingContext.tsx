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
import { QuickStartGuide } from "../components/onboarding/QuickStartGuide";
import { isQuickGuideDismissed } from "../lib/onboarding";

type OnboardingContextValue = {
  openQuickGuide: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!isQuickGuideDismissed(user.role, user.id)) {
      setOpen(true);
    }
  }, [user?.id, user?.role]);

  const openQuickGuide = useCallback(() => setOpen(true), []);

  const value = useMemo(() => ({ openQuickGuide }), [openQuickGuide]);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {user && open && (
        <QuickStartGuide
          role={user.role}
          userId={user.id}
          onClose={() => setOpen(false)}
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
