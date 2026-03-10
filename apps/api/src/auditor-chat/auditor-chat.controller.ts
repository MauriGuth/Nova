import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditorChatService } from './auditor-chat.service';
import { AuditorChatDto } from './dto/auditor-chat.dto';

@Controller('auditor-chat')
@UseGuards(JwtAuthGuard)
export class AuditorChatController {
  constructor(private readonly auditorChatService: AuditorChatService) {}

  /** Chat sin persistencia (legacy, opcional) */
  @Post()
  chat(@Body() dto: AuditorChatDto) {
    return this.auditorChatService.chat(dto);
  }

  /** Métricas para gráficos y resumen en el chat */
  @Get('metrics')
  getMetrics() {
    return this.auditorChatService.getMetrics();
  }

  /** Listar conversaciones del usuario */
  @Get('conversations')
  getConversations(@CurrentUser('id') userId: string) {
    return this.auditorChatService.getConversations(userId);
  }

  /** Crear nueva conversación */
  @Post('conversations')
  createConversation(@CurrentUser('id') userId: string) {
    return this.auditorChatService.createConversation(userId);
  }

  /** Obtener una conversación con todos sus mensajes */
  @Get('conversations/:id')
  getConversation(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.auditorChatService.getConversationWithMessages(id, userId);
  }

  /** Enviar mensaje en una conversación (guarda user + assistant y devuelve ambos) */
  @Post('conversations/:id/messages')
  sendMessage(
    @Param('id') id: string,
    @Body() body: { content: string },
    @CurrentUser('id') userId: string,
  ) {
    const content = body?.content?.trim();
    if (!content) {
      throw new BadRequestException('content es requerido');
    }
    return this.auditorChatService.sendMessage(id, content, userId);
  }
}
