import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterUserDto {
  @ApiProperty({ example: 'judhisahoo@gmail.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'cdsacascadca' })
  @IsString()
  @MinLength(3)
  deviceId!: string;
}
