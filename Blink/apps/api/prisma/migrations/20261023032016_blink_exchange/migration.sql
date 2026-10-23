/*
  Warnings:

  - You are about to drop the `irlmessage` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `irlmessage` DROP FOREIGN KEY `IrlMessage_planId_fkey`;

-- DropForeignKey
ALTER TABLE `irlmessage` DROP FOREIGN KEY `IrlMessage_senderId_fkey`;

-- DropTable
DROP TABLE `irlmessage`;

-- CreateTable
CREATE TABLE `ExchangePost` (
    `id` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(140) NOT NULL,
    `description` TEXT NOT NULL,
    `kind` ENUM('OFFER', 'REQUEST', 'ADVICE', 'COLLABORATION') NOT NULL,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ExchangePost_createdAt_idx`(`createdAt`),
    INDEX `ExchangePost_kind_createdAt_idx`(`kind`, `createdAt`),
    INDEX `ExchangePost_authorId_createdAt_idx`(`authorId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExchangeMedia` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `mimeType` VARCHAR(60) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `ExchangeMedia_key_key`(`key`),
    INDEX `ExchangeMedia_postId_position_idx`(`postId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExchangeResponse` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `message` VARCHAR(600) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `acknowledgedAt` DATETIME(3) NULL,

    INDEX `ExchangeResponse_postId_createdAt_idx`(`postId`, `createdAt`),
    INDEX `ExchangeResponse_authorId_createdAt_idx`(`authorId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ExchangePost` ADD CONSTRAINT `ExchangePost_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExchangeMedia` ADD CONSTRAINT `ExchangeMedia_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `ExchangePost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExchangeResponse` ADD CONSTRAINT `ExchangeResponse_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `ExchangePost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExchangeResponse` ADD CONSTRAINT `ExchangeResponse_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
