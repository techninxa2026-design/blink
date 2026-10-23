import { CreateBusinessMeetingDto } from './business-meeting.dto';
import { BusinessProfileType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SaveBusinessProfileDto } from './business-match.dto';
export declare class BusinessMatchService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    mine(userId: string): Prisma.Prisma__BusinessProfileClient<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        type: import("@prisma/client").$Enums.BusinessProfileType;
        location: string;
        headline: string;
        industry: string;
        skills: string;
        about: string;
        lookingFor: string;
        active: boolean;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs, Prisma.PrismaClientOptions>;
    save(userId: string, dto: SaveBusinessProfileDto): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        type: import("@prisma/client").$Enums.BusinessProfileType;
        location: string;
        headline: string;
        industry: string;
        skills: string;
        about: string;
        lookingFor: string;
        active: boolean;
    }>;
    activate(userId: string, active: boolean): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        type: import("@prisma/client").$Enums.BusinessProfileType;
        location: string;
        headline: string;
        industry: string;
        skills: string;
        about: string;
        lookingFor: string;
        active: boolean;
    }>;
    private requireActive;
    discover(userId: string, query: string, type?: BusinessProfileType, page?: number): Promise<{
        name: string;
        id: string;
        type: import("@prisma/client").$Enums.BusinessProfileType;
        location: string;
        headline: string;
        industry: string;
        skills: string;
        about: string;
        lookingFor: string;
    }[]>;
    publicProfile(userId: string, profileId: string): Promise<{
        name: string;
        id: string;
        type: import("@prisma/client").$Enums.BusinessProfileType;
        location: string;
        headline: string;
        industry: string;
        skills: string;
        about: string;
        lookingFor: string;
    }>;
    private requireBothActive;
    sendRequest(userId: string, profileId: string): Promise<{
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.BusinessConnectionStatus;
    }>;
    requests(userId: string): Promise<{
        id: string;
        direction: string;
        status: import("@prisma/client").$Enums.BusinessConnectionStatus;
        createdAt: Date;
        profile: {
            id: string;
            type: import("@prisma/client").$Enums.BusinessProfileType;
            name: string;
            headline: string;
            industry: string;
            location: string;
            skills: string;
            about: string;
            lookingFor: string;
        };
    }[]>;
    connections(userId: string): Promise<{
        id: string;
        profile: {
            id: string;
            type: import("@prisma/client").$Enums.BusinessProfileType;
            name: string;
            headline: string;
            industry: string;
            location: string;
            skills: string;
            about: string;
            lookingFor: string;
        };
    }[]>;
    respond(userId: string, requestId: string, accept: boolean): Promise<{
        status: string;
    }>;
    cancel(userId: string, requestId: string): Promise<{
        canceled: boolean;
    }>;
    private requireChatAccess;
    chatMessages(userId: string, connectionId: string, before?: string): Promise<{
        id: string;
        createdAt: Date;
        senderId: string;
        text: string;
    }[]>;
    sendChatMessage(userId: string, connectionId: string, rawText: string): Promise<{
        id: string;
        createdAt: Date;
        senderId: string;
        text: string;
    }>;
    private ensureMeetingAccess;
    meetings(userId: string): Promise<{
        id: string;
        connectionId: string;
        title: string;
        agenda: string;
        location: string;
        startsAt: Date;
        endsAt: Date;
        status: import("@prisma/client").$Enums.BusinessMeetingStatus;
        createdAt: Date;
        role: string;
        counterpartName: string;
    }[]>;
    private assertNoMeetingConflict;
    createMeeting(userId: string, dto: CreateBusinessMeetingDto): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.BusinessMeetingStatus;
        startsAt: Date;
        endsAt: Date;
    }>;
    answerMeeting(userId: string, id: string, accept: boolean): Promise<{
        status: string;
    }>;
    cancelMeeting(userId: string, id: string): Promise<{
        status: string;
    }>;
}
