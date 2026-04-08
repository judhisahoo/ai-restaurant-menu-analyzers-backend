import { Injectable } from '@nestjs/common';
import { persistUploadedImage } from '../common/utils/image-storage.util';
import { PrismaService } from '../database/prisma.service';
import { UserService } from '../user/user.service';

@Injectable()
export class MenuScansService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly userService: UserService,
  ) {}

  async create(
    userId: number,
    file: { buffer: Buffer; mimetype: string },
  ) {
    await this.userService.ensureUserExists(userId);

    const capturedAt = new Date();
    const storedPhoto = await persistUploadedImage(
      file.buffer,
      file.mimetype,
      'scan_photo',
      'scan',
    );
    const menuScan = await this.prismaService.menuScan.create({
      data: {
        userId,
        scanPhoto: storedPhoto,
        capturedAt,
      },
    });

    return {
      message: 'Menu scan saved successfully.',
      data: {
        id: menuScan.id,
        user_id: userId,
        scan_photo: storedPhoto,
        captured_at: menuScan.capturedAt.toISOString(),
      },
    };
  }
}
