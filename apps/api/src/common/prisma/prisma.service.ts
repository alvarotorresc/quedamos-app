import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const DEFAULT_CONNECTION_LIMIT = 5;

export function buildDatasourceUrl(baseUrl: string, connectionLimit: number): string {
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}connection_limit=${connectionLimit}`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionLimit =
      parseInt(process.env.DATABASE_CONNECTION_LIMIT ?? '', 10) || DEFAULT_CONNECTION_LIMIT;

    super({
      datasourceUrl: buildDatasourceUrl(process.env.DATABASE_URL!, connectionLimit),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
