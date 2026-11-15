#!/usr/bin/env bash
# Load the battery seed data into the running local Canvas and publish the resulting
# tokens / fixture ids into test/.state.json.
#
#   run.sh                 run every step that has not completed yet (safe to re-run)
#   run.sh --fixtures      do not seed; just re-read the fixtures of completed steps and merge them
#   run.sh --summary       only print record counts / sizes
#   SEED_ONLY=users run.sh run only steps whose name matches (prefix or glob, comma separated)
#   SEED_FORCE=step.name   re-run one finished (idempotent) step
#
# Environment: CANVAS_WEB_CONTAINER (canvas-web), CANVAS_PG_CONTAINER (canvas-pg),
#              STATE_FILE (test/.state.json), SEED_LOG (log file to keep)
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB="${CANVAS_WEB_CONTAINER:-canvas-web}"
PG="${CANVAS_PG_CONTAINER:-canvas-pg}"
STATE_FILE="${STATE_FILE:-$HERE/../../../.state.json}"
REMOTE_DIR=/tmp/n8n-seed
MODE="${1:-seed}"

summary() {
	echo
	echo "== record counts =="
	docker exec "$PG" psql -U postgres -d canvas_development -At -F $'\t' -c "
		select t, n from (values
		  ('accounts (active)', (select count(*) from accounts where workflow_state='active')),
		  ('enrollment_terms', (select count(*) from enrollment_terms where root_account_id=1)),
		  ('roles (custom)', (select count(*) from roles where workflow_state in ('active','inactive'))),
		  ('users', (select count(*) from users)),
		  ('pseudonyms', (select count(*) from pseudonyms)),
		  ('communication_channels', (select count(*) from communication_channels)),
		  ('access_tokens', (select count(*) from access_tokens)),
		  ('courses', (select count(*) from courses where root_account_id=1)),
		  ('course_sections', (select count(*) from course_sections)),
		  ('enrollments', (select count(*) from enrollments)),
		  ('user_observers', (select count(*) from user_observers)),
		  ('assignment_groups', (select count(*) from assignment_groups)),
		  ('assignments', (select count(*) from assignments)),
		  ('assignment_overrides', (select count(*) from assignment_overrides)),
		  ('submissions', (select count(*) from submissions)),
		  ('submissions (submitted/graded)', (select count(*) from submissions where workflow_state in ('submitted','graded','pending_review'))),
		  ('submission_comments', (select count(*) from submission_comments)),
		  ('rubrics', (select count(*) from rubrics)),
		  ('rubric_assessments', (select count(*) from rubric_assessments)),
		  ('learning_outcomes', (select count(*) from learning_outcomes)),
		  ('learning_outcome_groups', (select count(*) from learning_outcome_groups)),
		  ('learning_outcome_results', (select count(*) from learning_outcome_results)),
		  ('context_modules', (select count(*) from context_modules)),
		  ('content_tags (module items)', (select count(*) from content_tags where tag_type='context_module')),
		  ('wiki_pages', (select count(*) from wiki_pages)),
		  ('attachments', (select count(*) from attachments)),
		  ('folders', (select count(*) from folders)),
		  ('quizzes', (select count(*) from quizzes)),
		  ('quiz_questions', (select count(*) from quiz_questions)),
		  ('quiz_submissions', (select count(*) from quiz_submissions)),
		  ('discussion_topics (incl. announcements)', (select count(*) from discussion_topics)),
		  ('announcements', (select count(*) from discussion_topics where type='Announcement')),
		  ('discussion_entries', (select count(*) from discussion_entries)),
		  ('group_categories', (select count(*) from group_categories)),
		  ('groups', (select count(*) from groups)),
		  ('group_memberships', (select count(*) from group_memberships)),
		  ('conversations', (select count(*) from conversations)),
		  ('conversation_messages', (select count(*) from conversation_messages)),
		  ('calendar_events', (select count(*) from calendar_events)),
		  ('appointment_groups', (select count(*) from appointment_groups)),
		  ('planner_notes', (select count(*) from planner_notes)),
		  ('eportfolios', (select count(*) from eportfolios)),
		  ('polling_polls', (select count(*) from polling_polls)),
		  ('content_exports', (select count(*) from content_exports)),
		  ('content_migrations', (select count(*) from content_migrations)),
		  ('sis_batches', (select count(*) from sis_batches)),
		  ('sis_batch_errors', (select count(*) from sis_batch_errors)),
		  ('account_notifications', (select count(*) from account_notifications)),
		  ('developer_keys', (select count(*) from developer_keys)),
		  ('context_external_tools', (select count(*) from context_external_tools)),
		  ('page_views', (select count(*) from page_views)),
		  ('messages', (select count(*) from messages)),
		  ('delayed_jobs (queued)', (select count(*) from delayed_jobs where run_at <= now() + interval '1 minute' and tag not like 'periodic:%')),
		  ('failed_jobs', (select count(*) from failed_jobs)),
		  ('seed steps done', (select count(*) from n8n_seed_steps))
		) as c(t, n)" 2>/dev/null | awk -F '\t' '{ printf "  %-42s %s\n", $1, $2 }'
	echo
	echo "== sizes =="
	echo "postgres db:   $(docker exec "$PG" psql -U postgres -d canvas_development -Atc "select pg_size_pretty(pg_database_size('canvas_development'))")"
	echo "file storage:  $(docker exec "$WEB" du -sh /usr/src/app/tmp/files 2>/dev/null | cut -f1)"
	echo "disk free (/): $(df -h / | awk 'NR==2 {print $4}')"
}

if [ "$MODE" = "--summary" ]; then
	summary
	exit 0
fi

docker exec "$WEB" mkdir -p "$REMOTE_DIR" || { echo "cannot reach container $WEB" >&2; exit 1; }
docker cp "$HERE/." "$WEB:$REMOTE_DIR/" >/dev/null

LOG="${SEED_LOG:-$(mktemp -t canvas-seed.XXXXXX.log)}"
only="${SEED_ONLY:-}"
[ "$MODE" = "--fixtures" ] && only="__fixtures_only__"

merge_fixtures() {
	node -e '
		const fs = require("fs");
		const file = process.argv[1];
		const add = JSON.parse(fs.readFileSync(0, "utf8"));
		const state = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
		state.canvas = state.canvas || {};
		state.canvas.url = state.canvas.url || "http://localhost:3000";
		state.canvas.tokens = { ...(state.canvas.tokens || {}), ...add.tokens };
		state.canvas.fixtures = { ...(state.canvas.fixtures || {}), ...add.fixtures };
		const tmp = file + ".seed-tmp";
		fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n");
		fs.renameSync(tmp, file);
		console.log(`[run.sh] merged ${Object.keys(add.tokens).length} tokens + ${Object.keys(add.fixtures).length} fixtures into ${file}`);
	' "$STATE_FILE"
}

# The loader prints a FIXTURES_JSON line after every phase (and once more on exit, even
# after a failure); each one is merged into the state file as soon as it appears.
merged=0
last=""
while IFS= read -r line; do
	case "$line" in
	"Running via Spring preloader"*) ;;
	FIXTURES_JSON=*)
		json="${line#FIXTURES_JSON=}"
		if [ "$json" != "$last" ]; then
			if printf '%s' "$json" | merge_fixtures; then merged=1; last="$json"; else echo "[run.sh] failed to merge fixtures into $STATE_FILE" >&2; fi
		fi
		;;
	SEED_EXIT_STATUS=*) ;;
	*) printf '%s\n' "$line" ;;
	esac
	printf '%s\n' "$line" >>"$LOG"
done < <(docker exec -e SEED_ONLY="$only" -e SEED_FORCE="${SEED_FORCE:-}" "$WEB" bundle exec rails runner "$REMOTE_DIR/seed.rb" 2>&1; echo "SEED_EXIT_STATUS=$?")
status=$(grep '^SEED_EXIT_STATUS=' "$LOG" | tail -1 | cut -d= -f2)
status="${status:-1}"
if [ "$merged" -eq 0 ]; then
	echo "[run.sh] no FIXTURES_JSON line in the seed output (see $LOG)" >&2
	status=1
fi

[ "$MODE" = "--fixtures" ] || summary
[ "$status" -eq 0 ] || echo "seed finished with errors (exit $status); log: $LOG" >&2
exit "$status"
