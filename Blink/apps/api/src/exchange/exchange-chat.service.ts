import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExchangeChatService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private async getPost(postId: string) {
    const post = await this.prisma.exchangePost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        authorId: true,
        status: true,
      },
    });

    if (!post) {
      throw new NotFoundException('Exchange post not found.');
    }

    return post;
  }

  private async ensureNotBlocked(
    ownerId: string,
    requesterId: string,
  ) {
    const blocked = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          {
            blockerId: ownerId,
            blockedId: requesterId,
          },
          {
            blockerId: requesterId,
            blockedId: ownerId,
          },
        ],
      },
    });

    if (blocked) {
      throw new ForbiddenException(
        'Private conversation is unavailable.',
      );
    }
  }

  private async getAuthorizedThread(
    userId: string,
    postId: string,
    threadId: string,
  ) {
    const thread = await this.prisma.exchangeThread.findFirst({
      where: {
        id: threadId,
        postId,
      },
      include: {
        post: {
          select: { authorId: true },
        },
      },
    });

    if (!thread) {
      throw new NotFoundException(
        'Conversation not found.',
      );
    }

    if (
      userId !== thread.post.authorId &&
      userId !== thread.requesterId
    ) {
      throw new ForbiddenException(
        'You cannot access this conversation.',
      );
    }

    await this.ensureNotBlocked(
      thread.post.authorId,
      thread.requesterId,
    );

    return thread;
  }

  // Return an existing conversation for an interested user.
  async myThread(userId: string, postId: string) {
    const post = await this.getPost(postId);

    if (post.authorId === userId) {
      throw new BadRequestException(
        'The post owner must select a conversation.',
      );
    }

    await this.ensureNotBlocked(post.authorId, userId);

    const thread = await this.prisma.exchangeThread.findUnique({
      where: {
        postId_requesterId: {
          postId,
          requesterId: userId,
        },
      },
      select: { id: true },
    });

    return {
      threadId: thread?.id ?? null,
    };
  }

  // Create or reuse one conversation per interested user.
  async startThread(userId: string, postId: string) {
    const post = await this.getPost(postId);

    if (post.authorId === userId) {
      throw new BadRequestException(
        'You cannot request your own service.',
      );
    }

    await this.ensureNotBlocked(post.authorId, userId);

    const existing = await this.prisma.exchangeThread.findUnique({
      where: {
        postId_requesterId: {
          postId,
          requesterId: userId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      return { threadId: existing.id };
    }

    if (post.status === 'CLOSED') {
      throw new BadRequestException(
        'This exchange is closed to new conversations.',
      );
    }

    const thread = await this.prisma.exchangeThread.upsert({
      where: {
        postId_requesterId: {
          postId,
          requesterId: userId,
        },
      },
      create: {
        postId,
        requesterId: userId,
      },
      update: {},
      select: { id: true },
    });

    return { threadId: thread.id };
  }

  // Only the post owner sees all interested people.
  async ownerThreads(userId: string, postId: string) {
    const post = await this.getPost(postId);

    if (post.authorId !== userId) {
      throw new ForbiddenException(
        'Only the post owner can see interested users.',
      );
    }

    return this.prisma.exchangeThread.findMany({
      where: { postId },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  // Only the two participants can read messages.
  async messages(
    userId: string,
    postId: string,
    threadId: string,
  ) {
    await this.getAuthorizedThread(
      userId,
      postId,
      threadId,
    );

    const messages = await this.prisma.exchangeChatMessage.findMany({
      where: { threadId },
      select: {
        id: true,
        text: true,
        senderId: true,
        createdAt: true,
        sender: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    return messages.reverse();
  }

  // Send a private message.
  async sendMessage(
    userId: string,
    postId: string,
    threadId: string,
    value: unknown,
  ) {
    await this.getAuthorizedThread(
      userId,
      postId,
      threadId,
    );

    const text =
      typeof value === 'string'
        ? value.trim()
        : '';

    if (text.length < 1 || text.length > 2000) {
      throw new BadRequestException(
        'Message must be between 1 and 2000 characters.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const message = await tx.exchangeChatMessage.create({
        data: {
          threadId,
          senderId: userId,
          text,
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      await tx.exchangeThread.update({
        where: { id: threadId },
        data: {
          updatedAt: new Date(),
        },
      });

      return message;
    });
  }
}