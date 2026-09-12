import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export function createDb(url: string) {
  const connectionUrl = new URL(url);
  if (connectionUrl.searchParams.get('sslmode') === 'require' && !connectionUrl.searchParams.has('uselibpqcompat')) {
    connectionUrl.searchParams.set('uselibpqcompat', 'true');
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionUrl.toString() }) });
}

export type Db = ReturnType<typeof createDb>;
