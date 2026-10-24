import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ExchangeKind,
  ExchangeStatus,
} from '@prisma/client';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

export const Exchange_MEDIA_DIR = join(
  process.cwd(),
  'uploads',
  'Exchange',
);

const postInclude = {
  author: {
    select: { id: true, name: true, avatarKey: true },
  },
  media: {
    orderBy: { position: 'asc' as const },
  },
  responses: {
    orderBy: { createdAt: 'asc' as const },
    take: 30,
    include: {
      author: {
        select: { id: true, name: true },
      },
    },
  },
  _count: {
    select: { responses: true },
  },
};

const validKinds: ExchangeKind[] = [
  ExchangeKind.OFFER,
  ExchangeKind.REQUEST,
  ExchangeKind.ADVICE,
  ExchangeKind.COLLABORATION,
];

type ListFilters = {
  search?: string;
  kind?: string;
  mine?: string;
  page?: string;
};

@Injectable()
export class ExchangeService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private validateForm(body: Record<string, unknown>) {
    const title =
      typeof body.title === 'string'
        ? body.title.trim()
        : '';

    const description =
      typeof body.description === 'string'
        ? body.description.trim()
        : '';

    const kind = body.kind;

    if (title.length < 6 || title.length > 140) {
      throw new BadRequestException(
        'Title must be 6–140 characters.',
      );
    }

    if (
      description.length < 20 ||
      description.length > 5000
    ) {
      throw new BadRequestException(
        'Description must be 20–5000 characters.',
      );
    }

    if (
      typeof kind !== 'string' ||
      !validKinds.includes(kind as ExchangeKind)
    ) {
      throw new BadRequestException('Invalid post type.');
    }

    return {
      title,
      description,
      kind: kind as ExchangeKind,
    };
  }

  private async cleanup(
    files: Array<{ filename: string }>,
  ) {
    await Promise.all(
      files.map(async (file) => {
        await unlink(
          join(Exchange_MEDIA_DIR, file.filename),
        ).catch(() => undefined);
      }),
    );
  }

  private mediaCreate(files: Express.Multer.File[]) {
    return files.map((file, position) => ({
      key: file.filename,
      mimeType: file.mimetype,
      position,
    }));
  }

  async list(userId: string, filters: ListFilters) {
    const currentPage = Number(filters.page ?? 1);

    const page = Number.isSafeInteger(currentPage)
      ? Math.min(10000, Math.max(1, currentPage))
      : 1;

    const search = (filters.search || '')
      .trim()
      .slice(0, 100);

    const kind = validKinds.includes(
      filters.kind as ExchangeKind,
    )
      ? (filters.kind as ExchangeKind)
      : undefined;

    const where: Prisma.ExchangePostWhereInput = {
      ...(kind ? { kind } : {}),
      ...(filters.mine === 'true'
        ? { authorId: userId }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search } },
              { description: { contains: search } },
            ],
          }
        : {}),
    };

    const take = 10;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.ExchangePost.findMany({
        where,
        include: postInclude,
        orderBy: { createdAt: 'desc' },
        take,
        skip: (page - 1) * take,
      }),
      this.prisma.ExchangePost.count({ where }),
    ]);

    return {
      items,
      page,
      pages: Math.max(1, Math.ceil(total / take)),
      total,
    };
  }

  async getOne(id: string) {
    const post = await this.prisma.ExchangePost.findUnique({
      where: { id },
      include: postInclude,
    });

    if (!post) {
      throw new NotFoundException(
        'Exchange post not found.',
      );
    }

    return post;
  }

  async create(
    userId: string,
    body: Record<string, unknown>,
    files: Express.Multer.File[],
  ) {
    try {
      const data = this.validateForm(body);

      return await this.prisma.ExchangePost.create({
        data: {
          ...data,
          authorId: userId,
          media: {
            create: this.mediaCreate(files),
          },
        },
        include: postInclude,
      });
    } catch (error) {
      await this.cleanup(files);
      throw error;
    }
  }

  async update(
    userId: string,
    id: string,
    body: Record<string, unknown>,
    files: Express.Multer.File[],
  ) {
    try {
      const post = await this.prisma.ExchangePost.findUnique({
        where: { id },
        include: { media: true },
      });

      if (!post) {
        throw new NotFoundException(
          'Exchange post not found.',
        );
      }

      if (post.authorId !== userId) {
        throw new ForbiddenException(
          'You can edit only your own posts.',
        );
      }

      const data = this.validateForm(body);
      const status = body.status;

      if (
        status !== undefined &&
        !Object.values(ExchangeStatus).includes(
          status as ExchangeStatus,
        )
      ) {
        throw new BadRequestException(
          'Invalid post status.',
        );
      }

      const updated =
        await this.prisma.ExchangePost.update({
          where: { id },
          data: {
            ...data,
            ...(status
              ? { status: status as ExchangeStatus }
              : {}),
            ...(files.length
              ? {
                  media: {
                    deleteMany: {},
                    create: this.mediaCreate(files),
                  },
                }
              : {}),
          },
          include: postInclude,
        });

      // New files replace existing media.
      // An empty file selection keeps existing media.
      if (files.length) {
        await this.cleanup(
          post.media.map((media) => ({
            filename: media.key,
          })),
        );
      }

      return updated;
    } catch (error) {
      await this.cleanup(files);
      throw error;
    }
  }

  async remove(userId: string, id: string) {
    const post = await this.prisma.ExchangePost.findUnique({
      where: { id },
      include: { media: true },
    });

    if (!post) {
      throw new NotFoundException(
        'Exchange post not found.',
      );
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException(
        'You can delete only your own posts.',
      );
    }

    await this.prisma.ExchangePost.delete({
      where: { id },
    });

    await this.cleanup(
      post.media.map((media) => ({
        filename: media.key,
      })),
    );

    return { success: true };
  }

  async reply(
    userId: string,
    postId: string,
    value: unknown,
  ) {
    const message =
      typeof value === 'string' ? value.trim() : '';

    if (
      message.length < 2 ||
      message.length > 600
    ) {
      throw new BadRequestException(
        'Your message must be 2–600 characters.',
      );
    }

    const post = await this.prisma.ExchangePost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException(
        'Exchange post not found.',
      );
    }

    if (post.status === ExchangeStatus.CLOSED) {
      throw new BadRequestException(
        'This Exchange is closed.',
      );
    }

    if (post.authorId === userId) {
      throw new BadRequestException(
        'You cannot reply to your own Exchange post.',
      );
    }

    return this.prisma.ExchangeResponse.create({
      data: {
        postId,
        authorId: userId,
        message,
      },
      include: {
        author: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async acknowledge(
    userId: string,
    postId: string,
    responseId: string,
  ) {
    const response =
      await this.prisma.ExchangeResponse.findFirst({
        where: { id: responseId, postId },
        include: {
          post: {
            select: { authorId: true },
          },
        },
      });

    if (!response) {
      throw new NotFoundException('Response not found.');
    }

    if (response.post.authorId !== userId) {
      throw new ForbiddenException(
        'Only the post author can acknowledge help.',
      );
    }

    return this.prisma.ExchangeResponse.update({
      where: { id: responseId },
      data: {
        acknowledgedAt:
          response.acknowledgedAt ?? new Date(),
      },
    });
  }

  async getMedia(id: string) {
    const media = await this.prisma.ExchangeMedia.findUnique({
      where: { id },
    });

    if (!media) {
      throw new NotFoundException(
        'Attachment not found.',
      );
    }

    if (
      !/^[0-9a-f-]{36}\.(jpg|png|webp|mp4|webm|mov)$/.test(
        media.key,
      )
    ) {
      throw new NotFoundException(
        'Attachment not found.',
      );
    }

    return media;
  }
}