import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

type RequestUser = {
  userId: string;
  email: string;
};

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  findForMe(@Req() req: { user?: RequestUser }) {
    return this.notifications.findForUser(req.user?.userId ?? '');
  }

  @Patch('read-all')
  markAllRead(@Req() req: { user?: RequestUser }) {
    return this.notifications.markAllRead(req.user?.userId ?? '');
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @Req() req: { user?: RequestUser }) {
    return this.notifications.markRead(id, req.user?.userId ?? '');
  }
}
