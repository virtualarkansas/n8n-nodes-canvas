# frozen_string_literal: true

# Lighter content for every other course (assignments, a few graded submissions, pages,
# a module, files, a discussion), a fuller set for the second / large / concluded courses,
# and finally the course-level lifecycle changes (conclude, delete) that need content first.
#
# One step per course: these steps run in a second process in parallel with the main-course
# phases (see run.sh), so their transactions are kept short.

module Seed
  module Other
    TYPES = ["online_text_entry", "online_upload", "online_text_entry,online_upload", "on_paper", "online_url", "none"].freeze

    class << self
      # dates relative to the course's own term so past-term courses have past work
      def window(course)
        term = course.enrollment_term
        s = course.start_at || term.start_at || (Seed.now - 60.days)
        e = course.conclude_at || term.end_at || (Seed.now + 60.days)
        [s, e]
      end

      def build(course, rng, assignments:, graded: 0, roster: 8, pages: 1, files: 0, discussion: false, mod: true)
        s, e = window(course)
        span = [(e - s).to_i, 86_400].max
        teacher = course.teachers.order(:id).first || Seed.admin
        # in a course whose term has ended the teacher can no longer grade; the admin can
        grader = course.grants_right?(teacher, :manage_grades) ? teacher : Seed.admin
        tests = course.assignment_groups.create!(name: ["Tests", "Assessments", "Projects & Tests"][rng.rand(3)], position: 2)
        default = course.assignment_groups.active.order(:id).first
        made = []
        Seed.bulk_assignments(course, update_grades: false) do
          assignments.times do |i|
            due = s + (span * (i + 1) / (assignments + 1)).seconds
            attrs = { title: "#{["Assignment", "Worksheet", "Reflection", "Problem Set", "Essay", "Project"][rng.rand(6)]} #{i + 1}: #{Seed::Text.title(rng, 1, 3)}",
                      submission_types: TYPES[rng.rand(TYPES.size)], points_possible: [5, 10, 10, 20, 25, 50, 100][rng.rand(7)],
                      due_at: (rng.rand < 0.12 ? nil : due), group: (i % 4 == 3 ? tests : default), description: (rng.rand < 0.7 ? Seed::Text.html(rng, paragraphs: 1) : nil),
                      published: rng.rand > 0.1 }
            attrs[:grading_type] = "pass_fail" if rng.rand < 0.08
            made << Seed::Assign.create(course, **attrs)
          end
        end
        if graded.positive? && course.available?
          students = course.student_enrollments.where(workflow_state: "active").order(:user_id).preload(:user).map(&:user).uniq.first(roster)
          due_past = made.select { |a| a.published? && (a.due_at.nil? || a.due_at < Seed.now) }.first(graded)
          stats = Hash.new(0)
          due_past.each do |a|
            Seed::Subs.populate(a, students.each_with_index.map { |u, i| [u, i + 7] }, rng, graders: [grader], stats:, grade_ratio: 0.85)
          end
        end
        page_ids = Array.new(pages) do |i|
          p = course.wiki_pages.create!(title: ["Course Info", "Schedule", "Resources", "Rubric & Expectations"][i % 4], body: Seed::Text.html(rng, paragraphs: 2, rich: i.zero?), user: teacher)
          p.id
        end
        file_ids = Array.new(files) do |i|
          content, type = Seed::Files.payload(%w[pdf docx txt][i % 3], rng)
          Seed.upload(context: course, name: "#{course.course_code} handout #{i + 1}.#{%w[pdf docx txt][i % 3]}", content:, content_type: type, folder: Folder.root_folders(course).first, user: teacher).id
        end
        if mod
          m = course.context_modules.create!(name: "Getting Started")
          m.add_item(type: "wiki_page", id: page_ids.first) if page_ids.first
          made.first(3).each { |a| m.add_item(type: "assignment", id: a.id) if a.published? }
          m.add_item(type: "attachment", id: file_ids.first) if file_ids.first
          m.add_item(type: "external_url", title: "Textbook site", url: "https://example.com/textbooks/#{course.course_code.to_s.downcase}")
        end
        if discussion
          t = Seed::Disc.topic(course, title: "#{course.course_code}: #{Seed::Text.title(rng, 2, 4)}?", user: teacher, message: Seed::Text.html(rng), discussion_type: "threaded")
          people = course.students.order(:id).limit(10).to_a + [teacher]
          # (students cannot post once the course or its term has ended)
          Seed::Disc.thread(t, people, rng, roots: rng.rand(2..5), depth: 2) if course.available? && course.grants_right?(people.first, :participate_as_student)
        end
        made
      end
    end
  end
end

Seed.step("other.second") do
  rng = Seed.rng("other.second")
  second = Seed.course(:second)
  teacher = Seed.user(:teacher)
  students = Seed.users(:second_students)
  hw = second.assignment_groups.active.order(:id).first
  hw.update!(name: "Homework", group_weight: 40)
  tests = second.assignment_groups.create!(name: "Tests & Quizzes", group_weight: 60, position: 2)
  second.update!(group_weighting_scheme: "percent")
  made = []
  Seed.bulk_assignments(second) do
    20.times do |i|
      made << Seed::Assign.create(second, title: "Problem Set #{i + 1}", group: hw, submission_types: i % 5 == 4 ? "on_paper" : "online_upload,online_text_entry", points_possible: 20,
                                          due_at: Seed::Assign.due(-70 + (i * 5)), description: Seed::Text.html(rng, paragraphs: 1), published: i < 18)
    end
    3.times { |i| made << Seed::Assign.create(second, title: "Chapter #{i + 1} Test", group: tests, submission_types: "on_paper", points_possible: 100, due_at: Seed::Assign.due(-55 + (i * 25))) }
    made << Seed::Assign.create(second, title: "Final Project: Modeling with Functions", group: tests, submission_types: "online_upload", points_possible: 150, due_at: Seed::Assign.due(28))
  end
  p5 = CourseSection.find(Seed.ref("sections:second")[1])
  Seed::Assign.override(made[10], set: p5, due_at: Seed::Assign.due(-18))
  stats = Hash.new(0)
  roster = students.each_with_index.to_a
  made.first(8).each { |a| Seed::Subs.populate(a, roster, rng, graders: [teacher], stats:, grade_ratio: 0.9) }
  made[20, 2].each { |a| Seed::Subs.populate(a, roster, rng, graders: [teacher], stats:, grade_ratio: 0.95) }
  Seed.set_ref("assignment:second_first", made.first.id)
  Seed.fixture(:course2AssignmentId, made.first.id)
  Seed.fixture(:course2AssignmentGroupId, hw.id)
  Seed.log "  second course: #{made.size} assignments; #{stats.sort.map { |k, v| "#{k}=#{v}" }.join(" ")}"
end

Seed.step("other.large") do
  rng = Seed.rng("other.large")
  large = Seed.course(:large)
  teacher = Seed.user(:teacher)
  made = []
  Seed.bulk_assignments(large) do
    12.times do |i|
      made << Seed::Assign.create(large, title: "Seminar Reflection #{i + 1}", submission_types: i % 4 == 3 ? "none" : "online_text_entry", points_possible: 10,
                                         due_at: Seed::Assign.due(-75 + (i * 9)), description: Seed::Text.html(rng, paragraphs: 1))
    end
  end
  Seed.set_ref("assignments:large", made.map(&:id))
  5.times { |i| large.announcements.create!(title: "Seminar week #{i + 1}", message: Seed::Text.html(rng), user: teacher) }
  3.times do |i|
    m = large.context_modules.create!(name: "Seminar Block #{i + 1}")
    made[i * 4, 4].each { |a| m.add_item(type: "assignment", id: a.id) }
  end
  large.wiki_pages.create!(title: "Seminar Expectations", body: Seed::Text.html(rng, rich: true), user: teacher)
  Seed.fixture(:largeCourseAssignmentId, made.first.id)
end

# two heavily-submitted assignments in the large course (> 200 submissions each), split so
# each transaction stays short
4.times do |n|
  Seed.step("other.large_subs.#{n}") do
    rng = Seed.rng("other.large_subs.#{n}")
    large = Seed.course(:large)
    teacher = Seed.user(:teacher)
    asg = Assignment.find(Seed.ref("assignments:large")[n / 2])
    students = large.student_enrollments.where(workflow_state: "active").order(:user_id).preload(:user).map(&:user).uniq
    half = students.each_with_index.select { |_, i| i % 2 == n % 2 }
    stats = Hash.new(0)
    Seed::Subs.populate(asg, half.map { |u, i| [u, i + 7] }, rng, graders: [teacher], stats:, grade_ratio: n < 2 ? 0.9 : 0.5)
    Seed.log "  #{asg.title} (part #{(n % 2) + 1}): #{stats.sort.map { |k, v| "#{k}=#{v}" }.join(" ")}"
  end
end

Seed.step("other.plan") do
  special = %i[concluded unpublished deleted blueprint date_restricted_past date_restricted_future public paced].map { |k| Seed.ref("course:#{k}") }
  Seed.set_ref("courses:other", special + Seed.ref("courses:catalog"))
end

(Seed.ref?("courses:other") ? Seed.ref("courses:other") : []).each_with_index do |cid, idx|
  Seed.step("other.course.#{cid}") do
    rng = Seed.rng("other.course.#{idx}")
    course = Course.find(cid)
    past = course.enrollment_term.end_at && course.enrollment_term.end_at < Seed.now
    key = { Seed.ref("course:concluded") => :concluded, Seed.ref("course:blueprint") => :blueprint, Seed.ref("course:paced") => :paced, Seed.ref("course:deleted") => :deleted }[cid]
    case key
    when :concluded
      made = Seed::Other.build(course, rng, assignments: 9, graded: 6, roster: 22, pages: 3, files: 3, discussion: true)
      Seed.fixture(:concludedCourseAssignmentId, made.first.id)
    when :blueprint
      made = Seed::Other.build(course, rng, assignments: 4, pages: 3, files: 2, discussion: true)
      Seed.set_ref("blueprint:assignment", made.first.id)
    when :paced
      Seed::Other.build(course, rng, assignments: 5, pages: 2, mod: true)
    else
      rich = idx % 3 == 0
      Seed::Other.build(course, rng, assignments: rng.rand(3..7), graded: (idx % 5 < 2 || past ? rng.rand(1..3) : 0), roster: rng.rand(5..9),
                                     pages: rich ? 2 : 1, files: rich ? 2 : 0, discussion: idx % 4 == 0, mod: idx % 2 == 0)
    end
  end
end

Seed.step("other.blueprint") do
  bp = Seed.course(:blueprint)
  template = MasterCourses::MasterTemplate.full_template_for(bp)
  # lock one assignment and one page in the blueprint
  asg = Assignment.find(Seed.ref("blueprint:assignment"))
  [asg, bp.wiki_pages.order(:id).first].compact.each do |item|
    tag = template.content_tag_for(item)
    tag.update!(restrictions: { content: true, points: true, due_dates: false, availability_dates: false })
  end
  Seed.fixture(:blueprintAssignmentId, asg.id)
  Seed.fixture(:blueprintLockedPageUrl, bp.wiki_pages.order(:id).first&.url)
end

Seed.step("other.lifecycle") do
  # hard-conclude and delete the courses that were earmarked for it (they now have content)
  Course.where(id: Seed.ref("courses:to_conclude")).each { |c| c.complete! unless c.completed? }
  Course.where(id: Seed.ref("courses:to_delete")).each { |c| c.destroy unless c.deleted? }
  Seed.fixture(:concludedCourseIds, Seed.ref("courses:to_conclude"))
  Seed.fixture(:deletedCourseIds, Seed.ref("courses:to_delete"))
  Seed.log "  concluded #{Seed.ref("courses:to_conclude").size} courses, deleted #{Seed.ref("courses:to_delete").size}"
end
