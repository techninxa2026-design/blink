import { BusinessProfileType } from '@prisma/client';
export declare class SaveBusinessProfileDto {
    type: BusinessProfileType;
    name: string;
    headline: string;
    industry: string;
    location?: string;
    skills?: string;
    about?: string;
    lookingFor?: string;
}
export declare class SetBusinessActivationDto {
    active: boolean;
}
export declare class DiscoverBusinessProfilesDto {
    q?: string;
    type?: BusinessProfileType;
    page?: string;
}
