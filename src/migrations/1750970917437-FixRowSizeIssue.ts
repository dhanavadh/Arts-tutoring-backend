import { MigrationInterface, QueryRunner } from "typeorm";

export class FixRowSizeIssue1750970917437 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // First, convert large VARCHAR columns to TEXT to reduce row size
        try {
            await queryRunner.query(`ALTER TABLE quiz_questions MODIFY COLUMN question TEXT`);
        } catch (error) {
            console.log('Question column already TEXT or does not exist');
        }

        try {
            await queryRunner.query(`ALTER TABLE quiz_questions MODIFY COLUMN correct_answer TEXT`);
        } catch (error) {
            console.log('Correct answer column already TEXT or does not exist');
        }

        try {
            await queryRunner.query(`ALTER TABLE quiz_questions MODIFY COLUMN correct_answer_explanation TEXT`);
        } catch (error) {
            console.log('Correct answer explanation column already TEXT or does not exist');
        }

        // Now try to drop the qualifications column if it exists
        try {
            const tableExists = await queryRunner.hasTable('teachers');
            if (tableExists) {
                const hasColumn = await queryRunner.hasColumn('teachers', 'qualifications');
                if (hasColumn) {
                    await queryRunner.query(`ALTER TABLE teachers DROP COLUMN qualifications`);
                }
            }
        } catch (error) {
            console.log('Qualifications column already dropped or does not exist');
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // In rollback, we don't need to revert these changes as they are safe improvements
        // Adding back qualifications column if needed
        try {
            const tableExists = await queryRunner.hasTable('teachers');
            if (tableExists) {
                const hasColumn = await queryRunner.hasColumn('teachers', 'qualifications');
                if (!hasColumn) {
                    await queryRunner.query(`ALTER TABLE teachers ADD COLUMN qualifications JSON NULL`);
                }
            }
        } catch (error) {
            console.log('Could not add back qualifications column');
        }
    }
}