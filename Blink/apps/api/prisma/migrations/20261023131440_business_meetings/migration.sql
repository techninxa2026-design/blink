-- CreateTable
CREATE TABLE `BusinessMeeting` (
    `id` VARCHAR(191) NOT NULL,
    `connectionId` VARCHAR(191) NOT NULL,
    `organizerId` VARCHAR(191) NOT NULL,
    `attendeeId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `agenda` VARCHAR(1000) NOT NULL DEFAULT '',
    `location` VARCHAR(300) NOT NULL DEFAULT '',
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BusinessMeeting_organizerId_startsAt_idx`(`organizerId`, `startsAt`),
    INDEX `BusinessMeeting_attendeeId_startsAt_idx`(`attendeeId`, `startsAt`),
    INDEX `BusinessMeeting_connectionId_startsAt_idx`(`connectionId`, `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BusinessMeeting` ADD CONSTRAINT `BusinessMeeting_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `BusinessConnectionRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessMeeting` ADD CONSTRAINT `BusinessMeeting_organizerId_fkey` FOREIGN KEY (`organizerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessMeeting` ADD CONSTRAINT `BusinessMeeting_attendeeId_fkey` FOREIGN KEY (`attendeeId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
