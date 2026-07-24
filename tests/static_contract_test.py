"""Static contracts runnable without Node, Docker or a Supabase project."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class RelationalPersistenceContract(unittest.TestCase):
    def read(self, relative):
        return (ROOT / relative).read_text(encoding="utf-8")

    def test_migrations_are_ordered_and_complete(self):
        migrations = sorted((ROOT / "supabase" / "migrations").glob("*.sql"))
        self.assertEqual([item.name for item in migrations], [
            "202607230001_extensions.sql",
            "202607230002_relational_core.sql",
            "202607230003_constraints_and_indices.sql",
            "202607230004_functions.sql",
            "202607230005_rls.sql",
            "202607230006_legacy_family_config_retained.sql",
        ])
        core = self.read("supabase/migrations/202607230002_relational_core.sql")
        for table in ("families", "family_access", "family_members", "family_settings", "tasks", "task_assignees", "task_schedules", "task_schedule_overrides", "task_occurrence_status"):
            self.assertIn(f"public.{table}", core)

    def test_resolver_and_unique_occurrence_identity_exist(self):
        core = self.read("supabase/migrations/202607230002_relational_core.sql")
        functions = self.read("supabase/migrations/202607230004_functions.sql")
        self.assertIn("unique (schedule_id, occurrence_date)", core)
        self.assertIn("get_occurrences_for_date", functions)
        self.assertIn("schedule_type = 'once'", functions)
        self.assertIn("schedule_type = 'weekly'", functions)
        self.assertIn("override_type, 'override') <> 'skip'", functions)
        self.assertIn("schedule_id::text || ':' || p_occurrence_date::text", functions)
        self.assertIn("split_task_schedule_for_future", functions)

    def test_rls_never_uses_editable_metadata(self):
        rls = self.read("supabase/migrations/202607230005_rls.sql").lower()
        self.assertIn("family_access", rls)
        self.assertIn("auth.uid()", self.read("supabase/migrations/202607230004_functions.sql"))
        self.assertNotIn("raw_user_meta_data", rls)
        self.assertNotIn("user_metadata", rls)

    def test_frontend_has_no_jsonb_schedule_write_path(self):
        frontend = "\n".join(self.read(f"js/{name}") for name in ("state.js", "storage.js", "quick-actions.js", "parent-panel.js", "missions.js"))
        self.assertNotIn("missionsByDay", frontend)
        self.assertNotIn("from('family_config')", frontend)
        self.assertIn("createTaskWithSchedule", frontend)
        self.assertIn("setOccurrenceOverride", frontend)
        self.assertIn("setOccurrenceStatus", frontend)

    def test_repeated_series_edits_do_not_append_weekday_copies(self):
        actions = self.read("js/quick-actions.js")
        renderer = self.read("js/render.js")
        self.assertIn("updateTaskSeries", actions)
        self.assertIn("splitTaskScheduleForFuture", actions)
        self.assertNotIn("missionsByDay", actions)
        self.assertIn('data-delete-scope="occurrence"', renderer)
        self.assertIn('data-delete-scope="series"', renderer)

    def test_date_helpers_remain_local_calendar_based(self):
        state = self.read("js/state.js")
        self.assertIn("getFullYear()", state)
        self.assertIn("getMonth() + 1", state)
        self.assertIn("getDate()", state)
        self.assertNotIn("toISOString", state)


if __name__ == "__main__":
    unittest.main(verbosity=2)
