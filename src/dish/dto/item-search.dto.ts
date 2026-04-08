import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ItemSearchDto {
  @ApiProperty({ example: 'Paneer' })
  @IsString()
  item_title!: string;
}
