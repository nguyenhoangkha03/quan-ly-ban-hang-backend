import { PrismaClient } from '@prisma/client';
import { CreateTagInput } from '../validators/news.validator';

const prisma = new PrismaClient();

export class NewsTagService {

    /**
     * Get all tags
     */
    static async getAllTags() {
        return prisma.newsTag.findMany({
            where: { deletedAt: null },
            orderBy: { tagName: 'asc' },
            include: {
                _count: {
                    select: { newsTagRelations: true },
                },
            },
        });
    }

    /**
     * Get tag by ID
     */
    static async getTagById(id: number) {
        return prisma.newsTag.findFirst({
            where: { id, deletedAt: null },
        });
    }

    /**
     * Get tag by slug
     */
    static async getTagBySlug(slug: string) {
        return prisma.newsTag.findFirst({
            where: { slug, deletedAt: null },
        });
    }

    /**
     * Create tag
     */
    static async createTag(data: CreateTagInput) {
        return prisma.newsTag.create({
            data,
        });
    }

    /**
     * Delete tag (soft delete)
     */
    static async deleteTag(id: number) {
        return prisma.newsTag.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }
}
