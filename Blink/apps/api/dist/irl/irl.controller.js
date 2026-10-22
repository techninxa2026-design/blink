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
exports.IrlController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const irl_service_1 = require("./irl.service");
let IrlController = class IrlController {
    service;
    constructor(service) {
        this.service = service;
    }
    invitations(req) { return this.service.invitations(req.user.userId); }
    invite(req, id, body) { return this.service.invite(req.user.userId, id, body?.recipientId || ''); }
    respondInvitation(req, id, body) { return this.service.respondInvitation(req.user.userId, id, body?.status); }
    inboxMessages(req, id) { return this.service.inboxMessages(req.user.userId, id); }
    sendInboxMessage(req, id, body) { return this.service.sendInboxMessage(req.user.userId, id, body); }
    plans(req) { return this.service.list(req.user.userId); }
    create(req, body) { return this.service.create(req.user.userId, body); }
    remove(req, id) { return this.service.remove(req.user.userId, id); }
    interest(req, id, body) { return this.service.interest(req.user.userId, id, body); }
    withdraw(req, id) { return this.service.withdraw(req.user.userId, id); }
};
exports.IrlController = IrlController;
__decorate([
    (0, common_1.Get)('invitations'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], IrlController.prototype, "invitations", null);
__decorate([
    (0, common_1.Post)('plans/:id/invitations'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], IrlController.prototype, "invite", null);
__decorate([
    (0, common_1.Post)('invitations/:id/respond'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], IrlController.prototype, "respondInvitation", null);
__decorate([
    (0, common_1.Get)('plans/:id/messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], IrlController.prototype, "inboxMessages", null);
__decorate([
    (0, common_1.Post)('plans/:id/messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], IrlController.prototype, "sendInboxMessage", null);
__decorate([
    (0, common_1.Get)('plans'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], IrlController.prototype, "plans", null);
__decorate([
    (0, common_1.Post)('plans'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], IrlController.prototype, "create", null);
__decorate([
    (0, common_1.Delete)('plans/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], IrlController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('plans/:id/interest'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], IrlController.prototype, "interest", null);
__decorate([
    (0, common_1.Delete)('plans/:id/interest'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], IrlController.prototype, "withdraw", null);
exports.IrlController = IrlController = __decorate([
    (0, common_1.Controller)('irl'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [irl_service_1.IrlService])
], IrlController);
//# sourceMappingURL=irl.controller.js.map