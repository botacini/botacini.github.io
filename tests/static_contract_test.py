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
            "202607240001_member_family_integrity.sql",
            "202607260001_secure_legacy_family_config.sql",
            "202607260002_restrict_public_function_execution.sql",
            "202607260003_grant_authenticated_data_api_access.sql",
            "202607260004_grant_rls_helper_execution.sql",
            "202607270001_prevent_task_schedule_conflicts.sql",
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

    def test_member_references_cannot_cross_family_boundaries(self):
        integrity = self.read("supabase/migrations/202607240001_member_family_integrity.sql")
        self.assertIn("security definer", integrity)
        self.assertIn("member must belong to the same family", integrity)
        for table in ("task_assignees", "family_custom_goals", "manual_star_events"):
            self.assertIn(f"on public.{table}", integrity)

    def test_pages_runtime_config_is_present_and_has_no_server_secret(self):
        config = self.read("js/supabase-config.js")
        self.assertIn("window.GP_SUPABASE_CONFIG", config)
        self.assertIn("publishableKey", config)
        self.assertNotIn("service_role", config.lower())
        self.assertNotIn("postgres://", config.lower())

    def test_legacy_jsonb_store_is_not_exposed_to_browser_roles(self):
        migration = self.read("supabase/migrations/202607260001_secure_legacy_family_config.sql").lower()
        self.assertIn("enable row level security", migration)
        self.assertIn("force row level security", migration)
        self.assertIn("drop policy if exists family_owner", migration)
        self.assertIn("drop policy if exists acesso_publico", migration)
        self.assertIn("revoke all privileges", migration)

    def test_security_definer_helpers_are_not_callable_by_anonymous_users(self):
        migration = self.read("supabase/migrations/202607260002_restrict_public_function_execution.sql")
        self.assertIn("revoke execute on all functions in schema public from public", migration.lower())
        self.assertIn("alter function public.weekdays_are_valid(smallint[]) set search_path = public", migration.lower())
        self.assertIn("grant execute on function public.bootstrap_current_family(text) to authenticated", migration.lower())

    def test_data_api_table_access_is_limited_to_authenticated_users(self):
        migration = self.read("supabase/migrations/202607260003_grant_authenticated_data_api_access.sql").lower()
        self.assertIn("grant select, insert, update, delete on table", migration)
        self.assertIn("public.family_members", migration)
        self.assertIn("public.weekly_summaries", migration)
        self.assertNotIn(" to anon", migration)

    def test_rls_predicates_are_granted_only_to_authenticated_users(self):
        migration = self.read("supabase/migrations/202607260004_grant_rls_helper_execution.sql").lower()
        self.assertIn("can_access_family(uuid) to authenticated", migration)
        self.assertIn("can_manage_family(uuid) to authenticated", migration)
        self.assertNotIn(" to anon", migration)

    def test_user_content_is_escaped_before_html_rendering(self):
        renderer = self.read("js/render.js")
        self.assertIn("escapeHtml(ms.title)", renderer)
        self.assertIn("escapeHtml(mem.name)", renderer)
        self.assertIn("safeCssColor", renderer)
        actions = self.read("js/quick-actions.js")
        self.assertIn("select.replaceChildren", actions)

    def test_finalize_day_only_advances_the_selected_date(self):
        missions = self.read("js/missions.js")
        page = self.read("index.html")
        finalize_body = missions.split("export async function finalizeDay()", 1)[1].split("/* ════════════════ FINALIZAR A SEMANA", 1)[0]
        self.assertIn("shiftDateKey", finalize_body)
        self.assertIn("loadDateContext(nextDate)", finalize_body)
        self.assertNotIn("clearOccurrenceStatus", finalize_body)
        self.assertNotIn("missionStatus =", finalize_body)
        self.assertIn("ENCERRAR DIA E AVANÇAR", page)
        self.assertIn('aria-label="Encerrar o dia e avançar para a próxima data"', page)

    def test_task_schedule_conflicts_are_checked_in_ui_and_persistence(self):
        migration = self.read("supabase/migrations/202607270001_prevent_task_schedule_conflicts.sql")
        storage = self.read("js/storage.js")
        actions = self.read("js/quick-actions.js")
        self.assertIn("find_task_schedule_conflict", migration)
        self.assertIn("pg_advisory_xact_lock", migration)
        self.assertIn("assert_no_task_schedule_conflict", migration)
        self.assertIn("create or replace function public.create_task_with_schedule", migration)
        self.assertIn("create or replace function public.update_task_series", migration)
        self.assertIn("create or replace function public.set_task_occurrence_override", migration)
        self.assertIn("findTaskScheduleConflict", storage)
        self.assertIn("Conflito de horário", actions)


if __name__ == "__main__":
    unittest.main(verbosity=2)
