import { AuthRepository } from '@/src/data/repositories/AuthRepository';

export class SendOtpUseCase {
  private authRepo = new AuthRepository();

  async execute(email: string): Promise<void> {
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email address');
    }
    return this.authRepo.signInWithOtp(email);
  }
}
