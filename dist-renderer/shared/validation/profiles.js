import { z } from 'zod';
export const createProfileSchema = z.object({
    name: z.string().trim().min(1).max(80),
});
export const updateProfileSchema = z.object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(80),
});
export const deleteByIdSchema = z.object({
    id: z.string().uuid(),
});
