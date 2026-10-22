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
exports.ProfileController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const profile_service_1 = require("./profile.service");
const UPLOAD_DIR = (0, node_path_1.join)(__dirname, '..', '..', 'uploads');
const IMAGE_TYPES = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
};
function imageUploadOptions(maxBytes) {
    return {
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
                const extension = IMAGE_TYPES[file.mimetype];
                if (!extension) {
                    callback(new common_1.BadRequestException('Unsupported image type.'), '');
                    return;
                }
                callback(null, `${(0, node_crypto_1.randomUUID)()}${extension}`);
            },
        }),
        limits: {
            fileSize: maxBytes,
            files: 1,
        },
        fileFilter: (_req, file, callback) => {
            if (!IMAGE_TYPES[file.mimetype]) {
                callback(new common_1.BadRequestException('Please select a JPG, PNG, or WebP image.'), false);
                return;
            }
            callback(null, true);
        },
    };
}
let ProfileController = class ProfileController {
    profileService;
    constructor(profileService) {
        this.profileService = profileService;
    }
    getMyProfile(req) {
        return this.profileService.getMyProfile(req.user.userId);
    }
    getPublicProfile(req, userId) {
        return this.profileService.getPublicProfile(req.user.userId, userId);
    }
    updateMyProfile(req, body) {
        return this.profileService.updateMyProfile(req.user.userId, body);
    }
    uploadAvatar(req, file) {
        if (!file) {
            throw new common_1.BadRequestException('Please select a profile picture.');
        }
        return this.profileService.updateProfileImage(req.user.userId, file, 'avatarKey');
    }
    uploadCover(req, file) {
        if (!file) {
            throw new common_1.BadRequestException('Please select a cover photo.');
        }
        return this.profileService.updateProfileImage(req.user.userId, file, 'coverKey');
    }
};
exports.ProfileController = ProfileController;
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProfileController.prototype, "getMyProfile", null);
__decorate([
    (0, common_1.Get)(':userId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProfileController.prototype, "getPublicProfile", null);
__decorate([
    (0, common_1.Patch)('me'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ProfileController.prototype, "updateMyProfile", null);
__decorate([
    (0, common_1.Post)('me/avatar'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', imageUploadOptions(5 * 1024 * 1024))),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ProfileController.prototype, "uploadAvatar", null);
__decorate([
    (0, common_1.Post)('me/cover'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', imageUploadOptions(10 * 1024 * 1024))),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ProfileController.prototype, "uploadCover", null);
exports.ProfileController = ProfileController = __decorate([
    (0, common_1.Controller)('profile'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [profile_service_1.ProfileService])
], ProfileController);
//# sourceMappingURL=profile.controller.js.map