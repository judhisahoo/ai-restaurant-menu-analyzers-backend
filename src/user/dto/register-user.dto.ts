import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterUserDto {
  @ApiProperty({ example: 'judhisahoo@gmail.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  name!: string;

  @ApiProperty({ example: 'cdsacascadca' })
  @IsString()
  @MinLength(3)
  deviceId!: string;

  @ApiProperty({ example: '20.2961' })
  @Type(() => Number)
  @IsNumber()
  latitude!: number;

  @ApiProperty({ example: '85.8245' })
  @Type(() => Number)
  @IsNumber()
  longitude!: number;

  @ApiPropertyOptional({ example: '5.7' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  accuracy?: number;
}
