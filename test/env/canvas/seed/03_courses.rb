# frozen_string_literal: true

# ~85 courses across the sub-account tree and terms, their sections, and the first real
# SIS import (which builds the very large course in the jobs container while the rest of
# the seed keeps going).

module Seed
  module Courses
    # account key => [[name, code], ...]
    CATALOG = {
      rhs_bio: [["AP Biology", "APBIO"], ["Anatomy & Physiology", "ANAT"], ["Environmental Science", "ENVS"]],
      rhs_phy: [["Chemistry I", "CHEM1"], ["Physics I (Period 1)", "PHYS1-P1"], ["Physics I (Period 3)", "PHYS1-P3"]],
      rhs_math: [["Algebra I", "ALG1"], ["Geometry", "GEOM"], ["Pre-Calculus", "PRECALC"], ["AP Calculus AB", "APCALC"], ["Statistics & Probability", "STAT"]],
      rhs_ela: [["English 9", "ENG9"], ["English 10", "ENG10"], ["English 11: American Literature", "ENG11"], ["AP English Literature", "APLIT"],
                ["Creative Writing ✍️", "CRWR"], ["Journalism", "JOUR"]],
      rhs_hist: [["U.S. History", "USHIST"], ["Government & Civics", "GOV"], ["Economics", "ECON"]],
      rhs_arts: [["Studio Art", "ART1"], ["Concert Band", "BAND"], ["Choir", "CHOIR"], ["Theatre Arts", "THTR"], ["Digital Photography", "PHOTO"]],
      rhs: [["Advisory / Homeroom 10", "ADV10"], ["Student Council", "STUCO"]],
      lms_g6: [["Math 6", "M6"], ["Science 6", "SCI6"], ["ELA 6", "ELA6"], ["Social Studies 6", "SS6"]],
      lms_g78: [["Math 7", "M7"], ["Pre-Algebra 8", "PREALG8"], ["Science 7", "SCI7"], ["Science 8", "SCI8"], ["ELA 7", "ELA7"], ["ELA 8", "ELA8"]],
      nge: [["Homeroom 3A", "HR3A"], ["Homeroom 4B", "HR4B"], ["Homeroom 5C", "HR5C"], ["Music K–5", "MUSK5"]],
      doa: [["Intro to Computer Science", "CS101"], ["Web Design", "WEB1"], ["Health & Wellness", "HLTH"]],
      doa_lang: [["Español I", "SPAN1"], ["Español II", "SPAN2"], ["Français I", "FREN1"], ["中文 I (Mandarin I)", "CHIN1"], ["日本語入門 (Intro Japanese)", "JAPN1"]],
      doa_pd: [["New Teacher Orientation", "PD-NTO"], ["Canvas Basics for Staff", "PD-CANVAS"]],
      root: [["Sandbox – T. Marlowe", "SANDBOX-TM"], ["Club: Robotics 🤖", "CLUB-ROBO"]]
    }.freeze
    VIEWS = %w[modules modules assignments syllabus feed].freeze # "wiki" needs a front page; set in 08
    LICENSES = %w[private cc_by_nc_nd cc_by_sa public_domain].freeze

    class << self
      def acct(key)
        key == :root ? Seed.root : Seed.account(key)
      end

      def create(key:, name:, code:, account:, term:, state: "available", sis: nil, **attrs)
        c = Course.new(name:, course_code: code, account: acct(account), enrollment_term: Seed.term(term), sis_source_id: sis)
        c.root_account = Seed.root
        attrs.each { |k, v| c.public_send("#{k}=", v) }
        c.workflow_state = state == "completed" ? "available" : state # concluded later, once it has content
        Course.suspend_callbacks(:copy_from_course_template) { c.save! }
        c.default_section # materialise the default section
        Seed.set_ref("course:#{key}", c.id) if key
        c
      end

      def section(course, name, sis: nil, **attrs)
        course.course_sections.create!(name:, sis_source_id: sis, **attrs)
      end
    end
  end
end

Seed.step("courses.special") do
  now = Seed.now
  rng = Seed.rng("courses.special")
  c = Seed::Courses
  syllabus = "<h2>Syllabus</h2>#{Seed::Text.html(rng, paragraphs: 3, rich: true)}"

  main = c.create(key: :main, name: "Biology 101: Cells to Ecosystems", code: "BIO-101", account: :rhs_bio, term: :current, sis: "BIO101-MAIN",
                  syllabus_body: syllabus, default_view: "modules", time_zone: "America/Chicago", license: "cc_by_nc_sa", public_syllabus_to_auth: true,
                  grading_standard_id: Seed.ref("grading_standard:letter"), integration_id: "INT-BIO101", storage_quota: 600.megabytes,
                  allow_student_forum_attachments: true, allow_student_discussion_topics: true, show_announcements_on_home_page: true, home_page_announcement_limit: 5)
  main.default_section.update!(name: "Period 1 (MWF 8:00)", sis_source_id: "BIO101-P1")
  p2 = c.section(main, "Period 2 (MWF 9:10)", sis: "BIO101-P2")
  p4 = c.section(main, "Period 4 — Honors", sis: "BIO101-P4-H", start_at: now - 80.days, end_at: now + 40.days, restrict_enrollments_to_section_dates: true)
  p6 = c.section(main, "Period 6 (blended) 🧪")
  empty_sec = c.section(main, "Independent Study (no students)", sis: "BIO101 IND/STUDY")
  dead_sec = c.section(main, "Period 7 (dissolved)", sis: "BIO101-P7")
  dead_sec.destroy
  Seed.set_ref("sections:main", [main.default_section.id, p2.id, p4.id, p6.id])
  Seed.fixture(:courseId, main.id)
  Seed.fixture(:courseSisId, "BIO101-MAIN")
  Seed.fixture(:sectionId, main.default_section.id)
  Seed.fixture(:sectionSisId, "BIO101-P1")
  Seed.fixture(:sectionId2, p2.id)
  Seed.fixture(:dateRestrictedSectionId, p4.id)
  Seed.fixture(:emptySectionId, empty_sec.id)
  Seed.fixture(:deletedSectionId, dead_sec.id)

  second = c.create(key: :second, name: "Algebra II", code: "MATH-201", account: :rhs_math, term: :current, sis: "ALG2-01",
                    syllabus_body: "<p>#{Seed::Text.paragraph(rng)}</p>", default_view: "modules")
  second.default_section.update!(name: "Algebra II — Period 3", sis_source_id: "ALG2-01-P3")
  s2b = c.section(second, "Algebra II — Period 5", sis: "ALG2-01-P5")
  Seed.set_ref("sections:second", [second.default_section.id, s2b.id])
  Seed.fixture(:courseId2, second.id)
  Seed.fixture(:course2SectionId, second.default_section.id)

  empty = c.create(key: :empty, name: "Empty Shell — Sandbox (no content)", code: "EMPTY", account: :doa, term: :nodates, sis: "EMPTY-001", state: "claimed")
  Seed.fixture(:emptyCourseId, empty.id)

  concluded = c.create(key: :concluded, name: "World History (concluded)", code: "WHIST", account: :rhs_hist, term: :past1, sis: "WHIST-PAST1", state: "completed",
                       start_at: Seed.term(:past1).start_at, conclude_at: Seed.term(:past1).end_at)
  Seed.set_ref("courses:to_conclude", [concluded.id])
  Seed.fixture(:concludedCourseId, concluded.id)

  unpublished = c.create(key: :unpublished, name: "AP Chemistry (unpublished draft)", code: "APCHEM", account: :rhs_phy, term: :current, sis: "APCHEM-DRAFT", state: "claimed")
  Seed.fixture(:unpublishedCourseId, unpublished.id)

  deleted = c.create(key: :deleted, name: "Cancelled: Intro to Latin", code: "LATN1", account: :doa_lang, term: :current, sis: "LATN1-CANCELLED")
  Seed.set_ref("courses:to_delete", [deleted.id])
  Seed.fixture(:deletedCourseId, deleted.id)

  bp = c.create(key: :blueprint, name: "Blueprint: District Digital Citizenship", code: "BP-DIGCIT", account: :doa, term: :nodates, sis: "BP-DIGCIT")
  kids = [[:bp_child1, "Digital Citizenship — RHS", :rhs, "DIGCIT-RHS"], [:bp_child2, "Digital Citizenship — LMS", :lms, "DIGCIT-LMS"], [:bp_child3, "Digital Citizenship — NGE", :nge, nil]].map do |key, name, acct, sis|
    c.create(key:, name:, code: "DIGCIT", account: acct, term: :current, sis:)
  end
  template = MasterCourses::MasterTemplate.set_as_master_course(bp)
  template.update!(default_restrictions: { content: true, points: true }, use_default_restrictions_by_type: false)
  kids.each { |k| template.add_child_course!(k) }
  Seed.fixture(:blueprintCourseId, bp.id)
  Seed.fixture(:blueprintTemplateId, template.id)
  Seed.fixture(:blueprintChildCourseId, kids.first.id)
  Seed.fixture(:blueprintChildCourseIds, kids.map(&:id))

  # date-restricted courses (course dates override the term)
  past_dated = c.create(key: :date_restricted_past, name: "Summer Bridge Math (course dates ended)", code: "BRIDGE", account: :rhs_math, term: :nodates, sis: "BRIDGE-SU",
                        start_at: now - 120.days, conclude_at: now - 60.days, restrict_enrollments_to_course_dates: true)
  future_dated = c.create(key: :date_restricted_future, name: "Winter Intensive: Lab Skills (starts later)", code: "WINT-LAB", account: :rhs_sci, term: :nodates,
                                                        start_at: now + 30.days, conclude_at: now + 50.days, restrict_enrollments_to_course_dates: true,
                                                        restrict_student_future_view: true)
  Seed.fixture(:dateRestrictedCourseId, past_dated.id)
  Seed.fixture(:futureDatedCourseId, future_dated.id)

  pub = c.create(key: :public, name: "Open Course: Study Skills (public, self-enroll)", code: "OPEN-STUDY", account: :doa, term: :nodates, sis: "OPEN-STUDY",
                 is_public: true, public_syllabus: true, self_enrollment: true, open_enrollment: true, indexed: true,
                 syllabus_body: "<p>Public syllabus. #{Seed::Text.paragraph(rng)}</p>", public_description: "Anyone can join. #{Seed::Text.sentence(rng)}")
  Seed.fixture(:publicCourseId, pub.id)
  Seed.fixture(:selfEnrollmentCode, pub.self_enrollment_code)

  paced = c.create(key: :paced, name: "Self-Paced: Personal Finance", code: "PFIN", account: :doa, term: :nodates, sis: "PFIN-PACED",
                   start_at: now - 20.days, conclude_at: now + 100.days, restrict_enrollments_to_course_dates: true)
  Seed.fixture(:pacedCourseId, paced.id)

  Seed.fixture(:probeCourseId, 1) if Course.where(id: 1).exists?
end

Seed.step("courses.catalog") do
  now = Seed.now
  rng = Seed.rng("courses.catalog")
  c = Seed::Courses
  ids = []
  to_conclude = []
  to_delete = []
  count = 0
  term_code = ->(key) { Seed.term(key).sis_source_id.to_s.sub("TERM-", "") }
  mk = lambda do |name, code, account, term, state, idx|
    count += 1
    sis = case rng.rand(10)
          when 0, 1 then nil
          when 2 then "#{code} #{term_code.call(term)} (legacy id)"
          when 3 then "#{code}/#{term_code.call(term)}"
          else "#{code}-#{term_code.call(term)}"
          end
    attrs = { default_view: c::VIEWS[rng.rand(c::VIEWS.size)], license: c::LICENSES[rng.rand(c::LICENSES.size)] }
    attrs[:syllabus_body] = Seed::Text.html(rng, paragraphs: 2, rich: rng.rand < 0.3) if rng.rand < 0.6
    attrs[:time_zone] = Seed::Users::ZONES[rng.rand(Seed::Users::ZONES.size)] if rng.rand < 0.2
    attrs[:is_public] = true if rng.rand < 0.05
    attrs[:hide_final_grades] = true if rng.rand < 0.08
    attrs[:locale] = %w[es fr ja zh-Hans][rng.rand(4)] if account == :doa_lang && rng.rand < 0.6
    attrs[:grading_standard_id] = Seed.ref("grading_standard:letter") if rng.rand < 0.25
    attrs[:course_format] = %w[on_campus online blended][rng.rand(3)] if rng.rand < 0.4
    course = c.create(key: nil, name: (idx.zero? ? name : "#{name} (#{Seed.term(term).name})"), code:, account:, term:, state:, sis:, **attrs)
    # sections
    extra = [0, 0, 1, 1, 2, 3][rng.rand(6)]
    extra.times do |i|
      sec_attrs = {}
      sec_attrs[:sis] = "#{code}-#{term_code.call(term)}-S#{i + 2}" if sis && rng.rand < 0.7
      if rng.rand < 0.1
        sec_attrs[:start_at] = now - 30.days
        sec_attrs[:end_at] = now + 30.days
        sec_attrs[:restrict_enrollments_to_section_dates] = true
      end
      c.section(course, ["Period #{i + 2}", "Section #{("B".ord + i).chr}", "#{name} – Group #{i + 2}"][rng.rand(3)], **sec_attrs)
    end
    ids << course.id
    course
  end

  c::CATALOG.each do |account, list|
    list.each do |name, code|
      state = rng.rand < 0.1 ? %w[created claimed][rng.rand(2)] : "available"
      mk.call(name, code, account, :current, state, 0)
      if rng.rand < 0.3
        term = %i[past1 past2 past0][rng.rand(3)]
        st = rng.rand < 0.5 ? "completed" : "available"
        past = mk.call(name, code, account, term, st, 1)
        to_conclude << past.id if st == "completed"
      end
      next unless rng.rand < 0.16

      term = %i[future1 future2][rng.rand(2)]
      mk.call(name, code, account, term, rng.rand < 0.75 ? "claimed" : "available", 2)
    end
  end
  # a few courses in the default term and a couple that will be deleted
  mk.call("Legacy Course in Default Term", "LEGACY", :root, :default, "available", 0)
  mk.call("Staff Lounge (default term)", "STAFF", :root, :default, "available", 0)
  2.times { |i| to_delete << mk.call("Duplicate Shell #{i + 1} (to be deleted)", "DUP#{i + 1}", :doa, :current, "claimed", 0).id }

  Seed.set_ref("courses:catalog", ids)
  Seed.set_ref("courses:to_conclude", Seed.ref("courses:to_conclude") + to_conclude)
  Seed.set_ref("courses:to_delete", Seed.ref("courses:to_delete") + to_delete)
  Seed.log "  #{count} catalog courses (#{to_conclude.size} to conclude, #{to_delete.size} to delete)"
end

Seed.step("courses.crosslist") do
  p1 = Course.where(id: Seed.ref("courses:catalog"), course_code: "PHYS1-P1").order(:id).first
  p3 = Course.where(id: Seed.ref("courses:catalog"), course_code: "PHYS1-P3").order(:id).first
  sec = Seed::Courses.section(p3, "Physics I P3 (cross-listed into Period 1)", sis: "PHYS1-P3-XLIST")
  Seed.set_ref("course:xlist_target", p1.id)
  Seed.set_ref("course:xlist_source", p3.id)
  Seed.set_ref("section:xlist", sec.id) # actually cross-listed in 04, after it has enrollments
  Seed.fixture(:crossListedSectionId, sec.id)
  Seed.fixture(:crossListTargetCourseId, p1.id)
  Seed.fixture(:crossListSourceCourseId, p3.id)
end

# --- SIS import #1 (real CSV zip through the API; processed by the jobs container) ----------
Seed.step("courses.sis_import_1", tx: false) do
  require "zip"
  rng = Seed.rng("sis1")
  first = Seed::Users::FIRST
  last = Seed::Users::LAST
  cur = Seed.term(:current)
  csv = ->(rows) { rows.map { |r| r.map { |v| v.to_s.match?(/[",\n]/) ? "\"#{v.to_s.gsub('"', '""')}\"" : v.to_s }.join(",") }.join("\n") + "\n" }

  users = [%w[user_id integration_id login_id first_name last_name full_name sortable_name short_name email status]]
  cohort = Array.new(130) do |i|
    f = first[rng.rand(first.size)]
    l = last[rng.rand(last.size)]
    id = format("SIS-STU-%04d", i + 1)
    login = "#{f}.#{l}.sis#{i + 1}".downcase.gsub(/[^a-z0-9.]/, "")
    users << [id, (i % 7).zero? ? "INT-#{id}" : "", login, f, l, "", "", (i % 9).zero? ? f[0, 3] : "", (i % 11).zero? ? "" : "#{login}@students.example.edu", "active"]
    id
  end
  users << ["SIS-TCH-0001", "", "sis.teacher.one", "Imported", "Teacher-One", "", "", "", "sis.teacher.one@example.edu", "active"]
  users << ["SIS-TCH-0002", "", "sis.teacher.two", "Ïmpörted", "Tëacher Twö", "Ïmpörted Tëacher Twö", "Twö, Ïmpörted Tëacher", "", "sis.teacher.two@example.edu", "active"]

  courses = [%w[course_id short_name long_name account_id term_id status start_date end_date course_format blueprint_course_id]]
  courses << ["FRSH-100-ALL", "FRSH-100", "Freshman Seminar (all sections, very large)", "SCH-RHS", cur.sis_source_id, "active", "", "", "on_campus", ""]
  courses << ["SIS-HEALTH-9", "HLTH-9", "Health 9 (SIS-managed)", "SCH-RHS", cur.sis_source_id, "active", "", "", "", ""]
  courses << ["SIS-PE-9", "PE-9", "Physical Education 9 (SIS-managed)", "SCH-RHS", cur.sis_source_id, "active", cur.start_at.iso8601, cur.end_at.iso8601, "", ""]
  courses << ["SIS-DRIVER-ED", "DRV-ED", "Driver Education (SIS, unpublished)", "SCH-DOA", "TERM-ONGOING", "unpublished", "", "", "online", ""]

  sections = [%w[section_id course_id name status start_date end_date]]
  6.times { |i| sections << ["FRSH-100-S#{i + 1}", "FRSH-100-ALL", "Seminar Group #{i + 1}#{" (Honors)" if i == 5}", "active", "", ""] }
  sections << ["SIS-HEALTH-9-A", "SIS-HEALTH-9", "Health 9 A", "active", "", ""]
  sections << ["SIS-HEALTH-9-B", "SIS-HEALTH-9", "Health 9 B", "active", "", ""]
  sections << ["SIS-PE-9-A", "SIS-PE-9", "PE 9 — Gym A", "active", "", ""]

  # 120 model-created students that have SIS ids join the SIS cohort in the large course
  existing = Pseudonym.active.where(user_id: Seed.ref("users:students")).where.not(sis_user_id: nil).order(:user_id).limit(120).pluck(:sis_user_id)
  roster = cohort + existing
  enroll = [%w[course_id user_id role section_id status limit_section_privileges]]
  roster.each_with_index do |sid, i|
    status = case i % 41
             when 7 then "inactive"
             when 19 then "completed"
             else "active"
             end
    enroll << ["", sid, "student", "FRSH-100-S#{(i % 6) + 1}", status, ""]
  end
  enroll << ["", "P-STUDENT-01", "student", "FRSH-100-S1", "active", ""]
  enroll << ["FRSH-100-ALL", "P-TEACHER-01", "teacher", "", "active", ""]
  enroll << ["FRSH-100-ALL", "SIS-TCH-0001", "teacher", "", "active", ""]
  6.times { |i| enroll << ["", "SIS-TCH-0002", "ta", "FRSH-100-S#{i + 1}", "active", "true"] } # section-limited TA in every section
  cohort.each_with_index do |sid, i|
    enroll << ["", sid, "student", "SIS-HEALTH-9-#{i.even? ? "A" : "B"}", "active", ""] if i < 56
    enroll << ["", sid, "student", "SIS-PE-9-A", "active", ""] if i >= 40 && i < 85
  end
  enroll << ["SIS-HEALTH-9", "SIS-TCH-0001", "teacher", "", "active", ""]
  enroll << ["SIS-PE-9", "SIS-TCH-0002", "teacher", "", "active", ""]
  enroll << ["SIS-PE-9", "P-TA-01", "ta", "", "active", ""]

  zip = Zip::OutputStream.write_buffer do |z|
    { "users.csv" => users, "courses.csv" => courses, "sections.csv" => sections, "enrollments.csv" => enroll }.each do |name, rows|
      z.put_next_entry(name)
      z.write(csv.call(rows))
    end
  end.string
  body, = Seed.api!(:post, "/api/v1/accounts/#{Seed.root.id}/sis_imports?import_type=instructure_csv&extension=zip&batch_mode=0", raw: zip, content_type: "application/zip")
  Seed.set_ref("sis_import:1", body["id"])
  Seed.fixture(:sisImportId, body["id"])
  Seed.log "  SIS import ##{body["id"]} submitted (#{users.size - 1} users, #{enroll.size - 1} enrollments); processing continues in canvas-jobs"
end
