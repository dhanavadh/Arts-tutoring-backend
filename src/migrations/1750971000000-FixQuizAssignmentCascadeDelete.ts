import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixQuizAssignmentCascadeDelete1750971000000
  implements MigrationInterface
{
  name = 'FixQuizAssignmentCascadeDelete1750971000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop existing foreign key constraints
    await queryRunner.query(
      `ALTER TABLE \`quiz_assignments\` DROP FOREIGN KEY \`FK_quiz_assignments_quiz_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`quiz_assignments\` DROP FOREIGN KEY \`FK_quiz_assignments_student_id\``,
    );

    // Add new foreign key constraints with CASCADE delete
    await queryRunner.query(
      `ALTER TABLE \`quiz_assignments\` ADD CONSTRAINT \`FK_quiz_assignments_quiz_id\` FOREIGN KEY (\`quiz_id\`) REFERENCES \`quizzes\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`quiz_assignments\` ADD CONSTRAINT \`FK_quiz_assignments_student_id\` FOREIGN KEY (\`student_id\`) REFERENCES \`students\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop CASCADE constraints
    await queryRunner.query(
      `ALTER TABLE \`quiz_assignments\` DROP FOREIGN KEY \`FK_quiz_assignments_quiz_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`quiz_assignments\` DROP FOREIGN KEY \`FK_quiz_assignments_student_id\``,
    );

    // Add back original constraints (NO ACTION)
    await queryRunner.query(
      `ALTER TABLE \`quiz_assignments\` ADD CONSTRAINT \`FK_quiz_assignments_quiz_id\` FOREIGN KEY (\`quiz_id\`) REFERENCES \`quizzes\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`quiz_assignments\` ADD CONSTRAINT \`FK_quiz_assignments_student_id\` FOREIGN KEY (\`student_id\`) REFERENCES \`students\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
