import Fastify from 'fastify';
import type { Config } from './config.js';
import type { Db } from './db.js';
import { EventRepository } from './repositories/event.repository.js';
import { EventService } from './services/event.service.js';
import { EventController } from './controllers/event.controller.js';
import { eventRoutes } from './routes/event.routes.js';
import { requireApiKey } from './middleware/auth.js';
import { registerErrorHandler } from './middleware/error-handler.js';

export function buildApp(config: Config, db: Db, events = new EventService(new EventRepository(db))) {
  const app = Fastify({
    logger: config.NODE_ENV === 'test' ? false : {
      redact: ['req.headers.authorization'],
    },
    bodyLimit: 1_048_576,
  });
  registerErrorHandler(app);

  app.get('/health', async () => {
    await db.$queryRaw`SELECT 1`;
    return { status: 'ok', service: 'arias' };
  });

  const controller = new EventController(events);
  app.register(async api => {
    api.addHook('onRequest', requireApiKey(config.API_KEY));
    eventRoutes(api, controller);
  }, { prefix: '/api' });

  return app;
}
