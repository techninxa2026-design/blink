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
exports.SecretsController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const secrets_service_1 = require("./secrets.service");
class CreateSecretDto {
    prompt;
    options;
    correctIndex;
    visibility;
    revealAt;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(5),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CreateSecretDto.prototype, "prompt", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(2),
    (0, class_validator_1.ArrayMaxSize)(5),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(120, { each: true }),
    __metadata("design:type", Array)
], CreateSecretDto.prototype, "options", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(4),
    __metadata("design:type", Number)
], CreateSecretDto.prototype, "correctIndex", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['ANONYMOUS', 'NAMED']),
    __metadata("design:type", String)
], CreateSecretDto.prototype, "visibility", void 0);
__decorate([
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], CreateSecretDto.prototype, "revealAt", void 0);
class EditSecretDto {
    prompt;
    options;
    correctIndex;
    visibility;
    revealAt;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(5),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], EditSecretDto.prototype, "prompt", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(2),
    (0, class_validator_1.ArrayMaxSize)(5),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(120, { each: true }),
    __metadata("design:type", Array)
], EditSecretDto.prototype, "options", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(4),
    __metadata("design:type", Number)
], EditSecretDto.prototype, "correctIndex", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['ANONYMOUS', 'NAMED']),
    __metadata("design:type", String)
], EditSecretDto.prototype, "visibility", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], EditSecretDto.prototype, "revealAt", void 0);
class GuessDto {
    selectedIndex;
}
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(4),
    __metadata("design:type", Number)
], GuessDto.prototype, "selectedIndex", void 0);
class ReactDto {
    emoji;
}
__decorate([
    (0, class_validator_1.IsIn)(['🧡', '❤️', '😮', '😂', '👏']),
    __metadata("design:type", String)
], ReactDto.prototype, "emoji", void 0);
let SecretsController = class SecretsController {
    service;
    constructor(service) {
        this.service = service;
    }
    points(req) {
        return this.service.points(req.user.userId);
    }
    list(req) {
        return this.service.list(req.user.userId);
    }
    create(req, dto) {
        return this.service.create(req.user.userId, dto);
    }
    edit(req, id, dto) {
        return this.service.edit(req.user.userId, id, dto);
    }
    guess(req, id, dto) {
        return this.service.guess(req.user.userId, id, dto.selectedIndex);
    }
    react(req, id, dto) {
        return this.service.react(req.user.userId, id, dto.emoji);
    }
};
exports.SecretsController = SecretsController;
__decorate([
    (0, common_1.Get)('points'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SecretsController.prototype, "points", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SecretsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateSecretDto]),
    __metadata("design:returntype", void 0)
], SecretsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, EditSecretDto]),
    __metadata("design:returntype", void 0)
], SecretsController.prototype, "edit", null);
__decorate([
    (0, common_1.Post)(':id/guess'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, GuessDto]),
    __metadata("design:returntype", void 0)
], SecretsController.prototype, "guess", null);
__decorate([
    (0, common_1.Post)(':id/react'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ReactDto]),
    __metadata("design:returntype", void 0)
], SecretsController.prototype, "react", null);
exports.SecretsController = SecretsController = __decorate([
    (0, common_1.Controller)('secrets'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [secrets_service_1.SecretsService])
], SecretsController);
//# sourceMappingURL=secrets.controller.js.map