import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DishDto } from '../../menu-scans/dto/dish-analysis.dto';
import { ChatgptService } from '../chatgpt/chatgpt.service';
import { GeminiService } from '../gemini/gemini.service';

export type MenuScanAiProvider = 'gemini' | 'chatgpt';
export type MenuScanProcessingMode = MenuScanAiProvider | 'offline';

const MENU_SCAN_AI_PROVIDER_CONFIG = 'menu_scan_ai_provider';

type ConfigQueryRow = {
  value: string;
  status: boolean;
};

@Injectable()
export class AiService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly geminiService: GeminiService,
    private readonly chatgptService: ChatgptService,
  ) {}

  async analyzeMenuImage(
    imageUrl: string,
    provider?: MenuScanAiProvider,
  ): Promise<DishDto[]> {
    const activeProvider = provider ?? (await this.resolveMenuScanProcessingMode());

    switch (activeProvider) {
      case 'gemini':
        return this.geminiService.analyzeMenuImage(imageUrl);
      case 'chatgpt':
        return this.chatgptService.analyzeMenuImage(imageUrl);
      default:
        throw new BadRequestException(
          `Unsupported AI provider "${String(activeProvider)}".`,
        );
    }
  }

  async resolveMenuScanProcessingMode(): Promise<MenuScanProcessingMode> {
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
}
