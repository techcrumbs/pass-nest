import { z } from 'zod';
export const listEntriesByProfileSchema = z.object({
    profileId: z.string().uuid(),
});
export const createEntrySchema = z.object({
    profileId: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    password: z.string().min(1).max(4096),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});
export const updateEntrySchema = z.object({
    id: z.string().uuid(),
    profileId: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    password: z.string().min(1).max(4096).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});
export const deleteEntrySchema = z.object({
    id: z.string().uuid(),
});
