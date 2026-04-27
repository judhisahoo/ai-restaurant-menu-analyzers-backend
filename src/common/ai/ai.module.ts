import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { OllamaService } from './ollama.service';
import { ChatgptModule } from '../chatgpt/chatgpt.module';
import { GeminiModule } from '../gemini/gemini.module';

@Module({
  imports: [GeminiModule, ChatgptModule],
  providers: [AiService, OllamaService],
  exports: [AiService],
})
export class AiModule {}
