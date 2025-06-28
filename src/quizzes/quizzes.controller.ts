import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
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
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async create(
    @Body() createQuizDto: CreateQuizDto,
    @CurrentUser() user: User,
  ) {
    console.log('Creating quiz with data:', {
      title: createQuizDto.title,
      description: createQuizDto.description,
      questionCount: createQuizDto.questions?.length || 0,
      questions: createQuizDto.questions?.map((q) => ({
        type: q.questionType,
        text: q.question.substring(0, 50),
        marks: q.marks,
      })),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });

    const quiz = await this.quizzesService.create(createQuizDto, user);

    console.log('Quiz created:', {
      id: quiz.id,
      title: quiz.title,
      status: quiz.status,
      questionCount: quiz.questions?.length || 0,
      totalMarks:
        quiz.questions?.reduce((sum, q) => sum + (q.marks || 0), 0) || 0,
    });

    return quiz;
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAll(@Query() paginationDto: PaginationDto) {
    try {
      console.log(
        'GET /quizzes - Finding all quizzes with pagination:',
        JSON.stringify(paginationDto, null, 2),
      );

      const result = await this.quizzesService.findAll(
        paginationDto.page,
        paginationDto.limit,
      );

      const summary = {
        total: result.total,
        pageCount: result.totalPages,
        currentPage: result.page,
        quizzesInPage: result.data.length,
        status: 'success',
      };

      console.log('Quizzes found:', JSON.stringify(summary, null, 2));
      return result;
    } catch (error) {
      console.error('Error finding quizzes:', error);
      throw error;
    }
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

  @Get('my-attempts')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STUDENT)
  getMyAttempts(@CurrentUser() user: User) {
    return this.quizzesService.getStudentAttempts(user.id);
  }

  @Get('debug/my-attempts')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STUDENT)
  async debugMyAttempts(@CurrentUser() user: User) {
    return this.quizzesService.debugGetStudentAttempts(user.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.quizzesService.findOne(id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateQuizDto: CreateQuizDto,
    @CurrentUser() user: User,
  ) {
    return this.quizzesService.update(id, updateQuizDto, user);
  }

  @Get(':id/assignments')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  getQuizAssignments(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.quizzesService.getQuizAssignments(id, user);
  }

  @Post(':id/assign')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  assignQuiz(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignQuizDto: AssignQuizDto,
    @CurrentUser() user: User,
  ) {
    assignQuizDto.quizId = id;
    return this.quizzesService.assignQuiz(assignQuizDto, user);
  }

  @Delete(':id/assignments/:studentId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  removeQuizAssignment(
    @Param('id', ParseIntPipe) id: number,
    @Param('studentId', ParseIntPipe) studentId: number,
    @CurrentUser() user: User,
  ) {
    return this.quizzesService.removeQuizAssignment(id, studentId, user);
  }

  // Temporary endpoint for testing - reset assignment attempts
  @Patch('assignments/:assignmentId/reset-attempts')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  resetAttempts(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @CurrentUser() user: User,
  ) {
    return this.quizzesService.resetQuizAttempts(assignmentId, user);
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

  @Get('attempts/:attemptId/details')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STUDENT)
  getAttemptDetails(
    @Param('attemptId', ParseIntPipe) attemptId: number,
    @CurrentUser() user: User,
  ) {
    return this.quizzesService.getAttemptDetails(attemptId, user);
  }

  @Get('assignments/:assignmentId/result')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STUDENT)
  getAssignmentResult(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @CurrentUser() user: User,
  ) {
    return this.quizzesService.getAssignmentResult(assignmentId, user);
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
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  gradeManualQuestions(
    @Param('attemptId', ParseIntPipe) attemptId: number,
    @Body('grades') grades: Record<number, number>,
    @CurrentUser() user: User,
  ) {
    return this.quizzesService.gradeManualQuestions(attemptId, grades, user);
  }

  @Get(':id/results')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  getQuizResults(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.quizzesService.getQuizResults(id, user);
  }

  @Patch(':id/publish')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  publishQuiz(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.quizzesService.publishQuiz(id, user);
  }

  @Patch(':id/unpublish')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  unpublishQuiz(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.quizzesService.unpublishQuiz(id, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.quizzesService.delete(id, user);
  }
}
