CREATE OR REPLACE FUNCTION append_deleted_identity_avatar()
RETURNS TRIGGER AS $$
BEGIN
    -- When deleting identity
    IF TG_OP = 'DELETE' THEN
        IF OLD.avatar_file_id IS NOT NULL THEN
            INSERT INTO deleted_files (file_id, count)
            VALUES (OLD.avatar_file_id, 1)
            ON CONFLICT (file_id)
            DO UPDATE
            SET count = deleted_files.count + 1;
        END IF;

        RETURN OLD;
    END IF;

    -- When updating avatar
    IF TG_OP = 'UPDATE' THEN
        IF OLD.avatar_file_id IS NOT NULL
            AND OLD.avatar_file_id IS DISTINCT FROM NEW.avatar_file_id THEN

            INSERT INTO deleted_files (file_id, count)
            VALUES (OLD.avatar_file_id, 1)
            ON CONFLICT (file_id)
            DO UPDATE
            SET count = deleted_files.count + 1;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- DELETE trigger
DROP TRIGGER IF EXISTS identities_after_delete ON identities;

CREATE TRIGGER identities_after_delete
AFTER DELETE ON identities
FOR EACH ROW
EXECUTE FUNCTION append_deleted_identity_avatar();


-- UPDATE trigger
DROP TRIGGER IF EXISTS identities_after_update_avatar ON identities;

CREATE TRIGGER identities_after_update_avatar
AFTER UPDATE OF avatar_file_id ON identities
FOR EACH ROW
EXECUTE FUNCTION append_deleted_identity_avatar();
