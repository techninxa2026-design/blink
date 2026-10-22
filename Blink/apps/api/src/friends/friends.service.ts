
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FriendRequestStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const publicUserSelect = {
  id: true,
  name: true,
  avatarKey: true,
  bio: true,
} as const;

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  private getPair(userId1: string, userId2: string) {
    return [userId1, userId2].sort() as [string, string];
  }

  private async areFriends(userId1: string, userId2: string) {
    const [userAId, userBId] = this.getPair(userId1, userId2);

    return this.prisma.friendship.findUnique({
      where: {
        userAId_userBId: { userAId, userBId },
      },
    });
  }

  async sendRequest(senderId: string, receiverId?: string) {
    if (!receiverId || typeof receiverId !== 'string') {
      throw new BadRequestException('A valid receiverId is required.');
    }

    if (senderId === receiverId) {
      throw new BadRequestException(
        'You cannot send a friend request to yourself.',
      );
    }

    const receiver = await this.prisma.user.findUnique({
      where: { id: receiverId },
      select: { id: true },
    });

    if (!receiver) {
      throw new NotFoundException('User not found.');
    }

    if (await this.areFriends(senderId, receiverId)) {
      throw new ConflictException('You are already friends.');
    }

    const existingRequests = await this.prisma.friendRequest.findMany({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      },
    });

    if (
      existingRequests.some(
        (request) => request.status === FriendRequestStatus.ACCEPTED,
      )
    ) {
      throw new ConflictException(
        'This connection has already been accepted.',
      );
    }

    if (
      existingRequests.some(
        (request) => request.status === FriendRequestStatus.PENDING,
      )
    ) {
      throw new ConflictException(
        'A friend request is already pending between you.',
      );
    }

    try {
      // Reuse an old rejected request if one exists in this direction.
      const previous = existingRequests.find(
        (request) =>
          request.senderId === senderId &&
          request.receiverId === receiverId,
      );

      if (previous) {
        return await this.prisma.friendRequest.update({
          where: { id: previous.id },
          data: { status: FriendRequestStatus.PENDING },
          include: {
            receiver: { select: publicUserSelect },
          },
        });
      }

      return await this.prisma.friendRequest.create({
        data: {
          senderId,
          receiverId,
          status: FriendRequestStatus.PENDING,
        },
        include: {
          receiver: { select: publicUserSelect },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A friend request already exists.',
        );
      }
      throw error;
    }
  }

  async getIncoming(userId: string) {
    return this.prisma.friendRequest.findMany({
      where: {
        receiverId: userId,
        status: FriendRequestStatus.PENDING,
      },
      include: {
        sender: { select: publicUserSelect },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOutgoing(userId: string) {
    return this.prisma.friendRequest.findMany({
      where: {
        senderId: userId,
        status: FriendRequestStatus.PENDING,
      },
      include: {
        receiver: { select: publicUserSelect },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async acceptRequest(userId: string, requestId: string) {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.receiverId !== userId) {
      throw new NotFoundException('Friend request not found.');
    }

    if (request.status !== FriendRequestStatus.PENDING) {
      throw new ConflictException(
        'This friend request is no longer pending.',
      );
    }

    const [userAId, userBId] = this.getPair(
      request.senderId,
      request.receiverId,
    );

    try {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.friendRequest.updateMany({
          where: {
            id: requestId,
            receiverId: userId,
            status: FriendRequestStatus.PENDING,
          },
          data: { status: FriendRequestStatus.ACCEPTED },
        });

        if (updated.count !== 1) {
          throw new ConflictException(
            'This friend request is no longer pending.',
          );
        }

        await tx.friendship.upsert({
          where: {
            userAId_userBId: { userAId, userBId },
          },
          create: { userAId, userBId },
          update: {},
        });

        // Clear any opposite-direction pending request.
        await tx.friendRequest.updateMany({
          where: {
            senderId: userId,
            receiverId: request.senderId,
            status: FriendRequestStatus.PENDING,
          },
          data: { status: FriendRequestStatus.ACCEPTED },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        throw new ConflictException(
          'This request was updated concurrently. Please try again.',
        );
      }
      throw error;
    }

    return {
      message: 'Friend request accepted.',
      friendId: request.senderId,
    };
  }

  async declineRequest(userId: string, requestId: string) {
    const updated = await this.prisma.friendRequest.updateMany({
      where: {
        id: requestId,
        receiverId: userId,
        status: FriendRequestStatus.PENDING,
      },
      data: { status: FriendRequestStatus.REJECTED },
    });

    if (updated.count !== 1) {
      throw new NotFoundException(
        'Pending friend request not found.',
      );
    }

    return { message: 'Friend request declined.' };
  }



async unfriend(userId: string, friendId: string) {
  if (userId === friendId) {
    throw new BadRequestException('You cannot unfriend yourself.');
  }

  const [userAId, userBId] = [userId, friendId].sort();

  const result = await this.prisma.$transaction(async (tx) => {
    const deleted = await tx.friendship.deleteMany({
      where: {
        userAId,
        userBId,
      },
    });

    if (deleted.count === 0) {
      throw new NotFoundException('Friendship not found.');
    }

    // Remove old accepted requests so either user can
    // send a fresh request after unfriending.
    await tx.friendRequest.deleteMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { senderId: userId, receiverId: friendId },
          { senderId: friendId, receiverId: userId },
        ],
      },
    });

    return { message: 'You are no longer friends.' };
  });

  return result;
}





async searchUsers(userId: string, query?: string) {
  const search = typeof query === 'string' ? query.trim() : '';

  if (search.length > 80) {
    throw new BadRequestException(
      'Search cannot exceed 80 characters.',
    );
  }

  if (!search) return [];

  return this.prisma.user.findMany({
    where: {
      id: { not: userId },
      name: { contains: search },
    },
    select: publicUserSelect,
    orderBy: { name: 'asc' },
    take: 20,
  });
}



  async getFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      include: {
        userA: { select: publicUserSelect },
        userB: { select: publicUserSelect },
      },
      orderBy: { createdAt: 'desc' },
    });

    return friendships.map((friendship) => ({
      friendshipId: friendship.id,
      createdAt: friendship.createdAt,
      user:
        friendship.userAId === userId
          ? friendship.userB
          : friendship.userA,
    }));
  }
}
