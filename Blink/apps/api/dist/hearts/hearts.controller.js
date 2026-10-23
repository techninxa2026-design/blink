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
exports.HeartsController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const hearts_service_1 = require("./hearts.service");
class SendHeartDto {
    receiverId;
    text;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], SendHeartDto.prototype, "receiverId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], SendHeartDto.prototype, "text", void 0);
class SendMessageDto {
    text;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], SendMessageDto.prototype, "text", void 0);
class EditMessageDto {
    text;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], EditMessageDto.prototype, "text", void 0);
class RespondHeartDto {
    status;
}
__decorate([
    (0, class_validator_1.IsIn)(['ACCEPTED', 'DECLINED']),
    __metadata("design:type", String)
], RespondHeartDto.prototype, "status", void 0);
let HeartsController = class HeartsController {
    service;
    constructor(service) {
        this.service = service;
    }
    people(req, search = '') {
        return this.service.people(req.user.userId, search);
    }
    incoming(req) {
        return this.service.list(req.user.userId, 'incoming');
    }
    sent(req) {
        return this.service.list(req.user.userId, 'sent');
    }
    send(req, dto) {
        return this.service.send(req.user.userId, dto.receiverId, dto.text);
    }
    detail(req, id) {
        return this.service.detail(req.user.userId, id);
    }
    message(req, id, dto) {
        return this.service.message(req.user.userId, id, dto.text);
    }
    editMessage(req, id, messageId, dto) {
        return this.service.editMessage(req.user.userId, id, messageId, dto.text);
    }
    respond(req, id, dto) {
        return this.service.respond(req.user.userId, id, dto.status);
    }
    reveal(req, id) {
        return this.service.reveal(req.user.userId, id);
    }
    block(req, id) {
        return this.service.block(req.user.userId, id);
    }
};
exports.HeartsController = HeartsController;
__decorate([
    (0, common_1.Get)('people'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], HeartsController.prototype, "people", null);
__decorate([
    (0, common_1.Get)('incoming'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], HeartsController.prototype, "incoming", null);
__decorate([
    (0, common_1.Get)('sent'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], HeartsController.prototype, "sent", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, SendHeartDto]),
    __metadata("design:returntype", void 0)
], HeartsController.prototype, "send", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], HeartsController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(':id/messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, SendMessageDto]),
    __metadata("design:returntype", void 0)
], HeartsController.prototype, "message", null);
__decorate([
    (0, common_1.Patch)(':id/messages/:messageId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('messageId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, EditMessageDto]),
    __metadata("design:returntype", void 0)
], HeartsController.prototype, "editMessage", null);
__decorate([
    (0, common_1.Post)(':id/respond'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, RespondHeartDto]),
    __metadata("design:returntype", void 0)
], HeartsController.prototype, "respond", null);
__decorate([
    (0, common_1.Post)(':id/reveal'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], HeartsController.prototype, "reveal", null);
__decorate([
    (0, common_1.Post)(':id/block'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], HeartsController.prototype, "block", null);
exports.HeartsController = HeartsController = __decorate([
    (0, common_1.Controller)('hearts'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [hearts_service_1.HeartsService])
], HeartsController);
//# sourceMappingURL=hearts.controller.js.map