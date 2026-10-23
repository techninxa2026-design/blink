
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const heartInclude = {
  sender: {
    select: {
      id: true,
      name: true,
      avatarKey: true,
    },
  },
  receiver: {
    select: {
      id: true,
      name: true,
      avatarKey: true,
    },
  },
  messages: {
    select: {
      id: true,
      authorId: true,
      text: true,
      createdAt: true,
      editedAt: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: 300,
  },
} as const satisfies Prisma.BlinkHeartThreadInclude;

type HeartRecord =
  Prisma.BlinkHeartThreadGetPayload<{
    include: typeof heartInclude;
  }>;

@Injectable()
export class HeartsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // Prevent communication if either user
  // has blocked the other.
  private async checkNotBlocked(
    userA: string,
    userB: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const block = await tx.userBlock.findFirst({
      where: {
        OR: [
          {
            blockerId: userA,
            blockedId: userB,
          },
          {
            blockerId: userB,
            blockedId: userA,
          },
        ],
      },
      select: {
        blockerId: true,
      },
    });

    if (block) {
      throw new ForbiddenException(
        'This conversation is unavailable.',
      );
    }
  }

  // Format a thread without exposing
  // an anonymous sender's account details.
  private project(
    thread: HeartRecord,
    viewerId: string,
    blockedByMe = false,
  ) {
    const incoming =
      thread.receiverId === viewerId;

    const person = incoming
      ? (
          thread.senderRevealed
            ? thread.sender
            : null
        )
      : thread.receiver;

    return {
      id: thread.id,
      side: incoming ? 'incoming' : 'sent',

      // Declines are never disclosed
      // to the original sender.
      status:
        !incoming &&
        thread.status === 'DECLINED'
          ? 'PENDING'
          : thread.status,

      revealed: thread.senderRevealed,
      person,

      blockedByMe: incoming
        ? blockedByMe
        : false,

      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,

      messages: thread.messages.map(message => ({
        id: message.id,
        text: message.text,
        createdAt: message.createdAt,
        editedAt: message.editedAt,

        // Do not return authorId to the UI.
        fromMe: message.authorId === viewerId,
      })),
    };
  }

  private async load(
    userId: string,
    threadId: string,
  ): Promise<HeartRecord> {
    const thread =
      await this.prisma.blinkHeartThread.findFirst({
        where: {
          id: threadId,
          OR: [
            { senderId: userId },
            { receiverId: userId },
          ],
        },
        include: heartInclude,
      });

    if (!thread) {
      throw new NotFoundException(
        'Heart conversation not found.',
      );
    }

    return thread;
  }

  // Search for people to send Hearts to.
  async people(
    userId: string,
    search: string,
  ) {
    const term = search.trim().slice(0, 80);

    if (term.length < 2) {
      return [];
    }

    const matches =
      await this.prisma.user.findMany({
        where: {
          id: { not: userId },
          name: { contains: term },
        },
        select: {
          id: true,
          name: true,
          avatarKey: true,
        },
        orderBy: {
          name: 'asc',
        },
        take: 15,
      });

    const blocks =
      await this.prisma.userBlock.findMany({
        where: {
          OR: [
            { blockerId: userId },
            { blockedId: userId },
          ],
        },
        select: {
          blockerId: true,
          blockedId: true,
        },
      });

    const blockedIds = new Set(
      blocks.map(block =>
        block.blockerId === userId
          ? block.blockedId
          : block.blockerId,
      ),
    );

    return matches.filter(
      user => !blockedIds.has(user.id),
    );
  }

  // Received and sent Heart conversations.
  async list(
    userId: string,
    side: 'incoming' | 'sent',
  ) {
    const incoming = side === 'incoming';

    const [threads, blocks] = await Promise.all([
      this.prisma.blinkHeartThread.findMany({
        where: incoming
          ? { receiverId: userId }
          : { senderId: userId },

        include: heartInclude,

        orderBy: {
          updatedAt: 'desc',
        },

        take: 100,
      }),

      incoming
        ? this.prisma.userBlock.findMany({
            where: {
              blockerId: userId,
            },
            select: {
              blockedId: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const blocked = new Set(
      blocks.map(block => block.blockedId),
    );

    return threads.map(thread =>
      this.project(
        thread,
        userId,
        blocked.has(thread.senderId),
      ),
    );
  }

  // Load thread without creating
  // any read receipt.
  async detail(
    userId: string,
    id: string,
  ) {
    const thread = await this.load(userId, id);

    const block =
      thread.receiverId === userId
        ? await this.prisma.userBlock.findUnique({
            where: {
              blockerId_blockedId: {
                blockerId: userId,
                blockedId: thread.senderId,
              },
            },
          })
        : null;

    return this.project(
      thread,
      userId,
      Boolean(block),
    );
  }

  // Send a new Heart.
  // Repeated Hearts are allowed while pending.
  async send(
    senderId: string,
    receiverId: string,
    input: string,
  ) {
    if (receiverId === senderId) {
      throw new BadRequestException(
        'You cannot Heart yourself.',
      );
    }

    const text = input.trim();

    if (!text || text.length > 2000) {
      throw new BadRequestException(
        'Enter a message (1-2000 characters).',
      );
    }

    const receiver =
      await this.prisma.user.findUnique({
        where: { id: receiverId },
        select: { id: true },
      });

    if (!receiver) {
      throw new NotFoundException(
        'User not found.',
      );
    }

    await this.prisma.$transaction(async tx => {
      await this.checkNotBlocked(
        senderId,
        receiverId,
        tx,
      );

      const thread =
        await tx.blinkHeartThread.upsert({
          where: {
            senderId_receiverId: {
              senderId,
              receiverId,
            },
          },
          create: {
            senderId,
            receiverId,
          },
          update: {},
        });

      // Short anti-spam interval.
      // No limit on the total number of Hearts.
      const recent =
        await tx.blinkHeartMessage.findFirst({
          where: {
            threadId: thread.id,
            authorId: senderId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            createdAt: true,
          },
        });

      if (
        recent &&
        Date.now() - recent.createdAt.getTime() < 2000
      ) {
        throw new BadRequestException(
          'Please wait a moment before sending again.',
        );
      }

      // Another Heart can reopen a
      // quietly declined request.
      if (thread.status === 'DECLINED') {
        await tx.blinkHeartThread.update({
          where: {
            id: thread.id,
          },
          data: {
            status: 'PENDING',
          },
        });
      }

      await tx.blinkHeartMessage.create({
        data: {
          threadId: thread.id,
          authorId: senderId,
          text,
        },
      });

      await tx.blinkHeartThread.update({
        where: {
          id: thread.id,
        },
        data: {
          updatedAt: new Date(),
        },
      });
    });

    const thread =
      await this.prisma.blinkHeartThread
        .findUniqueOrThrow({
          where: {
            senderId_receiverId: {
              senderId,
              receiverId,
            },
          },
          include: heartInclude,
        });

    return this.project(thread, senderId);
  }

  // Send a follow-up Heart or accepted reply.
  async message(
    userId: string,
    id: string,
    input: string,
  ) {
    const text = input.trim();

    if (!text || text.length > 2000) {
      throw new BadRequestException(
        'Enter a message (1-2000 characters).',
      );
    }

    await this.prisma.$transaction(async tx => {
      const thread =
        await tx.blinkHeartThread.findFirst({
          where: {
            id,
            OR: [
              { senderId: userId },
              { receiverId: userId },
            ],
          },
          select: {
            id: true,
            senderId: true,
            receiverId: true,
            status: true,
          },
        });

      if (!thread) {
        throw new NotFoundException(
          'Heart conversation not found.',
        );
      }

      await this.checkNotBlocked(
        thread.senderId,
        thread.receiverId,
        tx,
      );

      if (
        userId === thread.receiverId &&
        thread.status !== 'ACCEPTED'
      ) {
        throw new ForbiddenException(
          'Accept the Heart before replying.',
        );
      }

      const recent =
        await tx.blinkHeartMessage.findFirst({
          where: {
            threadId: id,
            authorId: userId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            createdAt: true,
          },
        });

      if (
        recent &&
        Date.now() - recent.createdAt.getTime() < 2000
      ) {
        throw new BadRequestException(
          'Please wait a moment before sending again.',
        );
      }

      if (
        userId === thread.senderId &&
        thread.status === 'DECLINED'
      ) {
        await tx.blinkHeartThread.update({
          where: { id },
          data: { status: 'PENDING' },
        });
      }

      await tx.blinkHeartMessage.create({
        data: {
          threadId: id,
          authorId: userId,
          text,
        },
      });

      await tx.blinkHeartThread.update({
        where: { id },
        data: {
          updatedAt: new Date(),
        },
      });
    });

    return this.detail(userId, id);
  }

  // =========================================
  // NEW FEATURE: EDIT OWN HEART MESSAGE
  // =========================================
  async editMessage(
    userId: string,
    id: string,
    messageId: string,
    input: string,
  ) {
    if (typeof input !== 'string') {
      throw new BadRequestException(
        'Message text is required.',
      );
    }

    const text = input.trim();

    if (!text || text.length > 2000) {
      throw new BadRequestException(
        'Enter a message (1-2000 characters).',
      );
    }

    await this.prisma.$transaction(async tx => {
      const thread =
        await tx.blinkHeartThread.findFirst({
          where: {
            id,
            OR: [
              { senderId: userId },
              { receiverId: userId },
            ],
          },
          select: {
            senderId: true,
            receiverId: true,
            status: true,
          },
        });

      if (!thread) {
        throw new NotFoundException(
          'Heart conversation not found.',
        );
      }

      await this.checkNotBlocked(
        thread.senderId,
        thread.receiverId,
        tx,
      );

      // Receiver can edit replies
      // only after accepting.
      if (
        userId === thread.receiverId &&
        thread.status !== 'ACCEPTED'
      ) {
        throw new ForbiddenException(
          'Accept the Heart before editing a reply.',
        );
      }

      // Ownership verified in the SQL update.
      // Cannot modify another user's message.
      const result =
        await tx.blinkHeartMessage.updateMany({
          where: {
            id: messageId,
            threadId: id,
            authorId: userId,
          },
          data: {
            text,
            editedAt: new Date(),
          },
        });

      if (result.count === 0) {
        throw new NotFoundException(
          'Your Heart message was not found.',
        );
      }

      await tx.blinkHeartThread.update({
        where: { id },
        data: {
          updatedAt: new Date(),
        },
      });
    });

    // Return anonymity-safe data.
    return this.detail(userId, id);
  }

  // Receiver accepts or quietly declines.
  async respond(
    receiverId: string,
    id: string,
    status: 'ACCEPTED' | 'DECLINED',
  ) {
    const thread =
      await this.prisma.blinkHeartThread.findFirst({
        where: {
          id,
          receiverId,
        },
        select: {
          senderId: true,
          status: true,
        },
      });

    if (!thread) {
      throw new NotFoundException(
        'Heart conversation not found.',
      );
    }

    await this.checkNotBlocked(
      thread.senderId,
      receiverId,
    );

    if (thread.status !== 'PENDING') {
      throw new BadRequestException(
        'This request was already answered.',
      );
    }

    const result =
      await this.prisma.blinkHeartThread.updateMany({
        where: {
          id,
          receiverId,
          status: 'PENDING',
        },
        data: {
          status,
        },
      });

    if (!result.count) {
      throw new BadRequestException(
        'The request changed; refresh this page.',
      );
    }

    return this.detail(receiverId, id);
  }

  // Sender confirms before revealing identity.
  async reveal(
    senderId: string,
    id: string,
  ) {
    const thread =
      await this.prisma.blinkHeartThread.findFirst({
        where: {
          id,
          senderId,
        },
        select: {
          receiverId: true,
          status: true,
        },
      });

    if (!thread) {
      throw new NotFoundException(
        'Heart conversation not found.',
      );
    }

    await this.checkNotBlocked(
      senderId,
      thread.receiverId,
    );

    if (thread.status !== 'ACCEPTED') {
      throw new ForbiddenException(
        'You can only reveal yourself after the recipient accepts.',
      );
    }

    await this.prisma.blinkHeartThread.update({
      where: { id },
      data: {
        senderRevealed: true,
      },
    });

    return this.detail(senderId, id);
  }

  // Receiver blocks the anonymous sender.
  async block(
    receiverId: string,
    id: string,
  ) {
    const thread =
      await this.prisma.blinkHeartThread.findFirst({
        where: {
          id,
          receiverId,
        },
        select: {
          senderId: true,
        },
      });

    if (!thread) {
      throw new NotFoundException(
        'Heart conversation not found.',
      );
    }

    await this.prisma.$transaction(async tx => {
      await tx.userBlock.upsert({
        where: {
          blockerId_blockedId: {
            blockerId: receiverId,
            blockedId: thread.senderId,
          },
        },
        create: {
          blockerId: receiverId,
          blockedId: thread.senderId,
        },
        update: {},
      });

      // No notification is sent to the sender.
      await tx.blinkHeartThread.updateMany({
        where: {
          id,
          status: 'PENDING',
        },
        data: {
          status: 'DECLINED',
        },
      });
    });

    return {
      blocked: true,
    };
  }
}
