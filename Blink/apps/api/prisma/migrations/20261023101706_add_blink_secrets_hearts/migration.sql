-- AlterTable
ALTER TABLE `user` ADD COLUMN `blinkPoints` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `BlinkSecret` (
    `id` VARCHAR(191) NOT NULL,
    `creatorId` VARCHAR(191) NOT NULL,
    `prompt` VARCHAR(500) NOT NULL,
    `options` JSON NOT NULL,
    `correctIndex` INTEGER NOT NULL,
    `visibility` ENUM('ANONYMOUS', 'NAMED') NOT NULL DEFAULT 'ANONYMOUS',
    `revealAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BlinkSecret_createdAt_idx`(`createdAt`),
    INDEX `BlinkSecret_revealAt_idx`(`revealAt`),
    INDEX `BlinkSecret_creatorId_createdAt_idx`(`creatorId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BlinkSecretGuess` (
    `id` VARCHAR(191) NOT NULL,
    `secretId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `selectedIndex` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BlinkSecretGuess_userId_idx`(`userId`),
    UNIQUE INDEX `BlinkSecretGuess_secretId_userId_key`(`secretId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BlinkSecretReward` (
    `secretId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `points` INTEGER NOT NULL DEFAULT 10,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BlinkSecretReward_userId_idx`(`userId`),
    PRIMARY KEY (`secretId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BlinkSecretReaction` (
    `secretId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `emoji` VARCHAR(16) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`secretId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BlinkHeartThread` (
    `id` VARCHAR(191) NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `receiverId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'DECLINED') NOT NULL DEFAULT 'PENDING',
    `senderRevealed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BlinkHeartThread_receiverId_updatedAt_idx`(`receiverId`, `updatedAt`),
    INDEX `BlinkHeartThread_senderId_updatedAt_idx`(`senderId`, `updatedAt`),
    UNIQUE INDEX `BlinkHeartThread_senderId_receiverId_key`(`senderId`, `receiverId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BlinkHeartMessage` (
    `id` VARCHAR(191) NOT NULL,
    `threadId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `text` VARCHAR(2000) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BlinkHeartMessage_threadId_createdAt_idx`(`threadId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BlinkSecret` ADD CONSTRAINT `BlinkSecret_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BlinkSecretGuess` ADD CONSTRAINT `BlinkSecretGuess_secretId_fkey` FOREIGN KEY (`secretId`) REFERENCES `BlinkSecret`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BlinkSecretGuess` ADD CONSTRAINT `BlinkSecretGuess_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BlinkSecretReward` ADD CONSTRAINT `BlinkSecretReward_secretId_fkey` FOREIGN KEY (`secretId`) REFERENCES `BlinkSecret`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BlinkSecretReward` ADD CONSTRAINT `BlinkSecretReward_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BlinkSecretReaction` ADD CONSTRAINT `BlinkSecretReaction_secretId_fkey` FOREIGN KEY (`secretId`) REFERENCES `BlinkSecret`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BlinkSecretReaction` ADD CONSTRAINT `BlinkSecretReaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BlinkHeartThread` ADD CONSTRAINT `BlinkHeartThread_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BlinkHeartThread` ADD CONSTRAINT `BlinkHeartThread_receiverId_fkey` FOREIGN KEY (`receiverId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BlinkHeartMessage` ADD CONSTRAINT `BlinkHeartMessage_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `BlinkHeartThread`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BlinkHeartMessage` ADD CONSTRAINT `BlinkHeartMessage_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
