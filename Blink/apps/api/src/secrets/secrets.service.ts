
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  BlinkSecretVisibility,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

const CORRECT_GUESS_BP = 10;
const PAGE_SIZE = 80;

type SecretInput = {
  prompt: string;
  options: string[];
  correctIndex: number;
  visibility: BlinkSecretVisibility;
  revealAt?: string;
};

@Injectable()
export class SecretsService {
  constructor(
    private readonly prisma: PrismaService
  ) {}

  private async friendIds(
    userId: string
  ): Promise<string[]> {
    const rows = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { userAId: userId },
          { userBId: userId },
        ],
      },
      select: {
        userAId: true,
        userBId: true,
      },
    });

    return rows.map(f =>
      f.userAId === userId ? f.userBId : f.userAId
    );
  }

  private async canSee(
    userId: string,
    creatorId: string
  ): Promise<boolean> {
    if (userId === creatorId) return true;

    return (
      await this.prisma.friendship.count({
        where: {
          OR: [
            { userAId: userId, userBId: creatorId },
            { userAId: creatorId, userBId: userId },
          ],
        },
      })
    ) > 0;
  }

  private validateFields(data: SecretInput) {
    const prompt = data.prompt.trim();

    const options = data.options.map(value =>
      value.trim()
    );

    if (
      prompt.length < 5 ||
      prompt.length > 500
    ) {
      throw new BadRequestException(
        'Question must be 5-500 characters.'
      );
    }

    if (
      options.length < 2 ||
      options.length > 5 ||
      options.some(o => !o || o.length > 120)
    ) {
      throw new BadRequestException(
        'Provide 2-5 nonempty options, max 120 characters each.'
      );
    }

    if (
      new Set(
        options.map(o => o.toLowerCase())
      ).size !== options.length
    ) {
      throw new BadRequestException(
        'Answer options must be different.'
      );
    }

    if (
      !Number.isInteger(data.correctIndex) ||
      data.correctIndex < 0 ||
      data.correctIndex >= options.length
    ) {
      throw new BadRequestException(
        'Choose the correct option.'
      );
    }

    if (
      data.visibility !== 'ANONYMOUS' &&
      data.visibility !== 'NAMED'
    ) {
      throw new BadRequestException(
        'Invalid identity setting.'
      );
    }

    return {
      prompt,
      options,
      correctIndex: data.correctIndex,
      visibility: data.visibility,
    };
  }

  private validateRevealTime(
    value: string
  ): Date {
    const revealAt = new Date(value);
    const delay = revealAt.getTime() - Date.now();

    // Small allowance for request latency.
    if (
      !Number.isFinite(delay) ||
      delay < 59 * 60 * 1000 ||
      delay > 7 * 24 * 60 * 60 * 1000
    ) {
      throw new BadRequestException(
        'Choose a reveal time between 1 hour and 7 days from now.'
      );
    }

    return revealAt;
  }

  private async settle(userId: string) {
    const guesses =
      await this.prisma.blinkSecretGuess.findMany({
        where: {
          userId,
          secret: {
            revealAt: {
              lte: new Date(),
            },
            rewards: {
              none: { userId },
            },
          },
        },
        include: {
          secret: {
            select: { correctIndex: true },
          },
        },
        take: 1000,
      });

    for (const guess of guesses) {
      if (
        guess.selectedIndex !==
        guess.secret.correctIndex
      ) {
        continue;
      }

      try {
        await this.prisma.$transaction(
          async tx => {
            await tx.blinkSecretReward.create({
              data: {
                secretId: guess.secretId,
                userId,
                points: CORRECT_GUESS_BP,
              },
            });

            await tx.user.update({
              where: { id: userId },
              data: {
                blinkPoints: {
                  increment: CORRECT_GUESS_BP,
                },
              },
            });
          }
        );
      } catch (error) {
        if (
          error instanceof
            Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }

        throw error;
      }
    }
  }

  async points(userId: string) {
    await this.settle(userId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { blinkPoints: true },
    });

    return {
      points: Number(user?.blinkPoints ?? 0),
      correctGuessReward: CORRECT_GUESS_BP,
    };
  }

  async create(
    userId: string,
    data: SecretInput & { revealAt: string }
  ) {
    const fields = this.validateFields(data);
    const revealAt = this.validateRevealTime(
      data.revealAt
    );

    const secret =
      await this.prisma.blinkSecret.create({
        data: {
          ...fields,
          creatorId: userId,
          revealAt,
        },
      });

    return {
      id: secret.id,
      created: true,
    };
  }

  async list(userId: string) {
    await this.settle(userId);

    const friends = await this.friendIds(userId);

    const items =
      await this.prisma.blinkSecret.findMany({
        where: {
          creatorId: {
            in: [userId, ...friends],
          },
        },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              avatarKey: true,
            },
          },
          guesses: {
            where: { userId },
            select: { selectedIndex: true },
          },
          rewards: {
            where: { userId },
            select: { points: true },
          },
          reactions: {
            select: {
              userId: true,
              emoji: true,
            },
          },
          _count: {
            select: { guesses: true },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: PAGE_SIZE,
      });

    const now = Date.now();

    return items.map(s => {
      const revealed =
        s.revealAt.getTime() <= now;

      const isMine =
        s.creatorId === userId;

      const reactionCounts:
        Record<string, number> = {};

      for (const reaction of s.reactions) {
        reactionCounts[reaction.emoji] =
          (reactionCounts[reaction.emoji] ?? 0) + 1;
      }

      return {
        id: s.id,
        prompt: s.prompt,
        options: Array.isArray(s.options)
          ? s.options
          : [],
        visibility: s.visibility,
        createdAt: s.createdAt,
        editedAt: s.editedAt,
        revealAt: s.revealAt,
        revealed,
        isMine,

        // New: tell the frontend if editing
        // is currently permitted.
        canEdit:
          isMine &&
          !revealed &&
          s._count.guesses === 0,

        author:
          s.visibility === 'NAMED' || isMine
            ? s.creator
            : null,

        // Keep the correct answer secret.
        correctIndex:
          revealed || isMine
            ? s.correctIndex
            : null,

        myGuess:
          s.guesses[0]?.selectedIndex ?? null,

        myReward:
          s.rewards[0]?.points ?? 0,

        guessCount: s._count.guesses,

        myReaction:
          s.reactions.find(
            r => r.userId === userId
          )?.emoji ?? null,

        reactionCounts,
      };
    });
  }

  // MySQL row lock prevents a race between
  // somebody guessing and the creator editing.
  private async lockSecret(
    tx: Prisma.TransactionClient,
    id: string
  ) {
    const locked =
      await tx.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM \`BlinkSecret\`
        WHERE id = ${id}
        FOR UPDATE
      `;

    if (!locked.length) {
      throw new NotFoundException(
        'Secret not found.'
      );
    }
  }

  // NEW: Edit Secret
  async edit(
    userId: string,
    id: string,
    data: SecretInput
  ) {
    const fields = this.validateFields(data);

    const newRevealTime = data.revealAt
      ? this.validateRevealTime(data.revealAt)
      : undefined;

    return this.prisma.$transaction(
      async tx => {
        await this.lockSecret(tx, id);

        const secret =
          await tx.blinkSecret.findUnique({
            where: { id },
            select: {
              creatorId: true,
              revealAt: true,
            },
          });

        if (!secret) {
          throw new NotFoundException(
            'Secret not found.'
          );
        }

        if (secret.creatorId !== userId) {
          throw new ForbiddenException(
            'Only the creator can edit this Secret.'
          );
        }

        if (
          secret.revealAt.getTime() <= Date.now()
        ) {
          throw new BadRequestException(
            'Revealed Secrets cannot be edited.'
          );
        }

        const guesses =
          await tx.blinkSecretGuess.count({
            where: { secretId: id },
          });

        if (guesses > 0) {
          throw new BadRequestException(
            'Editing is locked because someone has already guessed.'
          );
        }

        await tx.blinkSecret.update({
          where: { id },
          data: {
            ...fields,
            ...(newRevealTime
              ? { revealAt: newRevealTime }
              : {}),
            editedAt: new Date(),
          },
        });

        return {
          updated: true,
          id,
        };
      }
    );
  }

  async guess(
    userId: string,
    id: string,
    selectedIndex: number
  ) {
    if (!Number.isInteger(selectedIndex)) {
      throw new BadRequestException(
        'Invalid answer option.'
      );
    }

    return this.prisma.$transaction(
      async tx => {
        await this.lockSecret(tx, id);

        const secret =
          await tx.blinkSecret.findUnique({
            where: { id },
            select: {
              creatorId: true,
              revealAt: true,
              options: true,
            },
          });

        if (!secret) {
          throw new NotFoundException(
            'Secret not found.'
          );
        }

        if (
          !await this.canSee(
            userId,
            secret.creatorId
          )
        ) {
          throw new NotFoundException(
            'Secret not found.'
          );
        }

        if (secret.creatorId === userId) {
          throw new ForbiddenException(
            'You cannot answer your own Secret.'
          );
        }

        if (
          secret.revealAt.getTime() <= Date.now()
        ) {
          throw new BadRequestException(
            'This Secret is already revealed.'
          );
        }

        const optionCount =
          Array.isArray(secret.options)
            ? secret.options.length
            : 0;

        if (
          selectedIndex < 0 ||
          selectedIndex >= optionCount
        ) {
          throw new BadRequestException(
            'Invalid answer option.'
          );
        }

        try {
          await tx.blinkSecretGuess.create({
            data: {
              secretId: id,
              userId,
              selectedIndex,
            },
          });
        } catch (error) {
          if (
            error instanceof
              Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            throw new BadRequestException(
              'Your answer is already locked.'
            );
          }

          throw error;
        }

        return {
          saved: true,
          revealAt: secret.revealAt,
        };
      }
    );
  }

  async react(
    userId: string,
    id: string,
    emoji: string
  ) {
    const secret =
      await this.prisma.blinkSecret.findUnique({
        where: { id },
        select: { creatorId: true },
      });

    if (
      !secret ||
      !await this.canSee(
        userId,
        secret.creatorId
      )
    ) {
      throw new NotFoundException(
        'Secret not found.'
      );
    }

    await this.prisma.blinkSecretReaction.upsert({
      where: {
        secretId_userId: {
          secretId: id,
          userId,
        },
      },
      create: {
        secretId: id,
        userId,
        emoji,
      },
      update: { emoji },
    });

    return { saved: true };
  }
}
