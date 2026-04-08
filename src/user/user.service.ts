import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CurrentLocationDto } from './dto/current-location.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { SendOtpDto } from './dto/send-otp.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async sendOtp(payload: SendOtpDto) {
    const mailgunApiKey = process.env.MAILGUN_API_KEY;
    const mailgunDomain = process.env.MAILGUN_DOMAIN;
    const fromEmail = process.env.MAILGUN_FROM_EMAIL;
    const mailgunBaseUrl =
      process.env.MAILGUN_BASE_URL ?? 'https://api.mailgun.net';

    this.logger.log('Attempting to send OTP email.');
    this.logger.log(`MAILGUN_API_KEY: ${mailgunApiKey ? 'Configured' : 'Not Set'}`);
    this.logger.log(`MAILGUN_DOMAIN: ${mailgunDomain || 'Not Set'}`);
    this.logger.log(`MAILGUN_FROM_EMAIL: ${fromEmail || 'Not Set'}`);
    this.logger.log(`MAILGUN_BASE_URL: ${mailgunBaseUrl}`);

    if (!mailgunApiKey) {
      throw new InternalServerErrorException(
        'MAILGUN_API_KEY is not configured.',
      );
    }

    if (!mailgunDomain) {
      throw new InternalServerErrorException('MAILGUN_DOMAIN is not configured.');
    }

    if (!fromEmail) {
      throw new InternalServerErrorException(
        'MAILGUN_FROM_EMAIL is not configured.',
      );
    }

    const to = payload.email;
    const subject = 'Your OTP Code';
    const text = `Your OTP code is: ${payload.otp}`;
    const html = `<p>Your OTP code is: <strong>${payload.otp}</strong></p>`;

    try {
      const formData = new FormData();
      formData.append('from', fromEmail);
      formData.append('to', to);
      formData.append('subject', subject);
      formData.append('text', text);
      formData.append('html', html);
      formData.append('o:tracking', 'no');

      const authHeader = Buffer.from(`api:${mailgunApiKey}`).toString('base64');
      const response = await fetch(
        `${mailgunBaseUrl}/v3/${encodeURIComponent(mailgunDomain)}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authHeader}`,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Mailgun rejected the request with status ${response.status}${errorText ? `: ${errorText}` : ''}`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown Mailgun error.';
      throw new ServiceUnavailableException(
        `Failed to send OTP via Mailgun: ${message}`,
      );
    }

    return {
      message: 'OTP sent successfully.',
      email: payload.email,
      note: 'OTP email was sent through Mailgun and is not persisted because the provided schema has no OTP table.',
    };
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

    if (existingUser) {
      throw new ConflictException('A user with this email already exists.');
    }

    const now = new Date();
    const { createdUser, location } = await this.prismaService.$transaction(
      async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email: payload.email,
            createdAt: now,
            updatedAt: now,
            verifiedAt: now,
          },
        });

        const location = await tx.locationHistory.create({
          data: {
            userId: createdUser.id,
            latitude: payload.latitude,
            longitude: payload.longitude,
            accuracy: payload.accuracy ?? null,
            capturedAt: now,
          },
        });

        return { createdUser, location };
      },
    );

    return {
      message: 'User registered successfully.',
      data: {
        id: createdUser.id,
        email: payload.email,
        deviceId: payload.deviceId,
        created_at: createdUser.createdAt.toISOString(),
        updated_at: createdUser.updatedAt.toISOString(),
        verified_at: createdUser.verifiedAt.toISOString(),
        location: {
          id: location.id,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          captured_at: location.capturedAt.toISOString(),
        },
      },
      note: 'deviceId is accepted from the client but not persisted because it is not part of the database schema.',
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
