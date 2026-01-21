import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedNews() {
    console.log('🌱 Seeding news data...');

    try {
        // 1. Create categories
        console.log('Creating categories...');
        const categories = await Promise.all([
            prisma.newsCategory.upsert({
                where: { categoryKey: 'san-pham' },
                update: {},
                create: {
                    categoryKey: 'san-pham',
                    categoryName: 'Sản phẩm',
                    slug: 'san-pham',
                    description: 'Tin tức về sản phẩm mới',
                    displayOrder: 1,
                    status: 'active',
                },
            }),
            prisma.newsCategory.upsert({
                where: { categoryKey: 'huong-dan' },
                update: {},
                create: {
                    categoryKey: 'huong-dan',
                    categoryName: 'Hướng dẫn',
                    slug: 'huong-dan',
                    description: 'Hướng dẫn làm vườn',
                    displayOrder: 2,
                    status: 'active',
                },
            }),
            prisma.newsCategory.upsert({
                where: { categoryKey: 'su-kien' },
                update: {},
                create: {
                    categoryKey: 'su-kien',
                    categoryName: 'Sự kiện',
                    slug: 'su-kien',
                    description: 'Sự kiện và khuyến mãi',
                    displayOrder: 3,
                    status: 'active',
                },
            }),
        ]);

        console.log(`✅ Created ${categories.length} categories`);

        // 2. Create tags
        console.log('Creating tags...');
        const tags = await Promise.all([
            prisma.newsTag.upsert({
                where: { slug: 'lam-vuon' },
                update: {},
                create: {
                    tagName: 'Làm vườn',
                    slug: 'lam-vuon',
                },
            }),
            prisma.newsTag.upsert({
                where: { slug: 'cham-soc-cay' },
                update: {},
                create: {
                    tagName: 'Chăm sóc cây',
                    slug: 'cham-soc-cay',
                },
            }),
            prisma.newsTag.upsert({
                where: { slug: 'san-pham-moi' },
                update: {},
                create: {
                    tagName: 'Sản phẩm mới',
                    slug: 'san-pham-moi',
                },
            }),
        ]);

        console.log(`✅ Created ${tags.length} tags`);

        // 3. Get first user (admin) to be author
        const firstUser = await prisma.user.findFirst({
            where: { deletedAt: null },
        });

        if (!firstUser) {
            console.error('❌ No user found. Please create a user first.');
            return;
        }

        // 4. Create sample news articles
        console.log('Creating news articles...');

        const article1 = await prisma.news.upsert({
            where: { slug: 'huong-dan-trong-cay-tai-nha' },
            update: {},
            create: {
                title: 'Hướng dẫn trồng cây tại nhà cho người mới bắt đầu',
                slug: 'huong-dan-trong-cay-tai-nha',
                excerpt: 'Bạn muốn bắt đầu trồng cây tại nhà nhưng chưa biết bắt đầu từ đâu? Hãy cùng tìm hiểu những bước cơ bản nhất.',
                content: `
          <h2>Giới thiệu</h2>
          <p>Trồng cây tại nhà không chỉ giúp không gian sống xanh mát hơn mà còn mang lại nhiều lợi ích cho sức khỏe.</p>
          
          <h2>Các bước cơ bản</h2>
          <ol>
            <li><strong>Chọn loại cây phù hợp:</strong> Với người mới bắt đầu, nên chọn các loại cây dễ trồng như cây lưỡi hổ, cây kim tiền, cây trầu bà.</li>
            <li><strong>Chuẩn bị đất:</strong> Sử dụng đất trồng chuyên dụng hoặc pha trộn đất vườn với phân hữu cơ.</li>
            <li><strong>Tưới nước đúng cách:</strong> Không tưới quá nhiều nước, chỉ tưới khi đất khô.</li>
            <li><strong>Ánh sáng:</strong> Đặt cây ở nơi có ánh sáng gián tiếp, tránh ánh nắng trực tiếp.</li>
          </ol>
          
          <h2>Lưu ý</h2>
          <p>Hãy kiên nhẫn và quan sát cây thường xuyên để kịp thời xử lý các vấn đề phát sinh.</p>
        `,
                contentType: 'article',
                categoryId: categories[1].id, // Hướng dẫn
                authorId: firstUser.id,
                status: 'published',
                publishedAt: new Date(),
                isFeatured: true,
                metaTitle: 'Hướng dẫn trồng cây tại nhà cho người mới bắt đầu',
                metaDescription: 'Tìm hiểu cách trồng cây tại nhà dễ dàng với hướng dẫn chi tiết từ A-Z',
                metaKeywords: 'trồng cây, làm vườn, cây cảnh, hướng dẫn',
                createdBy: firstUser.id,
            },
        });

        // Create tags relation for article 1
        await prisma.newsTagRelation.createMany({
            data: [
                { newsId: article1.id, tagId: tags[0].id },
                { newsId: article1.id, tagId: tags[1].id },
            ],
            skipDuplicates: true,
        });

        const article2 = await prisma.news.upsert({
            where: { slug: 'san-pham-phan-bon-huu-co-moi' },
            update: {},
            create: {
                title: 'Ra mắt sản phẩm phân bón hữu cơ cao cấp',
                slug: 'san-pham-phan-bon-huu-co-moi',
                excerpt: 'Chúng tôi vui mừng giới thiệu dòng phân bón hữu cơ mới, an toàn và hiệu quả cho mọi loại cây.',
                content: `
          <h2>Giới thiệu sản phẩm</h2>
          <p>Phân bón hữu cơ cao cấp của chúng tôi được sản xuất từ 100% nguyên liệu tự nhiên, không chứa hóa chất độc hại.</p>
          
          <h2>Ưu điểm</h2>
          <ul>
            <li>100% hữu cơ, an toàn cho người và môi trường</li>
            <li>Cung cấp đầy đủ dinh dưỡng cho cây</li>
            <li>Cải thiện cấu trúc đất</li>
            <li>Tăng khả năng giữ nước của đất</li>
          </ul>
          
          <h2>Cách sử dụng</h2>
          <p>Bón 1-2 lần/tháng, pha loãng theo hướng dẫn trên bao bì.</p>
        `,
                contentType: 'article',
                categoryId: categories[0].id, // Sản phẩm
                authorId: firstUser.id,
                status: 'published',
                publishedAt: new Date(Date.now() - 86400000), // 1 day ago
                isFeatured: false,
                metaTitle: 'Phân bón hữu cơ cao cấp - An toàn cho cây trồng',
                metaDescription: 'Sản phẩm phân bón hữu cơ mới, 100% tự nhiên, an toàn và hiệu quả',
                metaKeywords: 'phân bón, hữu cơ, sản phẩm mới',
                createdBy: firstUser.id,
            },
        });

        await prisma.newsTagRelation.createMany({
            data: [
                { newsId: article2.id, tagId: tags[2].id },
            ],
            skipDuplicates: true,
        });

        // 5. Create sample video news
        console.log('Creating video news...');

        const video1 = await prisma.news.upsert({
            where: { slug: 'video-huong-dan-lam-vuon-ban-cong' },
            update: {},
            create: {
                title: 'Video: Hướng dẫn làm vườn ban công mini',
                slug: 'video-huong-dan-lam-vuon-ban-cong',
                excerpt: 'Xem video hướng dẫn chi tiết cách tạo một khu vườn mini xinh xắn ngay tại ban công nhà bạn.',
                content: `
          <p>Trong video này, chúng tôi sẽ hướng dẫn bạn từng bước để tạo ra một khu vườn ban công đẹp mắt và dễ chăm sóc.</p>
          
          <h2>Nội dung video</h2>
          <ul>
            <li>Chọn cây phù hợp với ban công</li>
            <li>Bố trí chậu cây hợp lý</li>
            <li>Hệ thống tưới nước tự động</li>
            <li>Mẹo chăm sóc cây hiệu quả</li>
          </ul>
        `,
                contentType: 'video',
                videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Sample YouTube URL
                videoDuration: 600, // 10 minutes
                categoryId: categories[1].id, // Hướng dẫn
                authorId: firstUser.id,
                status: 'published',
                publishedAt: new Date(Date.now() - 172800000), // 2 days ago
                isFeatured: true,
                metaTitle: 'Video hướng dẫn làm vườn ban công mini',
                metaDescription: 'Xem video hướng dẫn chi tiết cách tạo vườn ban công đẹp',
                metaKeywords: 'video, làm vườn, ban công, hướng dẫn',
                createdBy: firstUser.id,
            },
        });

        await prisma.newsTagRelation.createMany({
            data: [
                { newsId: video1.id, tagId: tags[0].id },
                { newsId: video1.id, tagId: tags[1].id },
            ],
            skipDuplicates: true,
        });

        console.log('✅ Created sample news articles and videos');
        console.log('\n📊 Summary:');
        console.log(`- Categories: ${categories.length}`);
        console.log(`- Tags: ${tags.length}`);
        console.log(`- Articles: 2`);
        console.log(`- Videos: 1`);
        console.log('\n✨ Seed completed successfully!');
        console.log('\n🌐 Visit http://localhost:3000/news to see the news');

    } catch (error) {
        console.error('❌ Error seeding news:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

seedNews()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
