-- Persistent Moment comments and BP gifts (existing records remain intact).
CREATE TABLE `MomentComment` (
  `id` VARCHAR(191) NOT NULL,
  `momentId` VARCHAR(191) NOT NULL,
  `authorId` VARCHAR(191) NOT NULL,
  `body` VARCHAR(500) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `MomentComment_momentId_createdAt_idx` (`momentId`, `createdAt`),
  INDEX `MomentComment_authorId_idx` (`authorId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MomentBpGift` (
  `id` VARCHAR(191) NOT NULL,
  `momentId` VARCHAR(191) NOT NULL,
  `senderId` VARCHAR(191) NOT NULL,
  `amount` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `MomentBpGift_momentId_createdAt_idx` (`momentId`, `createdAt`),
  INDEX `MomentBpGift_senderId_createdAt_idx` (`senderId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MomentComment` ADD CONSTRAINT `MomentComment_momentId_fkey` FOREIGN KEY (`momentId`) REFERENCES `Moment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `MomentComment` ADD CONSTRAINT `MomentComment_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `MomentBpGift` ADD CONSTRAINT `MomentBpGift_momentId_fkey` FOREIGN KEY (`momentId`) REFERENCES `Moment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `MomentBpGift` ADD CONSTRAINT `MomentBpGift_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
