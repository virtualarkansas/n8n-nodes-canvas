# frozen_string_literal: true

# Final consistency pass: one last grade recalculation, wait for the canvas-jobs container
# to finish the work the REST calls queued, empty the loader's own queue, print a health
# report. The drain/report part has no marker (it is cheap and safe to repeat).

Seed.step("finish.grades") do
  # belt and braces: one final grade recalculation for every course that has graded work
  ids = Submission.where(workflow_state: "graded").distinct.pluck(:course_id)
  Course.where(id: ids).where.not(workflow_state: "deleted").find_each(&:recompute_student_scores)
  Seed.fixture(:seedVersion, 1)
  Seed.fixture(:seededAt, Time.now.utc.iso8601)
  Seed.log "  queued a final grade recalculation for #{ids.size} courses"
end

Seed.always("finish.drain") do
  waiting = -> { Delayed::Job.where(queue: "canvas_queue", run_at: ..Time.now.utc).where.not("tag LIKE 'periodic:%'").where(attempts: ..1) }
  begin
    Seed.wait_for("canvas-jobs queue", timeout: 900, interval: 3) { waiting.call.none? }
    Seed.log "  canvas-jobs queue is empty"
  rescue => e
    Seed.log "  WARNING: #{e.message}; still queued in canvas-jobs: #{waiting.call.group(:tag).count.inspect}"
  end
  Seed.drain_jobs("final", all: true)

  failed = Delayed::Job::Failed.group(:queue, :tag).count
  future = Delayed::Job.where.not("tag LIKE 'periodic:%'").where(run_at: Time.now.utc..).group(:tag).count
  Seed.log "  failed jobs by queue/tag: #{failed.inspect}" if failed.any?
  Seed.log "  jobs scheduled for later (normal): #{future.inspect}" if future.any?
  Seed.log "  steps completed: #{Seed.conn.select_value("SELECT count(*) FROM #{Seed::TABLE}")}, " \
           "total step time #{Seed.conn.select_value("SELECT round(sum(seconds)::numeric, 1) FROM #{Seed::TABLE}")}s"
end
