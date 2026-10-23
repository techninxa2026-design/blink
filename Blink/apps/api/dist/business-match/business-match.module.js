"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessMatchModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const business_match_controller_1 = require("./business-match.controller");
const business_match_service_1 = require("./business-match.service");
let BusinessMatchModule = class BusinessMatchModule {
};
exports.BusinessMatchModule = BusinessMatchModule;
exports.BusinessMatchModule = BusinessMatchModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule],
        controllers: [business_match_controller_1.BusinessMatchController],
        providers: [business_match_service_1.BusinessMatchService],
    })
], BusinessMatchModule);
//# sourceMappingURL=business-match.module.js.map