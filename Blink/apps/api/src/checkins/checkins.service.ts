import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type CreateBody = { emoji?: unknown; status?: unknown; note?: unknown; duration?: unknown };
const DURATIONS: Record<string, number | null> = {
  '24h': 24 * 60 * 60 * 1000,
  '48h': 48 * 60 * 60 * 1000,
  'until_removed': null,
};

@Injectable()
export class CheckinsService {
  constructor(private readonly prisma: PrismaService) {}

  private active() {
    return [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];
  }

  async mine(userId: string) {
    return this.prisma.checkin.findFirst({
      where: { userId, OR: this.active() },
      include: { user: { select: { id: true, name: true, avatarKey: true } } },
    });
  }

  async feed(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      select: { userAId: true, userBId: true },
    });
    const friendIds = friendships.map(f => f.userAId === userId ? f.userBId : f.userAId);
    const blocked = await this.prisma.userBlock.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    const blockedIds = new Set(blocked.map(b => b.blockerId === userId ? b.blockedId : b.blockerId));
    const visibleIds = [userId, ...friendIds.filter(id => !blockedIds.has(id))];
    return this.prisma.checkin.findMany({
      where: { userId: { in: visibleIds }, OR: this.active() },
      include: { user: { select: { id: true, name: true, avatarKey: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async create(userId: string, input: unknown) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('A check-in is required.');
    }
    const body = input as CreateBody;
    if (typeof body.emoji !== 'string' || !body.emoji.trim() || [...body.emoji].length > 8) {
      throw new BadRequestException('Choose a valid emoji.');
    }
    if (typeof body.status !== 'string' || !body.status.trim() || [...body.status.trim()].length > 80) {
      throw new BadRequestException('Status must be 1–80 characters.');
    }
    if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') {
      throw new BadRequestException('Note must be text.');
    }
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if ([...note].length > 280) {
      throw new BadRequestException('Note cannot exceed 280 characters.');
    }
    if (typeof body.duration !== 'string' || !Object.prototype.hasOwnProperty.call(DURATIONS, body.duration)) {
      throw new BadRequestException('Duration must be 24h, 48h, or until_removed.');
    }
    const now = new Date();
    const durationMs = DURATIONS[body.duration];
    const expiresAt = durationMs === null ? null : new Date(now.getTime() + durationMs);
    const data = { emoji: body.emoji.trim(), status: body.status.trim(), note: note || null, duration: body.duration, expiresAt };
    // A unique userId constraint also prevents concurrent duplicate check-ins.
    const current = await this.prisma.checkin.findUnique({ where: { userId } });
    if (current && (!current.expiresAt || current.expiresAt > now)) {
      throw new ConflictException('Remove your active check-in before creating another.');
    }
    try {
      return await this.prisma.checkin.upsert({
        where: { userId },
        create: { userId, ...data },
        update: { ...data, createdAt: now },
      });
    } catch (error) {
      // A concurrent request may have created a check-in first.
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('You already have an active check-in.');
      }
      throw error;
    }
  }


  async update(userId: string, id: string, input: unknown) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('A Check-In update is required.');
    }
    const body = input as CreateBody;
    if (typeof body.emoji !== 'string' || !body.emoji.trim() || [...body.emoji].length > 8) throw new BadRequestException('Choose a valid emoji.');
    if (typeof body.status !== 'string' || !body.status.trim() || [...body.status.trim()].length > 80) throw new BadRequestException('Status must be 1–80 characters.');
    if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') throw new BadRequestException('Note must be text.');
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if ([...note].length > 280) throw new BadRequestException('Note cannot exceed 280 characters.');
    if (typeof body.duration !== 'string' || !Object.prototype.hasOwnProperty.call(DURATIONS, body.duration)) throw new BadRequestException('Invalid duration.');
    const now = new Date();
    const current = await this.prisma.checkin.findFirst({ where: { id, userId, OR: this.active() } });
    if (!current) throw new NotFoundException('Active Check-In not found.');
    const durationMs = DURATIONS[body.duration];
    // Editing duration starts a new visibility window from the edit time.
    const expiresAt = durationMs === null ? null : new Date(now.getTime() + durationMs);
    const updated = await this.prisma.checkin.updateMany({
      where: { id, userId, OR: this.active() },
      data: { emoji: body.emoji.trim(), status: body.status.trim(), note: note || null, duration: body.duration, expiresAt },
    });
    if (!updated.count) throw new NotFoundException('Active Check-In not found.');
    return this.prisma.checkin.findUnique({ where: { id } });
  }

  async remove(userId: string, id: string) {
    const result = await this.prisma.checkin.deleteMany({ where: { id, userId } });
    if (!result.count) throw new NotFoundException('Check-in not found.');
    return { message: 'Check-in removed.' };
  }
}
