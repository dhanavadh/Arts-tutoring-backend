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
  ParseIntPipe,
} from '@nestjs/common';
import { QuizzesService } from './quizzes.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { AssignQuizDto } from './dto/assign-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { User } from '../users/entities/user.entity';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('quizzes')
@UseGuards(JwtAuthGuard)
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER)
  create(@Body() createQuizDto: CreateQuizDto, @CurrentUser() user: User) {
    return this.quizzesService.create(createQuizDto, user);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findAll(@Query() paginationDto: PaginationDto) {
    return this.quizzesService.findAll(paginationDto.page, paginationDto.limit);
  }

  @Get('my-quizzes')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER)
  findMyQuizzes(@CurrentUser() user: User) {
    return this.quizzesService.findByTeacher(user.teacher.id);
  }

  @Get('assigned')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STUDENT)
  getAssignedQuizzes(@CurrentUser() user: User) {
    return this.quizzesService.getAssignedQuizzes(user.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.quizzesService.findOne(id);
  }

  @Post(':id/assign')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER)
  assignQuiz(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignQuizDto: AssignQuizDto,
    @CurrentUser() user: User,
  ) {
    assignQuizDto.quizId = id;
    return this.quizzesService.assignQuiz(assignQuizDto, user);
  }

  @Post('assignments/:assignmentId/attempt')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STUDENT)
  startAttempt(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @CurrentUser() user: User,
  ) {
    return this.quizzesService.startQuizAttempt(assignmentId, user);
  }

  @Post('attempts/:attemptId/submit')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STUDENT)
  submitQuiz(
    @Param('attemptId', ParseIntPipe) attemptId: number,
    @Body() submitQuizDto: SubmitQuizDto,
    @CurrentUser() user: User,
  ) {
    return this.quizzesService.submitQuiz(attemptId, submitQuizDto, user);
  }

  @Patch('attempts/:attemptId/grade')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER)
  gradeManualQuestions(
    @Param('attemptId', ParseIntPipe) attemptId: number,
    @Body('grades') grades: Record<number, number>,
    @CurrentUser() user: User,
  ) {
    return this.quizzesService.gradeManualQuestions(attemptId, grades, user);
  }

  @Get(':id/results')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER)
  getQuizResults(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.quizzesService.getQuizResults(id, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.quizzesService.delete(id, user);
  }
}
