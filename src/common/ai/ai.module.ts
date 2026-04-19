import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { ChatgptModule } from '../chatgpt/chatgpt.module';
import { GeminiModule } from '../gemini/gemini.module';

@Module({
  imports: [GeminiModule, ChatgptModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
