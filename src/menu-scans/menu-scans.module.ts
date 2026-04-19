import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { MenuScansController } from './menu-scans.controller';
import { MenuScansService } from './menu-scans.service';
import { AiModule } from '../common/ai/ai.module';

@Module({
  imports: [UserModule, AiModule],
  controllers: [MenuScansController],
  providers: [MenuScansService],
})
export class MenuScansModule {}
