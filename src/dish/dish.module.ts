import { Module } from '@nestjs/common';
import { AiModule } from '../common/ai/ai.module';
import { UserModule } from '../user/user.module';
import { DishController } from './dish.controller';
import { DishService } from './dish.service';

@Module({
  imports: [UserModule, AiModule],
  controllers: [DishController],
  providers: [DishService],
})
export class DishModule {}
