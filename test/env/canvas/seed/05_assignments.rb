# frozen_string_literal: true

# Main-course groups (needed by group assignments), assignment groups, ~95 directly created
# assignments covering every submission / grading type and date shape (quizzes and graded
# discussions add ~25 more later), overrides, late policies, custom gradebook columns, and a
# lighter set of assignments in the other courses.

module Seed
  module Assign
    class << self
      # 23:59:59 in the course's zone, n days from now (Canvas "fancy midnight")
      def due(n)
        (Seed.now + n.days).in_time_zone("America/Chicago").end_of_day.change(usec: 0)
      end

      def at(n, hour = 8)
        (Seed.now + n.days).in_time_zone("America/Chicago").change(hour:, min: 0)
      end

      def create(course, title:, group: nil, published: true, post_manually: false, tool_url: nil, **attrs)
        a = course.assignments.build(title:, **attrs)
        a.assignment_group = group if group
        a.workflow_state = published ? "published" : "unpublished"
        a.external_tool_tag_attributes = { url: tool_url, new_tab: false } if tool_url
        a.save!
        a.ensure_post_policy(post_manually: true) if post_manually
        a
      end

      def override(target, set: nil, students: nil, title: nil, due_at: :none, unlock_at: :none, lock_at: :none)
        o = target.assignment_overrides.build
        if set
          o.set = set
        else
          o.set_type = "ADHOC"
          o.title = title || "#{students.size} student#{"s" if students.size != 1}"
        end
        o.override_due_at(due_at) unless due_at == :none
        o.override_unlock_at(unlock_at) unless unlock_at == :none
        o.override_lock_at(lock_at) unless lock_at == :none
        o.save!
        students&.each { |s| o.assignment_override_students.create!(user: s) }
        o
      end
    end
  end
end

Seed.step("groups.main") do
  main = Seed.course(:main)
  rng = Seed.rng("groups.main")
  students = Seed.users(:main_students)
  cat = lambda do |name, **attrs|
    main.group_categories.where(name:).first || main.group_categories.create!(name:, **attrs)
  end
  grp = lambda do |category, name, members, leader: nil, **attrs|
    g = category.groups.create!(name:, context: main, **attrs)
    members.each { |u| g.add_user(u, "accepted") }
    g.update!(leader:) if leader
    g
  end

  lab = cat.call("Lab Teams", sis_source_id: "BIO101-GC-LAB")
  lab_groups = students.each_slice(6).each_with_index.map do |members, i|
    grp.call(lab, "Lab Team #{i + 1}#{[" 🧬", "", " (Wed)", ""][i % 4]}", members, leader: members.first, sis_source_id: (i < 6 ? "BIO101-LAB-#{i + 1}" : nil))
  end
  proj = cat.call("Project Groups (self sign-up, max 4)", self_signup: "enabled", group_limit: 4, auto_leader: "first")
  proj_groups = students.shuffle(random: rng).first(46).each_slice(4).each_with_index.map do |members, i|
    grp.call(proj, "Project Group #{("A".ord + i).chr}", i == 3 ? members.first(1) : members, description: Seed::Text.sentence(rng))
  end
  2.times { |i| grp.call(proj, "Project Group (empty #{i + 1})", []) }
  circles = cat.call("Study Circles (same section only)", self_signup: "restricted", self_signup_end_at: Seed.now + 14.days)
  3.times { |i| grp.call(circles, "Study Circle #{i + 1}", students.select.with_index { |_, j| j % 4 == i }.first(3)) }
  cat.call("Empty Category (no groups)")
  dead = cat.call("Old Seating Chart Groups (deleted)")
  grp.call(dead, "Row 1", students.first(2))
  dead.destroy

  # student-organised groups with the different join levels and pending memberships
  organized = GroupCategory.student_organized_for(main)
  s1 = Seed.user(:student)
  s2 = Seed.user(:student2)
  club = grp.call(organized, "Sam's Study Buddies", [s1, s2, students[7], students[9]], leader: s1, join_level: "parent_context_auto_join", is_public: false)
  invite_only = grp.call(organized, "Invite-only Exam Prep", [s2, students[12]], leader: s2, join_level: "invitation_only")
  invite_only.add_user(students[13], "invited")
  request = grp.call(organized, "Request-to-join Frog Fans 🐸", [students[14]], join_level: "parent_context_request")
  request.add_user(students[15], "requested")
  request.add_user(s1, "requested")
  removed = lab_groups.last.add_user(students[1], "accepted")
  removed.destroy if removed.respond_to?(:destroy) && lab_groups.last.users.count > 1 && students[1].id != lab_groups.last.leader_id

  Seed.set_ref("group_category:lab", lab.id)
  Seed.set_ref("group_category:project", proj.id)
  Seed.set_ref("groups:lab", lab_groups.map(&:id))
  Seed.set_ref("groups:project", proj_groups.map(&:id))
  Seed.set_ref("group:student_club", club.id)
  Seed.fixture(:groupCategoryId, lab.id)
  Seed.fixture(:selfSignupGroupCategoryId, proj.id)
  Seed.fixture(:restrictedGroupCategoryId, circles.id)
  Seed.fixture(:studentOrganizedGroupCategoryId, organized.id)
  Seed.fixture(:groupId, lab_groups.first.id)
  Seed.fixture(:groupId2, lab_groups[1].id)
  Seed.fixture(:studentGroupId, club.id)
  Seed.fixture(:inviteOnlyGroupId, invite_only.id)
  Seed.fixture(:requestToJoinGroupId, request.id)
  Seed.fixture(:groupMembershipId, club.group_memberships.where(user_id: s1.id).first.id)
  Seed.log "  #{main.groups.active.count} groups in the main course"
end

Seed.step("assign.groups") do
  main = Seed.course(:main)
  main.update!(group_weighting_scheme: "percent")
  default = main.assignment_groups.active.order(:id).first
  defs = [
    [:homework, "Homework", 20, "drop_lowest:2\n"],
    [:labs, "Labs & Practicals", 25, "drop_lowest:1\ndrop_highest:1\n"],
    [:quizzes, "Quizzes", 15, "drop_lowest:1\n"],
    [:exams, "Exams", 20, nil],
    [:projects, "Projects", 10, nil],
    [:participation, "Participation", 5, nil],
    [:discussions, "Discussions", 5, nil],
    [:extra, "Extra Credit ⭐", 0, nil],
    [:misc, "Ungraded / Practice / Edge cases", 0, nil],
    [:empty, "Empty Group (no assignments)", 0, nil]
  ]
  defs.each_with_index do |(key, name, weight, rules), i|
    g = if i.zero? && default
          default.update!(name:, group_weight: weight, rules:, position: 1)
          default
        else
          main.assignment_groups.where(name:).first || main.assignment_groups.create!(name:, group_weight: weight, rules:, position: i + 1)
        end
    g.update!(sis_source_id: "BIO101-AG-#{key.to_s.upcase}", integration_data: { "sis" => key.to_s }) if %i[homework exams].include?(key)
    Seed.set_ref("assignment_group:#{key}", g.id)
  end
  gone = main.assignment_groups.create!(name: "Imported Assignments (deleted)", group_weight: 0, position: 11)
  gone.destroy
  Seed.fixture(:assignmentGroupId, Seed.ref("assignment_group:homework"))
  Seed.fixture(:emptyAssignmentGroupId, Seed.ref("assignment_group:empty"))
  Seed.fixture(:deletedAssignmentGroupId, gone.id)
end

Seed.step("assign.main") do
  a = Seed::Assign
  main = Seed.course(:main)
  rng = Seed.rng("assign.main")
  teacher = Seed.user(:teacher)
  ag = ->(k) { AssignmentGroup.find(Seed.ref("assignment_group:#{k}")) }
  groups = %i[homework labs quizzes exams projects participation discussions extra misc].to_h { |k| [k, ag.call(k)] }
  letter = GradingStandard.find(Seed.ref("grading_standard:letter"))
  gpa = GradingStandard.find(Seed.ref("grading_standard:gpa"))
  lab_cat = GroupCategory.find(Seed.ref("group_category:lab"))
  proj_cat = GroupCategory.find(Seed.ref("group_category:project"))
  tool = main.context_external_tools.create!(name: "Battery LTI 1.1 Tool (course)", consumer_key: "battery-course", shared_secret: "s3cret-course",
                                             url: "https://course-tool.example.com/launch", privacy_level: "public",
                                             custom_fields: { "course" => "$Canvas.course.id" })
  Seed.fixture(:courseExternalToolId, tool.id)
  annot = Seed.upload(context: main, name: "annotate-me.pdf", content: Seed::Files::PDF_MIN, content_type: "application/pdf", user: teacher)

  core = []
  partial = []
  edge = []
  all = {}
  mk = lambda do |key, bucket, title, group, **attrs|
    desc = attrs.key?(:description) ? attrs.delete(:description) : Seed::Text.html(rng, paragraphs: rng.rand(1..2), rich: rng.rand < 0.25)
    asg = a.create(main, title:, group: groups.fetch(group), description: desc, **attrs)
    all[key] = asg
    Seed.set_ref("assignment:#{key}", asg.id)
    bucket << asg.id if bucket
    asg
  end

  # ---- core: every active student gets a realistic outcome on these (06) ----------------
  hw_types = %w[online_text_entry online_text_entry online_url online_upload online_text_entry,online_upload online_text_entry online_upload online_text_entry,online_url]
  8.times do |i|
    mk.call(:"hw#{i + 1}", core, "HW #{i + 1}: #{Seed::Text.title(rng, 2, 4)}", :homework, submission_types: hw_types[i],
                                                                                           points_possible: [10, 10, 15, 20, 10, 12.5, 25, 10][i], due_at: a.due(-70 + (i * 8)), unlock_at: a.at(-78 + (i * 8)),
                                                                                           lock_at: (i < 3 ? a.due(-60 + (i * 8)) : nil))
  end
  4.times do |i|
    mk.call(:"lab#{i + 1}", core, "Lab #{i + 1}: #{Seed::Text.title(rng, 2, 3)}", :labs, submission_types: "online_upload",
                                                                                        allowed_extensions: (i.even? ? %w[pdf docx txt csv png] : []), points_possible: 30, due_at: a.due(-62 + (i * 14)))
  end
  mk.call(:exam1, core, "Unit 1 Exam: The Cell", :exams, submission_types: "on_paper", points_possible: 100, due_at: a.due(-55), grading_type: "points")
  mk.call(:midterm, core, "Midterm Exam", :exams, submission_types: "on_paper", points_possible: 150, due_at: a.due(-25), grading_type: "letter_grade", grading_standard: letter)
  mk.call(:field_journal, core, "Field Journal (text or file)", :projects, submission_types: "online_text_entry,online_upload", points_possible: 40, due_at: a.due(-18), allowed_attempts: 3)
  mk.call(:paper_draft, core, "Research Paper — Draft (peer review)", :projects, submission_types: "online_text_entry,online_upload", points_possible: 20, due_at: a.due(-30),
                                                                               peer_reviews: true, peer_review_count: 2, automatic_peer_reviews: false, peer_reviews_due_at: a.due(-23))

  # ---- partial: roughly a third of the class has activity ---------------------------------
  4.times do |i|
    mk.call(:"hw#{i + 9}", partial, "HW #{i + 9}: #{Seed::Text.title(rng, 2, 4)}", :homework, submission_types: hw_types[i + 2], points_possible: 10,
                                                                                             due_at: a.due(-6 + (i * 7)), unlock_at: (i == 3 ? a.at(10) : nil))
  end
  4.times do |i|
    mk.call(:"lab#{i + 5}", partial, "Lab #{i + 5}: #{Seed::Text.title(rng, 2, 3)}", :labs, submission_types: "online_upload,online_text_entry", points_possible: 30, due_at: a.due(-6 + (i * 10)))
  end
  8.times do |i|
    mk.call(:"participation#{i + 1}", partial, "Week #{i + 1} Participation", :participation, submission_types: "none", points_possible: 5,
                                                                                              grading_type: (i.even? ? "points" : "pass_fail"), due_at: a.due(-80 + (i * 7)), description: nil)
  end
  mk.call(:poster, partial, "Ecosystem Poster (group project)", :projects, submission_types: "online_upload", points_possible: 50, due_at: a.due(-12),
                                                                           group_category: lab_cat, grade_group_students_individually: false)
  mk.call(:group_individual, partial, "Lab Team Report (graded individually)", :labs, submission_types: "online_text_entry", points_possible: 25, due_at: a.due(-9),
                                                                                      group_category: lab_cat, grade_group_students_individually: true)
  mk.call(:paper_final, partial, "Research Paper — Final (moderated)", :projects, submission_types: "online_text_entry,online_upload", points_possible: 100, due_at: a.due(-10),
                                                                                  moderated_grading: true, grader_count: 2, final_grader: teacher, grader_comments_visible_to_graders: true,
                                                                                  grader_names_visible_to_final_grader: true, graders_anonymous_to_graders: false)
  mk.call(:moderated_published, partial, "Lab Practical (moderated, grades released)", :labs, submission_types: "online_text_entry", points_possible: 40, due_at: a.due(-40),
                                                                                              moderated_grading: true, grader_count: 2, final_grader: teacher)
  mk.call(:anonymous, partial, "Reflection Essay (anonymous grading)", :homework, submission_types: "online_text_entry", points_possible: 20, due_at: a.due(-15), anonymous_grading: true)
  mk.call(:anonymous_posted, partial, "Ethics Response (anonymous, posted)", :homework, submission_types: "online_text_entry", points_possible: 10, due_at: a.due(-45), anonymous_grading: true)
  mk.call(:manual_post, partial, "Unit 2 Exam (grades hidden — manual post)", :exams, submission_types: "on_paper", points_possible: 100, due_at: a.due(-8), post_manually: true)
  mk.call(:peer_auto, partial, "Peer Critique: Lab Poster (automatic, anonymous peer review)", :projects, submission_types: "online_text_entry", points_possible: 10, due_at: a.due(-20),
                                                                                                    peer_reviews: true, peer_review_count: 2, automatic_peer_reviews: true, anonymous_peer_reviews: true, peer_reviews_due_at: a.due(-13))
  mk.call(:media, partial, "Science Fair Pitch (media recording)", :projects, submission_types: "media_recording", points_possible: 15, due_at: a.due(-5))
  mk.call(:url_only, partial, "Share a News Article (URL)", :homework, submission_types: "online_url", points_possible: 5, due_at: a.due(-33))
  mk.call(:external_tool, partial, "Virtual Dissection (LTI tool)", :labs, submission_types: "external_tool", points_possible: 20, due_at: a.due(-14), tool_url: "https://course-tool.example.com/launch?module=frog")
  mk.call(:external_tool_account, partial, "Library Research Module (account LTI tool)", :homework, submission_types: "external_tool", points_possible: 10, due_at: a.due(7), tool_url: "https://lti.example.com/launch?unit=3")

  # ---- edge cases -----------------------------------------------------------------------------
  mk.call(:zero_points, edge, "Bonus: Science Museum Visit (0 points)", :extra, submission_types: "online_text_entry", points_possible: 0, due_at: a.due(-28))
  mk.call(:extra_credit2, edge, "Extra Credit Reading Log", :extra, submission_types: "online_text_entry,online_url", points_possible: 0, due_at: nil)
  mk.call(:half_point, edge, "Exit Ticket (0.5 points)", :misc, submission_types: "online_text_entry", points_possible: 0.5, due_at: a.due(-50))
  mk.call(:decimal_points, edge, "Microscope Skills Check (7.25 pts)", :labs, submission_types: "on_paper", points_possible: 7.25, due_at: a.due(-48))
  mk.call(:huge_points, edge, "Semester Portfolio (1,000,000 points)", :misc, submission_types: "online_upload", points_possible: 1_000_000, due_at: a.due(20), omit_from_final_grade: true)
  mk.call(:pass_fail, edge, "Lab Safety Contract (complete/incomplete)", :misc, submission_types: "online_text_entry", points_possible: 1, grading_type: "pass_fail", due_at: a.due(-85))
  mk.call(:letter_grade, edge, "Book Report (letter grade)", :homework, submission_types: "online_upload", points_possible: 100, grading_type: "letter_grade", grading_standard: letter, due_at: a.due(-35))
  mk.call(:percent, edge, "Vocabulary Check (percent)", :homework, submission_types: "online_text_entry", points_possible: 40, grading_type: "percent", due_at: a.due(-38))
  mk.call(:gpa, edge, "Capstone Outline (GPA scale)", :projects, submission_types: "online_text_entry", points_possible: 50, grading_type: "gpa_scale", grading_standard: gpa, due_at: a.due(-22))
  mk.call(:not_graded, edge, "Read Chapter 7 (not graded)", :misc, submission_types: "none", grading_type: "not_graded", points_possible: nil, due_at: a.due(-3))
  mk.call(:not_graded_submit, edge, "Practice Upload (not graded, accepts files)", :misc, submission_types: "online_upload", grading_type: "not_graded", points_possible: nil, due_at: nil)
  mk.call(:omit, edge, "Practice Quiz Corrections (omitted from final grade)", :misc, submission_types: "online_text_entry", points_possible: 10, omit_from_final_grade: true, due_at: a.due(-27))
  mk.call(:on_paper, edge, "In-class Worksheet (on paper)", :homework, submission_types: "on_paper", points_possible: 10, due_at: a.due(-41))
  mk.call(:no_submission, edge, "Notebook Check (no submission)", :participation, submission_types: "none", points_possible: 10, due_at: a.due(-44))
  mk.call(:no_due, edge, "Ongoing Reading Journal (no due date)", :homework, submission_types: "online_text_entry", points_possible: 10, due_at: nil)
  mk.call(:all_null, edge, "Untitled-ish (no dates, no description)", :misc, submission_types: "online_text_entry", points_possible: 5, due_at: nil, description: nil)
  mk.call(:far_past, edge, "Summer Reading Check (due long ago)", :homework, submission_types: "online_text_entry", points_possible: 10, due_at: a.due(-200), lock_at: a.due(-190))
  mk.call(:far_future, edge, "Next Year Preview (due far in the future)", :misc, submission_types: "online_text_entry", points_possible: 10, due_at: a.due(300), unlock_at: a.at(280))
  mk.call(:future, edge, "Final Exam", :exams, submission_types: "on_paper", points_possible: 200, due_at: a.due(32))
  mk.call(:future2, edge, "Unit 5 Project Proposal", :projects, submission_types: "online_text_entry,online_upload", points_possible: 30, due_at: a.due(12), unlock_at: a.at(2))
  mk.call(:due_tomorrow, edge, "Due Tomorrow: Lab Prep", :labs, submission_types: "online_text_entry", points_possible: 5, due_at: a.due(1))
  mk.call(:due_today, edge, "Due Today: Warm-up", :homework, submission_types: "online_text_entry", points_possible: 5, due_at: Seed.now + 5.hours)
  mk.call(:locked, edge, "Closed Assignment (lock date passed)", :homework, submission_types: "online_text_entry", points_possible: 10, due_at: a.due(-58), lock_at: a.due(-52))
  mk.call(:not_yet_unlocked, edge, "Locked Until Next Month", :homework, submission_types: "online_upload", points_possible: 10, unlock_at: a.at(25), due_at: a.due(35), lock_at: a.due(40))
  mk.call(:all_dates, edge, "Window Assignment (unlock/due/lock all set)", :homework, submission_types: "online_text_entry", points_possible: 10, unlock_at: a.at(-4), due_at: a.due(3), lock_at: a.due(6))
  mk.call(:midnight, edge, "Due at exactly midnight UTC", :misc, submission_types: "online_text_entry", points_possible: 3, due_at: (Seed.now - 16.days).utc.beginning_of_day)
  mk.call(:unpublished, edge, "DRAFT — Genetics Problem Set (unpublished)", :homework, submission_types: "online_text_entry", points_possible: 20, due_at: a.due(15), published: false)
  mk.call(:unpublished_past, edge, "Forgotten Draft (unpublished, due date passed)", :homework, submission_types: "online_upload", points_possible: 10, due_at: a.due(-20), published: false)
  mk.call(:unpublished_nodate, edge, "Idea: Field Trip Reflection (unpublished)", :misc, submission_types: "online_text_entry", points_possible: nil, grading_type: "not_graded", published: false, description: nil)
  mk.call(:section_only, edge, "Honors Extension (Period 4 only)", :homework, submission_types: "online_text_entry", points_possible: 15, only_visible_to_overrides: true, due_at: nil)
  mk.call(:adhoc_only, edge, "Makeup Lab (assigned to 3 students only)", :labs, submission_types: "online_upload", points_possible: 30, only_visible_to_overrides: true, due_at: nil)
  mk.call(:overrides, edge, "Chapter 6 Questions (different dates per section)", :homework, submission_types: "online_text_entry", points_possible: 10, due_at: a.due(-11), unlock_at: a.at(-20), lock_at: a.due(-4))
  mk.call(:group_override, edge, "Group Presentation Slides (per-group due dates)", :projects, submission_types: "online_upload", points_possible: 25, due_at: a.due(4), group_category: proj_cat)
  mk.call(:attempts1, edge, "One-shot Submission (1 attempt)", :homework, submission_types: "online_text_entry", points_possible: 10, allowed_attempts: 1, due_at: a.due(-17))
  mk.call(:ext_restricted, edge, "PDF Only Upload", :homework, submission_types: "online_upload", allowed_extensions: %w[pdf], points_possible: 10, due_at: a.due(-13))
  mk.call(:multi_type, edge, "Choice Board (any submission type)", :projects, submission_types: "online_text_entry,online_url,online_upload,media_recording", points_possible: 20, due_at: a.due(-7))
  mk.call(:annotation, edge, "Annotate the Diagram (student annotation)", :labs, submission_types: "student_annotation", annotatable_attachment_id: annot.id, points_possible: 10, due_at: a.due(9))
  mk.call(:post_to_sis, edge, "SIS-synced Benchmark", :exams, submission_types: "on_paper", points_possible: 50, due_at: a.due(-36), post_to_sis: true, integration_id: "INT-BENCH-1", sis_source_id: "BIO101-BENCH-1")
  mk.call(:important, edge, "Science Fair Entry Deadline (important date)", :projects, submission_types: "online_upload", points_possible: 0, due_at: a.due(18), important_dates: true)
  mk.call(:long_title, edge, "Long title #{"— a very long assignment name that keeps going " * 6}"[0, 250], :misc, submission_types: "online_text_entry", points_possible: 1, due_at: nil)
  mk.call(:emoji_title, edge, "🧪 Lab Clean-up Sign-off ✅ — ¡Importante! 重要", :participation, submission_types: "none", points_possible: 2, due_at: a.due(-2))
  mk.call(:html_title, edge, "<i>Italic</i> & \"quoted\" / slashed \\ title #1", :misc, submission_types: "online_text_entry", points_possible: 1, due_at: nil)
  mk.call(:spaces_title, edge, "   Leading and trailing spaces   ", :misc, submission_types: "online_text_entry", points_possible: 1, due_at: nil)
  3.times { |i| mk.call(:"dup#{i + 1}", edge, "Weekly Reflection", :homework, submission_types: "online_text_entry", points_possible: 5, due_at: a.due(-49 + (i * 7))) }
  mk.call(:copy, edge, "HW 1 Copy", :homework, submission_types: "online_text_entry", points_possible: 10, due_at: nil, published: false)
  mk.call(:long_desc, edge, "Lab Manual Excerpt (very long description)", :labs, submission_types: "online_text_entry", points_possible: 10, due_at: a.due(-1),
                                                                         description: Seed::Text.html(rng, paragraphs: 120, rich: true))
  mk.call(:unicode_desc, edge, "Multilingual Instructions", :homework, submission_types: "online_text_entry", points_possible: 10, due_at: a.due(2),
                                                             description: Seed::Text::UNICODE_SNIPPETS.map { |s| "<p>#{ERB::Util.html_escape(s)}</p>" }.join)
  mk.call(:hidden_gb, edge, "Attendance Survey (ungraded, hidden from gradebook)", :misc, submission_types: "online_text_entry", points_possible: 0, due_at: a.due(-19), omit_from_final_grade: true)
  5.times do |i|
    mk.call(:"filler#{i + 1}", edge, "Review Packet #{i + 1}: #{Seed::Text.title(rng, 1, 3)}", :homework, submission_types: %w[online_text_entry online_upload on_paper][i % 3],
                                                                                                points_possible: [8, 12, 16, 20, 24][i], due_at: a.due(8 + (i * 5)))
  end
  deleted = Array.new(4) do |i|
    d = mk.call(:"deleted#{i + 1}", nil, "Deleted Assignment #{i + 1}", :misc, submission_types: "online_text_entry", points_possible: 10, due_at: a.due(-30 + i))
    d.destroy
    d
  end

  # never_drop rule now that ids exist
  hw = groups[:homework]
  hw.update!(rules: "drop_lowest:2\nnever_drop:#{all[:hw1].id}\n")

  Seed.set_ref("assignments:core", core)
  Seed.set_ref("assignments:partial", partial)
  Seed.set_ref("assignments:edge", edge)
  {
    assignmentId: :hw1, urlAssignmentId: :hw3, uploadAssignmentId: :lab1, peerReviewAssignmentId: :paper_draft, autoPeerReviewAssignmentId: :peer_auto,
    groupAssignmentId: :poster, moderatedAssignmentId: :paper_final, moderatedPublishedAssignmentId: :moderated_published,
    anonymousAssignmentId: :anonymous, manualPostAssignmentId: :manual_post, mediaAssignmentId: :media, externalToolAssignmentId: :external_tool,
    onPaperAssignmentId: :exam1, letterGradeAssignmentId: :midterm, passFailAssignmentId: :pass_fail, percentAssignmentId: :percent, gpaAssignmentId: :gpa,
    notGradedAssignmentId: :not_graded, noSubmissionAssignmentId: :no_submission, zeroPointsAssignmentId: :zero_points, decimalPointsAssignmentId: :decimal_points,
    hugePointsAssignmentId: :huge_points, omitFromFinalAssignmentId: :omit, noDueDateAssignmentId: :no_due, futureAssignmentId: :future,
    lockedAssignmentId: :locked, unpublishedAssignmentId: :unpublished, overrideAssignmentId: :overrides, sectionOnlyAssignmentId: :section_only,
    adhocOnlyAssignmentId: :adhoc_only, annotationAssignmentId: :annotation, multiAttemptAssignmentId: :field_journal
  }.each { |fx, key| Seed.fixture(fx, all[key].id) }
  Seed.fixture(:deletedAssignmentId, deleted.first.id)
  Seed.log "  #{all.size} assignments created (#{core.size} core, #{partial.size} partial, #{edge.size} edge, #{deleted.size} deleted)"
end

Seed.step("assign.overrides") do
  a = Seed::Assign
  main = Seed.course(:main)
  p1, p2, p4, p6 = CourseSection.where(id: Seed.ref("sections:main")).order(:id).to_a
  students = Seed.users(:main_students)
  asg = ->(k) { Assignment.find(Seed.ref("assignment:#{k}")) }

  ov = asg.call(:overrides)
  first = a.override(ov, set: p2, due_at: a.due(-9), lock_at: a.due(-2))
  a.override(ov, set: p4, due_at: a.due(-7), unlock_at: a.at(-18), lock_at: a.due(-1))
  a.override(ov, set: p6, due_at: nil) # explicitly "no due date" for this section
  adhoc = a.override(ov, students: [Seed.user(:student), students[8], students[9]], title: "Extended time (IEP)", due_at: a.due(5), lock_at: a.due(8))
  a.override(asg.call(:section_only), set: p4, due_at: a.due(6))
  a.override(asg.call(:adhoc_only), students: students[20, 3], due_at: a.due(3), lock_at: a.due(10))
  a.override(asg.call(:hw5), students: [Seed.user(:student2)], due_at: a.due(-30))
  a.override(asg.call(:lab2), set: p1, due_at: a.due(-45))
  a.override(asg.call(:future), set: p6, due_at: a.due(34), unlock_at: a.at(33))
  a.override(asg.call(:hw10), students: [students[30]], title: "1 student", due_at: a.due(20))
  gone = a.override(asg.call(:hw2), set: p2, due_at: a.due(-50))
  gone.destroy
  proj_groups = Group.where(id: Seed.ref("groups:project")).order(:id).to_a
  grp = a.override(asg.call(:group_override), set: proj_groups[0], due_at: a.due(6))
  a.override(asg.call(:group_override), set: proj_groups[1], due_at: a.due(8), lock_at: a.due(9))

  Seed.fixture(:assignmentOverrideId, first.id)
  Seed.fixture(:adhocAssignmentOverrideId, adhoc.id)
  Seed.fixture(:groupAssignmentOverrideId, grp.id)
  Seed.fixture(:deletedAssignmentOverrideId, gone.id)
  Seed.log "  #{AssignmentOverride.active.where(assignment_id: main.assignments.select(:id)).count} overrides in the main course"
end

Seed.step("assign.policies") do
  main = Seed.course(:main)
  rng = Seed.rng("assign.policies")
  students = Seed.users(:main_students)
  # late policies
  lp = LatePolicy.where(course_id: main.id).first ||
       LatePolicy.create!(course: main, late_submission_deduction_enabled: true, late_submission_deduction: 10, late_submission_interval: "day",
                          late_submission_minimum_percent_enabled: true, late_submission_minimum_percent: 50,
                          missing_submission_deduction_enabled: true, missing_submission_deduction: 100)
  Seed.fixture(:latePolicyId, lp.id)
  others = Course.where(id: Seed.ref("courses:catalog")).where(workflow_state: "available").order(:id).limit(40).to_a.select.with_index { |_, i| (i % 8).zero? }
  ([Seed.course(:second)] + others).each_with_index do |course, i|
    next if LatePolicy.where(course_id: course.id).exists?

    LatePolicy.create!(course:, late_submission_deduction_enabled: i.even?, late_submission_deduction: [5, 2.5, 20][i % 3], late_submission_interval: i.odd? ? "hour" : "day",
                       late_submission_minimum_percent_enabled: i % 3 == 0, late_submission_minimum_percent: 40,
                       missing_submission_deduction_enabled: i % 3 != 1, missing_submission_deduction: [100, 50, 75][i % 3])
  end
  Seed.fixture(:latePolicyCourseIds, LatePolicy.order(:course_id).pluck(:course_id))

  # custom gradebook columns with data
  col = lambda do |course, title, **attrs|
    course.custom_gradebook_columns.where(title:).first || course.custom_gradebook_columns.create!(title:, **attrs)
  end
  notes = col.call(main, "Notes", position: 1, teacher_notes: true)
  seat = col.call(main, "Seat / Locker #", position: 2)
  iep = col.call(main, "Accommodations (IEP/504) — confidential", position: 3, hidden: true)
  ro = col.call(main, "SIS Advisory Code (read-only)", position: 4, read_only: true)
  dead = col.call(main, "Old Column (deleted)", position: 5)
  dead.destroy
  students.each_with_index do |u, i|
    seat.custom_gradebook_column_data.where(user_id: u.id).first_or_create!(content: "#{("A".ord + (i % 6)).chr}#{(i / 6) + 1} / L-#{300 + i}")
    notes.custom_gradebook_column_data.where(user_id: u.id).first_or_create!(content: Seed::Text.sentence(rng)) if (i % 3).zero?
    iep.custom_gradebook_column_data.where(user_id: u.id).first_or_create!(content: ["Extended time 1.5x", "Preferential seating", "Lecture notes provided — ver IEP", "🎧 audio"][i % 4]) if (i % 9).zero?
    ro.custom_gradebook_column_data.where(user_id: u.id).first_or_create!(content: "ADV-#{100 + (i % 7)}") if i.even?
  end
  col.call(Seed.course(:second), "Notes", position: 1, teacher_notes: true)
  Seed.fixture(:customGradebookColumnId, seat.id)
  Seed.fixture(:teacherNotesColumnId, notes.id)
  Seed.fixture(:hiddenGradebookColumnId, iep.id)

  # course-level grading standard, tabs, a couple of course-level feature flags
  cgs = main.grading_standards.where(title: "BIO 101 Curve").first ||
        main.grading_standards.create!(title: "BIO 101 Curve", data: [["A", 0.88], ["B", 0.76], ["C", 0.64], ["D", 0.52], ["F", 0.0]], user: Seed.user(:teacher))
  Seed.fixture(:courseGradingStandardId, cgs.id)
  main.tab_configuration = [{ "id" => Course::TAB_HOME }, { "id" => Course::TAB_ANNOUNCEMENTS }, { "id" => Course::TAB_MODULES }, { "id" => Course::TAB_ASSIGNMENTS },
                            { "id" => Course::TAB_GRADES }, { "id" => Course::TAB_PEOPLE }, { "id" => Course::TAB_DISCUSSIONS }, { "id" => Course::TAB_QUIZZES },
                            { "id" => Course::TAB_PAGES }, { "id" => Course::TAB_FILES }, { "id" => Course::TAB_SYLLABUS }, { "id" => Course::TAB_OUTCOMES, "hidden" => true },
                            { "id" => Course::TAB_CONFERENCES, "hidden" => true }, { "id" => Course::TAB_COLLABORATIONS }]
  main.save!
  defs = Feature.definitions
  main.enable_feature!(:outcome_gradebook) if defs.key?("outcome_gradebook")
  main.enable_feature!(:student_outcome_gradebook) if defs.key?("student_outcome_gradebook")
  main.enable_feature!(:final_grades_override) if defs.key?("final_grades_override")
  main.disable_feature!(:anonymous_instructor_annotations) if defs.key?("anonymous_instructor_annotations")
  Seed.course(:second).enable_feature!(:quiz_log_auditing) if defs.key?("quiz_log_auditing")
  Seed.course(:second).enable_feature!(:epub_export) if defs.key?("epub_export")
end
