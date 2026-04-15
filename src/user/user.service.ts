import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../common/email/email.service';
import { CurrentLocationDto } from './dto/current-location.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { PrismaClient } from '@prisma/client';

type TransactionClient = Omit<PrismaClient, '$on' | '$connect' | '$disconnect' | '$transaction' | '$extends' | '$use'>;

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async sendOtp(payload: SendOtpDto) {
    this.logger.log('Attempting to send OTP email.');

    const to = payload.email;
    this.logger.log(`Sending OTP to ${to}`);

    try {
      const result = await this.emailService.sendOtp(payload.email, payload.otp);
      
      this.logger.log(`OTP email sent successfully. Message ID: ${result.messageId}`);
      
      return {
        message: 'OTP sent successfully.',
        email: payload.email,
        note: 'OTP email was sent and is not persisted because the provided schema has no OTP table.',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send OTP: ${errorMessage}`, error);
      throw error; // Re-throw to be handled by exception filters
    }
  }

  async register(payload: RegisterUserDto) {
    const existingUser = await this.prismaService.user.findFirst({
      where: {
        email: {
          equals: payload.email,
          mode: 'insensitive',
        },
      },
    });

    const now = new Date();
    const { user, location } = await this.prismaService.$transaction(
      async (tx: TransactionClient): Promise<{ user: any; location: any }> => {
        let user;

        if (existingUser) {
          // Update existing user's name
          user = await tx.user.update({
            where: { id: existingUser.id },
            data: {
              name: payload.name,
              deviceId: payload.deviceId,
              updatedAt: now,
            },
            select: {
              id: true,
              email: true,
              name: true,
              deviceId: true,
              createdAt: true,
              updatedAt: true,
              verifiedAt: true,
            },
          });
        } else {
          // Create new user
          user = await tx.user.create({
            data: {
              email: payload.email,
              name: payload.name,
              deviceId: payload.deviceId,
              createdAt: now,
              updatedAt: now,
              verifiedAt: now,
            },
            select: {
              id: true,
              email: true,
              name: true,
              deviceId: true,
              createdAt: true,
              updatedAt: true,
              verifiedAt: true,
            },
          });
        }

        const location = await tx.locationHistory.create({
          data: {
            userId: user.id,
            latitude: payload.latitude,
            longitude: payload.longitude,
            accuracy: payload.accuracy ?? null,
            capturedAt: now,
          },
        });

        return { user, location };
      },
    );

    const isNewUser = !existingUser;

    return {
      message: isNewUser ? 'User registered successfully.' : 'User updated successfully.',
      data: {
        id: user.id,
        email: payload.email,
        name: user.name,
        deviceId: user.deviceId,
        created_at: user.createdAt.toISOString(),
        updated_at: user.updatedAt.toISOString(),
        verified_at: user.verifiedAt.toISOString(),
        location: {
          id: location.id,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          captured_at: location.capturedAt.toISOString(),
        },
      },
    };
  }

  async saveCurrentLocation(payload: CurrentLocationDto) {
    await this.ensureUserExists(payload.user_id);

    const capturedAt = new Date();
    const location = await this.prismaService.locationHistory.create({
      data: {
        userId: payload.user_id,
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracy: payload.accuracy ?? null,
        capturedAt,
      },
    });

    return {
      message: 'Current location saved successfully.',
      data: {
        id: location.id,
        user_id: payload.user_id,
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracy: payload.accuracy ?? null,
        captured_at: location.capturedAt.toISOString(),
      },
    };
  }

  async ensureUserExists(userId: number): Promise<void> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} was not found.`);
    }
  }
}
