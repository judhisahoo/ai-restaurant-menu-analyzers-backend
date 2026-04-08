import { Injectable } from '@nestjs/common';
import { persistUploadedImage } from '../common/utils/image-storage.util';
import { currentTimestamp } from '../common/utils/timestamps.util';
import { DatabaseService } from '../database/database.service';
import { UserService } from '../user/user.service';

@Injectable()
export class MenuScansService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly userService: UserService,
  ) {}

  async create(
    userId: number,
    file: { buffer: Buffer; mimetype: string },
  ) {
    await this.userService.ensureUserExists(userId);

    const capturedAt = currentTimestamp();
    const storedPhoto = persistUploadedImage(
      file.buffer,
      file.mimetype,
      'scan_photo',
      'scan',
    );
    const result = await this.databaseService.run(
      `INSERT INTO menu_scans (user_id, scan_photo, captured_at)
       VALUES (?, ?, ?);`,
      [userId, storedPhoto, capturedAt],
    );

    return {
      message: 'Menu scan saved successfully.',
      data: {
        id: result.lastID,
        user_id: userId,
        scan_photo: storedPhoto,
        captured_at: capturedAt,
      },
    };
  }
}
