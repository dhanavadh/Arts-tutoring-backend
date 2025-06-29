// src/quizzes/quizzes.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Quiz } from './entities/quiz.entity';
import { QuizQuestion } from './entities/quiz-question.entity';
import { QuestionType } from './entities/question-type.enum';
import {
  QuizAssignment,
  AssignmentStatus,
} from './entities/quiz-assignment.entity';
import { QuizAttempt, AttemptStatus } from './entities/quiz-attempt.entity';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { AssignQuizDto } from './dto/assign-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { TeachersService } from '../teachers/teachers.service';
import { StudentsService } from '../students/students.service';
import { Student } from '../students/entities/student.entity';
import { DatabaseHealthService } from '../common/database-health.service';

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
    private databaseHealthService: DatabaseHealthService,
  ) {}

  async create(createQuizDto: CreateQuizDto, user: User): Promise<Quiz> {
    if (user.role !== UserRole.TEACHER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only teachers and admins can create quizzes',
      );
    }

    let teacherId: number | null;

    if (user.role === UserRole.TEACHER) {
      const teacher = await this.teachersService.findByUserId(user.id);
      teacherId = teacher.id;
    } else {
      teacherId = null;
    }

    const { questions, ...quizData } = createQuizDto;

    // Ensure maxAttempts is null if not provided (unlimited attempts)
    if (!('maxAttempts' in quizData)) {
      quizData.maxAttempts = null;
    }

    console.log('Creating quiz with data:', {
      ...quizData,
      teacherId,
      questionCount: questions?.length || 0,
    });

    // Calculate total marks
    const totalMarks = questions.reduce(
      (sum, question) => sum + (question.marks || 0),
      0,
    );

    // Create and save the quiz first
    const quiz = this.quizRepository.create({
      ...quizData,
      teacherId,
      createdBy: user.id,
      totalMarks,
      status: quizData.status || 'draft',
      isActive: true,
    });

    let savedQuiz: Quiz;
    try {
      savedQuiz = await this.quizRepository.save(quiz);
      console.log('Quiz saved successfully:', {
        id: savedQuiz.id,
        title: savedQuiz.title,
        status: savedQuiz.status,
        teacherId: savedQuiz.teacherId,
        totalMarks: savedQuiz.totalMarks,
      });
    } catch (error) {
      console.error('Error saving quiz:', error);
      throw new BadRequestException(`Failed to save quiz: ${error.message}`);
    }

    // Create and save questions if provided
    if (questions?.length > 0) {
      console.log(
        `Creating ${questions.length} questions for quiz ${savedQuiz.id}`,
      );

      const quizQuestions = questions.map((question, index) => {
        // Validate required fields
        if (!question.question?.trim()) {
          throw new BadRequestException(
            `Question ${index + 1} is missing question text`,
          );
        }

        // Validate question type
        if (
          !Object.values(QuestionType).includes(
            question.questionType as QuestionType,
          )
        ) {
          throw new BadRequestException(
            `Question ${index + 1} has invalid question type. Must be one of: ${Object.values(QuestionType).join(', ')}`,
          );
        }

        // Validate correct answer for MC and T/F questions
        if (
          [QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE].includes(
            question.questionType as QuestionType,
          ) &&
          !question.correctAnswer?.trim()
        ) {
          throw new BadRequestException(
            `Question ${index + 1} must have a correct answer for ${question.questionType} questions`,
          );
        }

        if (!question.marks || question.marks <= 0) {
          throw new BadRequestException(
            `Question ${index + 1} must have marks greater than 0`,
          );
        }

        const questionEntity = this.quizQuestionRepository.create({
          quiz: savedQuiz, // Set the quiz relationship
          question: question.question.trim(),
          questionType: question.questionType as QuestionType,
          options: question.options || [],
          correctAnswer: question.correctAnswer?.trim(),
          correctAnswerExplanation: question.correctAnswerExplanation?.trim(),
          marks: question.marks,
          orderIndex: index,
        });

        return questionEntity;
      });

      try {
        const savedQuestions =
          await this.quizQuestionRepository.save(quizQuestions);
        console.log('Questions saved successfully:', {
          count: savedQuestions.length,
          ids: savedQuestions.map((q) => q.id),
          totalMarks: savedQuestions.reduce((sum, q) => sum + q.marks, 0),
        });

        // Update quiz total marks in case it changed during question creation
        const actualTotalMarks = savedQuestions.reduce(
          (sum, q) => sum + q.marks,
          0,
        );
        if (actualTotalMarks !== savedQuiz.totalMarks) {
          console.log(
            `Updating quiz total marks from ${savedQuiz.totalMarks} to ${actualTotalMarks}`,
          );
          await this.quizRepository.update(savedQuiz.id, {
            totalMarks: actualTotalMarks,
          });
        }
      } catch (error: unknown) {
        const err = error as Error;
        console.error('Error saving questions:', {
          error: err.name,
          message: err.message,
          stack: err.stack,
        });
        // Delete the quiz since question creation failed
        await this.quizRepository.delete(savedQuiz.id);
        throw new BadRequestException(
          `Failed to save questions: ${err.message}`,
        );
      }
    }

    // Return the complete quiz with questions
    return this.findOne(savedQuiz.id);
  }

  async findAll(page: number = 1, limit: number = 10) {
    console.log('Finding all active quizzes with pagination:', { page, limit });

    const [quizzes, total] = await this.quizRepository
      .createQueryBuilder('quiz')
      .where('quiz.isActive = :isActive', { isActive: true })
      .leftJoinAndSelect('quiz.creator', 'creator')
      .leftJoinAndSelect('quiz.teacher', 'teacher')
      .leftJoinAndSelect('teacher.user', 'teacherUser')
      .leftJoinAndSelect('quiz.questions', 'questions')
      .leftJoinAndSelect('quiz.assignments', 'assignments')
      .leftJoinAndSelect('assignments.student', 'student')
      .leftJoinAndSelect('student.user', 'studentUser')
      .orderBy('quiz.createdAt', 'DESC')
      .addOrderBy('questions.orderIndex', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    console.log('Found quizzes:', {
      total,
      withQuestions: quizzes.filter((q) => q.questions?.length > 0).length,
      withAssignments: quizzes.filter((q) => q.assignments?.length > 0).length,
      quizzes: quizzes.map((q) => ({
        id: q.id,
        title: q.title,
        status: q.status,
        questionCount: q.questions?.length || 0,
        totalMarks:
          q.questions?.reduce(
            (sum, question) => sum + (question.marks || 0),
            0,
          ) || 0,
        assignmentCount: q.assignments?.length || 0,
      })),
    });

    return {
      data: quizzes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByTeacher(teacherId: number) {
    return this.quizRepository.find({
      where: { teacherId, isActive: true },
      relations: ['questions'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Quiz> {
    console.log('Finding quiz with ID:', id);

    // Use database health service for critical quiz lookup with retry
    const quiz = await this.databaseHealthService.executeWithRetry(async () => {
      return this.quizRepository
        .createQueryBuilder('quiz')
        .leftJoinAndSelect('quiz.questions', 'questions')
        .leftJoinAndSelect('quiz.assignments', 'assignments')
        .leftJoinAndSelect('assignments.student', 'student')
        .leftJoinAndSelect('student.user', 'studentUser')
        .leftJoinAndSelect('quiz.creator', 'creator')
        .leftJoinAndSelect('quiz.teacher', 'teacher')
        .leftJoinAndSelect('teacher.user', 'teacherUser')
        .where('quiz.id = :id', { id })
        .andWhere('quiz.isActive = :isActive', { isActive: true })
        .orderBy('questions.orderIndex', 'ASC')
        .getOne();
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // Debug logging
    console.log('Quiz found:', {
      id: quiz.id,
      title: quiz.title,
      questionCount: quiz.questions?.length || 0,
      totalMarks: quiz.totalMarks,
      assignmentCount: quiz.assignments?.length || 0,
      teacherId: quiz.teacherId,
      status: quiz.status,
      isActive: quiz.isActive,
    });

    if (quiz.questions?.length > 0) {
      console.log(
        'Quiz questions:',
        quiz.questions.map((q) => ({
          id: q.id,
          text: q.question.substring(0, 30) + '...',
          type: q.questionType,
          marks: q.marks,
          orderIndex: q.orderIndex,
        })),
      );
    } else {
      console.log('Quiz has no questions');
    }

    if (quiz.assignments?.length > 0) {
      console.log(
        'Quiz assignments:',
        quiz.assignments.map((a) => ({
          id: a.id,
          studentId: a.student?.id,
          studentName: a.student?.user
            ? `${a.student.user.firstName} ${a.student.user.lastName}`
            : 'Unknown',
          status: a.status,
          dueDate: a.dueDate,
        })),
      );
    } else {
      console.log('Quiz has no assignments');
    }

    return quiz;
  }

  async update(
    id: number,
    updateQuizDto: CreateQuizDto,
    user: User,
  ): Promise<Quiz> {
    // Find the existing quiz
    const existingQuiz = await this.quizRepository.findOne({
      where: { id },
      relations: ['questions'],
    });

    if (!existingQuiz) {
      throw new NotFoundException('Quiz not found');
    }

    // Check permissions - only quiz owner can update
    if (user.role === UserRole.TEACHER) {
      const teacher = await this.teachersService.findByUserId(user.id);
      if (existingQuiz.teacherId !== teacher.id) {
        throw new ForbiddenException('You can only update your own quizzes');
      }
    } else if (user.role === UserRole.ADMIN) {
      // Admins can only edit quizzes they created themselves
      if (existingQuiz.createdBy !== user.id) {
        throw new ForbiddenException('You can only update quizzes you created');
      }
    } else {
      throw new ForbiddenException(
        'Only teachers and admins can update quizzes',
      );
    }

    const { questions, ...quizData } = updateQuizDto;

    // Ensure maxAttempts is null if not provided (unlimited attempts)
    if (!('maxAttempts' in quizData)) {
      quizData.maxAttempts = null;
    }

    // Calculate total marks
    const totalMarks = questions.reduce(
      (sum, question) => sum + question.marks,
      0,
    );

    // Update quiz data
    await this.quizRepository.update(id, {
      ...quizData,
      totalMarks,
    });

    // Delete existing questions
    await this.quizQuestionRepository.delete({ quizId: id });

    // Create new questions
    console.log('Creating updated questions for quiz:', id);
    console.log('Questions to create:', questions);

    const quizQuestions = questions.map((question, index) => {
      const questionData = {
        question: question.question,
        questionType: question.questionType,
        options: question.options || undefined,
        correctAnswer: question.correctAnswer
          ? question.correctAnswer.trim()
          : undefined,
        correctAnswerExplanation:
          question.correctAnswerExplanation || undefined,
        marks: question.marks,
        quizId: id,
        orderIndex: index,
      };
      console.log(`Creating updated question ${index + 1}:`, questionData);
      return this.quizQuestionRepository.create(questionData);
    });

    console.log('Saving updated questions:', quizQuestions.length);
    const savedQuestions =
      await this.quizQuestionRepository.save(quizQuestions);
    console.log('Updated questions saved successfully:', savedQuestions.length);

    return this.findOne(id);
  }

  async assignQuiz(
    assignQuizDto: AssignQuizDto,
    user: User,
  ): Promise<QuizAssignment[]> {
    console.log('Assigning quiz:', assignQuizDto);

    if (user.role !== UserRole.TEACHER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only teachers and admins can assign quizzes',
      );
    }

    const { quizId, studentIds, dueDate } = assignQuizDto;

    // Verify that the quiz exists and is active (can be draft or published for assignment)
    const quiz = await this.quizRepository.findOne({
      where: {
        id: quizId,
        isActive: true,
        status: In(['draft', 'published']), // Allow assignment to draft and published quizzes
      },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found or not active');
    }

    // Get teacher ID and teacher entity
    let teacherId: number;
    let assigningTeacher: any = null;
    if (user.role === UserRole.TEACHER) {
      const teacher = await this.teachersService.findByUserId(user.id);
      teacherId = teacher.id;
      assigningTeacher = teacher;
    } else {
      // For admin, use the quiz's teacher ID or assign to a default teacher
      teacherId = quiz.teacherId || 1;
      if (quiz.teacherId) {
        try {
          assigningTeacher = await this.teachersService.findById(
            quiz.teacherId,
          );
        } catch (error) {
          console.warn('Could not find teacher for admin assignment:', error);
        }
      }
    }

    // Verify that each student exists
    const foundStudents = await Promise.all(
      studentIds.map(async (id) => {
        try {
          return await this.studentsService.findById(id);
        } catch (error) {
          console.error(`Student with ID ${id} not found:`, error);
          return null;
        }
      }),
    );

    // Filter out any null results from student lookups
    let validStudents = foundStudents.filter(
      (student): student is Student => student !== null,
    );

    if (validStudents.length !== studentIds.length) {
      const foundIds = validStudents.map((s) => s.id);
      const missingIds = studentIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Students not found: ${missingIds.join(', ')}`,
      );
    }

    console.log(
      'Creating assignments for students:',
      validStudents.map((s) => s.id),
    );

    // Check for existing assignments
    const existingAssignments = await this.quizAssignmentRepository.find({
      where: {
        quizId,
        studentId: In(validStudents.map((s) => s.id)),
      },
    });

    if (existingAssignments.length > 0) {
      const existingStudentIds = existingAssignments.map((a) => a.studentId);
      console.log(
        'Found existing assignments for students:',
        existingStudentIds,
      );
      // Filter out students that already have assignments
      validStudents = validStudents.filter(
        (s) => !existingStudentIds.includes(s.id),
      );

      if (validStudents.length === 0) {
        throw new BadRequestException(
          'All selected students already have assignments for this quiz',
        );
      }
    }

    // Create new assignments
    const assignments = validStudents.map((student) => {
      const assignment = this.quizAssignmentRepository.create({
        quiz, // Set the full quiz entity
        quizId,
        student, // Set the full student entity
        studentId: student.id,
        assignedBy: teacherId,
        assignedAt: new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
        status: AssignmentStatus.ASSIGNED,
      });
      console.log('Created assignment:', {
        id: assignment.id,
        quizId: assignment.quizId,
        studentId: assignment.studentId,
        assignedBy: assignment.assignedBy,
        status: assignment.status,
      });
      return assignment;
    });

    try {
      console.log(
        'Saving assignments for students:',
        validStudents.map((s) => s.id),
      );
      const savedAssignments =
        await this.quizAssignmentRepository.save(assignments);
      console.log('Saved assignments:', savedAssignments.length);

      // Load full assignment data with relationships
      const fullAssignments = await this.quizAssignmentRepository
        .createQueryBuilder('assignment')
        .leftJoinAndSelect('assignment.quiz', 'quiz')
        .leftJoinAndSelect('quiz.questions', 'questions')
        .leftJoinAndSelect('assignment.student', 'student')
        .leftJoinAndSelect('student.user', 'studentUser')
        .where('assignment.id IN (:...ids)', {
          ids: savedAssignments.map((a) => a.id),
        })
        .orderBy('assignment.assignedAt', 'DESC')
        .addOrderBy('questions.orderIndex', 'ASC')
        .getMany();

      console.log('Retrieved full assignments:', {
        count: fullAssignments.length,
        assignments: fullAssignments.map((a) => ({
          id: a.id,
          quizId: a.quizId,
          studentId: a.studentId,
          status: a.status,
          questionCount: a.quiz?.questions?.length || 0,
        })),
      });

      return fullAssignments;
    } catch (error) {
      console.error('Error saving assignments:', error);
      throw new BadRequestException(
        `Failed to save assignments: ${error.message}`,
      );
    }
  }

  async getQuizAssignments(quizId: number, user: User): Promise<any[]> {
    if (user.role !== UserRole.TEACHER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only teachers and admins can view quiz assignments',
      );
    }

    let quiz;
    if (user.role === UserRole.TEACHER) {
      const teacher = await this.teachersService.findByUserId(user.id);
      quiz = await this.quizRepository.findOne({
        where: { id: quizId, teacherId: teacher.id },
      });
    } else {
      quiz = await this.quizRepository.findOne({
        where: { id: quizId },
      });
    }

    if (!quiz) {
      throw new NotFoundException(
        'Quiz not found or you do not have permission',
      );
    }

    const assignments = await this.quizAssignmentRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.student', 'student')
      .leftJoinAndSelect('student.user', 'studentUser')
      .where('assignment.quizId = :quizId', { quizId })
      .getMany();

    return assignments
      .filter((assignment) => assignment.student && assignment.student.user) // Filter out assignments with missing student data
      .map((assignment) => ({
        id: assignment.id,
        studentId: assignment.studentId,
        student: {
          id: assignment.student.id,
          user: {
            firstName: assignment.student.user.firstName,
            lastName: assignment.student.user.lastName,
            email: assignment.student.user.email,
            profileImage: assignment.student.user.profileImage,
          },
          schoolGrade: assignment.student.schoolGrade,
          level: assignment.student.level,
        },
        assignedAt: assignment.assignedAt,
        assignedBy: assignment.assignedBy,
        assignedByTeacher: null, // We'll fetch this separately if needed
        dueDate: assignment.dueDate,
        status: assignment.status,
      }));
  }

  async removeQuizAssignment(
    quizId: number,
    studentId: number,
    user: User,
  ): Promise<{ message: string }> {
    if (user.role !== UserRole.TEACHER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only teachers and admins can remove quiz assignments',
      );
    }

    let quiz;
    if (user.role === UserRole.TEACHER) {
      const teacher = await this.teachersService.findByUserId(user.id);
      quiz = await this.quizRepository.findOne({
        where: { id: quizId, teacherId: teacher.id },
      });
    } else {
      quiz = await this.quizRepository.findOne({
        where: { id: quizId },
      });
    }

    if (!quiz) {
      throw new NotFoundException(
        'Quiz not found or you do not have permission',
      );
    }

    const assignment = await this.quizAssignmentRepository.findOne({
      where: { quizId, studentId },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    // Check if student has already attempted the quiz
    if (assignment.attempts > 0) {
      throw new BadRequestException(
        'Cannot remove assignment - student has already attempted the quiz',
      );
    }

    await this.quizAssignmentRepository.delete({ quizId, studentId });

    // Check if this was the last assigned student
    const remainingAssignments = await this.quizAssignmentRepository.count({
      where: { quizId },
    });

    // If no students remain and quiz is published, automatically unpublish it
    if (
      remainingAssignments === 0 &&
      quiz &&
      'status' in quiz &&
      (quiz as any).status === 'published'
    ) {
      await this.quizRepository.update(quizId, { status: 'draft' });
      console.log(
        `Quiz ${quizId} automatically unpublished - no students remaining`,
      );

      return {
        message:
          'Assignment removed successfully. Quiz has been automatically unpublished since no students remain assigned.',
      };
    }

    return { message: 'Assignment removed successfully' };
  }

  async getAssignedQuizzes(userId: number): Promise<QuizAssignment[]> {
    console.log('Getting assigned quizzes for user:', userId);

    const student = await this.studentsService.findByUserId(userId);
    console.log('Found student with ID:', student?.id);

    if (!student) {
      console.log('No student record found for user:', userId);
      return [];
    }

    // Use query builder for more complex joins and conditions
    const assignments = await this.quizAssignmentRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.quiz', 'quiz')
      .leftJoinAndSelect('quiz.questions', 'questions')
      .leftJoinAndSelect('quiz.teacher', 'teacher')
      .leftJoinAndSelect('teacher.user', 'teacherUser')
      .where('assignment.studentId = :studentId', { studentId: student.id })
      .andWhere('quiz.isActive = :isActive', { isActive: true })
      .andWhere('quiz.status = :status', { status: 'published' })
      .orderBy('assignment.assignedAt', 'DESC')
      .getMany();

    console.log('Found assignments:', {
      total: assignments.length,
      withQuiz: assignments.filter((a) => a.quiz).length,
      withQuestions: assignments.filter((a) => a.quiz?.questions?.length > 0)
        .length,
      byStatus: assignments.reduce(
        (acc, a) => {
          acc[a.status] = (acc[a.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    });

    // Filter and map assignments to include only valid ones with questions
    const validAssignments = assignments.filter((assignment) => {
      const isValid =
        assignment.quiz &&
        assignment.quiz.isActive &&
        assignment.quiz.status === 'published' &&
        assignment.quiz.questions?.length > 0;

      if (!isValid) {
        console.log('Filtering out invalid assignment:', {
          id: assignment.id,
          quizId: assignment.quizId,
          hasQuiz: !!assignment.quiz,
          quizActive: assignment.quiz?.isActive,
          quizStatus: assignment.quiz?.status,
          questionCount: assignment.quiz?.questions?.length || 0,
          studentId: assignment.studentId,
        });
      }

      return isValid;
    });

    console.log('Returning valid assignments:', validAssignments.length);
    return validAssignments;
  }

  async resetQuizAttempts(assignmentId: number, user: User) {
    // Find the assignment
    const assignment = await this.quizAssignmentRepository.findOne({
      where: { id: assignmentId },
      relations: ['quiz'],
    });

    if (!assignment) {
      throw new NotFoundException('Quiz assignment not found');
    }

    // Reset attempts count to 0
    assignment.attempts = 0;
    assignment.status = AssignmentStatus.ASSIGNED;

    // Delete any existing quiz attempts for this assignment
    await this.quizAttemptRepository.delete({
      assignmentId: assignmentId,
    });

    await this.quizAssignmentRepository.save(assignment);

    return { message: 'Quiz attempts reset successfully', attempts: 0 };
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

    // Students can only take published quizzes
    if (assignment.quiz.status !== 'published') {
      throw new BadRequestException(
        'This quiz is not yet published and cannot be taken',
      );
    }

    // Check if already attempted the maximum number of times (only if maxAttempts is set)
    if (
      assignment.quiz.maxAttempts &&
      assignment.attempts >= assignment.quiz.maxAttempts
    ) {
      throw new BadRequestException(
        `You have reached the maximum number of attempts (${assignment.quiz.maxAttempts}) for this quiz`,
      );
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

    // Update assignment status and increment attempts
    assignment.status = AssignmentStatus.IN_PROGRESS;
    assignment.attempts += 1;
    await this.quizAssignmentRepository.save(assignment);

    const savedAttempt = await this.quizAttemptRepository.save(attempt);

    // Return the attempt with full quiz assignment and quiz data
    return this.quizAttemptRepository.findOne({
      where: { id: savedAttempt.id },
      relations: [
        'quizAssignment',
        'quizAssignment.quiz',
        'quizAssignment.quiz.questions',
        'quizAssignment.student',
        'quizAssignment.student.user',
      ],
    }) as any;
  }

  async submitQuiz(
    attemptId: number,
    submitQuizDto: SubmitQuizDto,
    user: User,
  ): Promise<QuizAttempt> {
    const student = await this.studentsService.findByUserId(user.id);

    const attempt = await this.quizAttemptRepository.findOne({
      where: { id: attemptId },
      relations: [
        'quizAssignment',
        'quizAssignment.quiz',
        'quizAssignment.quiz.questions',
      ],
    });

    if (!attempt) {
      throw new NotFoundException('Quiz attempt not found');
    }

    if (attempt.submittedAt) {
      throw new BadRequestException('Quiz has already been submitted');
    }

    const { answers } = submitQuizDto;
    const quiz = attempt.quizAssignment.quiz;

    // Calculate score
    let score = 0;
    const gradedAnswers = {};

    console.log('Processing answers for quiz submission:');
    console.log('- Submit data answers:', answers);
    console.log('- Quiz questions count:', quiz.questions.length);

    quiz.questions.forEach((question) => {
      const studentAnswer = answers[question.id];
      console.log(`Question ${question.id}:`, {
        questionType: question.questionType,
        studentAnswer,
        correctAnswer: question.correctAnswer,
        marks: question.marks,
      });

      gradedAnswers[question.id] = {
        studentAnswer,
        correctAnswer: question.correctAnswer,
        marks: 0,
      };

      if (
        question.questionType === QuestionType.MULTIPLE_CHOICE ||
        question.questionType === QuestionType.TRUE_FALSE
      ) {
        console.log(
          `Auto-grading question ${question.id} (${question.questionType})`,
        );
        if (studentAnswer === question.correctAnswer) {
          gradedAnswers[question.id].marks = question.marks;
          score += question.marks;
          console.log(`✓ Correct! Awarded ${question.marks} points`);
        } else {
          console.log(
            `✗ Incorrect. Student: ${studentAnswer}, Correct: ${question.correctAnswer}`,
          );
        }
      } else {
        console.log(
          `Manual grading required for question ${question.id} (${question.questionType})`,
        );
      }
      // For essay and short_answer questions, manual grading is required
    });

    console.log('Final graded answers:', gradedAnswers);
    console.log('Total score:', score);

    // Calculate time taken
    let timeTaken = Math.floor(
      (new Date().getTime() - attempt.startedAt.getTime()) / (1000 * 60),
    );
    if (!Number.isFinite(timeTaken) || isNaN(timeTaken)) {
      timeTaken = 0;
    }

    // Update attempt
    attempt.submittedAt = new Date();
    attempt.answers = gradedAnswers;
    attempt.score = score;
    attempt.timeTaken = timeTaken;

    // Check if all questions can be automatically graded
    const hasEssayQuestions = quiz.questions.some(
      (q) => q.questionType === QuestionType.ESSAY,
    );

    // If no essay questions, mark as graded. Otherwise, leave as submitted for manual grading
    if (!hasEssayQuestions) {
      attempt.status = AttemptStatus.GRADED;
    } else {
      attempt.status = AttemptStatus.SUBMITTED;
    }

    // Update assignment status
    attempt.quizAssignment.status = AssignmentStatus.COMPLETED;
    await this.quizAssignmentRepository.save(attempt.quizAssignment);

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
        'quizAssignment',
        'quizAssignment.quiz',
        'quizAssignment.quiz.questions',
        'quizAssignment.quiz.teacher',
      ],
    });

    if (!attempt) {
      throw new NotFoundException('Quiz attempt not found');
    }

    const teacher = await this.teachersService.findByUserId(user.id);
    if (attempt.quizAssignment.quiz.teacherId !== teacher.id) {
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
    attempt.quizAssignment.status = AssignmentStatus.COMPLETED;
    await this.quizAssignmentRepository.save(attempt.quizAssignment);

    return this.quizAttemptRepository.save(attempt) as any;
  }

  async getQuizResults(quizId: number, user: User) {
    if (user.role !== UserRole.TEACHER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only teachers and admins can view quiz results',
      );
    }

    let quiz;
    if (user.role === UserRole.TEACHER) {
      const teacher = await this.teachersService.findByUserId(user.id);
      quiz = await this.quizRepository.findOne({
        where: { id: quizId, teacherId: teacher.id },
        relations: ['questions'],
      });
    } else {
      // Admin can view any quiz
      quiz = await this.quizRepository.findOne({
        where: { id: quizId },
        relations: ['questions'],
      });
    }

    if (!quiz) {
      throw new NotFoundException(
        'Quiz not found or you do not have permission',
      );
    }

    // Get all assignments and their attempts
    const assignments = await this.quizAssignmentRepository.find({
      where: { quizId },
      relations: ['student', 'student.user'],
      order: { assignedAt: 'DESC' },
    });

    const results: any[] = [];

    for (const assignment of assignments) {
      if (!assignment.student || !assignment.student.user) continue;

      // Get the latest attempt for this assignment
      const attempt = await this.quizAttemptRepository.findOne({
        where: {
          assignmentId: assignment.id,
          status: In(['submitted', 'graded']),
        },
        order: { submittedAt: 'DESC' },
      });

      const result = {
        id: attempt?.id || assignment.id,
        studentId: assignment.studentId,
        studentName: `${assignment.student.user.firstName} ${assignment.student.user.lastName}`,
        studentEmail: assignment.student.user.email,
        assignedAt: assignment.assignedAt,
        dueDate: assignment.dueDate,
        status: assignment.status,
        attemptCount: assignment.attempts,
        startedAt: attempt?.startedAt,
        submittedAt: attempt?.submittedAt,
        score: attempt?.score
          ? parseFloat(attempt.score.toString())
          : undefined,
        maxScore: attempt?.maxScore
          ? parseFloat(attempt.maxScore.toString())
          : quiz.totalMarks,
        timeTaken: attempt?.timeTaken,
        answers: attempt?.answers || {},
        graded: attempt?.status === 'graded',
      };

      results.push(result);
    }

    console.log('Quiz results for teacher/admin:', {
      quizId,
      resultsCount: results.length,
      firstResult: results[0]
        ? {
            studentName: results[0].studentName,
            hasAnswers: Object.keys(results[0].answers).length > 0,
            score: results[0].score,
          }
        : null,
    });

    return results;
  }

  async delete(id: number, user: User): Promise<void> {
    if (user.role !== UserRole.TEACHER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only teachers and admins can delete quizzes',
      );
    }

    let quiz;
    if (user.role === UserRole.TEACHER) {
      const teacher = await this.teachersService.findByUserId(user.id);
      quiz = await this.quizRepository.findOne({
        where: { id, teacherId: teacher.id },
      });
    } else if (user.role === UserRole.ADMIN) {
      // Admin can only delete quizzes they created
      quiz = await this.quizRepository.findOne({
        where: { id, createdBy: user.id },
      });
    }

    if (!quiz) {
      throw new NotFoundException(
        'Quiz not found or you do not have permission',
      );
    }

    // Check if any students have attempted this quiz
    const attemptCount = await this.quizAttemptRepository.count({
      where: {
        quizAssignment: { quizId: id },
      },
    });

    if (attemptCount > 0) {
      // If students have attempted the quiz, just mark as inactive to preserve data
      quiz.isActive = false;
      await this.quizRepository.save(quiz);
    } else {
      // If no attempts made, perform a hard delete (removes quiz and cascades to assignments/questions)
      await this.quizRepository.delete(id);
    }
  }

  async publishQuiz(id: number, user: User): Promise<Quiz> {
    let quiz: Quiz | null = null;

    if (user.role === UserRole.TEACHER) {
      const teacher = await this.teachersService.findByUserId(user.id);
      quiz = await this.quizRepository.findOne({
        where: { id, teacherId: teacher.id },
      });
    } else if (user.role === UserRole.ADMIN) {
      // Admin can only publish quizzes they created
      quiz = await this.quizRepository.findOne({
        where: { id, createdBy: user.id },
      });
    }

    if (!quiz) {
      throw new NotFoundException(
        'Quiz not found or you do not have permission',
      );
    }

    if (quiz.status === 'published') {
      throw new BadRequestException('Quiz is already published');
    }

    // Update quiz status to published
    quiz.status = 'published';

    await this.quizRepository.save(quiz);

    return this.findOne(quiz.id);
  }

  async unpublishQuiz(id: number, user: User): Promise<Quiz> {
    let quiz: Quiz | null = null;

    if (user.role === UserRole.TEACHER) {
      const teacher = await this.teachersService.findByUserId(user.id);
      quiz = await this.quizRepository.findOne({
        where: { id, teacherId: teacher.id },
      });
    } else if (user.role === UserRole.ADMIN) {
      // Admin can only unpublish quizzes they created
      quiz = await this.quizRepository.findOne({
        where: { id, createdBy: user.id },
      });
    }

    if (!quiz) {
      throw new NotFoundException(
        'Quiz not found or you do not have permission',
      );
    }

    if (quiz.status === 'draft') {
      throw new BadRequestException('Quiz is already unpublished (draft)');
    }

    // Update quiz status to draft
    quiz.status = 'draft';

    await this.quizRepository.save(quiz);

    return this.findOne(quiz.id);
  }

  async getStudentAttempts(userId: number) {
    const student = await this.studentsService.findByUserId(userId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const attempts = await this.quizAttemptRepository
      .createQueryBuilder('attempt')
      .leftJoinAndSelect('attempt.quizAssignment', 'assignment')
      .leftJoinAndSelect('assignment.quiz', 'quiz')
      .leftJoinAndSelect('quiz.questions', 'questions')
      .leftJoinAndSelect('quiz.teacher', 'teacher')
      .leftJoinAndSelect('teacher.user', 'teacherUser')
      .where('attempt.studentId = :studentId', { studentId: student.id })
      .andWhere('attempt.status IN (:...statuses)', {
        statuses: ['submitted', 'graded'],
      })
      .orderBy('attempt.submittedAt', 'DESC')
      .getMany();

    return attempts.map((attempt) => ({
      id: attempt.id,
      score: attempt.score,
      maxScore: attempt.maxScore,
      percentage:
        attempt.maxScore > 0
          ? Math.round((attempt.score / attempt.maxScore) * 100)
          : 0,
      submittedAt: attempt.submittedAt,
      timeTaken: attempt.timeTaken,
      status: attempt.status,
      quiz: {
        id: attempt.quizAssignment.quiz.id,
        title: attempt.quizAssignment.quiz.title,
        description: attempt.quizAssignment.quiz.description,
        totalMarks: attempt.quizAssignment.quiz.totalMarks,
        questionCount: attempt.quizAssignment.quiz.questions?.length || 0,
        teacher: {
          name:
            attempt.quizAssignment.quiz.teacher?.user?.firstName +
            ' ' +
            attempt.quizAssignment.quiz.teacher?.user?.lastName,
          email: attempt.quizAssignment.quiz.teacher?.user?.email,
        },
      },
      assignment: {
        id: attempt.quizAssignment.id,
        assignedAt: attempt.quizAssignment.assignedAt,
        dueDate: attempt.quizAssignment.dueDate,
      },
    }));
  }

  async debugGetStudentAttempts(userId: number) {
    const student = await this.studentsService.findByUserId(userId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    console.log('Debug: Student ID:', student.id);

    // Get ALL attempts regardless of status for debugging
    const allAttempts = await this.quizAttemptRepository
      .createQueryBuilder('attempt')
      .leftJoinAndSelect('attempt.quizAssignment', 'assignment')
      .leftJoinAndSelect('assignment.quiz', 'quiz')
      .where('attempt.studentId = :studentId', { studentId: student.id })
      .getMany();

    console.log('Debug: Found attempts:', allAttempts.length);
    allAttempts.forEach((attempt) => {
      console.log(
        `Attempt ${attempt.id}: status=${attempt.status}, submitted=${attempt.submittedAt}, score=${attempt.score}`,
      );
    });

    return {
      studentId: student.id,
      totalAttempts: allAttempts.length,
      attempts: allAttempts.map((attempt) => ({
        id: attempt.id,
        status: attempt.status,
        submittedAt: attempt.submittedAt,
        score: attempt.score,
        maxScore: attempt.maxScore,
        quizTitle: attempt.quizAssignment?.quiz?.title || 'Unknown Quiz',
      })),
    };
  }

  async getAttemptDetails(attemptId: number, user: User) {
    const student = await this.studentsService.findByUserId(user.id);
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const attempt = await this.quizAttemptRepository
      .createQueryBuilder('attempt')
      .leftJoinAndSelect('attempt.quizAssignment', 'assignment')
      .leftJoinAndSelect('assignment.quiz', 'quiz')
      .leftJoinAndSelect('quiz.questions', 'questions')
      .leftJoinAndSelect('quiz.teacher', 'teacher')
      .leftJoinAndSelect('teacher.user', 'teacherUser')
      .where('attempt.id = :attemptId', { attemptId })
      .andWhere('attempt.studentId = :studentId', { studentId: student.id })
      .andWhere('attempt.status IN (:...statuses)', {
        statuses: ['submitted', 'graded'],
      })
      .getOne();

    if (!attempt) {
      throw new NotFoundException('Quiz attempt not found or access denied');
    }

    const answers = attempt.answers || {};
    const questions = attempt.quizAssignment.quiz.questions || [];

    return {
      id: attempt.id,
      score: attempt.score,
      maxScore: attempt.maxScore,
      percentage:
        attempt.maxScore > 0
          ? Math.round((attempt.score / attempt.maxScore) * 100)
          : 0,
      submittedAt: attempt.submittedAt,
      timeTaken: attempt.timeTaken,
      status: attempt.status,
      quiz: {
        id: attempt.quizAssignment.quiz.id,
        title: attempt.quizAssignment.quiz.title,
        description: attempt.quizAssignment.quiz.description,
        totalMarks: attempt.quizAssignment.quiz.totalMarks,
        timeLimit: attempt.quizAssignment.quiz.timeLimit,
        teacher: {
          name:
            attempt.quizAssignment.quiz.teacher?.user?.firstName +
            ' ' +
            attempt.quizAssignment.quiz.teacher?.user?.lastName,
          email: attempt.quizAssignment.quiz.teacher?.user?.email,
        },
      },
      questions: questions.map((question) => {
        const studentAnswer = answers[question.id];
        const isCorrect = this.checkAnswer(question, studentAnswer);

        return {
          id: question.id,
          question: question.question,
          questionType: question.questionType,
          options: question.options,
          marks: question.marks,
          studentAnswer,
          correctAnswer: question.correctAnswer,
          correctAnswerExplanation: question.correctAnswerExplanation,
          isCorrect,
          pointsEarned: isCorrect ? question.marks : 0,
        };
      }),
      assignment: {
        id: attempt.quizAssignment.id,
        assignedAt: attempt.quizAssignment.assignedAt,
        dueDate: attempt.quizAssignment.dueDate,
      },
    };
  }

  async getAssignmentResult(assignmentId: number, user: User) {
    const student = await this.studentsService.findByUserId(user.id);
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // First, get the assignment to verify ownership
    const assignment = await this.quizAssignmentRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.quiz', 'quiz')
      .where('assignment.id = :assignmentId', { assignmentId })
      .andWhere('assignment.studentId = :studentId', { studentId: student.id })
      .getOne();

    if (!assignment) {
      throw new NotFoundException('Assignment not found or access denied');
    }

    // Get the latest submitted or graded attempt for this assignment
    const attempt = await this.quizAttemptRepository
      .createQueryBuilder('attempt')
      .leftJoinAndSelect('attempt.quizAssignment', 'quizAssignment')
      .leftJoinAndSelect('quizAssignment.quiz', 'quiz')
      .leftJoinAndSelect('quiz.questions', 'questions')
      .leftJoinAndSelect('quiz.teacher', 'teacher')
      .leftJoinAndSelect('teacher.user', 'teacherUser')
      .where('attempt.assignmentId = :assignmentId', { assignmentId })
      .andWhere('attempt.studentId = :studentId', { studentId: student.id })
      .andWhere('attempt.status IN (:...statuses)', {
        statuses: ['submitted', 'graded'],
      })
      .orderBy('attempt.submittedAt', 'DESC')
      .getOne();

    if (!attempt) {
      throw new NotFoundException(
        'No completed quiz attempts found for this assignment',
      );
    }

    const answers = attempt.answers || {};
    const questions = attempt.quizAssignment.quiz.questions || [];

    console.log('Debug getAssignmentResult:');
    console.log('- Assignment ID:', assignmentId);
    console.log('- Student ID:', student.id);
    console.log('- Found attempt:', attempt.id);
    console.log('- Attempt answers:', JSON.stringify(answers, null, 2));
    console.log('- Questions count:', questions.length);
    console.log(
      '- First question:',
      questions[0]
        ? {
            id: questions[0].id,
            question: questions[0].question.substring(0, 50),
            questionType: questions[0].questionType,
            correctAnswer: questions[0].correctAnswer,
            explanation: questions[0].correctAnswerExplanation?.substring(
              0,
              50,
            ),
          }
        : 'No questions',
    );

    return {
      id: attempt.id,
      score: attempt.score,
      maxScore: attempt.maxScore,
      percentage:
        attempt.maxScore > 0
          ? Math.round((attempt.score / attempt.maxScore) * 100)
          : 0,
      submittedAt: attempt.submittedAt,
      timeTaken: attempt.timeTaken,
      status: attempt.status,
      quiz: {
        id: attempt.quizAssignment.quiz.id,
        title: attempt.quizAssignment.quiz.title,
        description: attempt.quizAssignment.quiz.description,
        totalMarks: attempt.quizAssignment.quiz.totalMarks,
        timeLimit: attempt.quizAssignment.quiz.timeLimit,
        teacher: {
          name:
            attempt.quizAssignment.quiz.teacher?.user?.firstName +
            ' ' +
            attempt.quizAssignment.quiz.teacher?.user?.lastName,
          email: attempt.quizAssignment.quiz.teacher?.user?.email,
        },
      },
      questions: questions.map((question) => {
        const answerData = answers[question.id];
        const studentAnswer = answerData?.studentAnswer || answerData;
        const isCorrect = this.checkAnswer(question, studentAnswer);

        console.log(`Question ${question.id} processing:`, {
          answerData,
          studentAnswer,
          correctAnswer: question.correctAnswer,
          correctAnswerExplanation: question.correctAnswerExplanation,
          isCorrect,
        });

        return {
          id: question.id,
          question: question.question,
          questionType: question.questionType,
          options: question.options,
          marks: question.marks,
          studentAnswer,
          correctAnswer: question.correctAnswer,
          correctAnswerExplanation: question.correctAnswerExplanation,
          isCorrect,
          pointsEarned: isCorrect ? question.marks : 0,
        };
      }),
      assignment: {
        id: attempt.quizAssignment.id,
        assignedAt: attempt.quizAssignment.assignedAt,
        dueDate: attempt.quizAssignment.dueDate,
      },
    };
  }

  private checkAnswer(question: QuizQuestion, studentAnswer: any): boolean {
    if (!studentAnswer) return false;

    switch (question.questionType) {
      case QuestionType.MULTIPLE_CHOICE:
        return studentAnswer === question.correctAnswer;
      case QuestionType.TRUE_FALSE:
        return studentAnswer === question.correctAnswer;
      case QuestionType.SHORT_ANSWER:
        if (
          typeof studentAnswer === 'string' &&
          typeof question.correctAnswer === 'string'
        ) {
          return (
            studentAnswer.toLowerCase().trim() ===
            question.correctAnswer.toLowerCase().trim()
          );
        }
        return studentAnswer === question.correctAnswer;
      case QuestionType.ESSAY:
        return false;
      default:
        return false;
    }
  }
}
