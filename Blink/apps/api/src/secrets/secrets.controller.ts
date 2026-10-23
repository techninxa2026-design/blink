
import {
  Body, Controller, Get, Param,
  Patch, Post, Req, UseGuards
} from '@nestjs/common';

import {
  ArrayMaxSize, ArrayMinSize, IsArray,
  IsIn, IsInt, IsISO8601, IsOptional,
  IsString, Max, MaxLength, Min, MinLength
} from 'class-validator';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SecretsService } from './secrets.service';

type AuthReq = { user: { userId: string } };

class CreateSecretDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  prompt!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  options!: string[];

  @IsInt()
  @Min(0)
  @Max(4)
  correctIndex!: number;

  @IsIn(['ANONYMOUS', 'NAMED'])
  visibility!: 'ANONYMOUS' | 'NAMED';

  @IsISO8601()
  revealAt!: string;
}

class EditSecretDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  prompt!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  options!: string[];

  @IsInt()
  @Min(0)
  @Max(4)
  correctIndex!: number;

  @IsIn(['ANONYMOUS', 'NAMED'])
  visibility!: 'ANONYMOUS' | 'NAMED';

  // Optional: keep the existing reveal time.
  @IsOptional()
  @IsISO8601()
  revealAt?: string;
}

class GuessDto {
  @IsInt()
  @Min(0)
  @Max(4)
  selectedIndex!: number;
}

class ReactDto {
  @IsIn(['🧡', '❤️', '😮', '😂', '👏'])
  emoji!: string;
}

@Controller('secrets')
@UseGuards(JwtAuthGuard)
export class SecretsController {
  constructor(
    private readonly service: SecretsService
  ) {}

  @Get('points')
  points(@Req() req: AuthReq) {
    return this.service.points(req.user.userId);
  }

  @Get()
  list(@Req() req: AuthReq) {
    return this.service.list(req.user.userId);
  }

  @Post()
  create(
    @Req() req: AuthReq,
    @Body() dto: CreateSecretDto
  ) {
    return this.service.create(req.user.userId, dto);
  }

  @Patch(':id')
  edit(
    @Req() req: AuthReq,
    @Param('id') id: string,
    @Body() dto: EditSecretDto
  ) {
    return this.service.edit(req.user.userId, id, dto);
  }

  @Post(':id/guess')
  guess(
    @Req() req: AuthReq,
    @Param('id') id: string,
    @Body() dto: GuessDto
  ) {
    return this.service.guess(
      req.user.userId,
      id,
      dto.selectedIndex
    );
  }

  @Post(':id/react')
  react(
    @Req() req: AuthReq,
    @Param('id') id: string,
    @Body() dto: ReactDto
  ) {
    return this.service.react(
      req.user.userId,
      id,
      dto.emoji
    );
  }
}
