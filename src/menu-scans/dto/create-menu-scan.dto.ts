import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString } from 'class-validator';

export class CreateMenuScanDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  user_id!: number;

  @ApiProperty({
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...',
    description:
      'Can be a filename, a URL, a data URL, or raw base64 image content.',
  })
  @IsString()
  scan_photo!: string;
}
