
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { StreamableFile } from '@nestjs/common';

const publicUserSelect = {
  id: true,
  name: true,
  avatarKey: true,
  bio: true,
} as const;

@Injectable()
export class InboxService {
  constructor(private readonly prisma: PrismaService) {}

  private async messageForAction(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found.');
    const member = await this.getMembership(userId, message.conversationId);
    if (member.clearedAt && message.createdAt <= member.clearedAt) throw new NotFoundException("Message no longer available.");
    const hidden = await this.prisma.messageHidden.findUnique({ where: { messageId_userId: { messageId, userId } } });
    if (hidden) throw new NotFoundException("Message no longer available.");
    return message;
  }

  async editMessage(userId: string, messageId: string, body: unknown) {
    const message = await this.messageForAction(userId, messageId);
    if (message.senderId !== userId || message.mediaKey || message.unsentAt) throw new ForbiddenException('Only your own active text messages can be edited.');
    if (typeof body !== 'string' || !body.trim() || body.trim().length > 5000) throw new BadRequestException('Enter 1–5000 characters.');
    return this.prisma.message.update({ where: { id: messageId }, data: { body: body.trim(), editedAt: new Date() } });
  }

  async hideMessage(userId: string, messageId: string) {
    await this.messageForAction(userId, messageId);
    await this.prisma.messageHidden.upsert({ where: { messageId_userId: { messageId, userId } }, create: { messageId, userId }, update: {} });
    return { ok: true };
  }

  async unsendMessage(userId: string, messageId: string) {
    const message = await this.messageForAction(userId, messageId);
    if (message.senderId !== userId) throw new ForbiddenException('You can only unsend your own messages.');
    await this.prisma.conversation.updateMany({ where: { id: message.conversationId, pinnedMessageId: messageId }, data: { pinnedMessageId: null } });
    if (!message.unsentAt) await this.prisma.message.update({ where: { id: messageId }, data: { body: null, unsentAt: new Date() } });
    return { ok: true };
  }

  async reactToMessage(userId: string, messageId: string, emoji: unknown) {
    const message = await this.messageForAction(userId, messageId);
    if (message.unsentAt) throw new BadRequestException('Cannot react to an unsent message.');
    if (emoji === null) {
      await this.prisma.messageReaction.deleteMany({ where: { messageId, userId } });
    } else {
      if (typeof emoji !== 'string' || !['❤️','😂','👍','😮','😢'].includes(emoji)) throw new BadRequestException('Unsupported reaction.');
      await this.prisma.messageReaction.upsert({ where: { messageId_userId: { messageId, userId } }, create: { messageId, userId, emoji }, update: { emoji } });
    }
    return { ok: true };
  }

  async pinMessage(userId: string, conversationId: string, messageId: unknown) {
    await this.getMembership(userId, conversationId);
    if (messageId !== null && typeof messageId !== 'string') throw new BadRequestException('Invalid pin.');
    if (typeof messageId === 'string') {
      const message = await this.messageForAction(userId, messageId);
      if (message.conversationId !== conversationId || message.unsentAt || message.isPrivate) throw new BadRequestException('Message cannot be pinned.');
    }
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { pinnedMessageId: messageId as string | null } });
    return { ok: true };
  }

  async forwardMessage(userId: string, messageId: string, friendIds: unknown) {
    const original = await this.messageForAction(userId, messageId);
    if (original.isPrivate || original.unsentAt) throw new ForbiddenException('Private or unsent messages cannot be forwarded.');
    if (!Array.isArray(friendIds) || friendIds.length === 0 || friendIds.length > 10 ||
        friendIds.some(id => typeof id !== 'string' || !id || id === userId) ||
        new Set(friendIds).size !== friendIds.length) throw new BadRequestException('Select 1–10 different friends.');
    const sent: string[] = [];
    for (const friendId of friendIds as string[]) {
      const friendship = await this.prisma.friendship.findFirst({ where: { OR: [
        { userAId: userId, userBId: friendId }, { userAId: friendId, userBId: userId },
      ] } });
      if (!friendship) throw new ForbiddenException('Forwarding requires an existing friendship.');
      const blocks = await this.prisma.userBlock.findFirst({ where: { OR: [
        { blockerId: userId, blockedId: friendId }, { blockerId: friendId, blockedId: userId },
      ] } });
      if (blocks) throw new ForbiddenException('Forwarding to a blocked user is unavailable.');
    }
    for (const friendId of friendIds as string[]) {
      const opened = await this.openConversation(userId, friendId);
      await this.assertNotBlocked(userId, opened.conversationId);
      const created = await this.prisma.message.create({ data: {
        conversationId: opened.conversationId, senderId: userId, body: original.body,
        mediaKey: original.mediaKey, mediaType: original.mediaType, mediaMime: original.mediaMime,
        forwarded: true,
      } });
      await this.prisma.conversation.update({ where: { id: opened.conversationId }, data: { updatedAt: new Date() } });
      sent.push(created.id);
    }
    return { ok: true, messageIds: sent };
  }

  private async assertNotBlocked(userId: string, conversationId: string) {
    const members = await this.prisma.conversationMember.findMany({ where: { conversationId }, select: { userId: true } });
    const other = members.find(m => m.userId !== userId)?.userId;
    if (!other) return;
    const group = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { isGroup: true } });
    if (group?.isGroup) return;
    const blocked = await this.prisma.userBlock.findFirst({ where: { OR: [{ blockerId: userId, blockedId: other }, { blockerId: other, blockedId: userId }] } });
    if (blocked) throw new ForbiddenException('Messaging is unavailable because a user is blocked.');
  }

  async searchMessages(userId: string, conversationId: string, query: string) {
    const member = await this.getMembership(userId, conversationId);
    const term = typeof query === 'string' ? query.trim() : '';
    if (!term || term.length > 100) throw new BadRequestException('Search must be 1–100 characters.');
    return this.prisma.message.findMany({
      where: { conversationId, body: { contains: term }, unsentAt: null,
        hiddenBy: { none: { userId } },
        ...(member.clearedAt ? { createdAt: { gt: member.clearedAt } } : {}) },
      select: { id: true, body: true, createdAt: true, senderId: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50,
    });
  }

  private async getMembership(userId: string, conversationId: string) {
    const member = await this.prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
    if (!member) throw new ForbiddenException('You cannot access this conversation.');
    return member;
  }

  async setMute(userId: string, conversationId: string, muted: unknown) {
    await this.getMembership(userId, conversationId);
    if (typeof muted !== 'boolean') throw new BadRequestException('muted must be boolean.');
    return this.prisma.conversationMember.update({ where: { conversationId_userId: { conversationId, userId } }, data: { muted }, select: { muted: true } });
  }

  async clearConversation(userId: string, conversationId: string) {
    await this.getMembership(userId, conversationId);
    await this.prisma.conversationMember.update({ where: { conversationId_userId: { conversationId, userId } }, data: { clearedAt: new Date(), lastReadAt: new Date() } });
    return { ok: true };
  }

  async setBlock(userId: string, otherId: string, blocked: unknown) {
    if (typeof blocked !== 'boolean' || !otherId || userId === otherId) throw new BadRequestException('Invalid block request.');
    const other = await this.prisma.user.findUnique({ where: { id: otherId }, select: { id: true } });
    if (!other) throw new NotFoundException('User not found.');
    if (blocked) await this.prisma.userBlock.upsert({ where: { blockerId_blockedId: { blockerId: userId, blockedId: otherId } }, create: { blockerId: userId, blockedId: otherId }, update: {} });
    else await this.prisma.userBlock.deleteMany({ where: { blockerId: userId, blockedId: otherId } });
    return { blocked };
  }

  private async ensureMember(userId: string, conversationId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member) throw new ForbiddenException('You cannot access this conversation.');
  }

  async sendMedia(userId: string, conversationId: string, file: Express.Multer.File, isPrivate: boolean) {
    await this.ensureMember(userId, conversationId);
    await this.assertNotBlocked(userId, conversationId);
    if (!file) throw new BadRequestException('Choose a photo or video.');
    const type = file.mimetype.startsWith('image/') ? 'image' : file.mimetype.startsWith('video/') ? 'video' : file.mimetype.startsWith('audio/') ? 'audio' : null;
    if (!type || !['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav'].includes(file.mimetype)) {
      throw new BadRequestException('Unsupported media format.');
    }
    const mediaKey = file.filename;
    const message = await this.prisma.message.create({
      data: { conversationId, senderId: userId, mediaKey, mediaType: type, mediaMime: file.mimetype, isPrivate },
      select: { id:true, senderId:true, body:true, mediaKey:true, mediaType:true, mediaMime:true, isPrivate:true, privateOpenedAt:true, createdAt:true, editedAt:true },
    });
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    return message;
  }

  async getMedia(userId: string, messageId: string, openPrivate: boolean) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId }, select: {
      id:true, conversationId:true, senderId:true, mediaKey:true, mediaType:true, mediaMime:true, isPrivate:true, privateOpenedAt:true,
    }});
    if (!message?.mediaKey || (await this.prisma.message.findUnique({ where: { id: messageId }, select: { unsentAt: true } }))?.unsentAt) throw new NotFoundException('Media not found.');
    const membership = await this.getMembership(userId, message.conversationId);
    const groupForMedia = await this.prisma.conversation.findUnique({ where: { id: message.conversationId }, select: { isGroup: true } });
    if (groupForMedia?.isGroup && membership.joinedAt > (await this.prisma.message.findUniqueOrThrow({ where: { id: messageId }, select: { createdAt: true } })).createdAt) throw new ForbiddenException('This media predates your group membership.');
    const original = await this.prisma.message.findUnique({ where: { id: messageId }, select: { createdAt: true, hiddenBy: { where: { userId }, select: { userId: true } } } });
    if (!original || original.hiddenBy.length || (membership.clearedAt && original.createdAt <= membership.clearedAt)) throw new NotFoundException("Media unavailable.");
    if (message.isPrivate) {
      if (message.senderId === userId) throw new ForbiddenException('Private Moments can only be viewed by the recipient.');
      if (!openPrivate) throw new ForbiddenException('Use the View Private Moment button.');
      const group = await this.prisma.conversation.findUnique({ where: { id: message.conversationId }, select: { isGroup: true } });
      if (group?.isGroup) {
        try { await this.prisma.messagePrivateView.create({ data: { messageId, userId } }); }
        catch { throw new ForbiddenException('This Private Moment has already been opened.'); }
      } else {
        const claimed = await this.prisma.message.updateMany({ where: { id: messageId, privateOpenedAt: null }, data: { privateOpenedAt: new Date() } });
        if (claimed.count !== 1) throw new ForbiddenException('This Private Moment has already been opened.');
      }
    } else if (openPrivate) throw new BadRequestException('This is not a Private Moment.');
    const folder = message.isPrivate ? 'inbox-private' : 'inbox-media';
    const filePath = join(process.cwd(), 'inbox-storage', folder, message.mediaKey);
    if (!existsSync(filePath)) throw new NotFoundException('Media file unavailable.');
    return { stream: createReadStream(filePath), mime: message.mediaMime || 'application/octet-stream' };
  }


  async listConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: {
          include: {
            user: {
              select: publicUserSelect,
            },
          },
        },
        messages: {
          where: { hiddenBy: { none: { userId } } },
          orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
          take: 1,
          select: {
            id: true,
            senderId: true,
            body: true,
            mediaKey: true,
            mediaType: true,
            mediaMime: true,
            isPrivate: true,
            privateOpenedAt: true,
            unsentAt: true,
            createdAt: true,
          },
        },
      },
    });

    return Promise.all(conversations
      .filter((conversation) => conversation.isGroup || conversation.members.some((member) => member.userId !== userId))
      .map(async (conversation) => {
        const membership = conversation.members.find((member) => member.userId === userId);
        const unreadCount = await this.prisma.message.count({
          where: { conversationId: conversation.id, senderId: { not: userId }, hiddenBy: { none: { userId } },
            createdAt: { gt: new Date(Math.max((membership?.lastReadAt ?? membership?.joinedAt ?? new Date(0)).getTime(), (membership?.clearedAt ?? new Date(0)).getTime())) } },
        });
        return ({
        id: conversation.id,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        isGroup: conversation.isGroup,
        groupName: conversation.groupName,
        members: conversation.isGroup ? conversation.members.map(m => ({ user: m.user, role: m.role })) : undefined,
        otherUser:
          conversation.members.find(
            (member) => member.userId !== userId,
          )?.user ?? null,
        lastMessage: conversation.messages.find(m => !membership?.clearedAt || m.createdAt > membership.clearedAt) ?? null,
        muted: membership?.muted ?? false,
        blockedByMe: conversation.isGroup ? false : Boolean(await this.prisma.userBlock.findFirst({ where: { blockerId: userId, blockedId: conversation.members.find(m => m.userId !== userId)?.userId ?? "" } })),
        blockedByOther: conversation.isGroup ? false : Boolean(await this.prisma.userBlock.findFirst({ where: { blockerId: conversation.members.find(m => m.userId !== userId)?.userId ?? "", blockedId: userId } })),
        unreadCount,
      });
      }))
      .then((items) => items.filter(item => item.lastMessage || !conversations.find(c => c.id === item.id)?.members.find(m => m.userId === userId)?.clearedAt).sort((a, b) => {
        const aTime = a.lastMessage?.createdAt ?? a.createdAt;
        const bTime = b.lastMessage?.createdAt ?? b.createdAt;
        return bTime.getTime() - aTime.getTime();
      }));
  }

  async listMessageableFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      select: { userAId: true, userBId: true },
    });
    const friendIds = friendships.map((friendship) =>
      friendship.userAId === userId ? friendship.userBId : friendship.userAId,
    );
    if (!friendIds.length) return [];
    return this.prisma.user.findMany({
      where: { id: { in: friendIds } },
      select: publicUserSelect,
      orderBy: { name: 'asc' },
    });
  }

  async openConversation(userId: string, friendId: string) {
    if (
      typeof friendId !== 'string' ||
      !friendId.trim() ||
      userId === friendId
    ) {
      throw new BadRequestException('Invalid friend.');
    }

    const [userAId, userBId] = [userId, friendId].sort();
    const blocked = await this.prisma.userBlock.findFirst({ where: { OR: [{ blockerId: userId, blockedId: friendId }, { blockerId: friendId, blockedId: userId }] } });
    if (blocked) throw new ForbiddenException("Cannot start a conversation while a user is blocked.");

    const friendship = await this.prisma.friendship.findUnique({
      where: {
        userAId_userBId: { userAId, userBId },
      },
    });

    if (!friendship) {
      throw new ForbiddenException(
        'You can only start a conversation with a friend.',
      );
    }

    // Find an existing direct conversation first.
    const existing = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          { isGroup: false },
          { members: { some: { userId } } },
          { members: { some: { userId: friendId } } },
          { members: { every: { userId: { in: [userId, friendId] } } } },
        ],
      },
      include: {
        members: {
          select: { userId: true },
        },
      },
    });

    if (existing && !existing.isGroup && existing.members.length === 2) {
      return { conversationId: existing.id };
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        members: {
          create: [
            { userId },
            { userId: friendId },
          ],
        },
      },
      select: { id: true },
    });

    return { conversationId: conversation.id };
  }

  async getConversation(userId: string, conversationId: string, around?: string) {
    const membership = await this.getMembership(userId, conversationId);
    let aroundMessage: { createdAt: Date } | null = null;
    if (around) {
      aroundMessage = await this.prisma.message.findFirst({ where: { id: around, conversationId, hiddenBy: { none: { userId } }, ...(membership.clearedAt ? { createdAt: { gt: membership.clearedAt } } : {}) }, select: { createdAt: true } });
      if (!aroundMessage) throw new NotFoundException("Search result unavailable.");
    }
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        members: {
          include: {
            user: {
              select: publicUserSelect,
            },
          },
        },
        messages: {
          where: { hiddenBy: { none: { userId } },
            ...(membership.clearedAt ? { createdAt: { gt: membership.clearedAt } } : {}),
            ...(aroundMessage ? { createdAt: { lte: aroundMessage.createdAt } } : {}) },
          orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
          take: 100,
          select: {
            id: true,
            senderId: true,
            body: true,
            mediaKey: true,
            mediaType: true,
            mediaMime: true,
            isPrivate: true,
            privateOpenedAt: true,
            unsentAt: true,
            createdAt: true,
            editedAt: true,
            replyToId: true, forwarded: true,
            reactions: { select: { userId: true, emoji: true } },
            privateViews: { where: { userId }, select: { userId: true } },
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    if (
      !conversation.members.some(
        (member) => member.userId === userId,
      )
    ) {
      throw new ForbiddenException(
        'You cannot access this conversation.',
      );
    }

    return {
      id: conversation.id,
      isGroup: conversation.isGroup,
      groupName: conversation.groupName,
      groupOwnerId: conversation.groupOwnerId,
      members: conversation.isGroup ? conversation.members.map(m => ({ user: m.user, role: m.role })) : undefined,
      otherUser:
        conversation.members.find(
          (member) => member.userId !== userId,
        )?.user ?? null,
      messages: (await this.prisma.messageHidden.findMany({ where: { userId, messageId: { in: conversation.messages.map(m => m.id) } }, select: { messageId: true } })).reduce((messages, hidden) => messages.filter(m => m.id !== hidden.messageId), conversation.messages.reverse()).map(m => ({ ...m, privateOpenedAt: conversation.isGroup && m.isPrivate ? (m.privateViews.length ? m.createdAt : null) : m.privateOpenedAt })),
      pinnedMessage: conversation.pinnedMessageId ? await this.prisma.message.findFirst({
        where: { id: conversation.pinnedMessageId, conversationId, unsentAt: null,
          hiddenBy: { none: { userId } },
          ...(membership.clearedAt ? { createdAt: { gt: membership.clearedAt } } : {}) },
        select: { id: true, body: true, mediaType: true, isPrivate: true },
      }) : null,
      muted: membership.muted,
      blockedByMe: Boolean(await this.prisma.userBlock.findFirst({ where: { blockerId: userId, blockedId: conversation.members.find(m => m.userId !== userId)?.userId ?? "" } })),
      blockedByOther: Boolean(await this.prisma.userBlock.findFirst({ where: { blockerId: conversation.members.find(m => m.userId !== userId)?.userId ?? "", blockedId: userId } })),
      otherLastReadAt: conversation.isGroup ? null : conversation.members.find((member) => member.userId !== userId)?.lastReadAt ?? null,
      createdAt: conversation.createdAt,
    };
  }
  async markRead(userId: string, conversationId: string) {
    const membership = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!membership) throw new ForbiddenException('You cannot access this conversation.');
    // Use the most recent message timestamp, not the wall clock, to avoid marking
    // messages arriving after this request as read.
    const latest = await this.prisma.message.findFirst({
      where: { conversationId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { createdAt: true },
    });
    const lastReadAt = latest?.createdAt ?? new Date();
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: membership.lastReadAt && membership.lastReadAt > lastReadAt
        ? membership.lastReadAt : lastReadAt },
    });
    return { lastReadAt };
  }

  async sendMessage(userId: string, conversationId: string, body: unknown, replyToId?: unknown) {
    if (typeof body !== 'string' || !body.trim()) {
      throw new BadRequestException('Message cannot be empty.');
    }

    const text = body.trim();
    if (text.length > 5000) {
      throw new BadRequestException('Message must be 5000 characters or fewer.');
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { members: { select: { userId: true } } },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }
    if (!conversation.members.some((member) => member.userId === userId)) {
      throw new ForbiddenException('You cannot send to this conversation.');
    }

    await this.assertNotBlocked(userId, conversationId);
    let replyId: string | null = null;
    if (replyToId != null) {
      if (typeof replyToId !== 'string') throw new BadRequestException('Invalid reply.');
      const original = await this.messageForAction(userId, replyToId);
      if (original.conversationId !== conversationId || original.unsentAt) throw new BadRequestException('Reply target unavailable.');
      replyId = original.id;
    }
    const message = await this.prisma.message.create({
      data: { conversationId, senderId: userId, body: text, replyToId: replyId },
      select: {
        id: true, senderId: true, body: true, mediaKey: true, mediaType: true, isPrivate: true, privateOpenedAt: true,
        createdAt: true, editedAt: true, replyToId: true, forwarded: true,
      },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    return message;
  }


  private async requireGroup(userId: string, conversationId: string, admin = false) {
    const membership = await this.getMembership(userId, conversationId);
    const group = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!group?.isGroup) throw new BadRequestException('This is not a group conversation.');
    if (admin && membership.role !== 'ADMIN') throw new ForbiddenException('Only group admins can do this.');
    return group;
  }

  private validateGroupName(name: unknown): string {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) throw new BadRequestException('Group name must be 1–80 characters.');
    return name.trim();
  }

  private async validateGroupFriends(userId: string, friendIds: unknown) {
    if (!Array.isArray(friendIds) || friendIds.length < 1 || friendIds.length > 49 || friendIds.some(id => typeof id !== 'string' || !id || id === userId) || new Set(friendIds).size !== friendIds.length) throw new BadRequestException('Select 1–49 different friends.');
    const friends = await this.listMessageableFriends(userId);
    if (!(friendIds as string[]).every(id => friends.some(friend => friend.id === id))) throw new ForbiddenException('All added users must be your friends.');
    const blocks = await this.prisma.userBlock.findFirst({ where: { OR: [
      { blockerId: userId, blockedId: { in: friendIds as string[] } },
      { blockedId: userId, blockerId: { in: friendIds as string[] } },
    ] } });
    if (blocks) throw new ForbiddenException('Cannot add a blocked user.');
    return friendIds as string[];
  }

  async createGroup(userId: string, name: unknown, friendIds: unknown) {
    const groupName = this.validateGroupName(name);
    const ids = await this.validateGroupFriends(userId, friendIds);
    const group = await this.prisma.conversation.create({ data: {
      isGroup: true, groupName, groupOwnerId: userId,
      members: { create: [{ userId, role: 'ADMIN' }, ...ids.map(id => ({ userId: id, role: 'MEMBER' }))] },
    }, select: { id: true } });
    return { conversationId: group.id };
  }

  async renameGroup(userId: string, conversationId: string, name: unknown) {
    await this.requireGroup(userId, conversationId, true);
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { groupName: this.validateGroupName(name) } });
    return { ok: true };
  }

  async addGroupMembers(userId: string, conversationId: string, friendIds: unknown) {
    await this.requireGroup(userId, conversationId, true);
    const ids = await this.validateGroupFriends(userId, friendIds);
    const existing = await this.prisma.conversationMember.findMany({ where: { conversationId }, select: { userId: true } });
    if (existing.length + ids.filter(id => !existing.some(m => m.userId === id)).length > 50) throw new BadRequestException('Groups support up to 50 members.');
    await this.prisma.conversationMember.createMany({ data: ids.filter(id => !existing.some(m => m.userId === id)).map(id => ({ conversationId, userId: id })), skipDuplicates: true });
    return { ok: true };
  }

  async removeGroupMember(userId: string, conversationId: string, targetId: string) {
    const group = await this.requireGroup(userId, conversationId, true);
    if (group.groupOwnerId === targetId) throw new ForbiddenException('Group owner cannot be removed.');
    await this.prisma.conversationMember.deleteMany({ where: { conversationId, userId: targetId } });
    return { ok: true };
  }

  async leaveGroup(userId: string, conversationId: string) {
    const group = await this.requireGroup(userId, conversationId);
    if (group.groupOwnerId === userId) {
      const successor = await this.prisma.conversationMember.findFirst({ where: { conversationId, userId: { not: userId } }, orderBy: { joinedAt: 'asc' } });
      if (successor) {
        await this.prisma.$transaction([
          this.prisma.conversation.update({ where: { id: conversationId }, data: { groupOwnerId: successor.userId } }),
          this.prisma.conversationMember.update({ where: { id: successor.id }, data: { role: 'ADMIN' } }),
          this.prisma.conversationMember.delete({ where: { conversationId_userId: { conversationId, userId } } }),
        ]);
      } else await this.prisma.conversation.delete({ where: { id: conversationId } });
    } else await this.prisma.conversationMember.delete({ where: { conversationId_userId: { conversationId, userId } } });
    return { ok: true };
  }

}
