import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { DishDto } from '../../menu-scans/dto/dish-analysis.dto';
import { ChatgptService } from '../chatgpt/chatgpt.service';
import { GeminiService } from '../gemini/gemini.service';
import {
  ItemComponentReportDto,
  ItemIngredientReportDto,
} from './menu-image-analysis.util';
import { OllamaService } from './ollama.service';

export type MenuScanAiProvider = 'gemini' | 'chatgpt' | 'ollama';
export type MenuScanProcessingMode = MenuScanAiProvider | 'offline';

const MENU_SCAN_AI_PROVIDER_CONFIG = 'menu_scan_ai_provider';

type ConfigQueryRow = {
  value: string;
  status: boolean;
};

@Injectable()
export class AiService {
  private geminiService?: GeminiService;
  private chatgptService?: ChatgptService;
  private ollamaService?: OllamaService;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async analyzeMenuImage(
    imageUrl: string,
    provider?: MenuScanAiProvider,
  ): Promise<DishDto[]> {
    const activeProvider = provider ?? (await this.resolveMenuScanProcessingMode());

    switch (activeProvider) {
      case 'gemini':
        return this.getGeminiService().analyzeMenuImage(imageUrl);
      case 'chatgpt':
        return this.getChatgptService().analyzeMenuImage(imageUrl);
      case 'ollama':
        return this.getOllamaService().analyzeMenuImage(imageUrl);
      default:
        throw new BadRequestException(
          `Unsupported AI provider "${String(activeProvider)}".`,
        );
    }
  }

  async generateItemComponentReport(
    dishName: string,
    provider?: MenuScanAiProvider,
  ): Promise<ItemComponentReportDto[]> {
    const activeProvider = provider ?? (await this.resolveMenuScanProcessingMode());

    switch (activeProvider) {
      case 'gemini':
        return this.getGeminiService().generateItemComponentReport(dishName);
      case 'chatgpt':
        return this.getChatgptService().generateItemComponentReport(dishName);
      case 'ollama':
        return this.getOllamaService().generateItemComponentReport(dishName);
      default:
        throw new BadRequestException(
          `AI component generation is disabled for processing mode "${String(activeProvider)}".`,
        );
    }
  }

  async generateItemIngredientReport(
    dishName: string,
    provider?: MenuScanAiProvider,
  ): Promise<ItemIngredientReportDto[]> {
    const activeProvider = provider ?? (await this.resolveMenuScanProcessingMode());

    switch (activeProvider) {
      case 'gemini':
        return this.getGeminiService().generateItemIngredientReport(dishName);
      case 'chatgpt':
        return this.getChatgptService().generateItemIngredientReport(dishName);
      case 'ollama':
        return this.getOllamaService().generateItemIngredientReport(dishName);
      default:
        throw new BadRequestException(
          `AI ingredient generation is disabled for processing mode "${String(activeProvider)}".`,
        );
    }
  }

  async resolveMenuScanProcessingMode(): Promise<MenuScanProcessingMode> {
    const onlineProcess = this.configService.get<string>('ON_LINE_PROCESS');
    const useMuckData = this.configService.get<string>('USE_MUCK_DATA');

    if (onlineProcess === 'false') {
      if (useMuckData === 'true') {
        return 'offline';
      } else {
        return 'ollama';
      }
    }

    // Fallback to database config
    const [configEntry] = await this.prismaService.$queryRaw<ConfigQueryRow[]>`
      SELECT "value", "status"
      FROM "config"
      WHERE "name" = ${MENU_SCAN_AI_PROVIDER_CONFIG}
      LIMIT 1
    `;

    if (!configEntry) {
      return 'gemini';
    }

    if (!configEntry.status) {
      return 'offline';
    }

    const normalizedValue = configEntry.value.trim().toLowerCase();
    if (normalizedValue === 'gemini') {
      return 'gemini';
    }

    if (normalizedValue === 'chatgpt' || normalizedValue === 'openai') {
      return 'chatgpt';
    }

    throw new BadRequestException(
      `Unsupported value "${configEntry.value}" for config "${MENU_SCAN_AI_PROVIDER_CONFIG}". Use "gemini" or "chatgpt".`,
    );
  }

  private getGeminiService(): GeminiService {
    if (!this.geminiService) {
      console.log('[AI] Lazy loading GeminiService.');
      this.geminiService = new GeminiService();
    }

    return this.geminiService;
  }

  private getChatgptService(): ChatgptService {
    if (!this.chatgptService) {
      console.log('[AI] Lazy loading ChatgptService.');
      this.chatgptService = new ChatgptService();
    }

    return this.chatgptService;
  }

  private getOllamaService(): OllamaService {
    if (!this.ollamaService) {
      console.log('[AI] Lazy loading OllamaService.');
      this.ollamaService = new OllamaService(this.configService);
    }

    return this.ollamaService;
  }
}
