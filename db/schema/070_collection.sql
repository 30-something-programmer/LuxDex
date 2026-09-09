CREATE TABLE IF NOT EXISTS luxdex.profile (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    profile_key text NOT NULL,
    display_name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT profile_profile_key_key UNIQUE (profile_key),
    CONSTRAINT profile_key_format
        CHECK (profile_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT profile_display_name_not_blank CHECK (btrim(display_name) <> '')
);

CREATE TABLE IF NOT EXISTS luxdex.pokemon_collection_state (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    profile_id bigint NOT NULL,
    pokemon_form_id bigint NOT NULL,
    state text NOT NULL,
    first_seen_at timestamptz,
    first_owned_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pokemon_collection_state_profile_fkey
        FOREIGN KEY (profile_id)
        REFERENCES luxdex.profile (id)
        ON DELETE CASCADE,
    CONSTRAINT pokemon_collection_state_form_fkey
        FOREIGN KEY (pokemon_form_id)
        REFERENCES luxdex.pokemon_form (id),
    CONSTRAINT pokemon_collection_state_profile_form_key
        UNIQUE (profile_id, pokemon_form_id),
    CONSTRAINT pokemon_collection_state_state_valid
        CHECK (state IN ('unseen', 'seen', 'owned')),
    CONSTRAINT pokemon_collection_state_timestamps_valid CHECK (
        (state = 'unseen')
        OR (state = 'seen' AND first_seen_at IS NOT NULL)
        OR (state = 'owned' AND first_seen_at IS NOT NULL AND first_owned_at IS NOT NULL)
    ),
    CONSTRAINT pokemon_collection_state_owned_after_seen CHECK (
        first_owned_at IS NULL
        OR (first_seen_at IS NOT NULL AND first_owned_at >= first_seen_at)
    )
);

CREATE TABLE IF NOT EXISTS luxdex.pokemon_collection_state_event (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    profile_id bigint NOT NULL,
    pokemon_form_id bigint NOT NULL,
    previous_state text NOT NULL,
    new_state text NOT NULL,
    source text NOT NULL DEFAULT 'manual',
    occurred_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pokemon_collection_state_event_profile_fkey
        FOREIGN KEY (profile_id)
        REFERENCES luxdex.profile (id)
        ON DELETE CASCADE,
    CONSTRAINT pokemon_collection_state_event_form_fkey
        FOREIGN KEY (pokemon_form_id)
        REFERENCES luxdex.pokemon_form (id),
    CONSTRAINT pokemon_collection_state_event_previous_valid
        CHECK (previous_state IN ('unseen', 'seen', 'owned')),
    CONSTRAINT pokemon_collection_state_event_new_valid
        CHECK (new_state IN ('unseen', 'seen', 'owned')),
    CONSTRAINT pokemon_collection_state_event_changed
        CHECK (previous_state <> new_state),
    CONSTRAINT pokemon_collection_state_event_source_format
        CHECK (source ~ '^[a-z][a-z0-9_-]*$')
);

CREATE INDEX IF NOT EXISTS pokemon_collection_state_form_profile_idx
    ON luxdex.pokemon_collection_state (pokemon_form_id, profile_id);

CREATE INDEX IF NOT EXISTS pokemon_collection_state_event_profile_form_time_idx
    ON luxdex.pokemon_collection_state_event (profile_id, pokemon_form_id, occurred_at DESC, id DESC);

CREATE OR REPLACE FUNCTION luxdex.prevent_collection_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'pokemon_collection_state_event is immutable';
END;
$$;

DROP TRIGGER IF EXISTS pokemon_collection_state_event_immutable
    ON luxdex.pokemon_collection_state_event;
CREATE TRIGGER pokemon_collection_state_event_immutable
    BEFORE UPDATE OR DELETE ON luxdex.pokemon_collection_state_event
    FOR EACH ROW EXECUTE FUNCTION luxdex.prevent_collection_event_mutation();

INSERT INTO luxdex.profile (profile_key, display_name)
VALUES ('local', 'Local Player')
ON CONFLICT (profile_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    updated_at = CASE
        WHEN luxdex.profile.display_name IS DISTINCT FROM EXCLUDED.display_name THEN now()
        ELSE luxdex.profile.updated_at
    END;

COMMENT ON TABLE luxdex.profile IS
    'Collection ownership boundary. Pass 7 bootstraps the single active local profile without authentication.';
COMMENT ON TABLE luxdex.pokemon_collection_state IS
    'Current form-scoped collection projection. A missing row is pristine unseen; explicit unseen rows preserve historical first timestamps after reset.';
COMMENT ON TABLE luxdex.pokemon_collection_state_event IS
    'Immutable audit trail written transactionally with every actual collection-state transition.';
