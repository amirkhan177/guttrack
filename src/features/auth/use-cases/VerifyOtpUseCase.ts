import { AuthRepository } from '@/src/data/repositories/AuthRepository';

export class VerifyOtpUseCase {
  private authRepo = new AuthRepository();

  async execute(email: string, token: string): Promise<void> {
    if (!email || !token || token.length < 8) {
      throw new Error('Invalid email or code');
    }
    return this.authRepo.verifyOtp(email, token);
  }
}
