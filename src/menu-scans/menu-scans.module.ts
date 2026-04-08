import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { MenuScansController } from './menu-scans.controller';
import { MenuScansService } from './menu-scans.service';

@Module({
  imports: [UserModule],
  controllers: [MenuScansController],
  providers: [MenuScansService],
})
export class MenuScansModule {}
