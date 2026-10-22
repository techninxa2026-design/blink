-- Check-Ins Phase 1. Separate migration; existing Blink tables are unchanged.
CREATE TABLE `checkin` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `emoji` VARCHAR(16) NOT NULL,
    `status` VARCHAR(80) NOT NULL,
    `note` VARCHAR(280) NULL,
    `duration` VARCHAR(16) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,
    UNIQUE INDEX `checkin_userId_key`(`userId`),
    INDEX `checkin_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `checkin` ADD CONSTRAINT `checkin_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
