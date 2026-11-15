# frozen_string_literal: true

# Everything that is best created through the real REST API because a background job in the
# canvas-jobs container does the actual work: SIS imports (one clean, one with deliberate
# errors, one that fails outright), outcome imports, content exports, a course copy, a
# blueprint sync, content shares, account/quiz reports, recurring calendar series, a
# three-step file upload, and browser-style page views (recent history).

module Seed
  module Api
    class << self
      def csv(rows)
        rows.map { |r| r.map { |v| v.to_s.match?(/[",\n]/) ? "\"#{v.to_s.gsub('"', '""')}\"" : v.to_s }.join(",") }.join("\n") + "\n"
      end

      def zip(files)
        require "zip"
        Zip::OutputStream.write_buffer do |z|
          files.each do |name, rows|
            z.put_next_entry(name)
            z.write(rows.is_a?(String) ? rows : csv(rows))
          end
        end.string
      end

      def sis_import(payload, type: "zip", query: "")
        body, = Seed.api!(:post, "/api/v1/accounts/#{Seed.root.id}/sis_imports?import_type=instructure_csv&extension=#{type}#{query}", raw: payload,
                                                                                                                                  content_type: type == "zip" ? "application/zip" : "text/csv")
        body["id"]
      end

      def wait_sis(id, timeout: 900)
        Seed.wait_for("SIS import #{id}", timeout:, interval: 3) do
          b, = Seed.api!(:get, "/api/v1/accounts/#{Seed.root.id}/sis_imports/#{id}")
          b if %w[imported imported_with_messages failed failed_with_messages aborted].include?(b["workflow_state"])
        end
      end

      def wait_get(label, path, token: nil, timeout: 600)
        Seed.wait_for(label, timeout:, interval: 2) do
          b, = Seed.api!(:get, path, token:)
          b if yield(b)
        end
      end

      def tok(persona)
        Seed.tokens.fetch(persona.to_s)
      end
    end
  end
end

Seed.step("api.sis_import_2", tx: false) do
  a = Seed::Api
  cur = Seed.term(:current)
  now = Seed.now
  files = {
    "accounts.csv" => [%w[account_id parent_account_id name status], ["SIS-DEPT-PE", "SCH-RHS", "Physical Education & Health (SIS-created)", "active"],
                       ["SIS-DEPT-OLD", "SCH-DOA", "Discontinued Program (SIS, deleted)", "deleted"]],
    "terms.csv" => [%w[term_id name status start_date end_date], ["TERM-SIS-WINTER", "Winter Mini-Term (SIS-created)", "active", (now + 47.days).iso8601, (now + 58.days).iso8601]],
    "users.csv" => [%w[user_id login_id first_name last_name email status],
                    ["SIS-STU-0001", "renamed.student.sis1", "Renamed", "By-Second-Import", "renamed.sis1@students.example.edu", "active"],
                    ["SIS-STU-0130", "", "", "", "", "deleted"],
                    ["SIS-STU-0129", "suspended.sis129", "Suspended", "ViaSis", "suspended.sis129@students.example.edu", "suspended"],
                    ["SIS-OBS-0001", "sis.parent.one", "Parent", "One (SIS)", "sis.parent.one@parents.example.org", "active"],
                    ["SIS-OBS-0002", "sis.parent.two", "Parent", "Two (SIS)", "", "active"],
                    ["SIS-STU-NEW-1", "late.enrollee", "Late", "Enrollee", "late.enrollee@students.example.edu", "active"]],
    "logins.csv" => [%w[user_id login_id existing_user_id email], ["SIS-STU-0003-ALT", "second.login.sis3", "SIS-STU-0003", "alt.sis3@students.example.edu"]],
    "courses.csv" => [%w[course_id short_name long_name account_id term_id status], ["SIS-ART-9", "ART-9", "Art Foundations 9 (second SIS import)", "SIS-DEPT-PE", cur.sis_source_id, "published"],
                      ["SIS-WINTER-1", "WNTR-1", "Winter Mini-Course (future term)", "SCH-RHS", "TERM-SIS-WINTER", "active"],
                      ["SIS-DRIVER-ED", "DRV-ED", "Driver Education (SIS, now concluded)", "SCH-DOA", "TERM-ONGOING", "completed"]],
    "sections.csv" => [%w[section_id course_id name status], ["SIS-ART-9-A", "SIS-ART-9", "Art 9 A", "active"], ["SIS-ART-9-B", "SIS-ART-9", "Art 9 B (deleted by SIS)", "deleted"]],
    "enrollments.csv" => [%w[course_id user_id role section_id status associated_user_id]] +
                         (1..24).map { |i| ["", format("SIS-STU-%04d", i), "student", "SIS-ART-9-A", "active", ""] } +
                         [["SIS-ART-9", "SIS-TCH-0001", "teacher", "", "active", ""], ["", "SIS-STU-NEW-1", "student", "FRSH-100-S2", "active", ""],
                          ["", "SIS-STU-0010", "student", "FRSH-100-S5", "completed", ""], ["", "SIS-STU-0011", "student", "FRSH-100-S6", "inactive", ""],
                          ["", "SIS-STU-0012", "student", "FRSH-100-S1", "deleted", ""], ["FRSH-100-ALL", "SIS-OBS-0002", "observer", "", "active", "SIS-STU-0002"]],
    "xlists.csv" => [%w[xlist_course_id section_id status], %w[SIS-PE-9 SIS-HEALTH-9-B active]],
    "group_categories.csv" => [%w[group_category_id course_id category_name status], ["SIS-GC-FRSH", "FRSH-100-ALL", "SIS Advisory Groups", "active"]],
    "groups.csv" => [%w[group_id group_category_id name status]] + (1..3).map { |i| ["SIS-GRP-#{i}", "SIS-GC-FRSH", "Advisory Group #{i} (SIS)", "available"] },
    "groups_membership.csv" => [%w[group_id user_id status]] + (1..15).map { |i| ["SIS-GRP-#{((i - 1) % 3) + 1}", format("SIS-STU-%04d", i), "accepted"] },
    "user_observers.csv" => [%w[observer_id student_id status], %w[SIS-OBS-0001 SIS-STU-0001 active], %w[SIS-OBS-0001 SIS-STU-0002 active]],
    "admins.csv" => [%w[user_id account_id role status], ["SIS-TCH-0001", "SCH-DOA", "AccountAdmin", "active"]],
    "change_sis_id.csv" => [%w[old_id new_id type], %w[FRSH-100-S6 FRSH-100-S6-HONORS section]]
  }
  id = a.sis_import(a.zip(files))
  res = a.wait_sis(id)
  raise "second SIS import ended #{res["workflow_state"]}: #{res["processing_errors"].inspect[0, 300]}" if res["workflow_state"].start_with?("failed")

  xl = CourseSection.where(root_account_id: Seed.root.id, sis_source_id: "SIS-HEALTH-9-B").first
  Seed.fixture(:secondSisImportId, id)
  Seed.fixture(:sisCrossListedSectionId, xl.id) if xl
  Seed.fixture(:sisGroupCategoryId, GroupCategory.where(sis_source_id: "SIS-GC-FRSH").pick(:id))
  Seed.log "  SIS import ##{id}: #{res["workflow_state"]}, counts #{res.dig("data", "counts").to_h.reject { |_, v| v.to_i.zero? }.inspect}"
end

Seed.step("api.sis_import_errors", tx: false) do
  a = Seed::Api
  files = {
    "users.csv" => [%w[user_id login_id first_name last_name email status],
                    ["SIS-ERR-0001", "", "No", "Login", "nologin@example.edu", "active"],           # missing login_id
                    ["", "no.user.id", "No", "UserId", "nouserid@example.edu", "active"],             # missing user_id
                    ["SIS-ERR-0003", "bad.status", "Bad", "Status", "bad.status@example.edu", "enrolled"], # invalid status
                    ["SIS-ERR-0004", "teacher.persona@example.edu", "Login", "Collision", "", "active"], # login already used by another user
                    ["SIS-OK-0005", "ok.in.error.batch", "Okay", "Row", "ok.row@example.edu", "active"]],
    "courses.csv" => [%w[course_id short_name long_name account_id term_id status],
                      ["SIS-ERR-C1", "ERR1", "Course in unknown account", "NO-SUCH-ACCOUNT", "", "active"],
                      ["SIS-ERR-C2", "ERR2", "Course in unknown term", "SCH-RHS", "NO-SUCH-TERM", "active"],
                      ["", "ERR3", "Course without an id", "", "", "active"],
                      ["SIS-ERR-C4", "ERR4", "Course with bad status", "", "", "archived"]],
    "sections.csv" => [%w[section_id course_id name status], ["SIS-ERR-S1", "NO-SUCH-COURSE", "Orphan section", "active"], ["SIS-ERR-S2", "FRSH-100-ALL", "", "active"]],
    "enrollments.csv" => [%w[course_id user_id role section_id status],
                          ["FRSH-100-ALL", "NO-SUCH-USER", "student", "", "active"], ["NO-SUCH-COURSE", "SIS-STU-0002", "student", "", "active"],
                          ["FRSH-100-ALL", "SIS-STU-0002", "wizard", "", "active"], ["FRSH-100-ALL", "SIS-STU-0003", "student", "NO-SUCH-SECTION", "active"],
                          ["FRSH-100-ALL", "SIS-STU-0004", "student", "", "graduated"], ["", "SIS-STU-0005", "student", "", "active"],
                          ["FRSH-100-ALL", "SIS-OK-0005", "student", "FRSH-100-S3", "active"]],
    "xlists.csv" => [%w[xlist_course_id section_id status], %w[NO-SUCH-COURSE SIS-HEALTH-9-A active]],
    "group_memberships.csv" => [%w[group_id user_id status], %w[NO-SUCH-GROUP SIS-STU-0001 accepted]],
    "mystery.csv" => [%w[foo bar baz], %w[1 2 3]] # unrecognised file
  }
  id = a.sis_import(a.zip(files))
  res = a.wait_sis(id)
  errors, = Seed.api!(:get, "/api/v1/accounts/#{Seed.root.id}/sis_imports/#{id}/errors?per_page=100")
  list = errors.is_a?(Hash) ? errors["sis_import_errors"] : errors
  Seed.fixture(:sisImportWithErrorsId, id)
  Seed.fixture(:sisImportErrorCount, Array(list).size)
  Seed.log "  SIS import ##{id}: #{res["workflow_state"]} with #{Array(list).size} errors/warnings"

  # an import that cannot be parsed at all, and one aborted right after creation
  bad = a.sis_import("this is not a csv file\x00\x01\n,,,\n", type: "csv")
  bres = a.wait_sis(bad)
  Seed.fixture(:failedSisImportId, bad)
  Seed.log "  SIS import ##{bad}: #{bres["workflow_state"]}"
end

Seed.step("api.outcome_import", tx: false) do
  a = Seed::Api
  header = %w[vendor_guid object_type title description display_name calculation_method calculation_int workflow_state parent_guids mastery_points ratings]
  rows = [header,
          ["IMP-G1", "group", "Imported Standards (CSV import)", "Created by the outcome import API", "", "", "", "active", "", "", ""],
          ["IMP-G1-A", "group", "Imported — Scientific Practices", "", "", "", "", "active", "IMP-G1", "", ""],
          ["IMP-O1", "outcome", "Ask questions and define problems", "<p>Imported outcome 1</p>", "Asking Questions", "decaying_average", "65", "active", "IMP-G1-A", "3", "4", "Exceeds", "3", "Meets", "2", "Approaching", "1", "Beginning"],
          ["IMP-O2", "outcome", "Develop and use models", "", "", "n_mastery", "3", "active", "IMP-G1-A", "3", "4", "Exceeds", "3", "Meets", "1", "Not yet"],
          ["IMP-O3", "outcome", "Obtain, evaluate and communicate information — «comunicar»", "", "", "highest", "", "active", "IMP-G1 IMP-G1-A", "2", "3", "Yes", "2", "Mostly", "0", "No"],
          ["IMP-O4", "outcome", "Row with an invalid calculation method", "", "", "median", "", "active", "IMP-G1", "3", "4", "A", "0", "F"]]
  body, = Seed.api!(:post, "/api/v1/accounts/#{Seed.root.id}/outcome_imports?import_type=instructure_csv", raw: a.csv(rows), content_type: "text/csv")
  id = body["id"]
  res = a.wait_get("outcome import #{id}", "/api/v1/accounts/#{Seed.root.id}/outcome_imports/#{id}") { |b| %w[succeeded failed].include?(b["workflow_state"]) }
  Seed.fixture(:outcomeImportId, id)
  Seed.fixture(:importedOutcomeGroupVendorGuid, "IMP-G1")
  Seed.log "  outcome import ##{id}: #{res["workflow_state"]} (#{Array(res["processing_errors"]).size} row errors)"
end

Seed.step("api.exports", tx: false) do
  a = Seed::Api
  main = Seed.course(:main)
  second = Seed.course(:second)
  cc, = Seed.api!(:post, "/api/v1/courses/#{second.id}/content_exports", params: { export_type: "common_cartridge", skip_notifications: true })
  qti, = Seed.api!(:post, "/api/v1/courses/#{main.id}/content_exports", params: { export_type: "qti", skip_notifications: true })
  sel, = Seed.api!(:post, "/api/v1/courses/#{main.id}/content_exports", token: a.tok(:teacher),
                                                                       params: { export_type: "common_cartridge", skip_notifications: true, select: { modules: [Seed.fx["moduleId"]], pages: [Seed.fx["pageUrl"]] } })
  done = ->(b) { %w[exported failed].include?(b["workflow_state"]) }
  r1 = a.wait_get("content export #{cc["id"]}", "/api/v1/courses/#{second.id}/content_exports/#{cc["id"]}", &done)
  r2 = a.wait_get("content export #{qti["id"]}", "/api/v1/courses/#{main.id}/content_exports/#{qti["id"]}", &done)
  r3 = a.wait_get("content export #{sel["id"]}", "/api/v1/courses/#{main.id}/content_exports/#{sel["id"]}", &done)
  Seed.fixture(:contentExportId, cc["id"])
  Seed.fixture(:contentExportCourseId, second.id)
  Seed.fixture(:contentExportProgressId, cc["progress_url"].to_s[/\d+\z/]&.to_i)
  Seed.fixture(:qtiContentExportId, qti["id"])
  Seed.fixture(:selectiveContentExportId, sel["id"])
  Seed.log "  exports: cc=#{r1["workflow_state"]} qti=#{r2["workflow_state"]} selective=#{r3["workflow_state"]}"
end

Seed.step("api.migration", tx: false) do
  a = Seed::Api
  second = Seed.course(:second)
  dest = Course.where(root_account_id: Seed.root.id, sis_source_id: "ALG2-COPY").first
  unless dest
    body, = Seed.api!(:post, "/api/v1/accounts/#{Seed.ref("account:rhs_math")}/courses",
                      params: { course: { name: "Algebra II (copied for next term)", course_code: "MATH-201-COPY", sis_course_id: "ALG2-COPY", term_id: Seed.ref("term:future1") } })
    dest = Course.find(body["id"])
  end
  mig, = Seed.api!(:post, "/api/v1/courses/#{dest.id}/content_migrations",
                   params: { migration_type: "course_copy_importer", settings: { source_course_id: second.id },
                             date_shift_options: { shift_dates: true, old_start_date: Seed.term(:current).start_at.to_date.iso8601, new_start_date: Seed.term(:future1).start_at.to_date.iso8601 } })
  res = a.wait_get("course copy #{mig["id"]}", "/api/v1/courses/#{dest.id}/content_migrations/#{mig["id"]}", timeout: 900) { |b| %w[completed failed].include?(b["workflow_state"]) }
  # two migrations that deliberately never finish: one waiting for its file, one waiting for item selection
  pre, = Seed.api!(:post, "/api/v1/courses/#{dest.id}/content_migrations",
                   params: { migration_type: "common_cartridge_importer", pre_attachment: { name: "never-uploaded.imscc", size: 12_345, content_type: "application/zip" } })
  sel, = Seed.api!(:post, "/api/v1/courses/#{dest.id}/content_migrations",
                   params: { migration_type: "course_copy_importer", settings: { source_course_id: Seed.ref("course:main") }, selective_import: true })
  issues, = Seed.api!(:get, "/api/v1/courses/#{dest.id}/content_migrations/#{mig["id"]}/migration_issues?per_page=50")
  Seed.fixture(:contentMigrationId, mig["id"])
  Seed.fixture(:contentMigrationCourseId, dest.id)
  Seed.fixture(:progressId, mig["progress_url"].to_s[/\d+\z/]&.to_i)
  Seed.fixture(:pendingContentMigrationId, pre["id"])
  Seed.fixture(:selectiveContentMigrationId, sel["id"])
  Seed.fixture(:migrationIssueId, issues.first["id"]) if issues.is_a?(Array) && issues.first
  Seed.log "  course copy ##{mig["id"]}: #{res["workflow_state"]} (#{Array(issues).size} issues); pre_processing ##{pre["id"]}, waiting_for_select ##{sel["id"]} (#{sel["workflow_state"]})"
end

Seed.step("api.blueprint_sync", tx: false) do
  a = Seed::Api
  bp = Seed.course(:blueprint)
  mig, = Seed.api!(:post, "/api/v1/courses/#{bp.id}/blueprint_templates/default/migrations", params: { comment: "Initial sync from the seed loader", send_notification: false })
  res = a.wait_get("blueprint sync #{mig["id"]}", "/api/v1/courses/#{bp.id}/blueprint_templates/default/migrations/#{mig["id"]}", timeout: 900) { |b| %w[completed imports_failed exports_failed].include?(b["workflow_state"]) }
  # afterwards: an unsynced change in the blueprint and a downstream edit in one child
  asg = Assignment.find(Seed.ref("blueprint:assignment"))
  asg.update!(title: "#{asg.title} (edited after sync — unsynced change)")
  child = Course.find(Seed.fx["blueprintChildCourseIds"].last)
  cpage = child.wiki_pages.order(:id).last
  cpage&.update!(body: "#{cpage.body}<p>Edited locally in the child course.</p>")
  Seed.fixture(:blueprintMigrationId, mig["id"])
  Seed.fixture(:blueprintSubscriptionId, MasterCourses::ChildSubscription.where(child_course_id: Seed.fx["blueprintChildCourseId"]).pick(:id))
  Seed.log "  blueprint sync ##{mig["id"]}: #{res["workflow_state"]}; first child now has #{Course.find(Seed.fx["blueprintChildCourseId"]).assignments.count} assignments"
end

Seed.step("api.content_shares", tx: false) do
  a = Seed::Api
  teacher = Seed.ref("user:teacher")
  teacher2 = Seed.ref("user:teacher2")
  ta = Seed.ref("user:ta")
  share = lambda do |token, receivers, type, id|
    body, = Seed.api!(:post, "/api/v1/users/self/content_shares", token:, params: { receiver_ids: receivers, content_type: type, content_id: id })
    body
  end
  sent = share.call(nil, [teacher, teacher2], "assignment", Seed.fx["assignmentId"])
  share.call(nil, [teacher], "quiz", Seed.fx["quizId"])
  t_sent = share.call(a.tok(:teacher), [Seed.admin.id, ta], "page", Seed.fx["pageId"])
  share.call(a.tok(:teacher), [Seed.admin.id, teacher2], "discussion_topic", Seed.fx["discussionTopicId"])
  share.call(a.tok(:teacher), [teacher2], "module", Seed.fx["moduleId"])
  share.call(a.tok(:teacher), [Seed.admin.id], "attachment", Seed.fx["pdfFileId"])
  received, = Seed.api!(:get, "/api/v1/users/self/content_shares/received?per_page=50")
  t_received, = Seed.api!(:get, "/api/v1/users/self/content_shares/received?per_page=50", token: a.tok(:teacher))
  Seed.api!(:put, "/api/v1/users/self/content_shares/#{received.last["id"]}", params: { read_state: "read" }) if received.any?
  Seed.fixture(:contentShareId, sent["id"])
  Seed.fixture(:receivedContentShareId, received.first["id"]) if received.any?
  Seed.fixture(:teacherContentShareId, t_sent["id"])
  Seed.fixture(:teacherReceivedContentShareId, t_received.first["id"]) if t_received.any?
  Seed.log "  content shares: admin sent 2 / received #{received.size}; teacher sent 4 / received #{t_received.size}"
end

Seed.step("api.reports", tx: false) do
  a = Seed::Api
  root = Seed.root
  available, = Seed.api!(:get, "/api/v1/accounts/#{root.id}/reports?per_page=100")
  names = available.map { |r| r["report"] }
  made = {}
  { "provisioning_csv" => { users: true, courses: true, sections: true, enrollments: true }, "grade_export_csv" => { enrollment_term_id: Seed.ref("term:current") },
    "sis_export_csv" => { accounts: true, terms: true } }.each do |name, params|
    next unless names.include?(name)

    code, body, = Seed.api(:post, "/api/v1/accounts/#{root.id}/reports/#{name}", params: { parameters: params })
    made[name] = body["id"] if (200..299).cover?(code)
  end
  made.each do |name, id|
    a.wait_get("report #{name}", "/api/v1/accounts/#{root.id}/reports/#{name}/#{id}", timeout: 600) { |b| %w[complete error].include?(b["status"]) || b["progress"].to_i == 100 }
  end
  first = made.first
  if first
    Seed.fixture(:accountReportType, first[0])
    Seed.fixture(:accountReportId, first[1])
    Seed.fixture(:accountReportIds, made)
  end
  # classic quiz report (student analysis CSV) + statistics are generated by a job
  main = Seed.course(:main)
  rep, = Seed.api!(:post, "/api/v1/courses/#{main.id}/quizzes/#{Seed.fx["quizId"]}/reports", params: { quiz_report: { report_type: "student_analysis", includes_all_versions: true }, include: ["file"] })
  rid = rep["id"] || rep.dig("quiz_reports", 0, "id")
  Seed.fixture(:quizReportId, rid.to_i) if rid
  Seed.api(:post, "/api/v1/courses/#{main.id}/quizzes/#{Seed.fx["quizId"]}/reports", params: { quiz_report: { report_type: "item_analysis" } })
  Seed.log "  account reports: #{made.inspect}; quiz report #{rid}; available report types: #{names.size}"
end

Seed.step("api.calendar_series", tx: false) do
  a = Seed::Api
  main = Seed.course(:main)
  zone = ActiveSupport::TimeZone["America/Chicago"]
  start = zone.at(Seed.now - 28.days).change(hour: 13, min: 0)
  ev, = Seed.api!(:post, "/api/v1/calendar_events", token: a.tok(:teacher),
                                                   params: { calendar_event: { context_code: "course_#{main.id}", title: "Weekly Lab Block (recurring series)", start_at: start.iso8601,
                                                                               end_at: (start + 90.minutes).iso8601, location_name: "Lab 3", rrule: "FREQ=WEEKLY;INTERVAL=1;COUNT=12" } })
  day = zone.at(Seed.now + 1.day).change(hour: 7, min: 30)
  mine, = Seed.api!(:post, "/api/v1/calendar_events",
                    params: { calendar_event: { context_code: "user_#{Seed.admin.id}", title: "Daily stand-up (series)", start_at: day.iso8601, end_at: (day + 15.minutes).iso8601,
                                                rrule: "FREQ=DAILY;INTERVAL=1;COUNT=5" } })
  Seed.fixture(:seriesCalendarEventId, ev["id"])
  Seed.fixture(:calendarSeriesUuid, ev["series_uuid"])
  Seed.fixture(:adminSeriesCalendarEventId, mine["id"])
  Seed.log "  recurring series: #{CalendarEvent.where(series_uuid: ev["series_uuid"]).count} + #{CalendarEvent.where(series_uuid: mine["series_uuid"]).count} events"
end

Seed.step("api.file_upload", tx: false) do
  a = Seed::Api
  main = Seed.course(:main)
  content = "Uploaded through the three-step API flow.\n#{Seed::Text.paragraph(Seed.rng("api.upload"))}\n"
  step1, = Seed.api!(:post, "/api/v1/courses/#{main.id}/files", token: a.tok(:teacher),
                                                              params: { name: "api-upload (3-step).txt", size: content.bytesize, content_type: "text/plain", parent_folder_path: "API Uploads/nested", on_duplicate: "rename" })
  uri = URI(step1["upload_url"])
  req = Net::HTTP::Post.new(uri)
  req.set_form(step1["upload_params"].map { |k, v| [k, v.to_s] } + [["file", StringIO.new(content), { filename: "api-upload (3-step).txt", content_type: "text/plain" }]], "multipart/form-data")
  res = Net::HTTP.start(uri.host, uri.port) { |h| h.request(req) }
  file = if res["Location"]
           Seed.api!(:get, res["Location"].sub(Seed::BASE_URL, ""), token: a.tok(:teacher)).first
         else
           JSON.parse(res.body)
         end
  Seed.fixture(:apiUploadedFileId, file["id"])
  Seed.fixture(:apiUploadFolderId, file["folder_id"])
  Seed.log "  3-step upload -> file #{file["id"]} (#{res.code})"
end

Seed.step("api.page_views", tx: false) do
  a = Seed::Api
  main = Seed.course(:main)
  fx = Seed.fx
  paths = ["/courses/#{main.id}", "/courses/#{main.id}/assignments/#{fx["assignmentId"]}", "/courses/#{main.id}/pages/#{fx["pageUrl"]}", "/courses/#{main.id}/quizzes/#{fx["quizId"]}",
           "/courses/#{main.id}/discussion_topics/#{fx["discussionTopicId"]}", "/courses/#{main.id}/modules", "/courses/#{main.id}/files", "/courses/#{main.id}/announcements",
           "/courses/#{main.id}/grades", "/courses/#{fx["courseId2"]}", "/courses/#{fx["courseId2"]}/assignments", "/calendar", "/conversations"]
  # browser-style session (login form + cookies) so page views and recent history are real
  browse = lambda do |login, password|
    jar = {}
    get = lambda do |path|
      req = Net::HTTP::Get.new(URI.join(Seed::BASE_URL, path))
      req["Cookie"] = jar.map { |k, v| "#{k}=#{v}" }.join("; ")
      req["User-Agent"] = "Mozilla/5.0 (X11; Linux x86_64) n8n-battery-seed"
      req["Accept"] = "text/html"
      res = Net::HTTP.start("localhost", URI(Seed::BASE_URL).port, read_timeout: 120) { |h| h.request(req) }
      Array(res.get_fields("Set-Cookie")).each { |c| k, v = c.split(";").first.split("=", 2); jar[k] = v }
      res
    end
    form = get.call("/login/canvas")
    token = form.body[/name="authenticity_token"[^>]*value="([^"]+)"/, 1] || CGI.unescape(jar["_csrf_token"].to_s)
    req = Net::HTTP::Post.new(URI.join(Seed::BASE_URL, "/login/canvas"))
    req["Cookie"] = jar.map { |k, v| "#{k}=#{v}" }.join("; ")
    req.set_form_data("authenticity_token" => token, "pseudonym_session[unique_id]" => login, "pseudonym_session[password]" => password)
    res = Net::HTTP.start("localhost", URI(Seed::BASE_URL).port, read_timeout: 120) { |h| h.request(req) }
    Array(res.get_fields("Set-Cookie")).each { |c| k, v = c.split(";").first.split("=", 2); jar[k] = v }
    codes = paths.map { |p| get.call(p).code }
    [res.code, codes.tally]
  end
  visits = {}
  { teacher: ["teacher.persona@example.edu", Seed::PASSWORD], student: ["student.persona@example.edu", Seed::PASSWORD],
    admin: [ENV.fetch("CANVAS_LMS_ADMIN_EMAIL", "admin@example.com"), ENV["CANVAS_LMS_ADMIN_PASSWORD"]] }.each do |who, (login, password)|
    next if password.to_s.empty?

    visits[who] = browse.call(login, password)
  rescue => e
    visits[who] = "failed: #{e.class}: #{e.message[0, 80]}"
  end
  # API traffic for the same users (page views with http_method / url recorded)
  api_paths = ["/api/v1/courses/#{main.id}", "/api/v1/courses/#{main.id}/assignments?per_page=5", "/api/v1/users/self/profile", "/api/v1/courses/#{main.id}/modules",
               "/api/v1/courses/#{main.id}/discussion_topics?per_page=5", "/api/v1/users/self/todo", "/api/v1/courses/#{main.id}/pages/#{fx["pageUrl"]}"]
  [nil, a.tok(:teacher), a.tok(:student), a.tok(:ta)].each { |t| api_paths.each { |p| Seed.api(:get, p, token: t) } }
  sleep 3 # page views are written after the response
  counts = { admin: PageView.where(user_id: Seed.admin.id).count, teacher: PageView.where(user_id: Seed.ref("user:teacher")).count, student: PageView.where(user_id: Seed.ref("user:student")).count }
  Seed.fixture(:pageViewUserIds, [Seed.admin.id, Seed.ref("user:teacher"), Seed.ref("user:student")])
  Seed.log "  web sessions: #{visits.inspect}; page views now: #{counts.inspect}"
end
