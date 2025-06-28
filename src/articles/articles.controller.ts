import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { User } from '../users/entities/user.entity';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  create(
    @Body() createArticleDto: CreateArticleDto,
    @CurrentUser() user: User,
  ) {
    return this.articlesService.create(createArticleDto, user);
  }

  @Get()
  async findAll(@Query() query: any) {
    console.log('Articles findAll query params:', query);
    console.log('Articles findAll query type of status:', typeof query.status);
    console.log('Articles findAll query object keys:', Object.keys(query));
    console.log('Articles findAll query stringified:', JSON.stringify(query));

    // Ensure the status is lowercase to match the enum values
    if (query.status) {
      query.status = query.status.toLowerCase();
      console.log('Articles findAll normalized status:', query.status);
    }

    // Get all articles directly from the repository for debugging
    const articleRepo = this.articlesService.getArticleRepository();
    const allArticles = await articleRepo.find();
    console.log(
      'All articles in database:',
      allArticles.map((a) => ({ id: a.id, title: a.title, status: a.status })),
    );

    const result = await this.articlesService.findAllPublished(query);
    console.log('Articles findAll result count:', result?.articles?.length);
    return result;
  }

  @Get('my-articles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  findMyArticles(@CurrentUser() user: User) {
    return this.articlesService.findByTeacher(user.teacher.id);
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.articlesService.findBySlug(slug);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body() updateArticleDto: UpdateArticleDto,
    @CurrentUser() user: User,
  ) {
    return this.articlesService.update(+id, updateArticleDto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.articlesService.remove(+id, user);
  }

  @Post('upload-image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('image'))
  @SkipTransform()
  uploadEditorImage(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    return this.articlesService.uploadEditorImage(file, user);
  }

  @Post(':id/upload-banner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('banner'))
  @SkipTransform()
  uploadArticleBanner(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    return this.articlesService.uploadBanner(+id, file, user);
  }

  @Post(':id/upload-image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('image'))
  @SkipTransform()
  uploadArticleImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    return this.articlesService.uploadImage(+id, file, user);
  }
}
