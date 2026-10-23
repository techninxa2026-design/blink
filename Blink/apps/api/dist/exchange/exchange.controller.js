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
exports.ExchangeMediaController = exports.ExchangeController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const exchange_service_1 = require("./exchange.service");
const allowedMimeToExtension = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
};
const uploads = {
    storage: (0, multer_1.diskStorage)({
        destination: (_req, _file, callback) => {
            (0, node_fs_1.mkdirSync)(exchange_service_1.EXCHANGE_MEDIA_DIR, {
                recursive: true,
            });
            callback(null, exchange_service_1.EXCHANGE_MEDIA_DIR);
        },
        filename: (_req, file, callback) => {
            callback(null, (0, node_crypto_1.randomUUID)() +
                allowedMimeToExtension[file.mimetype]);
        },
    }),
    limits: {
        fileSize: 40 * 1024 * 1024,
        files: 4,
        fields: 8,
    },
    fileFilter: (_req, file, callback) => {
        const extension = file.originalname
            .toLowerCase()
            .match(/\.[^.]+$/)?.[0];
        const canonicalExtension = allowedMimeToExtension[file.mimetype];
        const valid = Boolean(canonicalExtension) &&
            (extension === canonicalExtension ||
                (file.mimetype === 'image/jpeg' &&
                    extension === '.jpeg'));
        if (!valid) {
            callback(new common_1.BadRequestException('Only JPG, PNG, WebP, MP4, WebM and MOV files are allowed.'), false);
            return;
        }
        callback(null, true);
    },
};
let ExchangeController = class ExchangeController {
    exchange;
    constructor(exchange) {
        this.exchange = exchange;
    }
    list(req, search, kind, mine, page) {
        return this.exchange.list(req.user.userId, {
            search,
            kind,
            mine,
            page,
        });
    }
    getOne(id) {
        return this.exchange.getOne(id);
    }
    create(req, body, files = []) {
        return this.exchange.create(req.user.userId, body, files);
    }
    update(req, id, body, files = []) {
        return this.exchange.update(req.user.userId, id, body, files);
    }
    remove(req, id) {
        return this.exchange.remove(req.user.userId, id);
    }
    reply(req, id, body) {
        return this.exchange.reply(req.user.userId, id, body?.message);
    }
    acknowledge(req, id, responseId) {
        return this.exchange.acknowledge(req.user.userId, id, responseId);
    }
};
exports.ExchangeController = ExchangeController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('search')),
    __param(2, (0, common_1.Query)('kind')),
    __param(3, (0, common_1.Query)('mine')),
    __param(4, (0, common_1.Query)('page')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", void 0)
], ExchangeController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ExchangeController.prototype, "getOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', 4, uploads)),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Array]),
    __metadata("design:returntype", void 0)
], ExchangeController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', 4, uploads)),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object, Array]),
    __metadata("design:returntype", void 0)
], ExchangeController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ExchangeController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/responses'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ExchangeController.prototype, "reply", null);
__decorate([
    (0, common_1.Patch)(':id/responses/:responseId/acknowledge'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('responseId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ExchangeController.prototype, "acknowledge", null);
exports.ExchangeController = ExchangeController = __decorate([
    (0, common_1.Controller)('exchange'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [exchange_service_1.ExchangeService])
], ExchangeController);
let ExchangeMediaController = class ExchangeMediaController {
    exchange;
    constructor(exchange) {
        this.exchange = exchange;
    }
    async show(id, res) {
        const media = await this.exchange.getMedia(id);
        res.setHeader('Content-Type', media.mimeType);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.sendFile(media.key, {
            root: exchange_service_1.EXCHANGE_MEDIA_DIR,
        });
    }
};
exports.ExchangeMediaController = ExchangeMediaController;
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ExchangeMediaController.prototype, "show", null);
exports.ExchangeMediaController = ExchangeMediaController = __decorate([
    (0, common_1.Controller)('exchange/media'),
    __metadata("design:paramtypes", [exchange_service_1.ExchangeService])
], ExchangeMediaController);
//# sourceMappingURL=exchange.controller.js.map