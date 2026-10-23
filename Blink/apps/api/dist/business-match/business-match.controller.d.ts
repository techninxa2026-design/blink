import { CreateBusinessMeetingDto } from './business-meeting.dto';
import { SendBusinessChatDto } from './business-chat.dto';
import { type AuthenticatedUser } from '../auth/jwt-auth.guard';
import { CreateBusinessRequestDto, RespondBusinessRequestDto } from './business-connection.dto';
import { BusinessMatchService } from './business-match.service';
import { SaveBusinessProfileDto, SetBusinessActivationDto, DiscoverBusinessProfilesDto } from './business-match.dto';
type AuthRequest = {
    user: AuthenticatedUser;
};
export declare class BusinessMatchController {
    private readonly service;
    constructor(service: BusinessMatchService);
    mine(req: AuthRequest): import("@prisma/client").Prisma.Prisma__BusinessProfileClient<{
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
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    save(req: AuthRequest, dto: SaveBusinessProfileDto): Promise<{
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
    activate(req: AuthRequest, body: SetBusinessActivationDto): Promise<{
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
    discover(req: AuthRequest, filters: DiscoverBusinessProfilesDto): Promise<{
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
    profile(req: AuthRequest, id: string): Promise<{
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
    send(req: AuthRequest, body: CreateBusinessRequestDto): Promise<{
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.BusinessConnectionStatus;
    }>;
    requests(req: AuthRequest): Promise<{
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
    connections(req: AuthRequest): Promise<{
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
    respond(req: AuthRequest, id: string, body: RespondBusinessRequestDto): Promise<{
        status: string;
    }>;
    cancel(req: AuthRequest, id: string): Promise<{
        canceled: boolean;
    }>;
    meetings(req: AuthRequest): Promise<{
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
    createMeeting(req: AuthRequest, dto: CreateBusinessMeetingDto): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.BusinessMeetingStatus;
        startsAt: Date;
        endsAt: Date;
    }>;
    acceptMeeting(req: AuthRequest, id: string): Promise<{
        status: string;
    }>;
    declineMeeting(req: AuthRequest, id: string): Promise<{
        status: string;
    }>;
    cancelMeeting(req: AuthRequest, id: string): Promise<{
        status: string;
    }>;
    chatMessages(req: AuthRequest, connectionId: string, before?: string): Promise<{
        id: string;
        createdAt: Date;
        senderId: string;
        text: string;
    }[]>;
    sendChatMessage(req: AuthRequest, connectionId: string, dto: SendBusinessChatDto): Promise<{
        id: string;
        createdAt: Date;
        senderId: string;
        text: string;
    }>;
}
export {};
