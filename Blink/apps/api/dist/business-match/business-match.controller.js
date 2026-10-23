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
exports.BusinessMatchController = void 0;
const business_meeting_dto_1 = require("./business-meeting.dto");
const business_chat_dto_1 = require("./business-chat.dto");
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const business_connection_dto_1 = require("./business-connection.dto");
const business_match_service_1 = require("./business-match.service");
const business_match_dto_1 = require("./business-match.dto");
let BusinessMatchController = class BusinessMatchController {
    service;
    constructor(service) {
        this.service = service;
    }
    mine(req) { return this.service.mine(req.user.userId); }
    save(req, dto) {
        return this.service.save(req.user.userId, dto);
    }
    activate(req, body) {
        return this.service.activate(req.user.userId, body.active);
    }
    discover(req, filters) {
        return this.service.discover(req.user.userId, filters.q ?? '', filters.type, Number(filters.page ?? '1'));
    }
    profile(req, id) {
        return this.service.publicProfile(req.user.userId, id);
    }
    send(req, body) {
        return this.service.sendRequest(req.user.userId, body.profileId);
    }
    requests(req) { return this.service.requests(req.user.userId); }
    connections(req) { return this.service.connections(req.user.userId); }
    respond(req, id, body) {
        return this.service.respond(req.user.userId, id, body.accept);
    }
    cancel(req, id) { return this.service.cancel(req.user.userId, id); }
    meetings(req) { return this.service.meetings(req.user.userId); }
    createMeeting(req, dto) {
        return this.service.createMeeting(req.user.userId, dto);
    }
    acceptMeeting(req, id) { return this.service.answerMeeting(req.user.userId, id, true); }
    declineMeeting(req, id) { return this.service.answerMeeting(req.user.userId, id, false); }
    cancelMeeting(req, id) { return this.service.cancelMeeting(req.user.userId, id); }
    chatMessages(req, connectionId, before) {
        return this.service.chatMessages(req.user.userId, connectionId, before);
    }
    sendChatMessage(req, connectionId, dto) {
        return this.service.sendChatMessage(req.user.userId, connectionId, dto.text);
    }
};
exports.BusinessMatchController = BusinessMatchController;
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BusinessMatchController.prototype, "mine", null);
__decorate([
    (0, common_1.Put)('me'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)(new common_1.ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, business_match_dto_1.SaveBusinessProfileDto]),
    __metadata("design:returntype", void 0)
], BusinessMatchController.prototype, "save", null);
__decorate([
    (0, common_1.Patch)('me/activation'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)(new common_1.ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, business_match_dto_1.SetBusinessActivationDto]),
    __metadata("design:returntype", void 0)
], BusinessMatchController.prototype, "activate", null);
__decorate([
    (0, common_1.Get)('discover'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)(new common_1.ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, business_match_dto_1.DiscoverBusinessProfilesDto]),
    __metadata("design:returntype", void 0)
], BusinessMatchController.prototype, "discover", null);
__decorate([
    (0, common_1.Get)('profiles/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BusinessMatchController.prototype, "profile", null);
__decorate([
    (0, common_1.Post)('requests'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)(new common_1.ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, business_connection_dto_1.CreateBusinessRequestDto]),
    __metadata("design:returntype", void 0)
], BusinessMatchController.prototype, "send", null);
__decorate([
    (0, common_1.Get)('requests'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BusinessMatchController.prototype, "requests", null);
__decorate([
    (0, common_1.Get)('connections'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BusinessMatchController.prototype, "connections", null);
__decorate([
    (0, common_1.Patch)('requests/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)(new common_1.ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, business_connection_dto_1.RespondBusinessRequestDto]),
    __metadata("design:returntype", void 0)
], BusinessMatchController.prototype, "respond", null);
__decorate([
    (0, common_1.Delete)('requests/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BusinessMatchController.prototype, "cancel", null);
__decorate([
    (0, common_1.Get)('meetings'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BusinessMatchController.prototype, "meetings", null);
__decorate([
    (0, common_1.Post)('meetings'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)(new common_1.ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, business_meeting_dto_1.CreateBusinessMeetingDto]),
    __metadata("design:returntype", void 0)
], BusinessMatchController.prototype, "createMeeting", null);
__decorate([
    (0, common_1.Patch)('meetings/:id/accept'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BusinessMatchController.prototype, "acceptMeeting", null);
__decorate([
    (0, common_1.Patch)('meetings/:id/decline'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BusinessMatchController.prototype, "declineMeeting", null);
__decorate([
    (0, common_1.Patch)('meetings/:id/cancel'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BusinessMatchController.prototype, "cancelMeeting", null);
__decorate([
    (0, common_1.Get)('chats/:connectionId/messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('connectionId')),
    __param(2, (0, common_1.Query)('before')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], BusinessMatchController.prototype, "chatMessages", null);
__decorate([
    (0, common_1.Post)('chats/:connectionId/messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('connectionId')),
    __param(2, (0, common_1.Body)(new common_1.ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, business_chat_dto_1.SendBusinessChatDto]),
    __metadata("design:returntype", void 0)
], BusinessMatchController.prototype, "sendChatMessage", null);
exports.BusinessMatchController = BusinessMatchController = __decorate([
    (0, common_1.Controller)('business-match'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [business_match_service_1.BusinessMatchService])
], BusinessMatchController);
//# sourceMappingURL=business-match.controller.js.map