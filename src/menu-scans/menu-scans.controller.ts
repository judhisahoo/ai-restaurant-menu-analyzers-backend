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
import { MenuAnalysisResponseDto } from './dto/dish-analysis.dto';
import { PersistMenuScanDishesDto } from './dto/persist-menu-scan-dishes.dto';

@ApiTags('Menu Scans')
@Controller('menu-scans')
export class MenuScansController {
  constructor(private readonly menuScansService: MenuScansService) {}

  @Post()
  @ApiOperation({
    summary:
      'Store a scanned menu photo and return processed dish data from Gemini or offline sample data.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({
    description: 'Returns the stored scan record and analyzed dish data.',
    type: MenuAnalysisResponseDto,
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
            'Uploaded file that will be stored in Vercel Blob and then processed for dish extraction.',
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

  @Post('persist-dishes')
  @ApiOperation({
    summary:
      'Persist processed dish data after menu scan AI processing has returned to the client.',
  })
  @ApiCreatedResponse({
    description: 'Returns the number of dishes persisted for the user.',
  })
  persistDishes(@Body() body: PersistMenuScanDishesDto) {
    return this.menuScansService.persistDishes(body.user_id, body.dishes);
  }
}
