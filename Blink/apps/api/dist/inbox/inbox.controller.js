"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InboxController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const inbox_service_1 = require("./inbox.service");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
let InboxController = class InboxController {
    inboxService;
    constructor(inboxService) {
        this.inboxService = inboxService;
    }
    listConversations(req) {
        return this.inboxService.listConversations(req.user.userId);
    }
    listMessageableFriends(req) {
        return this.inboxService.listMessageableFriends(req.user.userId);
    }
    openConversation(req, body) {
        return this.inboxService.openConversation(req.user.userId, body?.friendId ?? '');
    }
    createGroup(req, body) {
        return this.inboxService.createGroup(req.user.userId, body?.name, body?.friendIds);
    }
    renameGroup(req, id, body) {
        return this.inboxService.renameGroup(req.user.userId, id, body?.name);
    }
    addGroupMembers(req, id, body) {
        return this.inboxService.addGroupMembers(req.user.userId, id, body?.friendIds);
    }
    removeGroupMember(req, id, targetId) {
        return this.inboxService.removeGroupMember(req.user.userId, id, targetId);
    }
    leaveGroup(req, id) {
        return this.inboxService.leaveGroup(req.user.userId, id);
    }
    search(req, id, q) {
        return this.inboxService.searchMessages(req.user.userId, id, q);
    }
    mute(req, id, body) {
        return this.inboxService.setMute(req.user.userId, id, body?.muted);
    }
    clearConversation(req, id) {
        return this.inboxService.clearConversation(req.user.userId, id);
    }
    block(req, id, body) {
        return this.inboxService.setBlock(req.user.userId, id, body?.blocked);
    }
    getConversation(req, id, around) {
        return this.inboxService.getConversation(req.user.userId, id, around);
    }
    markRead(req, id) {
        return this.inboxService.markRead(req.user.userId, id);
    }
    sendMessage(req, id, body) {
        return this.inboxService.sendMessage(req.user.userId, id, body?.body, body?.replyToId);
    }
    pinMessage(req, id, body) {
        return this.inboxService.pinMessage(req.user.userId, id, body?.messageId);
    }
    forwardMessage(req, id, body) {
        return this.inboxService.forwardMessage(req.user.userId, id, body?.friendIds);
    }
    editMessage(req, id, body) {
        return this.inboxService.editMessage(req.user.userId, id, body?.body);
    }
    hideMessage(req, id) {
        return this.inboxService.hideMessage(req.user.userId, id);
    }
    unsendMessage(req, id) {
        return this.inboxService.unsendMessage(req.user.userId, id);
    }
    react(req, id, body) {
        return this.inboxService.reactToMessage(req.user.userId, id, body?.emoji);
    }
    sendMedia(req, id, file, body) {
        return this.inboxService.sendMedia(req.user.userId, id, file, body?.isPrivate === 'true');
    }
    async media(req, messageId, res) {
        const result = await this.inboxService.getMedia(req.user.userId, messageId, false);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', result.mime);
        result.stream.pipe(res);
    }
    async openPrivateMedia(req, messageId, res) {
        const result = await this.inboxService.getMedia(req.user.userId, messageId, true);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', result.mime);
        result.stream.pipe(res);
    }
};
exports.InboxController = InboxController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "listConversations", null);
__decorate([
    (0, common_1.Get)('friends'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "listMessageableFriends", null);
__decorate([
    (0, common_1.Post)('conversations'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "openConversation", null);
__decorate([
    (0, common_1.Post)('groups'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "createGroup", null);
__decorate([
    (0, common_1.Patch)('groups/:id/name'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "renameGroup", null);
__decorate([
    (0, common_1.Post)('groups/:id/members'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "addGroupMembers", null);
__decorate([
    (0, common_1.Delete)('groups/:id/members/:userId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "removeGroupMember", null);
__decorate([
    (0, common_1.Post)('groups/:id/leave'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "leaveGroup", null);
__decorate([
    (0, common_1.Get)('conversations/:id/search'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "search", null);
__decorate([
    (0, common_1.Patch)('conversations/:id/mute'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "mute", null);
__decorate([
    (0, common_1.Delete)('conversations/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "clearConversation", null);
__decorate([
    (0, common_1.Patch)('blocks/:userId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "block", null);
__decorate([
    (0, common_1.Get)('conversations/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('around')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "getConversation", null);
__decorate([
    (0, common_1.Post)('conversations/:id/read'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "markRead", null);
__decorate([
    (0, common_1.Post)('conversations/:id/messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Patch)('conversations/:id/pin'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "pinMessage", null);
__decorate([
    (0, common_1.Post)('messages/:messageId/forward'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('messageId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "forwardMessage", null);
__decorate([
    (0, common_1.Patch)('messages/:messageId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('messageId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "editMessage", null);
__decorate([
    (0, common_1.Delete)('messages/:messageId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('messageId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "hideMessage", null);
__decorate([
    (0, common_1.Post)('messages/:messageId/unsend'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('messageId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "unsendMessage", null);
__decorate([
    (0, common_1.Post)('messages/:messageId/reaction'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('messageId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "react", null);
__decorate([
    (0, common_1.Post)('conversations/:id/media'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: (req, _file, cb) => {
                const isPrivate = String(req.body?.isPrivate) === 'true';
                const dir = (0, node_path_1.join)(process.cwd(), 'inbox-storage', isPrivate ? 'inbox-private' : 'inbox-media');
                (0, node_fs_1.mkdirSync)(dir, { recursive: true });
                cb(null, dir);
            },
            filename: (_req, _file, cb) => cb(null, (0, node_crypto_1.randomUUID)()),
        }),
        limits: { fileSize: 30 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'].includes(file.mimetype)),
    })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.UploadedFile)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object, Object]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "sendMedia", null);
__decorate([
    (0, common_1.Get)('media/:messageId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('messageId')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], InboxController.prototype, "media", null);
__decorate([
    (0, common_1.Post)('media/:messageId/open'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('messageId')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], InboxController.prototype, "openPrivateMedia", null);
exports.InboxController = InboxController = __decorate([
    (0, common_1.Controller)('inbox'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [inbox_service_1.InboxService])
], InboxController);
//# sourceMappingURL=inbox.controller.js.map