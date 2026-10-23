-- CreateTable
CREATE TABLE `ExchangePriceOffer` (
    `id` VARCHAR(191) NOT NULL,
    `threadId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'DECLINED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `decidedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ExchangePriceOffer_threadId_key`(`threadId`),
    INDEX `ExchangePriceOffer_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ExchangePriceOffer` ADD CONSTRAINT `ExchangePriceOffer_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `ExchangeThread`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
