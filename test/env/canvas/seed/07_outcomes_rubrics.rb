# frozen_string_literal: true

# Outcome groups nested three deep (account + course), outcomes with every calculation
# method, proficiency ratings, rubrics (account + course, ranges, free-form, outcome-aligned),
# rubric associations and assessments -> learning outcome results / rollups.

module Seed
  module Outcomes
    SCALE4 = [[4, "Exceeds Mastery"], [3, "Mastery"], [2, "Near Mastery"], [1, "Below Mastery"], [0, "No Evidence"]].freeze
    SCALE5 = [[5, "Advanced"], [4, "Proficient"], [3, "Developing"], [2, "Emerging"], [1, "Beginning"]].freeze
    SCALE2 = [[1, "Met"], [0, "Not Yet"]].freeze

    class << self
      def group(context, parent, title, **attrs)
        parent.child_outcome_groups.active.where(title:).first ||
          parent.child_outcome_groups.create!(title:, context:, description: attrs.delete(:description) || "<p>#{title}</p>", **attrs)
      end

      def outcome(context, grp, title, scale: SCALE4, mastery: 3, method: "decaying_average", int: 65, **attrs)
        o = (context ? context.created_learning_outcomes : LearningOutcome).where(short_description: title).first
        unless o
          o = context ? context.created_learning_outcomes.build(title:) : LearningOutcome.new(title:)
          o.description = attrs.delete(:description) || "<p>Students can #{title.downcase}.</p>"
          o.calculation_method = method
          o.calculation_int = int
          attrs.each { |k, v| o.public_send("#{k}=", v) }
          o.rubric_criterion = { description: title, mastery_points: mastery, points_possible: scale.first.first,
                                 ratings: scale.map { |pts, desc| { points: pts, description: desc } } }
          o.save!
        end
        grp.add_outcome(o)
        o
      end
    end
  end
end

Seed.step("outcomes.account") do
  o = Seed::Outcomes
  root = Seed.root
  top = root.root_outcome_group
  district = o.group(root, top, "District Standards", vendor_guid: "DIST-STD")
  science = o.group(root, district, "Science (NGSS-style)", vendor_guid: "DIST-SCI")
  life = o.group(root, science, "Life Science — LS1: From Molecules to Organisms", vendor_guid: "DIST-SCI-LS1")
  eco = o.group(root, science, "Life Science — LS2: Ecosystems")
  math = o.group(root, district, "Mathematics")
  alg = o.group(root, math, "Algebra & Functions")
  skills = o.group(root, top, "21st Century Skills / Habilidades del siglo XXI")
  o.group(root, top, "Empty Group (no outcomes)")
  dead = o.group(root, top, "Retired Standards (deleted)")
  dead.destroy

  ls1 = o.outcome(root, life, "LS1.A Explain how cell structures relate to their functions", vendor_guid: "LS1.A", display_name: "Cell Structure & Function")
  ls1b = o.outcome(root, life, "LS1.B Describe growth and development of organisms (mitosis)", method: "n_mastery", int: 3, vendor_guid: "LS1.B")
  ls1c = o.outcome(root, life, "LS1.C Model the flow of matter and energy (photosynthesis, respiration)", method: "highest", int: nil, vendor_guid: "LS1.C")
  ls2a = o.outcome(root, eco, "LS2.A Analyze interdependent relationships in ecosystems", method: "latest", int: nil, scale: o::SCALE5, mastery: 4)
  o.outcome(root, eco, "LS2.B Trace cycles of matter and energy transfer in ecosystems", method: "average", int: nil)
  o.outcome(root, alg, "A.REI Solve linear equations and inequalities in one variable", scale: o::SCALE5, mastery: 4)
  o.outcome(root, alg, "F.IF Interpret functions that arise in applications", method: "decaying_average", int: 75)
  sep = o.outcome(root, skills, "SEP-3 Plan and carry out investigations", display_name: "Investigations 🔬")
  comm = o.outcome(root, skills, "COMM-1 Communicate scientific information clearly — «claridad»", scale: o::SCALE2, mastery: 1, method: "highest", int: nil)
  o.outcome(root, skills, "COLLAB-1 Collaborate effectively in teams", method: "n_mastery", int: 2)
  gone = o.outcome(root, skills, "OLD-1 Legacy outcome (deleted)")
  gone.destroy

  Seed.set_ref("outcomes:account", [ls1.id, ls1b.id, ls1c.id, ls2a.id, sep.id, comm.id])
  Seed.fixture(:accountOutcomeGroupId, district.id)
  Seed.fixture(:accountDeepOutcomeGroupId, life.id)
  Seed.fixture(:accountOutcomeId, ls1.id)
  Seed.fixture(:rootOutcomeGroupId, top.id)
  Seed.fixture(:deletedOutcomeId, gone.id)

  # account-level mastery scale + calculation method
  prof = OutcomeProficiency.where(context: root).first
  unless prof
    ratings = [[4, "Exceeds Mastery", "127A1B", false], [3, "Mastery", "0B874B", true], [2, "Near Mastery", "FAB901", false], [1, "Below Mastery", "FD5D10", false], [0, "No Evidence", "E0061F", false]]
              .map { |pts, d, color, m| OutcomeProficiencyRating.new(description: d, points: pts, mastery: m, color:) }
    prof = OutcomeProficiency.create!(context: root, outcome_proficiency_ratings: ratings)
  end
  OutcomeCalculationMethod.where(context: root).first || OutcomeCalculationMethod.create!(context: root, calculation_method: "decaying_average", calculation_int: 65)
  Seed.fixture(:outcomeProficiencyId, prof.id)
  Seed.fixture(:proficiencyRatingId, prof.outcome_proficiency_ratings.order(points: :desc).first.id)
end

Seed.step("outcomes.course") do
  o = Seed::Outcomes
  main = Seed.course(:main)
  top = main.root_outcome_group
  bio = o.group(main, top, "BIO 101 Outcomes")
  unit1 = o.group(main, bio, "Unit 1: Cells")
  structure = o.group(main, unit1, "1.1 Cell Structure")
  o.group(main, unit1, "1.2 Membranes & Transport")
  unit2 = o.group(main, bio, "Unit 2: Energy")
  o.group(main, top, "Lab Skills")

  c1 = o.outcome(main, structure, "Identify organelles in plant and animal cells", method: "highest", int: nil)
  c2 = o.outcome(main, structure, "Compare prokaryotic and eukaryotic cells")
  c3 = o.outcome(main, unit2, "Write balanced equations for photosynthesis and respiration", scale: o::SCALE5, mastery: 4, method: "latest", int: nil)
  c4 = o.outcome(main, top.child_outcome_groups.where(title: "Lab Skills").first, "Use a compound microscope safely and accurately", scale: o::SCALE2, mastery: 1, method: "n_mastery", int: 2)
  c5 = o.outcome(main, bio, "Write a lab report with claim, evidence and reasoning", method: "average", int: nil)
  # link (import) account-level outcomes into the course
  imported = LearningOutcome.where(id: Seed.ref("outcomes:account")).order(:id).to_a
  links = imported.map { |out| bio.add_outcome(out) }

  Seed.set_ref("outcomes:course", [c1.id, c2.id, c3.id, c4.id, c5.id])
  Seed.fixture(:outcomeId, c1.id)
  Seed.fixture(:outcomeId2, c5.id)
  Seed.fixture(:importedOutcomeId, imported.first.id)
  Seed.fixture(:outcomeGroupId, bio.id)
  Seed.fixture(:deepOutcomeGroupId, structure.id)
  Seed.fixture(:courseRootOutcomeGroupId, top.id)
  Seed.fixture(:outcomeLinkId, links.first.id)

  prof = OutcomeProficiency.where(context: main).first
  unless prof
    ratings = [[3, "Got it!", "0B874B", true], [2, "Almost", "FAB901", false], [1, "Not yet", "E0061F", false]]
              .map { |pts, d, color, m| OutcomeProficiencyRating.new(description: d, points: pts, mastery: m, color:) }
    prof = OutcomeProficiency.create!(context: main, outcome_proficiency_ratings: ratings)
  end
  OutcomeCalculationMethod.where(context: main).first || OutcomeCalculationMethod.create!(context: main, calculation_method: "highest")
  Seed.fixture(:courseOutcomeProficiencyId, prof.id)

  # a few outcomes in the second course too
  second = Seed.course(:second)
  g = o.group(second, second.root_outcome_group, "Algebra II Outcomes")
  o.outcome(second, g, "Solve quadratic equations by factoring")
  o.outcome(second, g, "Graph exponential and logarithmic functions", method: "latest", int: nil)
  Seed.fixture(:course2OutcomeGroupId, g.id)
end

Seed.step("rubrics.create") do
  main = Seed.course(:main)
  root = Seed.root
  teacher = Seed.user(:teacher)
  rng = Seed.rng("rubrics")
  course_outcomes = LearningOutcome.where(id: Seed.ref("outcomes:course")).order(:id).to_a
  account_outcomes = LearningOutcome.where(id: Seed.ref("outcomes:account")).order(:id).to_a
  levels = lambda do |max, names|
    names.each_with_index.to_h { |n, i| [i.to_s, { points: (max * (names.size - 1 - i).to_f / (names.size - 1)).round(2), description: n, long_description: Seed::Text.sentence(rng, 4, 10) }] }
  end
  crit = lambda do |desc, max, names = %w[Excellent Good Fair Poor], **extra|
    { description: desc, long_description: Seed::Text.sentence(rng), points: max, ratings: levels.call(max, names) }.merge(extra)
  end
  out_crit = lambda do |outcome, **extra|
    rc = outcome.data[:rubric_criterion]
    { description: outcome.short_description, points: rc[:points_possible], mastery_points: rc[:mastery_points], learning_outcome_id: outcome.id,
      ratings: rc[:ratings].each_with_index.to_h { |r, i| [i.to_s, { points: r[:points], description: r[:description] }] } }.merge(extra)
  end
  build = lambda do |context, title, criteria, user: teacher, **params|
    r = context.rubrics.where(title:).first
    unless r
      r = context.rubrics.build(user:)
      r.update_criteria({ title:, criteria: criteria.each_with_index.to_h { |c, i| [i.to_s, c] } }.merge(params))
      r.reusable = true
      r.save!
    end
    r
  end

  writing = build.call(root, "District Writing Rubric (6 traits)", [
                         crit.call("Ideas & Content", 10), crit.call("Organization", 10), crit.call("Voice — «voz» / 声", 5, %w[Strong Developing Weak]),
                         crit.call("Word Choice", 5), crit.call("Sentence Fluency", 5), crit.call("Conventions", 5, ["No errors", "Few errors", "Some errors", "Many errors", "Unreadable"])
                       ], user: Seed.admin)
  lab = build.call(root, "Lab Report Rubric (point ranges)", [
                     crit.call("Hypothesis & Variables", 10, %w[Exemplary Proficient Developing Missing], criterion_use_range: true),
                     crit.call("Data & Analysis", 10, %w[Exemplary Proficient Developing Missing], criterion_use_range: true),
                     out_crit.call(account_outcomes[4]), # SEP-3 investigations
                     out_crit.call(account_outcomes[0])  # LS1.A
                   ], user: Seed.admin)
  build.call(root, "Presentation Rubric (free-form comments)", [crit.call("Content", 20), crit.call("Delivery", 10), crit.call("Visual Aids", 10)],
             user: Seed.admin, free_form_criterion_comments: true)
  paper = build.call(main, "Research Paper Rubric", [
                       crit.call("Thesis & Argument", 30), crit.call("Use of Evidence", 30), crit.call("Organization & Style", 20),
                       out_crit.call(course_outcomes[4]), # CER lab report outcome (4)
                       out_crit.call(account_outcomes[5], ignore_for_scoring: true), # COMM-1 (not scored)
                       crit.call("Citations (MLA/APA)", 16, ["Complete", "Minor issues", "Missing"])
                     ])
  journal = build.call(main, "Field Journal Rubric (outcome aligned)", [
                         out_crit.call(course_outcomes[0]), out_crit.call(course_outcomes[1]), out_crit.call(course_outcomes[2]),
                         crit.call("Completeness", 23, %w[Complete Partial Minimal])
                       ])
  poster = build.call(main, "Poster Rubric", [crit.call("Scientific Accuracy", 20), crit.call("Design & Layout", 15), crit.call("Teamwork", 15, %w[Shared Uneven Solo])])
  peer = build.call(main, "Peer Review Checklist", [crit.call("Clear thesis?", 2, %w[Yes Partly No]), crit.call("Evidence cited?", 2, %w[Yes Partly No]), crit.call("Helpful feedback given", 1, %w[Yes No])],
                    hide_score_total: true)
  build.call(main, "Participation (no points shown)", [crit.call("Engagement", 5, %w[Leading Participating Passive Absent])], hide_points: true)
  dead = build.call(main, "Old Essay Rubric (deleted)", [crit.call("Everything", 10)])
  dead.destroy
  unused = build.call(main, "Unused Rubric (no associations)", [crit.call("Criterion with a very long name #{"lorem ipsum " * 12}".strip, 4)])

  asg = ->(k) { Assignment.find(Seed.ref("assignment:#{k}")) }
  assoc = lambda do |rubric, key, grading: true, **opts|
    rubric.associate_with(asg.call(key), main, purpose: "grading", use_for_grading: grading, skip_updating_points_possible: true, current_user: teacher, **opts)
  end
  a_journal = assoc.call(journal, :field_journal)
  a_final = assoc.call(paper, :paper_final)
  a_poster = assoc.call(poster, :poster, grading: false)
  a_peer = assoc.call(peer, :paper_draft, grading: false)
  lab_assocs = %i[lab1 lab2 lab3 lab4].map { |k| assoc.call(lab, k, grading: false) }
  assoc.call(writing, :letter_grade, grading: false)
  [writing, lab, paper, journal, poster].each { |r| r.associate_with(main, main, purpose: "bookmark") }
  a_peer.update!(hide_score_total: true)
  a_poster.update!(hide_points: true) if a_poster.respond_to?(:hide_points=)

  Seed.set_ref("rubric_assoc:journal", a_journal.id)
  Seed.set_ref("rubric_assoc:final", a_final.id)
  Seed.set_ref("rubric_assoc:poster", a_poster.id)
  Seed.set_ref("rubric_assoc:peer", a_peer.id)
  Seed.set_ref("rubric_assocs:lab", lab_assocs.map(&:id))
  Seed.fixture(:rubricId, journal.id)
  Seed.fixture(:rubricAssociationId, a_journal.id)
  Seed.fixture(:rubricAssignmentId, Seed.ref("assignment:field_journal"))
  Seed.fixture(:paperRubricId, paper.id)
  Seed.fixture(:accountRubricId, lab.id)
  Seed.fixture(:accountRubricId2, writing.id)
  Seed.fixture(:unusedRubricId, unused.id)
  Seed.fixture(:deletedRubricId, dead.id)
end

Seed.step("rubrics.assess") do
  rng = Seed.rng("rubrics.assess")
  teacher = Seed.user(:teacher)
  ta = Seed.user(:ta)
  students = Seed.users(:main_students)
  index = students.each_with_index.to_h { |u, i| [u.id, i] }
  count = 0
  first = nil
  assess = lambda do |assoc, sub, assessor, type, ratio|
    dil = Seed::Subs.diligence(index[sub.user_id] || 30)
    data = { assessment_type: type }
    assoc.rubric.criteria_object.each do |c|
      next if rng.rand > ratio # leave some criteria blank

      ratings = c.ratings
      pick = ratings[((1 - dil) * ratings.size + rng.rand(-1..1)).to_i.clamp(0, ratings.size - 1)]
      row = { points: pick.points, rating_id: pick.id }
      row[:comments] = Seed::Text.sentence(rng, 3, 12) if rng.rand < 0.3
      data[:"criterion_#{c.id}"] = row
    end
    ra = assoc.assess(user: sub.user, assessor:, artifact: sub, assessment: data)
    count += 1
    first ||= ra
    ra
  end

  graded = ->(assoc) { assoc.association_object.submissions.where(workflow_state: "graded").where.not(score: nil).preload(:user).order(:user_id).to_a }
  # used for grading: the rubric total becomes the score
  journal = RubricAssociation.find(Seed.ref("rubric_assoc:journal"))
  mine = nil
  graded.call(journal).each do |sub|
    next if rng.rand > 0.75 && sub.user_id != students[0].id

    ra = assess.call(journal, sub, rng.rand < 0.8 ? teacher : ta, "grading", 0.97)
    mine = ra if sub.user_id == students[0].id
  end
  # informational rubrics on the labs (account-level rubric with aligned outcomes)
  RubricAssociation.where(id: Seed.ref("rubric_assocs:lab")).order(:id).each do |assoc|
    graded.call(assoc).each { |sub| assess.call(assoc, sub, teacher, "grading", 0.9) if rng.rand < 0.6 }
  end
  poster = RubricAssociation.find(Seed.ref("rubric_assoc:poster"))
  graded.call(poster).first(20).each { |sub| assess.call(poster, sub, teacher, "grading", 1.0) }
  # peer-review assessments by the assigned reviewers
  peer = RubricAssociation.find(Seed.ref("rubric_assoc:peer"))
  AssessmentRequest.where(asset_type: "Submission", asset_id: peer.association_object.submissions.select(:id)).preload(:asset, :assessor).order(:id).each_with_index do |req, i|
    next unless i % 3 == 0

    req.update!(rubric_association: peer) if req.rubric_association_id.nil?
    assess.call(peer, req.asset, req.assessor, "peer_review", 1.0)
  end
  Seed.fixture(:rubricAssessmentId, (mine || first).id)
  Seed.fixture(:rubricAssessmentUserId, (mine || first).user_id)
  Seed.log "  #{count} rubric assessments, #{LearningOutcomeResult.count} outcome results so far"
end
