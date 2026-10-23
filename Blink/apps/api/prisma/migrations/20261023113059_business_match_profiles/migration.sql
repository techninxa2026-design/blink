-- CreateTable
CREATE TABLE `BusinessProfile` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('PROFESSIONAL', 'COMPANY') NOT NULL DEFAULT 'PROFESSIONAL',
    `name` VARCHAR(100) NOT NULL,
    `headline` VARCHAR(120) NOT NULL,
    `industry` VARCHAR(80) NOT NULL,
    `location` VARCHAR(100) NOT NULL DEFAULT '',
    `skills` VARCHAR(240) NOT NULL DEFAULT '',
    `about` VARCHAR(600) NOT NULL DEFAULT '',
    `lookingFor` VARCHAR(400) NOT NULL DEFAULT '',
    `active` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BusinessProfile_userId_key`(`userId`),
    INDEX `BusinessProfile_active_type_idx`(`active`, `type`),
    INDEX `BusinessProfile_active_industry_idx`(`active`, `industry`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BusinessProfile` ADD CONSTRAINT `BusinessProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
