import { Module } from '@nestjs/common';
import { ChatgptService } from './chatgpt.service';

@Module({
  providers: [ChatgptService],
  exports: [ChatgptService],
})
export class ChatgptModule {}
