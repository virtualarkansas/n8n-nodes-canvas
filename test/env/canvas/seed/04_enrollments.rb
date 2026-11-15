# frozen_string_literal: true

# ~3000 enrollments: every type, every state, section-limited, multi-section, custom roles,
# observers linked to students; then the lifecycle edge cases that need enrollments first
# (cross-listing, deleted / merged users, test student).

module Seed
  module Enroll
    TYPES = { student: "StudentEnrollment", teacher: "TeacherEnrollment", ta: "TaEnrollment", designer: "DesignerEnrollment", observer: "ObserverEnrollment" }.freeze

    class << self
      def add(course, user, type = :student, state: "active", section: nil, role: nil, limit: false, multi: false, associated_user_id: nil, start_at: nil, end_at: nil)
        initial = case state
                  when "invited", "rejected" then "invited"
                  when "default" then nil
                  else "active"
                  end
        e = course.enroll_user(user, TYPES.fetch(type), enrollment_state: initial, section:, role:, limit_privileges_to_course_section: limit,
                                                        allow_multiple_enrollments: multi, associated_user_id:, start_at:, end_at:,
                                                        skip_touch_user: true, no_notify: true)
        case state
        when "inactive" then e.deactivate
        when "completed" then e.conclude
        when "deleted" then e.destroy
        when "rejected" then e.reject!
        end
        e
      end

      def role(key)
        @roles ||= {}
        @roles[key] ||= Role.find(Seed.ref("role:#{key}"))
      end
    end
  end
end

Seed.step("enroll.main") do
  e = Seed::Enroll
  main = Seed.course(:main)
  p1, p2, p4, p6 = CourseSection.where(id: Seed.ref("sections:main")).order(:id).to_a
  secs = [p1, p2, p4, p6]
  pool = Seed.users(:students)
  specials = Seed.users(:special_students)

  t = e.add(main, Seed.user(:teacher), :teacher)
  e.add(main, Seed.user(:teacher2), :teacher, role: e.role(:co_teacher), section: p2)
  ta = e.add(main, Seed.user(:ta), :ta)
  tas = Seed.users(:tas)
  limited = e.add(main, tas[0], :ta, section: p4, limit: true)
  lead = e.add(main, tas[1], :ta, role: e.role(:lead_ta))
  e.add(main, tas[2], :ta, section: p6, state: "invited")
  d = e.add(main, Seed.user(:designer), :designer)
  e.add(main, Seed.users(:designers)[0], :designer, role: e.role(:reviewer))

  student = e.add(main, Seed.user(:student), :student, section: p1)
  student2 = e.add(main, Seed.user(:student2), :student, section: p2)
  active = [Seed.user(:student), Seed.user(:student2)]
  specials.each_with_index do |u, i|
    e.add(main, u, :student, section: secs[i % 4])
    active << u
  end
  [Seed.user(:no_email), Seed.user(:multi_login), Seed.user(:multi_channel), Seed.user(:merge_target)].each_with_index do |u, i|
    e.add(main, u, :student, section: secs[i % 4])
    active << u
  end
  pool.first(34).each_with_index do |u, i|
    e.add(main, u, :student, section: secs[i % 4])
    active << u
  end
  # the same student in two sections (twice)
  multi = e.add(main, active[5], :student, section: p6, multi: true)
  e.add(main, active[6], :student, section: p2, multi: true)
  # non-active states
  invited = e.add(main, pool[34], :student, state: "invited", section: p1)
  e.add(main, pool[35], :student, state: "invited", section: p2)
  e.add(main, Seed.user(:pending), :student, state: "invited", section: p4)
  e.add(main, Seed.user(:creation_pending), :student, state: "invited", section: p4)
  inactive = e.add(main, pool[36], :student, state: "inactive", section: p1)
  e.add(main, pool[37], :student, state: "inactive", section: p2)
  e.add(main, Seed.user(:suspended), :student, state: "inactive", section: p6)
  concluded = e.add(main, pool[38], :student, state: "completed", section: p1)
  e.add(main, pool[39], :student, state: "completed", section: p4)
  deleted = e.add(main, pool[40], :student, state: "deleted", section: p1)
  e.add(main, pool[41], :student, state: "deleted", section: p6)
  e.add(main, pool[42], :student, state: "rejected", section: p2)
  e.add(main, Seed.user(:deleted), :student, section: p2) # user is deleted later
  e.add(main, Seed.user(:merge_source), :student, section: p4) # user is merged later
  auditor = e.add(main, pool[43], :student, role: e.role(:auditor), section: p6)
  # enrollment-level dates
  e.add(main, pool[44], :student, section: p1, start_at: Seed.now - 10.days, end_at: Seed.now + 10.days)
  # plain observer without a linked student + custom observer role
  e.add(main, Seed.users(:observers)[30], :observer)
  e.add(main, Seed.users(:observers)[31], :observer, role: e.role(:parent_volunteer), section: p2)

  Seed.set_ref("users:main_students", active.map(&:id))
  Seed.set_ref("users:main_tas", [Seed.ref("user:ta"), tas[0].id, tas[1].id])
  Seed.fixture(:enrollmentId, student.id)
  Seed.fixture(:student2EnrollmentId, student2.id)
  Seed.fixture(:teacherEnrollmentId, t.id)
  Seed.fixture(:taEnrollmentId, ta.id)
  Seed.fixture(:designerEnrollmentId, d.id)
  Seed.fixture(:sectionLimitedEnrollmentId, limited.id)
  Seed.fixture(:customRoleEnrollmentId, lead.id)
  Seed.fixture(:customStudentRoleEnrollmentId, auditor.id)
  Seed.fixture(:multiSectionEnrollmentId, multi.id)
  Seed.fixture(:invitedEnrollmentId, invited.id)
  Seed.fixture(:inactiveEnrollmentId, inactive.id)
  Seed.fixture(:concludedEnrollmentId, concluded.id)
  Seed.fixture(:deletedEnrollmentId, deleted.id)
  Seed.fixture(:inactiveStudentUserId, pool[36].id)
  Seed.fixture(:concludedStudentUserId, pool[38].id)
  Seed.fixture(:mainCourseStudentCount, active.size)
  Seed.log "  main course: #{active.size} active students"
end

Seed.step("enroll.second") do
  e = Seed::Enroll
  second = Seed.course(:second)
  s1, s2 = CourseSection.where(id: Seed.ref("sections:second")).order(:id).to_a
  pool = Seed.users(:students)
  e.add(second, Seed.user(:teacher), :teacher)
  e.add(second, Seed.user(:ta), :ta, section: s2, limit: true)
  e.add(second, Seed.user(:designer), :designer)
  active = [Seed.user(:student), Seed.user(:student2)]
  e.add(second, Seed.user(:student), :student, section: s1)
  e.add(second, Seed.user(:student2), :student, section: s2)
  (pool[20, 14] + pool[60, 12]).each_with_index do |u, i| # overlaps the main course roster on purpose
    e.add(second, u, :student, section: i.even? ? s1 : s2)
    active << u
  end
  e.add(second, pool[80], :student, state: "invited", section: s1)
  e.add(second, pool[81], :student, state: "inactive", section: s2)
  e.add(second, pool[82], :student, state: "completed", section: s2)
  Seed.set_ref("users:second_students", active.map(&:id))
  Seed.fixture(:course2StudentCount, active.size)
end

# catalog + remaining special courses, in chunks so each transaction stays moderate
Seed.step("enroll.plan") do
  special = %i[concluded unpublished deleted blueprint bp_child1 bp_child2 bp_child3 date_restricted_past date_restricted_future public paced].map { |k| Seed.ref("course:#{k}") }
  ids = special + Seed.ref("courses:catalog")
  Seed.set_ref("courses:enroll_chunks", ids.each_slice(16).to_a)
end

(Seed.ref?("courses:enroll_chunks") ? Seed.ref("courses:enroll_chunks") : []).each_with_index do |chunk, idx|
  Seed.step("enroll.catalog.#{idx}") do
    e = Seed::Enroll
    rng = Seed.rng("enroll.catalog.#{idx}")
    students = Seed.users(:students) + Seed.users(:special_students)
    teachers = Seed.users(:teachers)
    tas = Seed.users(:tas)
    designers = Seed.users(:designers)
    persona = { teacher: Seed.user(:teacher), student: Seed.user(:student), student2: Seed.user(:student2), ta: Seed.user(:ta), designer: Seed.user(:designer) }
    teacher_codes = %w[APBIO ANAT ENVS CHEM1 SANDBOX-TM CLUB-ROBO WHIST APCHEM BP-DIGCIT PFIN]
    student_codes = %w[ENG10 USHIST GEOM ART1 SPAN1 ADV10 CLUB-ROBO WHIST DIGCIT OPEN-STUDY PFIN BRIDGE HLTH CS101]
    student2_codes = %w[ENG10 SPAN1 CLUB-ROBO DIGCIT GEOM]
    ta_codes = %w[APBIO CHEM1]
    designer_codes = %w[BP-DIGCIT APBIO PD-CANVAS WEB1]
    total = 0
    Course.where(id: chunk).order(:id).each do |course|
      sections = course.course_sections.active.order(:id).to_a
      published = course.available?
      code = course.course_code
      # staff
      e.add(course, teachers[rng.rand(teachers.size)], :teacher)
      e.add(course, teachers[rng.rand(teachers.size)], :teacher, section: sections.last, limit: rng.rand < 0.5) if rng.rand < 0.2
      e.add(course, persona[:teacher], :teacher) if teacher_codes.include?(code)
      rng.rand(0..2).times { e.add(course, tas[rng.rand(tas.size)], :ta, section: sections[rng.rand(sections.size)], limit: rng.rand < 0.3) }
      e.add(course, persona[:ta], :ta) if ta_codes.include?(code)
      e.add(course, designers[rng.rand(designers.size)], :designer) if rng.rand < 0.12
      e.add(course, persona[:designer], :designer) if designer_codes.include?(code)
      total += 2
      next if course.id == Seed.ref("course:blueprint") # blueprint courses carry no students

      # students
      n = rng.rand(12..42)
      n = 8 if %w[PD-NTO PD-CANVAS SANDBOX-TM].include?(code)
      roster = students.sample(n, random: rng)
      roster.each do |u|
        r = rng.rand
        state = if !published then "default"
                elsif r < 0.90 then "active"
                elsif r < 0.94 then "invited"
                elsif r < 0.96 then "inactive"
                elsif r < 0.98 then "completed"
                else
                  "deleted"
                end
        e.add(course, u, :student, state:, section: sections[rng.rand(sections.size)])
      end
      total += n
      e.add(course, persona[:student], :student, section: sections.first, state: published ? "active" : "default") if student_codes.include?(code)
      e.add(course, persona[:student2], :student, section: sections.last, state: published ? "active" : "default") if student2_codes.include?(code)
    end
    Seed.log "  chunk #{idx}: #{chunk.size} courses, ~#{total} enrollments"
  end
end

# The teacher persona teaches well over one API page of courses (published and unpublished).
Seed.step("enroll.teacher_persona") do
  teacher = Seed.user(:teacher)
  have = teacher.enrollments.where(type: "TeacherEnrollment").where.not(workflow_state: "deleted").distinct.pluck(:course_id)
  catalog = Course.where(id: Seed.ref("courses:catalog")).where.not(id: have + Seed.ref("courses:to_delete")).order(:id).to_a
  unpublished = catalog.reject(&:available?).first(7)
  published = catalog.select(&:available?).each_slice(3).map(&:first).first(12)
  (unpublished + published).each { |course| Seed::Enroll.add(course, teacher, :teacher) }
  Seed::Enroll.add(Seed.course(:date_restricted_future), teacher, :teacher)
  Seed::Enroll.add(Seed.course(:public), teacher, :teacher)
  count = teacher.enrollments.where(type: "TeacherEnrollment").where.not(workflow_state: "deleted").distinct.count(:course_id)
  Seed.fixture(:teacherCourseCount, count)
  Seed.log "  teacher persona now teaches #{count} courses"
end

# SIS import #1 must be finished before anything touches the large course.
Seed.step("enroll.sis_import_1_done", tx: false) do
  id = Seed.ref("sis_import:1")
  batch = Seed.wait_for("SIS import #{id}", timeout: 900, interval: 3) do
    b = SisBatch.find(id)
    b if %w[imported imported_with_messages failed failed_with_messages aborted].include?(b.workflow_state)
  end
  raise "SIS import #{id} ended #{batch.workflow_state}" unless batch.workflow_state.start_with?("imported")

  large = Course.where(root_account_id: Seed.root.id, sis_source_id: "FRSH-100-ALL").first!
  large.offer! unless large.available?
  Course.where(root_account_id: Seed.root.id, sis_source_id: %w[SIS-HEALTH-9 SIS-PE-9]).each { |c| c.offer! unless c.available? }
  sections = large.course_sections.active.order(:id).pluck(:id)
  cohort = Pseudonym.active.where(account_id: Seed.root.id).where("sis_user_id LIKE 'SIS-STU-%'").order(:sis_user_id).pluck(:user_id)
  ActiveRecord::Base.transaction do
    Seed.set_ref("course:large", large.id)
    Seed.set_ref("users:sis_cohort", cohort)
  end
  Seed.fixture(:largeCourseId, large.id)
  Seed.fixture(:largeCourseSisId, "FRSH-100-ALL")
  Seed.fixture(:largeCourseSectionIds, sections)
  Seed.fixture(:largeCourseStudentCount, large.student_enrollments.where(workflow_state: "active").distinct.count(:user_id))
  Seed.fixture(:sisManagedCourseId, Course.where(sis_source_id: "SIS-HEALTH-9").pick(:id))
  Seed.fixture(:sisUserId, cohort.first)
  Seed.fixture(:sisUserSisId, "SIS-STU-0001")
  Seed.log "  large course #{large.id}: #{large.student_enrollments.where(workflow_state: "active").count} active student enrollments in #{sections.size} sections"
end

Seed.step("enroll.observers") do
  root = Seed.root
  rng = Seed.rng("enroll.observers")
  observers = Seed.users(:observers)
  main_students = Seed.users(:main_students)
  pool = Seed.users(:students)
  link = ->(obs, stu) { UserObservationLink.create_or_restore(student: stu, observer: obs, root_account: root) }
  # persona observer watches the persona student plus two more (so the observees list pages)
  first = link.call(Seed.user(:observer), Seed.user(:student))
  link.call(Seed.user(:observer), Seed.user(:student2))
  link.call(Seed.user(:observer), main_students[10])
  observers.first(30).each_with_index do |obs, i|
    kids = i < 8 ? main_students.sample(rng.rand(1..2), random: rng) : pool.sample(rng.rand(1..3), random: rng)
    kids.each { |k| link.call(obs, k) }
  end
  # two parents for one child; one link later removed
  link.call(observers[32], main_students[3])
  link.call(observers[33], main_students[3])
  gone = link.call(observers[34], main_students[4])
  gone.destroy
  Seed.fixture(:observeeUserId, Seed.ref("user:student"))
  Seed.fixture(:userObservationLinkId, first.id)
  Seed.log "  #{UserObservationLink.active.count} observer links"
end

Seed.step("enroll.lifecycle") do
  rng = Seed.rng("enroll.lifecycle")
  main = Seed.course(:main)

  # cross-list a populated section into another course
  sec = CourseSection.find(Seed.ref("section:xlist"))
  src = Seed.course(:xlist_source)
  Seed.users(:students).sample(9, random: rng).each { |u| Seed::Enroll.add(src, u, :student, section: sec) }
  sec.crosslist_to_course(Seed.course(:xlist_target))

  # observer enrollments for the persona now exist; record one for the fixtures
  obs = main.observer_enrollments.where(user_id: Seed.ref("user:observer"), associated_user_id: Seed.ref("user:student")).first
  Seed.fixture(:observerEnrollmentId, obs.id) if obs

  # Test Student (student view) in the main course
  fake = main.student_view_student
  Seed.fixture(:testStudentUserId, fake.id)

  # realistic activity columns on a sample of active enrollments
  ids = Enrollment.where(workflow_state: "active", type: "StudentEnrollment").order(:id).pluck(:id)
  ids.each_slice(400) do |slice|
    slice.each do |id|
      next if rng.rand < 0.35

      Enrollment.where(id:).update_all(last_activity_at: Seed.now - rng.rand(0..60 * 24 * 40).minutes, total_activity_time: rng.rand(60..90_000))
    end
  end

  # soft-delete one user and merge another (both had enrollments in the main course)
  Seed.user(:deleted).destroy
  UserMerge.from(Seed.user(:merge_source)).into(Seed.user(:merge_target))
end
