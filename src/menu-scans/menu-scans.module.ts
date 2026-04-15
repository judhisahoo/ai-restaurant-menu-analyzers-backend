import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { MenuScansController } from './menu-scans.controller';
import { MenuScansService } from './menu-scans.service';
import { GeminiModule } from '../common/gemini/gemini.module';

@Module({
  imports: [UserModule, GeminiModule],
  controllers: [MenuScansController],
  providers: [MenuScansService],
})
export class MenuScansModule {}
