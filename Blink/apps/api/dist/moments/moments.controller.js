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
exports.MomentsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const moments_service_1 = require("./moments.service");
const UPLOAD_DIR = (0, node_path_1.join)(__dirname, '..', '..', 'uploads');
const ALLOWED_TYPES = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
};
let MomentsController = class MomentsController {
    momentsService;
    constructor(momentsService) {
        this.momentsService = momentsService;
    }
    async upload(req, file, caption) {
        if (!file) {
            throw new common_1.BadRequestException('Please select a photo or video.');
        }
        if (caption !== undefined && typeof caption !== 'string') {
            throw new common_1.BadRequestException('Caption must be text.');
        }
        if (caption && caption.length > 500) {
            throw new common_1.BadRequestException('Caption cannot exceed 500 characters.');
        }
        return this.momentsService.create(req.user.userId, file, caption);
    }
    findFeed() {
        return this.momentsService.findFeed();
    }
    findMine(req) {
        return this.momentsService.findMine(req.user.userId);
    }
    recordView(req, id) {
        return this.momentsService.recordView(req.user.userId, id);
    }
    getViews(req, id) {
        return this.momentsService.getViews(req.user.userId, id);
    }
    remove(req, id) {
        return this.momentsService.remove(req.user.userId, id);
    }
};
exports.MomentsController = MomentsController;
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: (_req, _file, callback) => {
                try {
                    (0, node_fs_1.mkdirSync)(UPLOAD_DIR, { recursive: true });
                    callback(null, UPLOAD_DIR);
                }
                catch (error) {
                    callback(error, UPLOAD_DIR);
                }
            },
            filename: (_req, file, callback) => {
                const extension = ALLOWED_TYPES[file.mimetype];
                if (!extension) {
                    callback(new common_1.BadRequestException('Unsupported media type.'), '');
                    return;
                }
                callback(null, `${(0, node_crypto_1.randomUUID)()}${extension}`);
            },
        }),
        limits: {
            fileSize: 50 * 1024 * 1024,
            files: 1,
        },
        fileFilter: (_req, file, callback) => {
            if (!ALLOWED_TYPES[file.mimetype]) {
                callback(new common_1.BadRequestException('Use a JPG, PNG, WEBP, GIF, MP4, WEBM, or MOV file.'), false);
                return;
            }
            callback(null, true);
        },
    })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)('caption')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], MomentsController.prototype, "upload", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MomentsController.prototype, "findFeed", null);
__decorate([
    (0, common_1.Get)('mine'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MomentsController.prototype, "findMine", null);
__decorate([
    (0, common_1.Post)(':id/view'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MomentsController.prototype, "recordView", null);
__decorate([
    (0, common_1.Get)(':id/views'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MomentsController.prototype, "getViews", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MomentsController.prototype, "remove", null);
exports.MomentsController = MomentsController = __decorate([
    (0, common_1.Controller)('moments'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [moments_service_1.MomentsService])
], MomentsController);
//# sourceMappingURL=moments.controller.js.map