-- AlterTable
ALTER TABLE `conversation` ADD COLUMN `groupName` VARCHAR(80) NULL,
    ADD COLUMN `groupOwnerId` VARCHAR(191) NULL,
    ADD COLUMN `isGroup` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `conversationmember` ADD COLUMN `role` VARCHAR(191) NOT NULL DEFAULT 'MEMBER';

-- CreateTable
CREATE TABLE `MessagePrivateView` (
    `messageId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`messageId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MessagePrivateView` ADD CONSTRAINT `MessagePrivateView_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `Message`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MessagePrivateView` ADD CONSTRAINT `MessagePrivateView_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
