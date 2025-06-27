-- Check if constraint exists and drop it if it does
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = 'iconroof_artsbackend' 
     AND TABLE_NAME = 'quiz_assignments' 
     AND CONSTRAINT_NAME = 'FK_quiz_assignments_assigned_by_teacher') > 0,
    'ALTER TABLE quiz_assignments DROP FOREIGN KEY FK_quiz_assignments_assigned_by_teacher',
    'SELECT "Constraint does not exist" as message'
));

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;