import { Module, Global } from '@nestjs/common';
import { sequelize } from './db';

@Global()
@Module({
  providers: [
    {
      provide: 'SEQUELIZE',
      useValue: sequelize,
    },
  ],
  exports: ['SEQUELIZE'],
})
export class DatabaseModule {}