-- AlterTable
ALTER TABLE `conversation` ADD COLUMN `pinnedMessageId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `message` ADD COLUMN `forwarded` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `replyToId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Message_replyToId_idx` ON `Message`(`replyToId`);
