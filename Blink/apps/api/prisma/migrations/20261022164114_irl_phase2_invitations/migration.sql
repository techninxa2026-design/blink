-- CreateTable
CREATE TABLE `IrlInvitation` (
    `id` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `recipientId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'DECLINED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `IrlInvitation_recipientId_status_createdAt_idx`(`recipientId`, `status`, `createdAt`),
    UNIQUE INDEX `IrlInvitation_planId_recipientId_key`(`planId`, `recipientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `IrlInvitation` ADD CONSTRAINT `IrlInvitation_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `IrlPlan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IrlInvitation` ADD CONSTRAINT `IrlInvitation_recipientId_fkey` FOREIGN KEY (`recipientId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
