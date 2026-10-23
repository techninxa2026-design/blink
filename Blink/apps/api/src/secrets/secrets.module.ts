
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

import { SecretsController } from './secrets.controller';
import { SecretsService } from './secrets.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [SecretsController],
  providers: [SecretsService],
})
export class SecretsModule {}
