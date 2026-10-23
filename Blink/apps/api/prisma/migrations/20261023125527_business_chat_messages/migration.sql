-- CreateTable
CREATE TABLE `BusinessChatMessage` (
    `id` VARCHAR(191) NOT NULL,
    `connectionId` VARCHAR(191) NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `text` VARCHAR(2000) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BusinessChatMessage_connectionId_createdAt_id_idx`(`connectionId`, `createdAt`, `id`),
    INDEX `BusinessChatMessage_senderId_idx`(`senderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BusinessChatMessage` ADD CONSTRAINT `BusinessChatMessage_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `BusinessConnectionRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessChatMessage` ADD CONSTRAINT `BusinessChatMessage_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
