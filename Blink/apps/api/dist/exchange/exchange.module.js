"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExchangeModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../prisma/prisma.module");
const auth_module_1 = require("../auth/auth.module");
const exchange_controller_1 = require("./exchange.controller");
const exchange_service_1 = require("./exchange.service");
const exchange_chat_controller_1 = require("./exchange-chat.controller");
const exchange_chat_service_1 = require("./exchange-chat.service");
const exchange_offer_controller_1 = require("./exchange-offer.controller");
const exchange_offer_service_1 = require("./exchange-offer.service");
let ExchangeModule = class ExchangeModule {
};
exports.ExchangeModule = ExchangeModule;
exports.ExchangeModule = ExchangeModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
        ],
        controllers: [
            exchange_controller_1.ExchangeController,
            exchange_controller_1.ExchangeMediaController,
            exchange_chat_controller_1.ExchangeChatController,
            exchange_offer_controller_1.ExchangeOfferController,
        ],
        providers: [
            exchange_service_1.ExchangeService,
            exchange_chat_service_1.ExchangeChatService,
            exchange_offer_service_1.ExchangeOfferService,
        ],
    })
], ExchangeModule);
//# sourceMappingURL=exchange.module.js.map