import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { DishModule } from './dish/dish.module';
import { MenuScansModule } from './menu-scans/menu-scans.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [DatabaseModule, UserModule, MenuScansModule, DishModule],
})
export class AppModule {}
