import type { FastifyInstance } from 'fastify';
import type { EventController } from '../controllers/event.controller.js';

export function eventRoutes(app: FastifyInstance, controller: EventController) {
  app.post('/events', controller.create);
  app.get('/events/:id', controller.getById);
}
