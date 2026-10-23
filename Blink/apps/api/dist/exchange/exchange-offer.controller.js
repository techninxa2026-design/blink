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
exports.ExchangeOfferController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const exchange_offer_service_1 = require("./exchange-offer.service");
let ExchangeOfferController = class ExchangeOfferController {
    offers;
    constructor(offers) {
        this.offers = offers;
    }
    get(req, postId, threadId) {
        return this.offers.getOffer(req.user.userId, postId, threadId);
    }
    create(req, postId, threadId, body) {
        return this.offers.createOffer(req.user.userId, postId, threadId, body);
    }
    edit(req, postId, threadId, body) {
        return this.offers.editOffer(req.user.userId, postId, threadId, body);
    }
    accept(req, postId, threadId) {
        return this.offers.acceptOffer(req.user.userId, postId, threadId);
    }
    decline(req, postId, threadId) {
        return this.offers.declineOffer(req.user.userId, postId, threadId);
    }
};
exports.ExchangeOfferController = ExchangeOfferController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('postId')),
    __param(2, (0, common_1.Param)('threadId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ExchangeOfferController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('postId')),
    __param(2, (0, common_1.Param)('threadId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", void 0)
], ExchangeOfferController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('postId')),
    __param(2, (0, common_1.Param)('threadId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", void 0)
], ExchangeOfferController.prototype, "edit", null);
__decorate([
    (0, common_1.Post)('accept'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('postId')),
    __param(2, (0, common_1.Param)('threadId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ExchangeOfferController.prototype, "accept", null);
__decorate([
    (0, common_1.Post)('decline'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('postId')),
    __param(2, (0, common_1.Param)('threadId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ExchangeOfferController.prototype, "decline", null);
exports.ExchangeOfferController = ExchangeOfferController = __decorate([
    (0, common_1.Controller)('exchange/:postId/chats/:threadId/offer'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [exchange_offer_service_1.ExchangeOfferService])
], ExchangeOfferController);
//# sourceMappingURL=exchange-offer.controller.js.map