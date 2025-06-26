import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article, ArticleStatus } from './entities/article.entity';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { UploadsService } from '../uploads/uploads.service';
import { UploadType } from '../uploads/entities/file-upload.entity';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private articleRepository: Repository<Article>,
    private uploadsService: UploadsService,
  ) {}

  async create(createArticleDto: CreateArticleDto, user: User): Promise<Article> {
    if (user.role !== UserRole.TEACHER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only teachers and admins can create articles');
    }

    // For admin users, we need to handle the case where they might not have a teacher profile
    let teacherId: number | undefined;
    
    if (user.role === UserRole.TEACHER) {
      teacherId = user.teacher.id;
    } else if (user.role === UserRole.ADMIN) {
      // For admin users, we can either:
      // 1. Allow null teacherId (if your schema allows it)
      // 2. Create a special admin teacher record
      // 3. Use a default teacher
      // For now, we'll allow null teacherId for admin articles
      teacherId = undefined;
    }

    // Auto-generate slug if not provided
    let slug = createArticleDto.slug;
    if (!slug) {
      slug = this.generateSlug(createArticleDto.title);
      // Ensure slug is unique
      slug = await this.ensureUniqueSlug(slug);
    }

    const article = this.articleRepository.create({
      ...createArticleDto,
      slug,
      teacherId,
    });

    return this.articleRepository.save(article);
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  private async ensureUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (await this.articleRepository.findOne({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  async findAll(page: number = 1, limit: number = 10) {
    const [articles, total] = await this.articleRepository.findAndCount({
      relations: ['teacher', 'teacher.user'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      articles,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAllPublished(query: any) {
    console.log('findAllPublished called with query:', query);
    
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const searchQuery = query.search || '';
    
    // Convert status to lowercase to ensure case insensitivity
    let status = query.status ? query.status.toString().toLowerCase() : 'published';
    
    // Ensure status is a valid enum value or default to published
    if (!Object.values(ArticleStatus).includes(status as ArticleStatus)) {
      status = ArticleStatus.PUBLISHED;
    }
    
    console.log('Using status:', status);
    
    // Build query using QueryBuilder
    const queryBuilder = this.articleRepository.createQueryBuilder('article')
      .leftJoinAndSelect('article.teacher', 'teacher')
      .leftJoinAndSelect('teacher.user', 'user')
      .skip((page - 1) * limit)
      .take(limit);
    
    console.log('Query builder initialized');
      
    // Apply status filter
    console.log('Applying status filter:', status);
    queryBuilder.andWhere('article.status = :status', { status });
    
    // Apply search filter if provided
    if (searchQuery) {
      console.log('Adding search filter:', searchQuery);
      queryBuilder.andWhere('article.title LIKE :search', { search: `%${searchQuery}%` });
    }
    
    // Apply ordering based on status
    if (query.status === ArticleStatus.PUBLISHED) {
      console.log('Using publishedAt ordering for published articles');
      queryBuilder.orderBy('article.publishedAt', 'DESC');
    } else {
      console.log('Using createdAt ordering for non-published articles');
      queryBuilder.orderBy('article.createdAt', 'DESC');
    }
    
    console.log('Executing query...');
    
    // Execute query
    const [articles, total] = await queryBuilder.getManyAndCount();
    
    console.log('Query results:', { articleCount: articles.length, total });

    return {
      articles,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByTeacher(teacherId: number) {
    return this.articleRepository.find({
      where: { teacherId },
      relations: ['teacher', 'teacher.user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Article> {
    const article = await this.articleRepository.findOne({
      where: { id },
      relations: ['teacher', 'teacher.user'],
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    return article;
  }

  async findBySlug(slug: string): Promise<Article> {
    const article = await this.articleRepository.findOne({
      where: { slug },
      relations: ['teacher', 'teacher.user'],
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    // Increment view count
    article.viewCount += 1;
    await this.articleRepository.save(article);

    return article;
  }

  async update(id: number, updateArticleDto: UpdateArticleDto, user: User): Promise<Article> {
    const article = await this.findOne(id);

    if (user.role !== UserRole.ADMIN && article.teacherId !== user.teacher?.id) {
      throw new ForbiddenException('You can only update your own articles');
    }

    Object.assign(article, updateArticleDto);
    return this.articleRepository.save(article);
  }

  async remove(id: number, user: User): Promise<void> {
    const article = await this.findOne(id);

    if (user.role !== UserRole.ADMIN && article.teacherId !== user.teacher?.id) {
      throw new ForbiddenException('You can only delete your own articles');
    }

    await this.articleRepository.remove(article);
  }

  async uploadEditorImage(
    file: Express.Multer.File,
    user: User,
  ): Promise<{ success: number; file: { url: string } }> {
    // For Editor.js image upload
    if (!file) {
      throw new Error('No file provided');
    }

    // Use the uploads service to handle the file upload
    const uploadedFile = await this.uploadsService.uploadFile(
      file,
      UploadType.ARTICLE_IMAGE,
      user,
    );

    // Return the URL in the format expected by Editor.js
    const imageUrl = `${process.env.API_URL || 'http://localhost:8080'}/uploads/articles/${uploadedFile.filename}`;

    return {
      success: 1,
      file: {
        url: imageUrl,
      },
    };
  }

  async uploadBanner(id: number, file: Express.Multer.File, user: User): Promise<Article> {
    const article = await this.findOne(id);

    if (user.role !== UserRole.ADMIN && article.teacherId !== user.teacher?.id) {
      throw new ForbiddenException('You can only update your own articles');
    }

    // Set the banner image
    article.featuredImage = file.filename;
    return this.articleRepository.save(article);
  }

  async uploadImage(id: number, file: Express.Multer.File, user: User): Promise<Article> {
    const article = await this.findOne(id);

    if (user.role !== UserRole.ADMIN && article.teacherId !== user.teacher?.id) {
      throw new ForbiddenException('You can only update your own articles');
    }

    article.featuredImage = file.filename;
    return this.articleRepository.save(article);
  }

  // For debugging purposes only
  getArticleRepository() {
    return this.articleRepository;
  }
}
