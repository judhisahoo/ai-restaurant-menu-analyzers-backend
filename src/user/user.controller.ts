import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentLocationDto } from './dto/current-location.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { UserService } from './user.service';

@ApiTags('User')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('send-otp')
  @ApiOperation({ summary: 'Accept an OTP payload from the client.' })
  sendOtp(@Body() payload: SendOtpDto) {
    return this.userService.sendOtp(payload);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a user by email.' })
  register(@Body() payload: RegisterUserDto) {
    return this.userService.register(payload);
  }

  @Post('currrent-location')
  @ApiOperation({ summary: 'Store the current location for a user.' })
  saveCurrentLocation(@Body() payload: CurrentLocationDto) {
    return this.userService.saveCurrentLocation(payload);
  }
}
