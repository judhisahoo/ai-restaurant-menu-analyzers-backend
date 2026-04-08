import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { currentTimestamp } from "../common/utils/timestamps.util";
import { DatabaseService } from "../database/database.service";
import { CurrentLocationDto } from "./dto/current-location.dto";
import { RegisterUserDto } from "./dto/register-user.dto";
import { SendOtpDto } from "./dto/send-otp.dto";

interface UserRow {
  id: number;
  email: string;
  created_at: string;
  updated_at: string;
  verified_at: string;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async sendOtp(payload: SendOtpDto) {
    const mailgunApiKey = process.env.MAILGUN_API_KEY;
    const mailgunDomain = process.env.MAILGUN_DOMAIN;
    const fromEmail = process.env.MAILGUN_FROM_EMAIL;
    const mailgunBaseUrl =
      process.env.MAILGUN_BASE_URL ?? "https://api.mailgun.net";

    this.logger.log("Attempting to send OTP email.");
    this.logger.log(`MAILGUN_API_KEY: ${mailgunApiKey ? "Configured" : "Not Set"}`);
    this.logger.log(`MAILGUN_DOMAIN: ${mailgunDomain || "Not Set"}`);
    this.logger.log(`MAILGUN_FROM_EMAIL: ${fromEmail || "Not Set"}`);
    this.logger.log(`MAILGUN_BASE_URL: ${mailgunBaseUrl}`);

    if (!mailgunApiKey) {
      throw new InternalServerErrorException(
        "MAILGUN_API_KEY is not configured.",
      );
    }

    if (!mailgunDomain) {
      throw new InternalServerErrorException(
        "MAILGUN_DOMAIN is not configured.",
      );
    }

    if (!fromEmail) {
      throw new InternalServerErrorException(
        "MAILGUN_FROM_EMAIL is not configured.",
      );
    }

    const to = payload.email;
    const subject = "Your OTP Code";
    const text = `Your OTP code is: ${payload.otp}`;
    const html = `<p>Your OTP code is: <strong>${payload.otp}</strong></p>`;

    try {
      const formData = new FormData();
      formData.append("from", fromEmail);
      formData.append("to", to);
      formData.append("subject", subject);
      formData.append("text", text);
      formData.append("html", html);
      formData.append("o:tracking", "no");

      const authHeader = Buffer.from(`api:${mailgunApiKey}`).toString("base64");
      const response = await fetch(
        `${mailgunBaseUrl}/v3/${encodeURIComponent(mailgunDomain)}/messages`,
        {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
        },
        body: formData,
      },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Mailgun rejected the request with status ${response.status}${errorText ? `: ${errorText}` : ""}`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Mailgun error.";
      throw new ServiceUnavailableException(
        `Failed to send OTP via Mailgun: ${message}`,
      );
    }

    return {
      message: "OTP sent successfully.",
      email: payload.email,
      note: "OTP email was sent through Mailgun and is not persisted because the provided schema has no OTP table.",
    };
  }

  async register(payload: RegisterUserDto) {
    const existingUser = await this.databaseService.get<UserRow>(
      'SELECT id, email, created_at, updated_at, verified_at FROM "user" WHERE email = ?;',
      [payload.email],
    );

    if (existingUser) {
      throw new ConflictException("A user with this email already exists.");
    }

    const timestamp = currentTimestamp();
    const result = await this.databaseService.run(
      'INSERT INTO "user" (email, created_at, updated_at, verified_at) VALUES (?, ?, ?, ?);',
      [payload.email, timestamp, timestamp, timestamp],
    );

    return {
      message: "User registered successfully.",
      data: {
        id: result.lastID,
        email: payload.email,
        deviceId: payload.deviceId,
        created_at: timestamp,
        updated_at: timestamp,
        verified_at: timestamp,
      },
      note: "deviceId is accepted from the client but not persisted because it is not part of the provided SQLite schema.",
    };
  }

  async saveCurrentLocation(payload: CurrentLocationDto) {
    await this.ensureUserExists(payload.user_id);

    const capturedAt = currentTimestamp();
    const result = await this.databaseService.run(
      `INSERT INTO location_history (user_id, latitude, longitude, accuracy, captured_at)
       VALUES (?, ?, ?, ?, ?);`,
      [
        payload.user_id,
        payload.latitude,
        payload.longitude,
        payload.accuracy ?? null,
        capturedAt,
      ],
    );

    return {
      message: "Current location saved successfully.",
      data: {
        id: result.lastID,
        user_id: payload.user_id,
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracy: payload.accuracy ?? null,
        captured_at: capturedAt,
      },
    };
  }

  async ensureUserExists(userId: number): Promise<void> {
    const user = await this.databaseService.get<{ id: number }>(
      'SELECT id FROM "user" WHERE id = ?;',
      [userId],
    );

    if (!user) {
      throw new NotFoundException(`User ${userId} was not found.`);
    }
  }
}
