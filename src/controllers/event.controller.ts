import type { FastifyReply, FastifyRequest } from 'fastify';
import type { EventService } from '../services/event.service.js';
import { createEventSchema, eventParamsSchema } from '../validators/event.validator.js';

export class EventController {
  constructor(private readonly events: EventService) {}

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const input = createEventSchema.parse(request.body);
    const event = await this.events.create(input);
    return reply.code(201).send({ data: event });
  };

  getById = async (request: FastifyRequest) => {
    const { id } = eventParamsSchema.parse(request.params);
    return { data: await this.events.getById(id) };
  };
}
