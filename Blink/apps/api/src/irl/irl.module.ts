
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IrlController } from './irl.controller';
import { IrlService } from './irl.service';

@Module({
  imports: [AuthModule],
  controllers: [IrlController],
  providers: [IrlService],
})
export class IrlModule {}
