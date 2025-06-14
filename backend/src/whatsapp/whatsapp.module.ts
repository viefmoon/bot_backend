import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { MenuService } from '../orders/menu.service';
import { RestaurantConfigService } from '../common/services/restaurant-config.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, MenuService, RestaurantConfigService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}