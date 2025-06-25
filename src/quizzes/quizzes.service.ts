// src/quizzes/quizzes.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Quiz } from './entities/quiz.entity';
import { QuizQuestion } from './entities/quiz-question.entity';
import { QuizAssignment, AssignmentStatus } from './entities/quiz-assignment.entity';
import { QuizAttempt } from './entities/quiz-attempt.entity';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { AssignQuizDto } from './dto/assign-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { TeachersService } from '../teachers/teachers.service';
import { StudentsService } from '../students/students.service';

@Injectable()
export class QuizzesService {
  constructor(
    @InjectRepository(Quiz)
    private quizRepository: Repository<Quiz>,
    @InjectRepository(QuizQuestion)
    private quizQuestionRepository: Repository<QuizQuestion>,
    @InjectRepository(QuizAssignment)
    private quizAssignmentRepository: Repository<QuizAssignment>,
    @InjectRepository(QuizAttempt)
    private quizAttemptRepository: Repository<QuizAttempt>,
    private teachersService: TeachersService,
    private studentsService: StudentsService,
  ) {}

  async create(createQuizDto: CreateQuizDto, user: User): Promise<Quiz> {
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException('Only teachers can create quizzes');
    }

    const teacher = await this.teachersService.findByUserId(user.id);
    const { questions, ...quizData } = createQuizDto;

    // Calculate total marks
    const totalMarks = questions.reduce(
      (sum, question) => sum + question.marks,
      0,
    );

    const quiz = this.quizRepository.create({
      ...quizData,
      teacherId: teacher.id,
      totalMarks,
    });

    const savedQuiz = await this.quizRepository.save(quiz) as Quiz;

    // Create questions
    const quizQuestions = questions.map((question, index) =>
      this.quizQuestionRepository.create({
        ...question,
        quizId: savedQuiz.id,
        orderIndex: index,
      } as any),
    );

    await this.quizQuestionRepository.save(quizQuestions as any);

    return this.findOne(savedQuiz.id);
  }

  async findAll(page: number = 1, limit: number = 10) {
    const [quizzes, total] = await this.quizRepository.findAndCount({
      where: { isActive: true },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      quizzes,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByTeacher(teacherId: number) {
    return this.quizRepository.find({
      where: { teacherId },
      relations: ['questions'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Quiz> {
    const quiz = await this.quizRepository.findOne({
      where: { id },
      relations: ['teacher', 'teacher.user', 'questions'],
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // Sort questions by order
    quiz.questions.sort((a, b) => a.orderIndex - b.orderIndex);

    return quiz;
  }

  async assignQuiz(
    assignQuizDto: AssignQuizDto,
    user: User,
  ): Promise<QuizAssignment[]> {
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException('Only teachers can assign quizzes');
    }

    const { quizId, studentIds, dueDate } = assignQuizDto;
    const teacher = await this.teachersService.findByUserId(user.id);

    // Verify quiz exists and belongs to teacher
    const quiz = await this.quizRepository.findOne({
      where: { id: quizId, teacherId: teacher.id },
    });

    if (!quiz) {
      throw new NotFoundException(
        'Quiz not found or you do not have permission',
      );
    }

    // Create assignments for each student
    const assignments = studentIds.map((studentId) =>
      this.quizAssignmentRepository.create({
        quizId,
        studentId,
        assignedBy: teacher.id,
        dueDate: dueDate ? new Date(dueDate) : null,
      } as any),
    );

    return this.quizAssignmentRepository.save(assignments as any);
  }

  async getAssignedQuizzes(userId: number): Promise<QuizAssignment[]> {
    const student = await this.studentsService.findByUserId(userId);

    return this.quizAssignmentRepository.find({
      where: { studentId: student.id },
      relations: ['quiz', 'quiz.teacher', 'quiz.teacher.user', 'attempts'],
      order: { assignedAt: 'DESC' },
    });
  }

  async startQuizAttempt(
    assignmentId: number,
    user: User,
  ): Promise<QuizAttempt> {
    const student = await this.studentsService.findByUserId(user.id);

    const assignment = await this.quizAssignmentRepository.findOne({
      where: { id: assignmentId, studentId: student.id },
      relations: ['quiz', 'quiz.questions'],
    });

    if (!assignment) {
      throw new NotFoundException('Quiz assignment not found');
    }

    // Check if already attempted
    const existingAttempt = await this.quizAttemptRepository.findOne({
      where: { assignmentId },
    });

    if (existingAttempt) {
      throw new BadRequestException('Quiz has already been attempted');
    }

    // Check due date
    if (assignment.dueDate && new Date() > assignment.dueDate) {
      throw new BadRequestException('Quiz submission deadline has passed');
    }

    const attempt = this.quizAttemptRepository.create({
      assignmentId,
      studentId: student.id,
      maxScore: assignment.quiz.totalMarks,
    });

    // Update assignment status
    assignment.status = AssignmentStatus.IN_PROGRESS;
    await this.quizAssignmentRepository.save(assignment);

    return this.quizAttemptRepository.save(attempt) as any;
  }

  async submitQuiz(
    attemptId: number,
    submitQuizDto: SubmitQuizDto,
    user: User,
  ): Promise<QuizAttempt> {
    const student = await this.studentsService.findByUserId(user.id);

    const attempt = await this.quizAttemptRepository.findOne({
      where: { id: attemptId },
      relations: ['assignment', 'assignment.quiz', 'assignment.quiz.questions'],
    });

    if (!attempt) {
      throw new NotFoundException('Quiz attempt not found');
    }

    if (attempt.submittedAt) {
      throw new BadRequestException('Quiz has already been submitted');
    }

    const { answers } = submitQuizDto;
    const quiz = attempt.assignment.quiz;

    // Calculate score
    let score = 0;
    const gradedAnswers = {};

    quiz.questions.forEach((question) => {
      const studentAnswer = answers[question.id];
      gradedAnswers[question.id] = {
        studentAnswer,
        correctAnswer: question.correctAnswer,
        marks: 0,
      };

      if (
        question.questionType === 'multiple_choice' ||
        question.questionType === 'true_false'
      ) {
        if (studentAnswer === question.correctAnswer) {
          gradedAnswers[question.id].marks = question.marks;
          score += question.marks;
        }
      }
      // For essay and short_answer questions, manual grading is required
    });

    // Calculate time taken
    const timeTaken = Math.floor(
      (new Date().getTime() - attempt.startedAt.getTime()) / (1000 * 60),
    );

    // Update attempt
    attempt.submittedAt = new Date();
    attempt.answers = gradedAnswers;
    attempt.score = score;
    attempt.timeTaken = timeTaken;

    // Update assignment status
    attempt.assignment.status = AssignmentStatus.COMPLETED;
    await this.quizAssignmentRepository.save(attempt.assignment);

    return this.quizAttemptRepository.save(attempt) as any;
  }

  async gradeManualQuestions(
    attemptId: number,
    grades: Record<number, number>,
    user: User,
  ): Promise<QuizAttempt> {
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException('Only teachers can grade quizzes');
    }

    const attempt = await this.quizAttemptRepository.findOne({
      where: { id: attemptId },
      relations: [
        'assignment',
        'assignment.quiz',
        'assignment.quiz.questions',
        'assignment.quiz.teacher',
      ],
    });

    if (!attempt) {
      throw new NotFoundException('Quiz attempt not found');
    }

    const teacher = await this.teachersService.findByUserId(user.id);
    if (attempt.assignment.quiz.teacherId !== teacher.id) {
      throw new ForbiddenException('You can only grade your own quizzes');
    }

    // Update manual grades
    const updatedAnswers = { ...attempt.answers };
    let additionalScore = 0;

    Object.entries(grades).forEach(([questionId, marks]) => {
      if (updatedAnswers[questionId]) {
        const oldMarks = updatedAnswers[questionId].marks || 0;
        updatedAnswers[questionId].marks = marks;
        additionalScore += marks - oldMarks;
      }
    });

    attempt.answers = updatedAnswers;
    attempt.score = (attempt.score || 0) + additionalScore;

    // Update assignment status
    attempt.assignment.status = AssignmentStatus.COMPLETED;
    await this.quizAssignmentRepository.save(attempt.assignment);

    return this.quizAttemptRepository.save(attempt) as any;
  }

  async getQuizResults(quizId: number, user: User) {
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException('Only teachers can view quiz results');
    }

    const teacher = await this.teachersService.findByUserId(user.id);
    const quiz = await this.quizRepository.findOne({
      where: { id: quizId, teacherId: teacher.id },
    });

    if (!quiz) {
      throw new NotFoundException(
        'Quiz not found or you do not have permission',
      );
    }

    const assignments = await this.quizAssignmentRepository.find({
      where: { quizId },
      relations: ['student', 'student.user', 'attempts'],
      order: { assignedAt: 'DESC' },
    });

    return assignments.map((assignment) => ({
      studentId: assignment.studentId,
      studentName: `${assignment.student.user.firstName} ${assignment.student.user.lastName}`,
      assignedAt: assignment.assignedAt,
      dueDate: assignment.dueDate,
      status: assignment.status,
      attempt: assignment.attempts[0] || null,
    }));
  }

  async delete(id: number, user: User): Promise<void> {
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException('Only teachers can delete quizzes');
    }

    const teacher = await this.teachersService.findByUserId(user.id);
    const quiz = await this.quizRepository.findOne({
      where: { id, teacherId: teacher.id },
    });

    if (!quiz) {
      throw new NotFoundException(
        'Quiz not found or you do not have permission',
      );
    }

    quiz.isActive = false;
    await this.quizRepository.save(quiz);
  }
}
