
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

import {
  IsIn,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HeartsService } from './hearts.service';

type AuthRequest = {
  user: {
    userId: string;
  };
};

class SendHeartDto {
  @IsString()
  @MinLength(1)
  receiverId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text!: string;
}

class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text!: string;
}

class EditMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text!: string;
}

class RespondHeartDto {
  @IsIn(['ACCEPTED', 'DECLINED'])
  status!: 'ACCEPTED' | 'DECLINED';
}

@Controller('hearts')
@UseGuards(JwtAuthGuard)
export class HeartsController {
  constructor(
    private readonly service: HeartsService,
  ) {}

  @Get('people')
  people(
    @Req() req: AuthRequest,
    @Query('search') search = '',
  ) {
    return this.service.people(
      req.user.userId,
      search,
    );
  }

  @Get('incoming')
  incoming(@Req() req: AuthRequest) {
    return this.service.list(
      req.user.userId,
      'incoming',
    );
  }

  @Get('sent')
  sent(@Req() req: AuthRequest) {
    return this.service.list(
      req.user.userId,
      'sent',
    );
  }

  @Post()
  send(
    @Req() req: AuthRequest,
    @Body() dto: SendHeartDto,
  ) {
    return this.service.send(
      req.user.userId,
      dto.receiverId,
      dto.text,
    );
  }

  @Get(':id')
  detail(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.service.detail(
      req.user.userId,
      id,
    );
  }

  @Post(':id/messages')
  message(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.service.message(
      req.user.userId,
      id,
      dto.text,
    );
  }

  // NEW: Edit an existing Heart message.
  @Patch(':id/messages/:messageId')
  editMessage(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.service.editMessage(
      req.user.userId,
      id,
      messageId,
      dto.text,
    );
  }

  @Post(':id/respond')
  respond(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: RespondHeartDto,
  ) {
    return this.service.respond(
      req.user.userId,
      id,
      dto.status,
    );
  }

  @Post(':id/reveal')
  reveal(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.service.reveal(
      req.user.userId,
      id,
    );
  }

  @Post(':id/block')
  block(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.service.block(
      req.user.userId,
      id,
    );
  }
}
