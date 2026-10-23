import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessMatchController } from './business-match.controller';
import { BusinessMatchService } from './business-match.service';

@Module({
  imports: [AuthModule],
  controllers: [BusinessMatchController],
  providers: [BusinessMatchService],
})
export class BusinessMatchModule {}
