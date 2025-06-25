import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article, ArticleStatus } from './entities/article.entity';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private articleRepository: Repository<Article>,
  ) {}

  async create(createArticleDto: CreateArticleDto, user: User): Promise<Article> {
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException('Only teachers can create articles');
    }

    const article = this.articleRepository.create({
      ...createArticleDto,
      teacherId: user.teacher.id,
    });

    return this.articleRepository.save(article);
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
    const page = query.page || 1;
    const limit = query.limit || 10;
    
    const [articles, total] = await this.articleRepository.findAndCount({
      where: { status: ArticleStatus.PUBLISHED },
      relations: ['teacher', 'teacher.user'],
      skip: (page - 1) * limit,
      take: limit,
      order: { publishedAt: 'DESC' },
    });

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

  async uploadImage(id: number, file: Express.Multer.File, user: User): Promise<Article> {
    const article = await this.findOne(id);

    if (user.role !== UserRole.ADMIN && article.teacherId !== user.teacher?.id) {
      throw new ForbiddenException('You can only update your own articles');
    }

    article.featuredImage = file.filename;
    return this.articleRepository.save(article);
  }
}
