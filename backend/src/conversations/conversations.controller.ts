import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversationsService } from './conversations.service';
import { ConversationsRealtimeService } from './conversations-realtime.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';

type RequestUser = {
  userId: string;
  email: string;
};

@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly realtime: ConversationsRealtimeService,
  ) {}

  @Get()
  findForMe(@Req() req: { user?: RequestUser }) {
    return this.conversations.findForUser(req.user?.userId ?? '');
  }

  @Post()
  create(
    @Req() req: { user?: RequestUser },
    @Body() dto: CreateConversationDto,
  ) {
    return this.conversations.createDirect(
      req.user?.userId ?? '',
      dto.participantId,
    );
  }

  @Get(':id/messages')
  findMessages(
    @Param('id') id: string,
    @Req() req: { user?: RequestUser },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.conversations.findMessages(id, req.user?.userId ?? '', {
      cursor,
      limit,
    });
  }

  @Post(':id/messages')
  async createMessage(
    @Param('id') id: string,
    @Req() req: { user?: RequestUser },
    @Body() dto: CreateMessageDto,
  ) {
    const message = await this.conversations.createMessage(
      id,
      req.user?.userId ?? '',
      dto.content,
    );
    const participantIds = await this.conversations.findParticipantIds(id);

    this.realtime.emitMessage(participantIds, message);

    return message;
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @Req() req: { user?: RequestUser }) {
    return this.conversations.markRead(id, req.user?.userId ?? '');
  }
}
