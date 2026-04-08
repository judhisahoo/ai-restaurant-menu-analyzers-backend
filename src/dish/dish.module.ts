import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { DishController } from './dish.controller';
import { DishService } from './dish.service';

@Module({
  imports: [UserModule],
  controllers: [DishController],
  providers: [DishService],
})
export class DishModule {}
