# frozen_string_literal: true

# Submissions in the main course: every state (unsubmitted, on time, late, missing, excused,
# graded, resubmitted, needs-regrade), every submission type, attachments, comment threads
# (text / file / media / draft / group), peer reviews, moderated grading, anonymous and
# manually-posted grades, late-policy status overrides.

module Seed
  module Subs
    class << self
      # stable per-student "diligence" in 0.45..1.0 (index in the roster, not the DB id)
      def diligence(index)
        return 0.97 if index.zero? # persona student
        return 0.8 if index == 1   # persona student2

        0.45 + (Seed.rng("diligence:#{index}").rand * 0.55)
      end

      def score_for(points, dil, rng)
        return nil if points.nil?

        frac = (dil * 0.8) + 0.12 + ((rng.rand - 0.5) * 0.3)
        frac = [[frac, 0.2].max, 1.0].min
        frac = 1.04 if rng.rand < 0.02 # over 100% happens
        v = (points * frac * 2).round / 2.0
        points >= 1000 ? v.round : v
      end

      def grade_value(asg, dil, rng)
        case asg.grading_type
        when "pass_fail" then rng.rand < dil ? "complete" : "incomplete"
        when "letter_grade" then %w[A A- B+ B B- C+ C D F][[((1 - dil) * 9) + rng.rand(-1..1), 0].max.to_i.clamp(0, 8)]
        when "percent" then "#{(55 + (dil * 40) + rng.rand(-5..5)).round(1)}%"
        when "gpa_scale" then %w[4.0 3.7 3.3 3.0 2.7 2.3 2.0][((1 - dil) * 8).to_i.clamp(0, 6)]
        else score_for(asg.points_possible || 0, dil, rng)
        end
      end

      def file_for(student, course, rng, base, ext = nil)
        ext ||= %w[pdf txt docx csv png md][rng.rand(6)]
        content, type = Seed::Files.payload(ext, rng)
        name = "#{base}#{[".", " final.", "_v2.", " (1)."][rng.rand(4)]}#{ext}"
        Seed.upload(context: student, name:, content:, content_type: type, folder: student.submissions_folder(course), user: student)
      end

      # submit one attempt of the right kind for the assignment
      def submit(asg, student, rng, at:, comment: nil)
        types = asg.submission_types.split(",") & %w[online_text_entry online_url online_upload media_recording]
        type = types[rng.rand(types.size)]
        return nil unless type

        opts = { submission_type: type, submitted_at: at }
        opts[:comment] = comment if comment
        case type
        when "online_text_entry"
          opts[:body] = Seed::Text.html(rng, paragraphs: rng.rand(1..3)) + (rng.rand < 0.15 ? "<p>#{ERB::Util.html_escape(Seed::Text.unicode(rng))}</p>" : "")
        when "online_url"
          opts[:url] = "https://example.com/articles/#{rng.rand(100_000)}?ref=#{student.id}"
        when "online_upload"
          exts = asg.allowed_extensions.presence
          n = rng.rand < 0.2 ? 2 : 1
          opts[:attachments] = Array.new(n) { |i| file_for(student, asg.context, rng, "#{asg.title[0, 18].strip.parameterize(separator: "_")}_#{student.id}_#{i}", exts && exts[rng.rand(exts.size)]) }
        when "media_recording"
          opts[:media_comment_id] = "m-seed-#{asg.id}-#{student.id}"
          opts[:media_comment_type] = %w[video audio][rng.rand(2)]
        end
        asg.submit_homework(student, opts)
      end

      def comment(asg, student, author, text, **opts)
        asg.update_submission(student, { author:, comment: text }.merge(opts))
      end

      # full realistic treatment of one assignment for a list of [student, roster_index]
      def populate(asg, roster, rng, graders:, stats:, grade_ratio: 0.9)
        due = asg.due_at
        past = due.nil? || due < Seed.now
        paper = (asg.submission_types.split(",") & %w[online_text_entry online_url online_upload media_recording]).empty?
        roster.each do |student, idx|
          dil = diligence(idx)
          r = rng.rand
          grader = graders[rng.rand(graders.size)]
          if r < 0.02 && idx > 6
            asg.grade_student(student, excuse: true, grader:)
            stats[:excused] += 1
            next
          end
          submitted = false
          unless paper
            base = due || (Seed.now - rng.rand(1..30).days)
            if !past
              next unless rng.rand < dil * 0.15 # a few early birds on future work

              submit(asg, student, rng, at: Seed.now - rng.rand(1..72).hours)
              stats[:early] += 1
              next
            elsif r < (dil * 0.82) + 0.04
              submit(asg, student, rng, at: base - rng.rand(600..(5 * 86_400)).seconds)
              submitted = true
              stats[:on_time] += 1
            elsif r < [dil + 0.12, 0.985].min
              late_at = [base + rng.rand(700..(6 * 86_400)).seconds, Seed.now - 60.seconds].min
              submit(asg, student, rng, at: late_at)
              submitted = true
              stats[:late] += 1
            else
              stats[:missing] += 1
              next
            end
          end
          next unless paper ? rng.rand < 0.93 : rng.rand < grade_ratio

          asg.grade_student(student, grade: grade_value(asg, dil, rng), grader:)
          stats[:graded] += 1
          if rng.rand < 0.22
            comment(asg, student, grader, Seed::Text.sentence(rng, 4, 18))
            comment(asg, student, student, Seed::Text.sentence(rng, 3, 10)) if rng.rand < 0.3
            stats[:comments] += 1
          end
          next unless submitted && rng.rand < 0.07 && asg.allowed_attempts != 1

          # resubmission after grading -> "needs regrading"; half get regraded
          submit(asg, student, rng, at: [Seed.now - rng.rand(1..48).hours, (due || Seed.now) + 1.hour].max.then { |t| [t, Seed.now - 30.seconds].min })
          stats[:resubmitted] += 1
          asg.grade_student(student, grade: grade_value(asg, [dil + 0.1, 1.0].min, rng), grader:) if rng.rand < 0.5
        end
      end
    end
  end
end

# deterministic showcase rows on HW 1 for the first few roster entries (fixtures point here)
Seed.step("subs.showcase") do
  s = Seed::Subs
  rng = Seed.rng("subs.showcase")
  main = Seed.course(:main)
  hw1 = Assignment.find(Seed.ref("assignment:hw1"))
  students = Seed.users(:main_students)
  teacher = Seed.user(:teacher)
  ta = Seed.user(:ta)
  due = hw1.due_at
  student = students[0]

  sub = s.submit(hw1, student, rng, at: due - 2.days, comment: "Here is my homework. Let me know if the diagram is unclear!")
  hw1.grade_student(student, grade: 9, grader: teacher)
  s.comment(hw1, student, teacher, "Nice work, Sam. Check the labelling on the mitochondria. 👍")
  s.comment(hw1, student, student, "Thanks! Fixed it in my notes — ¿puedo reenviar?")
  s.comment(hw1, student, ta, "Reminder: lab notebooks are due Friday.")
  att = Seed.upload(context: hw1, name: "feedback-annotated.pdf", content: Seed::Files::PDF_MIN + "%fb\n", content_type: "application/pdf", user: teacher)
  with_file = s.comment(hw1, student, teacher, "Annotated copy attached.", attachments: [att]).first
  s.comment(hw1, student, teacher, "", media_comment_id: "m-seed-feedback-1", media_comment_type: "audio")
  draft = s.comment(hw1, student, teacher, "DRAFT: consider adding a note about osmosis here (not yet sent)", draft_comment: true).first
  first_comment = sub.reload.submission_comments.order(:id).first

  s.submit(hw1, students[1], rng, at: due + 26.hours) # late (persona student2)
  hw1.grade_student(students[1], grade: 8, grader: teacher)
  # students[2] stays missing
  hw1.grade_student(students[3], excuse: true, grader: teacher)
  3.times { |i| s.submit(hw1, students[4], rng, at: due - (3 - i).days) } # three attempts
  hw1.grade_student(students[4], grade: 10, grader: ta)
  s.submit(hw1, students[5], rng, at: due - 5.hours) # submitted, never graded
  s.submit(hw1, students[6], rng, at: due - 1.day)   # graded, then resubmitted -> needs regrade
  hw1.grade_student(students[6], grade: 6.5, grader: teacher)
  s.submit(hw1, students[6], rng, at: Seed.now - 3.hours)
  hw1.grade_student(students[7], grade: 0, grader: teacher) # explicit zero without a submission
  hw1.grade_student(students[8], grade: 11, grader: teacher) # over the maximum

  Seed.fixture(:submissionId, sub.id)
  Seed.fixture(:submissionUserId, student.id)
  Seed.fixture(:submissionCommentId, first_comment.id)
  Seed.fixture(:submissionCommentWithFileId, with_file.id)
  Seed.fixture(:draftSubmissionCommentId, draft.id)
  Seed.fixture(:lateSubmissionUserId, students[1].id)
  Seed.fixture(:missingSubmissionUserId, students[2].id)
  Seed.fixture(:excusedSubmissionUserId, students[3].id)
  Seed.fixture(:multiAttemptSubmissionUserId, students[4].id)
  Seed.fixture(:ungradedSubmissionUserId, students[5].id)
  Seed.fixture(:needsRegradeSubmissionUserId, students[6].id)
  Seed.set_ref("subs:showcase_count", 9)
  main.touch
end

# one step per core assignment keeps transactions small and progress visible
(Seed.ref?("assignments:core") ? Seed.ref("assignments:core") : []).each_with_index do |aid, n|
  Seed.step("subs.core.#{n}") do
    asg = Assignment.find(aid)
    rng = Seed.rng("subs.core.#{n}")
    students = Seed.users(:main_students)
    roster = students.each_with_index.to_a
    roster = roster.drop(Seed.ref("subs:showcase_count")) if aid == Seed.ref("assignment:hw1")
    graders = [Seed.user(:teacher), Seed.user(:teacher), Seed.user(:ta)]
    stats = Hash.new(0)
    recent = asg.due_at && asg.due_at > Seed.now - 9.days
    Seed::Subs.populate(asg, roster, rng, graders:, stats:, grade_ratio: recent ? 0.45 : 0.92)
    Seed.log "  #{asg.title[0, 40]}: #{stats.sort.map { |k, v| "#{k}=#{v}" }.join(" ")}"
  end
end

Seed.step("subs.partial") do
  rng = Seed.rng("subs.partial")
  students = Seed.users(:main_students).each_with_index.to_a
  graders = [Seed.user(:teacher), Seed.user(:ta)]
  special = %w[poster group_individual paper_final moderated_published anonymous anonymous_posted manual_post peer_auto].map { |k| Seed.ref("assignment:#{k}") }
  stats = Hash.new(0)
  Assignment.where(id: Seed.ref("assignments:partial") - special).order(:id).each do |asg|
    roster = students.select { |_, i| i < 2 || rng.rand < 0.24 }
    Seed::Subs.populate(asg, roster, rng, graders:, stats:, grade_ratio: 0.8)
  end
  Seed.log "  partial: #{stats.sort.map { |k, v| "#{k}=#{v}" }.join(" ")}"
end

Seed.step("subs.edge") do
  rng = Seed.rng("subs.edge")
  students = Seed.users(:main_students).each_with_index.to_a
  graders = [Seed.user(:teacher)]
  stats = Hash.new(0)
  skip = %w[section_only adhoc_only annotation unpublished unpublished_past unpublished_nodate copy not_graded].map { |k| Seed.ref("assignment:#{k}") }
  Assignment.where(id: Seed.ref("assignments:edge") - skip).order(:id).each do |asg|
    roster = students.select { |_, i| i < 2 || rng.rand < 0.07 }
    Seed::Subs.populate(asg, roster, rng, graders:, stats:, grade_ratio: 0.75)
  end
  # assignments only visible through overrides: only assigned students can have submissions
  sec = Assignment.find(Seed.ref("assignment:section_only"))
  p4 = CourseSection.find(Seed.ref("sections:main")[2])
  p4_students = students.select { |u, _| p4.student_enrollments.where(user_id: u.id, workflow_state: "active").exists? }
  Seed::Subs.populate(sec, p4_students.first(8), rng, graders:, stats:, grade_ratio: 0.5)
  Seed.log "  edge: #{stats.sort.map { |k, v| "#{k}=#{v}" }.join(" ")}"
end

Seed.step("subs.special") do
  s = Seed::Subs
  rng = Seed.rng("subs.special")
  main = Seed.course(:main)
  students = Seed.users(:main_students)
  teacher = Seed.user(:teacher)
  ta = Seed.user(:ta)
  ta2 = User.find(Seed.ref("users:main_tas")[2])
  asg = ->(k) { Assignment.find(Seed.ref("assignment:#{k}")) }

  # --- group assignment graded as a group: one member submits, everyone gets the submission/grade
  poster = asg.call(:poster)
  lab_groups = Group.where(id: Seed.ref("groups:lab")).order(:id).to_a
  lab_groups.each_with_index do |g, i|
    next if i % 5 == 4 # some teams never submit

    member = g.users.order(:id).first
    s.submit(poster, member, rng, at: poster.due_at - rng.rand(1..40).hours, comment: "Submitted for #{g.name}")
    next if i % 3 == 2

    poster.grade_student(member, grade: 38 + (i * 1.5), grader: teacher)
    s.comment(poster, member, teacher, "Great teamwork — applies to the whole group.", group_comment: "1") if i.even?
  end
  # --- group assignment graded individually
  indiv = asg.call(:group_individual)
  lab_groups.first(5).each do |g|
    members = g.users.order(:id).to_a
    s.submit(indiv, members.first, rng, at: indiv.due_at - 3.hours)
    members.each_with_index { |m, j| indiv.grade_student(m, grade: 15 + (j * 2), grader: ta) if j < 4 }
  end
  Seed.fixture(:groupSubmissionUserId, lab_groups.first.users.order(:id).first.id)

  # --- peer reviews (manual): assignments, some completed with comments
  draft = asg.call(:paper_draft)
  submitted = draft.submissions.where(workflow_state: %w[submitted graded]).where.not(submission_type: nil).order(:user_id).preload(:user).to_a
  requests = []
  submitted.each_with_index do |sub, i|
    reviewer_sub = submitted[(i + 1) % submitted.size]
    req = draft.assign_peer_review(reviewer_sub.user, sub.user)
    requests << req
    if i % 3 != 2
      sub.add_comment(author: reviewer_sub.user, comment: "Peer review: #{Seed::Text.paragraph(rng, 2)}", assessment_request: req)
    end
    next unless i % 4 == 0

    second = submitted[(i + 2) % submitted.size]
    draft.assign_peer_review(second.user, sub.user)
  end
  mine = draft.assign_peer_review(Seed.user(:student), Seed.user(:student2))
  Seed.fixture(:peerReviewId, mine.id)
  Seed.fixture(:peerReviewerUserId, Seed.ref("user:student"))
  Seed.fixture(:peerRevieweeUserId, Seed.ref("user:student2"))
  Seed.fixture(:peerReviewSubmissionId, mine.asset_id)
  # --- peer reviews (automatic + anonymous)
  auto = asg.call(:peer_auto)
  students.first(24).each_with_index { |u, i| s.submit(auto, u, rng, at: auto.due_at - (i + 1).hours) }
  auto.assign_peer_reviews

  # --- moderated grading: two provisional graders + final grader, selections; one published
  [asg.call(:paper_final), asg.call(:moderated_published)].each_with_index do |mod, n|
    pool = students.first(26)
    pool.each_with_index { |u, i| s.submit(mod, u, rng, at: mod.due_at - rng.rand(1..90).hours) unless i % 9 == 8 }
    pool.first(20).each_with_index do |u, i|
      d = s.diligence(i)
      mod.grade_student(u, grader: ta, score: s.score_for(mod.points_possible, d, rng), provisional: true)
      mod.grade_student(u, grader: ta2, score: s.score_for(mod.points_possible, d, rng), provisional: true) if i < 14
      sub = mod.submissions.find_by(user_id: u.id)
      sub.add_comment(author: ta, comment: "Provisional note: #{Seed::Text.sentence(rng)}", provisional: true) if i % 4 == 0
      next unless i < 8

      final = mod.grade_student(u, grader: teacher, score: s.score_for(mod.points_possible, d, rng), provisional: true, final: true)
      pg = sub.provisional_grades.final.first || Array(final).first
      sel = mod.moderated_grading_selections.where(student_id: u.id).first_or_create!
      sel.update!(selected_provisional_grade_id: (i.even? ? pg.id : sub.provisional_grades.not_final.order(:id).first.id))
    end
    if n == 1
      # release grades the way ProvisionalGradesController#publish does
      selections = mod.moderated_grading_selections.index_by(&:student_id)
      mod.submissions.preload(:provisional_grades).each do |sub|
        next if sub.provisional_grades.empty?

        chosen = sub.provisional_grades.detect { |pg| pg.id == selections[sub.user_id]&.selected_provisional_grade_id } ||
                 sub.provisional_grades.select { |pg| pg.graded_at.present? }.min_by(&:id)
        chosen&.publish!(skip_grade_calc: true)
      end
      mod.updating_user = teacher
      mod.update_attribute(:grades_published_at, Time.now.utc)
    else
      first_pg = mod.submissions.find_by(user_id: students[0].id).provisional_grades.not_final.order(:id).first
      Seed.fixture(:provisionalGradeId, first_pg.id)
      Seed.fixture(:moderatedStudentUserId, students[0].id)
    end
  end

  # --- anonymous grading: one still hidden, one posted
  anon = asg.call(:anonymous)
  students.first(30).each_with_index do |u, i|
    s.submit(anon, u, rng, at: anon.due_at - rng.rand(1..50).hours)
    anon.grade_student(u, grade: s.score_for(20, s.diligence(i), rng), grader: teacher, graded_anonymously: true) if i < 18
  end
  posted = asg.call(:anonymous_posted)
  students.first(30).each_with_index do |u, i|
    s.submit(posted, u, rng, at: posted.due_at - rng.rand(1..50).hours)
    posted.grade_student(u, grade: s.score_for(10, s.diligence(i), rng), grader: teacher, graded_anonymously: true)
  end
  posted.post_submissions
  # --- manual post policy: graded but hidden, a handful posted
  manual = asg.call(:manual_post)
  students.first(40).each_with_index { |u, i| manual.grade_student(u, grade: s.score_for(100, s.diligence(i), rng), grader: teacher) }
  manual.post_submissions(submission_ids: manual.submissions.where(user_id: students.first(6).map(&:id)).pluck(:id))
  s.comment(manual, students[10], teacher, "Hidden comment until grades are posted.")

  # --- explicit late-policy status overrides and a custom grade status
  hw2 = asg.call(:hw2)
  sub = hw2.submissions.find_by(user_id: students[12].id)
  sub.update!(late_policy_status: "missing")
  hw2.submissions.find_by(user_id: students[13].id).update!(late_policy_status: "late", seconds_late_override: 3 * 86_400)
  hw2.submissions.find_by(user_id: students[14].id).update!(late_policy_status: "none")
  hw2.submissions.find_by(user_id: students[15].id).update!(late_policy_status: "extended")
  if Seed.ref?("custom_grade_status:makeup")
    hw2.submissions.find_by(user_id: students[16].id).update!(custom_grade_status_id: Seed.ref("custom_grade_status:makeup"))
  end
  Seed.fixture(:lateStatusOverrideUserId, students[13].id)

  # --- LTI-style submission on the external tool assignment
  ext = asg.call(:external_tool)
  ext.submit_homework(students[0], submission_type: "basic_lti_launch", url: "https://course-tool.example.com/result/#{students[0].id}", submitted_at: ext.due_at - 1.day)
  ext.grade_student(students[0], grade: 18, grader: teacher)

  main.touch
end
