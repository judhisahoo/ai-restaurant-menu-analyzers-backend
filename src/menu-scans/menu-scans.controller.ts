import {
  BadRequestException,
  Body,
  Controller,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { MenuScansService } from './menu-scans.service';

@ApiTags('Menu Scans')
@Controller('menu-scans')
export class MenuScansController {
  constructor(private readonly menuScansService: MenuScansService) {}

  @Post()
  @ApiOperation({ summary: 'Store a scanned menu photo for a user.' })
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({
    description: 'Returns the stored scan record with a public Vercel Blob URL.',
    schema: {
      example: {
        message: 'Menu scan saved successfully.',
        data: {
          id: 101,
          user_id: 12,
          scan_photo:
            'https://example-public.blob.vercel-storage.com/scan_photo/scan-7d5f9f7a.jpg',
          captured_at: '2026-04-08T10:22:30.000Z',
        },
      },
    },
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['user_id', 'scan_photo'],
      properties: {
        user_id: {
          type: 'integer',
          example: 12,
        },
        scan_photo: {
          type: 'string',
          format: 'binary',
          description:
            'Uploaded file that will be stored in Vercel Blob under the scan_photo/ folder.',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('scan_photo'))
  create(
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
    @Body('user_id', ParseIntPipe) userId: number,
  ) {
    if (!file) {
      throw new BadRequestException('scan_photo file is required.');
    }

    return this.menuScansService.create(userId, file);
  }
}
