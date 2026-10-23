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
exports.ExchangeChatController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const exchange_chat_service_1 = require("./exchange-chat.service");
let ExchangeChatController = class ExchangeChatController {
    chat;
    constructor(chat) {
        this.chat = chat;
    }
    myThread(req, postId) {
        return this.chat.myThread(req.user.userId, postId);
    }
    start(req, postId) {
        return this.chat.startThread(req.user.userId, postId);
    }
    interestedPeople(req, postId) {
        return this.chat.ownerThreads(req.user.userId, postId);
    }
    messages(req, postId, threadId) {
        return this.chat.messages(req.user.userId, postId, threadId);
    }
    send(req, postId, threadId, body) {
        return this.chat.sendMessage(req.user.userId, postId, threadId, body?.text);
    }
};
exports.ExchangeChatController = ExchangeChatController;
__decorate([
    (0, common_1.Get)('mine'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('postId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ExchangeChatController.prototype, "myThread", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('postId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ExchangeChatController.prototype, "start", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('postId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ExchangeChatController.prototype, "interestedPeople", null);
__decorate([
    (0, common_1.Get)(':threadId/messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('postId')),
    __param(2, (0, common_1.Param)('threadId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ExchangeChatController.prototype, "messages", null);
__decorate([
    (0, common_1.Post)(':threadId/messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('postId')),
    __param(2, (0, common_1.Param)('threadId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", void 0)
], ExchangeChatController.prototype, "send", null);
exports.ExchangeChatController = ExchangeChatController = __decorate([
    (0, common_1.Controller)('exchange/:postId/chats'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [exchange_chat_service_1.ExchangeChatService])
], ExchangeChatController);
//# sourceMappingURL=exchange-chat.controller.js.map