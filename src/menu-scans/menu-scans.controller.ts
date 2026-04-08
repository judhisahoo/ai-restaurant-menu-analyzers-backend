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
