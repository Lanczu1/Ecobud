import { Router } from 'express';
import { prisma } from '../prismaClient';
import { authenticateRequest, AuthenticatedRequest, requireUserAccess } from '../http/authentication';
import { HttpError, errorBoundary } from '../http/errorResponder';

const eventRoutes = Router();

eventRoutes.get(
  '/',
  errorBoundary(async (_req, res) => {
    const events = await prisma.event.findMany({
      include: {
        registrations: true,
      },
      orderBy: { date: 'asc' },
    });

    return res.json({
      items: events.map((event) => ({
        ...event,
        spotsLeft: Math.max(0, event.capacity - event.registrations.length),
      })),
    });
  }),
);

eventRoutes.post(
  '/:eventId/join',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const event = await prisma.event.findUnique({
      where: { id: req.params.eventId },
      include: { registrations: true },
    });

    if (!event) {
      throw new HttpError(404, 'Event not found.');
    }

    const existingRegistration = event.registrations.find(
      (registration) => registration.userId === req.auth!.userId,
    );

    if (existingRegistration) {
      return res.json({ alreadyJoined: true, registration: existingRegistration });
    }

    if (event.registrations.length >= event.capacity) {
      throw new HttpError(409, 'This event is already full.');
    }

    const registration = await prisma.eventRegistration.create({
      data: {
        userId: req.auth!.userId,
        eventId: event.id,
      },
    });

    return res.status(201).json({ alreadyJoined: false, registration });
  }),
);

export { eventRoutes };
