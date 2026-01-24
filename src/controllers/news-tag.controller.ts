import { Request, Response } from 'express';
import { NewsTagService } from '../services/news-tag.service';
import { createTagSchema } from '../validators/news.validator';

export class NewsTagController {

    static async getAllTags(_req: Request, res: Response) {
        try {
            const tags = await NewsTagService.getAllTags();
            return res.json({ success: true, data: tags });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    static async getTagBySlug(req: Request, res: Response) {
        try {
            const { slug } = req.params;
            const tag = await NewsTagService.getTagBySlug(slug);

            if (!tag) {
                return res.status(404).json({ success: false, error: 'Tag not found' });
            }

            return res.json({ success: true, data: tag });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    static async createTag(req: Request, res: Response) {
        try {
            const data = createTagSchema.parse(req.body);
            const tag = await NewsTagService.createTag(data);

            res.status(201).json({ success: true, data: tag });
        } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
        }
    }

    static async deleteTag(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id);
            await NewsTagService.deleteTag(id);

            res.json({ success: true, message: 'Tag deleted successfully' });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}
