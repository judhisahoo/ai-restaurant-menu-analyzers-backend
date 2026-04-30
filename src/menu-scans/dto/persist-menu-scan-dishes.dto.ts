import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class PersistDishDto {
  @ApiProperty({ example: 'Paneer Chilly' })
  @IsString()
  name!: string;

  @ApiProperty({
    example: 'A spicy Indo-Chinese paneer dish with peppers and sauces.',
  })
  @IsString()
  short_description!: string;

  @ApiProperty({
    example:
      'https://example-public.blob.vercel-storage.com/item_image/item-3c8e55a1.jpg',
    nullable: true,
    required: false,
  })
  @IsOptional()
  @IsString()
  image?: string | null;
}

export class PersistMenuScanDishesDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  user_id!: number;

  @ApiProperty({ type: [PersistDishDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PersistDishDto)
  dishes!: PersistDishDto[];
}
