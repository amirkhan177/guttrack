import { useState } from 'react';
import { SendOtpUseCase } from '../use-cases/SendOtpUseCase';
import { VerifyOtpUseCase } from '../use-cases/VerifyOtpUseCase';

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendOtp = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      const useCase = new SendOtpUseCase();
      await useCase.execute(email);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (email: string, token: string) => {
    setLoading(true);
    setError(null);
    try {
      const useCase = new VerifyOtpUseCase();
      await useCase.execute(email, token);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    sendOtp,
    verifyOtp,
    loading,
    error,
    setError,
  };
}
