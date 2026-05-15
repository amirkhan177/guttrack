export function usePinSession() {
  const storePinSession = (pin: string) => {
    sessionStorage.setItem('gut_pin', pin);
    sessionStorage.setItem('gut_last_activity', Date.now().toString());
    sessionStorage.setItem('gut_pin_attempts', '0');
  };

  const getPinFromSession = () => {
    return sessionStorage.getItem('gut_pin');
  };

  const refreshActivity = () => {
    sessionStorage.setItem('gut_last_activity', Date.now().toString());
  };

  const isSessionExpired = () => {
    const last = sessionStorage.getItem('gut_last_activity');
    if (!last) return true;
    return Date.now() - parseInt(last) > 5 * 60 * 1000;
  };

  const clearSession = () => {
    sessionStorage.removeItem('gut_pin');
    sessionStorage.removeItem('gut_last_activity');
    sessionStorage.removeItem('gut_pin_attempts');
  };

  const incrementPinAttempts = () => {
    const current = parseInt(sessionStorage.getItem('gut_pin_attempts') ?? '0');
    const next = current + 1;
    sessionStorage.setItem('gut_pin_attempts', next.toString());
    return next;
  };

  const getPinAttempts = () => {
    return parseInt(sessionStorage.getItem('gut_pin_attempts') ?? '0');
  };

  return {
    storePinSession,
    getPinFromSession,
    refreshActivity,
    isSessionExpired,
    clearSession,
    incrementPinAttempts,
    getPinAttempts,
  };
}
