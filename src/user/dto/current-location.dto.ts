import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional } from 'class-validator';

export class CurrentLocationDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  user_id!: number;

  @ApiProperty({ example: '1234.45565' })
  @Type(() => Number)
  @IsNumber()
  latitude!: number;

  @ApiProperty({ example: '3455.567' })
  @Type(() => Number)
  @IsNumber()
  longitude!: number;

  @ApiPropertyOptional({ example: '5.7' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  accuracy?: number;
}
