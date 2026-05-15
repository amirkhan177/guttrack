import { useCallback } from 'react';
import { usePinSession } from '@/src/features/auth/hooks/usePinSession';
import { useRouter } from 'next/navigation';

export function useSessionGuard() {
  const router = useRouter();
  const { isSessionExpired, refreshActivity, getPinFromSession } = usePinSession();

  const handleInteraction = useCallback(() => {
    refreshActivity();
  }, [refreshActivity]);

  const checkSession = useCallback(() => {
    const pin = getPinFromSession();
    if (!pin || isSessionExpired()) {
      router.replace('/pin');
      return false;
    }
    refreshActivity();
    return true;
  }, [getPinFromSession, isSessionExpired, refreshActivity, router]);

  return {
    handleInteraction,
    checkSession,
  };
}
