import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssignedByToQuizAssignments1750970917438 implements MigrationInterface {
    name = 'AddAssignedByToQuizAssignments1750970917438'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add the assigned_by column to quiz_assignments table
        await queryRunner.query(`
            ALTER TABLE quiz_assignments 
            ADD COLUMN assigned_by INTEGER
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove the assigned_by column from quiz_assignments table
        await queryRunner.query(`
            ALTER TABLE quiz_assignments 
            DROP COLUMN assigned_by
        `);
    }
}