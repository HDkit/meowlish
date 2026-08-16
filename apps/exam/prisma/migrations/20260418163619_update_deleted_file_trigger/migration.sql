CREATE OR REPLACE FUNCTION append_deleted_file()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO deleted_files (file_id, count)
    VALUES (OLD.file_id, 1)
    ON CONFLICT (file_id)
    DO UPDATE
    SET count = deleted_files.count + 1;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- section files trigger
DROP TRIGGER IF EXISTS section_files_after_delete ON section_files;

CREATE TRIGGER section_files_after_delete
AFTER DELETE ON section_files
FOR EACH ROW
EXECUTE FUNCTION append_deleted_file();


-- question files trigger
DROP TRIGGER IF EXISTS question_files_after_delete ON question_files;

CREATE TRIGGER question_files_after_delete
AFTER DELETE ON question_files
FOR EACH ROW
EXECUTE FUNCTION append_deleted_file();
