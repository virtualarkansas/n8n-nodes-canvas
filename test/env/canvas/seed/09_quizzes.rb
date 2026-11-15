# frozen_string_literal: true

# Classic quizzes: every quiz type and question type, question banks and groups (inline and
# bank-linked), submissions in every state (complete, pending review, in progress, multiple
# attempts), moderation extensions, overrides. New Quizzes need the external Quizzes.Next
# service and are not seeded.

module Seed
  module Quiz
    class << self
      # --- question_data builders (one per classic question type) ---------------------------
      def mc(rng, text = nil, pts = 1)
        correct = Seed::Text.title(rng, 1, 2)
        { question_type: "multiple_choice_question", question_name: "Multiple choice", question_text: "<p>#{text || Seed::Text.sentence(rng)}</p>", points_possible: pts,
          correct_comments: "Correct!", incorrect_comments: "Review section #{rng.rand(1..9)}.", neutral_comments: "See the textbook.",
          answers: ([{ answer_text: correct, answer_weight: 100, answer_comment: "Yes." }] +
                    Array.new(3) { { answer_text: Seed::Text.title(rng, 1, 2), answer_weight: 0 } }).shuffle(random: rng) }
      end

      def tf(rng, pts = 1)
        truth = rng.rand < 0.5
        { question_type: "true_false_question", question_name: "True/False", question_text: "<p>#{Seed::Text.sentence(rng)}</p>", points_possible: pts,
          answers: [{ answer_text: "True", answer_weight: truth ? 100 : 0 }, { answer_text: "False", answer_weight: truth ? 0 : 100 }] }
      end

      def short(_rng, pts = 1)
        { question_type: "short_answer_question", question_name: "Fill in the blank", question_text: "<p>The powerhouse of the cell is the ______.</p>", points_possible: pts,
          answers: [{ answer_text: "mitochondria", answer_weight: 100 }, { answer_text: "mitochondrion", answer_weight: 100 }, { answer_text: "Mitochondria", answer_weight: 100 }] }
      end

      def blanks(_rng, pts = 2)
        { question_type: "fill_in_multiple_blanks_question", question_name: "Multiple blanks", points_possible: pts,
          question_text: "<p>Plants use [gas] and release [product] during photosynthesis.</p>",
          answers: [{ answer_text: "carbon dioxide", answer_weight: 100, blank_id: "gas" }, { answer_text: "CO2", answer_weight: 100, blank_id: "gas" },
                    { answer_text: "oxygen", answer_weight: 100, blank_id: "product" }, { answer_text: "O2", answer_weight: 100, blank_id: "product" }] }
      end

      def multi(rng, pts = 2)
        { question_type: "multiple_answers_question", question_name: "Multiple answers", question_text: "<p>Select all organelles found in plant cells. #{Seed::Text.unicode(rng)}</p>", points_possible: pts,
          answers: [{ answer_text: "Chloroplast", answer_weight: 100 }, { answer_text: "Cell wall", answer_weight: 100 }, { answer_text: "Centriole", answer_weight: 0 },
                    { answer_text: "Vacuole", answer_weight: 100 }, { answer_text: "Flagellum", answer_weight: 0 }] }
      end

      def dropdowns(_rng, pts = 2)
        { question_type: "multiple_dropdowns_question", question_name: "Dropdowns", points_possible: pts,
          question_text: "<p>DNA is copied during [phase] and the cell divides during [division].</p>",
          answers: [{ answer_text: "S phase", answer_weight: 100, blank_id: "phase" }, { answer_text: "G1 phase", answer_weight: 0, blank_id: "phase" },
                    { answer_text: "mitosis", answer_weight: 100, blank_id: "division" }, { answer_text: "interphase", answer_weight: 0, blank_id: "division" }] }
      end

      def matching(_rng, pts = 4)
        { question_type: "matching_question", question_name: "Matching", question_text: "<p>Match each organelle to its function.</p>", points_possible: pts,
          matching_answer_incorrect_matches: "Stores bile\nMoves the cell",
          answers: [{ answer_match_left: "Nucleus", answer_match_right: "Stores genetic information" },
                    { answer_match_left: "Ribosome", answer_match_right: "Builds proteins" },
                    { answer_match_left: "Golgi apparatus", answer_match_right: "Packages and ships proteins" },
                    { answer_match_left: "Lysosome", answer_match_right: "Breaks down waste" }] }
      end

      def numerical(_rng, pts = 1)
        { question_type: "numerical_question", question_name: "Numerical", question_text: "<p>How many chromosomes are in a human somatic cell?</p>", points_possible: pts,
          answers: [{ numerical_answer_type: "exact_answer", answer_exact: 46, answer_error_margin: 0 },
                    { numerical_answer_type: "range_answer", answer_range_start: 45.5, answer_range_end: 46.5 }] }
      end

      def calculated(_rng, pts = 2)
        { question_type: "calculated_question", question_name: "Formula", points_possible: pts, question_text: "<p>A culture doubles [n] times starting from [start] cells. How many cells?</p>",
          formulas: [{ formula: "start * 2^n" }], formula_decimal_places: 0, answer_tolerance: 0,
          variables: [{ name: "n", min: 1, max: 6, scale: 0 }, { name: "start", min: 1, max: 10, scale: 0 }],
          answers: [{ answer_text: 8, variables: [{ name: "n", value: 2 }, { name: "start", value: 2 }] },
                    { answer_text: 48, variables: [{ name: "n", value: 4 }, { name: "start", value: 3 }] },
                    { answer_text: 10, variables: [{ name: "n", value: 1 }, { name: "start", value: 5 }] }] }
      end

      def essay(rng, pts = 5)
        { question_type: "essay_question", question_name: "Essay", question_text: "<p>#{Seed::Text.sentence(rng)} Explain in a paragraph.</p>", points_possible: pts }
      end

      def file_upload(_rng, pts = 3)
        { question_type: "file_upload_question", question_name: "File upload", question_text: "<p>Upload a labelled sketch of a cell.</p>", points_possible: pts }
      end

      def text_only(rng)
        { question_type: "text_only_question", question_name: "Instructions", question_text: "<p><strong>Part 2.</strong> #{Seed::Text.paragraph(rng, 2)}</p>", points_possible: 0 }
      end

      def types
        %i[mc tf short blanks multi dropdowns matching numerical calculated essay file_upload text_only]
      end

      def create(course, title:, published: true, questions: [], **attrs)
        q = course.quizzes.build(title:, **attrs)
        q.save!
        questions.each { |qd| q.quiz_questions.create!(question_data: qd) }
        yield q if block_given?
        if published
          q.reload
          q.publish!
        end
        q
      end

      # answer one generated question hash; right with probability p
      def answer(q, rng, p, student, course)
        right = rng.rand < p
        id = q[:id]
        case q[:question_type]
        when "multiple_choice_question", "true_false_question"
          pool = q[:answers].select { |a| right ? a[:weight].to_f == 100 : a[:weight].to_f.zero? }
          pool = q[:answers] if pool.empty?
          { "question_#{id}" => pool[rng.rand(pool.size)][:id].to_s }
        when "short_answer_question"
          { "question_#{id}" => right ? q[:answers].first[:text] : %w[nucleus ribosome Mitocondria].sample(random: rng) }
        when "fill_in_multiple_blanks_question"
          q[:answers].group_by { |a| a[:blank_id] }.to_h do |blank, as|
            ["question_#{id}_#{AssessmentQuestion.variable_id(blank)}", right ? as.first[:text] : "water"]
          end
        when "multiple_answers_question"
          q[:answers].to_h { |a| ["question_#{id}_answer_#{a[:id]}", (right ? a[:weight].to_f == 100 : rng.rand < 0.5) ? "1" : "0"] }
        when "multiple_dropdowns_question"
          q[:answers].group_by { |a| a[:blank_id] }.to_h do |blank, as|
            pick = right ? as.detect { |a| a[:weight].to_f == 100 } : as[rng.rand(as.size)]
            ["question_#{id}_#{AssessmentQuestion.variable_id(blank)}", pick[:id].to_s]
          end
        when "matching_question"
          matches = q[:matches]
          q[:answers].to_h { |a| ["question_#{id}_answer_#{a[:id]}", (right ? a[:match_id] : matches[rng.rand(matches.size)][:match_id]).to_s] }
        when "numerical_question"
          { "question_#{id}" => right ? "46" : %w[23 48 44.0 forty-six].sample(random: rng) }
        when "calculated_question"
          { "question_#{id}" => right ? q[:answers].first[:answer].to_s : rng.rand(1..99).to_s }
        when "essay_question"
          { "question_#{id}" => Seed::Text.html(rng, paragraphs: rng.rand(1..2)) }
        when "file_upload_question"
          att = Seed.upload(context: student, name: "sketch-#{id}-#{student.id}.png", content: Seed::Files::PNG_1X1 + rng.bytes(6), content_type: "image/png",
                            folder: student.submissions_folder(course), user: student)
          { "question_#{id}" => [att.id.to_s] }
        else
          {}
        end
      end

      # take the quiz once through the real model flow; returns the QuizSubmission
      def take(quiz, student, rng, p:, finished_at:, minutes: nil, skip: 0.04)
        qs = quiz.generate_submission(student)
        data = {}
        qs.quiz_data.each do |q|
          q = q.with_indifferent_access
          next if rng.rand < skip # unanswered question

          data.merge!(answer(q, rng, p, student, quiz.context))
        end
        qs.started_at = finished_at - (minutes || rng.rand(4..25)).minutes
        qs.submission_data = data
        Quizzes::SubmissionGrader.new(qs).grade_submission(finished_at:)
        qs
      end

      def start_only(quiz, student, rng)
        qs = quiz.generate_submission(student)
        partial = {}
        qs.quiz_data.first(2).each { |q| partial.merge!(answer(q.with_indifferent_access, rng, 0.7, student, quiz.context)) }
        qs.backup_submission_data(partial) unless partial.values.any?(Array)
        qs
      end

      def grade_manual(qs, grader, rng, ratio = 0.8)
        scores = {}
        qs.submission_data.each do |a|
          next unless a[:correct] == "undefined"

          q = qs.quiz_data.detect { |x| x[:id] == a[:question_id] }
          scores[a[:question_id].to_s] = { score: (q[:points_possible].to_f * [0.4, 0.6, 0.8, 1.0][rng.rand(4)] * ratio.ceil).round(1), comment: Seed::Text.sentence(rng, 3, 8) }
        end
        qs.update_scores(question_scores: scores, fudge_points: [0, 0, 0, 0.5, -1][rng.rand(5)], grader_id: grader.id)
      end
    end
  end
end

Seed.step("quizzes.banks") do
  main = Seed.course(:main)
  rng = Seed.rng("quizzes.banks")
  q = Seed::Quiz
  bank = main.assessment_question_banks.create!(title: "Unit 1 Question Bank")
  24.times { |i| bank.assessment_questions.create!(question_data: q.public_send(%i[mc mc tf mc multi short][i % 6], rng)) }
  vocab = main.assessment_question_banks.create!(title: "Vocabulary Bank — términos / 用語")
  12.times { vocab.assessment_questions.create!(question_data: q.mc(rng)) }
  main.assessment_question_banks.create!(title: "Empty Bank")
  acct = Seed.root.assessment_question_banks.create!(title: "District Benchmark Items (account bank)")
  6.times { acct.assessment_questions.create!(question_data: q.mc(rng)) }
  # outcome alignment: quiz results from this bank feed the outcome gradebook
  outcome = LearningOutcome.find(Seed.ref("outcomes:course")[1])
  outcome.align(bank, main, mastery_score: 0.6)
  Seed.set_ref("bank:unit1", bank.id)
  Seed.set_ref("bank:vocab", vocab.id)
  Seed.fixture(:questionBankId, bank.id)
end

Seed.step("quizzes.create") do
  main = Seed.course(:main)
  rng = Seed.rng("quizzes.create")
  q = Seed::Quiz
  a = Seed::Assign
  teacher = Seed.user(:teacher)
  students = Seed.users(:main_students)
  group_id = Seed.ref("assignment_group:quizzes")
  bank = AssessmentQuestionBank.find(Seed.ref("bank:unit1"))
  vocab = AssessmentQuestionBank.find(Seed.ref("bank:vocab"))
  desc = -> { Seed::Text.html(rng, paragraphs: 1) }
  made = {}
  Seed.bulk_assignments(main) do
    mk = lambda do |key, title, **attrs, &blk|
      made[key] = q.create(main, title:, description: desc.call, assignment_group_id: group_id, **attrs, &blk)
      Seed.set_ref("quiz:#{key}", made[key].id)
      made[key]
    end
    simple = ->(n) { Array.new(n) { |i| i % 3 == 2 ? q.tf(rng) : q.mc(rng) } }

    mk.call(:all_types, "Quiz 1: Cell Structure (every question type)", quiz_type: "assignment", due_at: a.due(-60), lock_at: a.due(-50),
                                                                       questions: q.types.map { |t| q.public_send(t, rng) }, show_correct_answers: true)
    mk.call(:auto, "Quiz 2: Membranes & Transport", quiz_type: "assignment", due_at: a.due(-46), time_limit: 20, allowed_attempts: 3, scoring_policy: "keep_highest",
                                                   shuffle_answers: true, questions: simple.call(10))
    mk.call(:bank_group, "Quiz 3: Photosynthesis (questions drawn from a bank)", quiz_type: "assignment", due_at: a.due(-32), one_question_at_a_time: true, cant_go_back: true,
                                                                               show_correct_answers: false, questions: [q.mc(rng, "Fixed question A"), q.tf(rng)]) do |quiz|
      g = quiz.quiz_groups.create!(name: "Random from Unit 1 bank", pick_count: 5, question_points: 2, assessment_question_bank_id: bank.id)
      Seed.set_ref("quiz_group:bank", g.id)
    end
    mk.call(:inline_group, "Quiz 4: Cellular Respiration (access code + IP filter)", quiz_type: "assignment", due_at: a.due(-21), access_code: "mitochondria", ip_filter: "10.0.0.0/8") do |quiz|
      g = quiz.quiz_groups.create!(name: "Pick 3 of 6", pick_count: 3, question_points: 1)
      6.times { quiz.quiz_questions.create!(question_data: q.mc(rng), quiz_group: g) }
      quiz.quiz_questions.create!(question_data: q.short(rng))
      Seed.set_ref("quiz_group:inline", g.id)
    end
    mk.call(:practice, "Practice Quiz: Organelles (unlimited attempts)", quiz_type: "practice_quiz", allowed_attempts: -1, questions: simple.call(6))
    mk.call(:graded_survey, "Graded Survey: Mid-semester Check-in", quiz_type: "graded_survey", points_possible: 5, due_at: a.due(-24),
                                                                   questions: [q.mc(rng, "How is the pace of the class?"), q.essay(rng, 0), q.multi(rng, 0)])
    mk.call(:survey, "Survey: Lab Preferences (anonymous)", quiz_type: "survey", anonymous_submissions: true, questions: [q.mc(rng, "Preferred lab day?"), q.essay(rng, 0)])
    mk.call(:locked, "Unit 2 Test (closed)", quiz_type: "assignment", due_at: a.due(-12), lock_at: a.due(-11), unlock_at: a.at(-14), time_limit: 45, questions: simple.call(12))
    mk.call(:future, "Quiz 5: Genetics (opens later)", quiz_type: "assignment", unlock_at: a.at(9), due_at: a.due(14), lock_at: a.due(16), questions: simple.call(8))
    mk.call(:unpublished, "Quiz 6: Evolution (unpublished draft)", quiz_type: "assignment", due_at: a.due(25), published: false, questions: simple.call(5))
    mk.call(:empty, "Empty Quiz (no questions, unpublished)", quiz_type: "assignment", published: false)
    mk.call(:no_due, "Pop Quiz (no due date)", quiz_type: "assignment", questions: simple.call(4))
    mk.call(:moderated, "Timed Quiz with Extensions (moderated)", quiz_type: "assignment", due_at: a.due(5), time_limit: 15, allowed_attempts: 1, questions: simple.call(6))
    mk.call(:essays, "Essay Quiz (everything needs manual grading)", quiz_type: "assignment", due_at: a.due(-16), questions: [q.essay(rng, 10), q.essay(rng, 10), q.file_upload(rng, 5)])
    mk.call(:in_progress, "Quiz with In-progress Attempts", quiz_type: "assignment", due_at: a.due(6), questions: simple.call(7))
    mk.call(:section_only, "Quiz: Honors Challenge (Period 4 only)", quiz_type: "assignment", only_visible_to_overrides: true, questions: simple.call(5))
    3.times do |i|
      mk.call(:"vocab#{i + 1}", "Vocabulary Quiz #{%w[A B C][i]}", quiz_type: "assignment", due_at: a.due(-52 + (i * 14))) do |quiz|
        quiz.quiz_groups.create!(name: "5 random terms", pick_count: 5, question_points: 1, assessment_question_bank_id: vocab.id)
      end
    end
    mk.call(:unicode, "Quiz with HTML & Unicode — «quiz» 测验 🧬", quiz_type: "assignment", due_at: a.due(-4),
                                                                 questions: [q.mc(rng, "¿Cuál es la función del <em>núcleo</em>? 細胞核の機能は？ &lt;script&gt;"), q.multi(rng), q.matching(rng)])
    mk.call(:zero_points, "Zero-point Quiz", quiz_type: "assignment", questions: [q.mc(rng, nil, 0), q.tf(rng, 0)])
    mk.call(:big_points, "Quiz worth 1000 points", quiz_type: "assignment", due_at: a.due(11), questions: [q.mc(rng, nil, 500), q.mc(rng, nil, 499.5), q.tf(rng, 0.5)])
    mk.call(:hidden_results, "Quiz with Hidden Results", quiz_type: "assignment", due_at: a.due(-27), hide_results: "always", show_correct_answers: false, questions: simple.call(5))
    mk.call(:keep_latest, "Retake Quiz (2 attempts, keep latest)", quiz_type: "assignment", due_at: a.due(-38), allowed_attempts: 2, scoring_policy: "keep_latest", questions: simple.call(5))
    2.times { |i| mk.call(:"deleted#{i + 1}", "Deleted Quiz #{i + 1}", quiz_type: "assignment", questions: simple.call(2)).destroy }

    # overrides on quizzes
    p2, p4 = CourseSection.where(id: Seed.ref("sections:main").values_at(1, 2)).order(:id).to_a
    a.override(made[:locked], set: p2, due_at: a.due(-10), lock_at: a.due(-9))
    a.override(made[:locked], students: [students[0], students[9]], title: "Makeup window", due_at: a.due(3), lock_at: a.due(4))
    a.override(made[:section_only], set: p4, due_at: a.due(7))
    a.override(made[:future], set: p4, unlock_at: a.at(7), due_at: a.due(12), lock_at: a.due(16))
  end

  Seed.fixture(:quizId, made[:auto].id)
  Seed.fixture(:quizAssignmentId, made[:auto].reload.assignment_id)
  Seed.fixture(:allQuestionTypesQuizId, made[:all_types].id)
  Seed.fixture(:quizQuestionId, made[:auto].quiz_questions.order(:id).first.id)
  Seed.fixture(:quizQuestionGroupId, Seed.ref("quiz_group:bank"))
  Seed.fixture(:quizQuestionGroupQuizId, made[:bank_group].id)
  Seed.fixture(:inlineQuizQuestionGroupId, Seed.ref("quiz_group:inline"))
  Seed.fixture(:practiceQuizId, made[:practice].id)
  Seed.fixture(:gradedSurveyQuizId, made[:graded_survey].id)
  Seed.fixture(:surveyQuizId, made[:survey].id)
  Seed.fixture(:unpublishedQuizId, made[:unpublished].id)
  Seed.fixture(:lockedQuizId, made[:locked].id)
  Seed.fixture(:essayQuizId, made[:essays].id)
  Seed.fixture(:moderatedQuizId, made[:moderated].id)
  Seed.fixture(:deletedQuizId, made[:deleted1].id)
  Seed.log "  #{main.quizzes.count} quizzes, #{Quizzes::QuizQuestion.where(quiz_id: main.quizzes.select(:id)).count} questions"
end

Seed.step("quizzes.submissions") do
  rng = Seed.rng("quizzes.submissions")
  q = Seed::Quiz
  teacher = Seed.user(:teacher)
  students = Seed.users(:main_students)
  quiz = ->(k) { Quizzes::Quiz.find(Seed.ref("quiz:#{k}")) }
  dil = ->(i) { Seed::Subs.diligence(i) }
  count = 0
  run = lambda do |key, roster, **opts, &blk|
    z = quiz.call(key)
    base = z.due_at || (Seed.now - 3.days)
    base = Seed.now - 2.hours if base > Seed.now
    roster.each do |u, i|
      next if i > 1 && rng.rand > dil.call(i) + 0.1 # the less diligent skip quizzes

      late = rng.rand < 0.1 && z.lock_at.nil?
      finished = late ? [base + rng.rand(1..60).hours, Seed.now - 5.minutes].min : base - rng.rand(1..90).hours
      qs = q.take(z, u, rng, p: dil.call(i), finished_at: finished, **opts)
      count += 1
      blk&.call(qs, u, i)
    end
    z
  end
  all = students.each_with_index.to_a

  # Quiz 2: auto-graded, everyone; a quarter retake it (attempts 2 and 3)
  mine = nil
  run.call(:auto, all) do |qs, u, i|
    mine = qs if i.zero?
    next unless rng.rand < 0.25 || i == 1

    (i == 1 ? 2 : 1).times do |n|
      q.take(qs.quiz, u, rng, p: [dil.call(i) + 0.15, 1.0].min, finished_at: qs.finished_at + (n + 1).hours)
      count += 1
    end
  end
  Seed.fixture(:quizSubmissionId, mine.id)
  Seed.fixture(:quizSubmissionUserId, students[0].id)
  Seed.fixture(:quizSubmissionAttempt, mine.reload.attempt)

  # Quiz 1: every question type -> pending review until the essay/file questions are scored
  pending = nil
  run.call(:all_types, all.first(45)) do |qs, _u, i|
    if i % 3 == 0
      pending ||= qs
    else
      q.grade_manual(qs, teacher, rng)
    end
  end
  Seed.fixture(:pendingReviewQuizSubmissionId, pending.id)
  run.call(:bank_group, all.first(50))
  run.call(:essays, all.first(18)) { |qs, _u, i| q.grade_manual(qs, teacher, rng) if i % 5 == 0 }
  %i[vocab1 vocab2 vocab3 hidden_results keep_latest locked unicode].each { |k| run.call(k, all.select { |_, i| i < 2 || rng.rand < 0.3 }) }
  run.call(:keep_latest, all.first(8)) # second attempts
  run.call(:practice, all.first(15))
  run.call(:practice, all.first(6))
  run.call(:graded_survey, all.first(40))
  run.call(:survey, all.first(25))
  run.call(:no_due, all.first(10))
  run.call(:zero_points, all.first(5))
  run.call(:inline_group, all.first(6))

  # in-progress attempts (started, never submitted)
  inprog = quiz.call(:in_progress)
  started = all[2, 7].map { |u, _| q.start_only(inprog, u, rng) }
  run.call(:in_progress, all.first(2))
  Seed.fixture(:inProgressQuizId, inprog.id)
  Seed.fixture(:inProgressQuizSubmissionId, started.first.id)

  # moderation: extra time / attempts / manual unlock for individual students
  mod = quiz.call(:moderated)
  ext_users = [students[0], students[3], students[5], students[8]]
  [{ extra_time: 15 }, { extra_attempts: 2 }, { extra_time: 30, extra_attempts: 1, manually_unlocked: true }, { manually_unlocked: true }].each_with_index do |params, i|
    qs = Quizzes::SubmissionManager.new(mod).find_or_create_submission(ext_users[i], state: "settings_only")
    Quizzes::QuizExtension.new(qs, params).extend_submission!
  end
  run.call(:moderated, all[10, 12])
  locked = quiz.call(:locked)
  qs = Quizzes::SubmissionManager.new(locked).find_or_create_submission(students[20], state: "settings_only")
  Quizzes::QuizExtension.new(qs, { extra_attempts: 1, manually_unlocked: true }).extend_submission!
  Seed.fixture(:quizExtensionUserId, students[0].id)
  Seed.fixture(:quizExtensionUserIds, ext_users.map(&:id))
  Seed.log "  #{count} quiz attempts; states: #{Quizzes::QuizSubmission.group(:workflow_state).count.inspect}"
end

Seed.step("quizzes.second") do
  second = Seed.course(:second)
  rng = Seed.rng("quizzes.second")
  q = Seed::Quiz
  students = Seed.users(:second_students)
  made = nil
  Seed.bulk_assignments(second) do
    made = q.create(second, title: "Chapter 1 Quiz: Quadratics", quiz_type: "assignment", due_at: Seed::Assign.due(-20), questions: Array.new(6) { q.mc(rng) } + [q.numerical(rng)])
    q.create(second, title: "Practice: Factoring", quiz_type: "practice_quiz", questions: Array.new(4) { q.tf(rng) })
    q.create(second, title: "Chapter 2 Quiz (unpublished)", quiz_type: "assignment", published: false, questions: [q.mc(rng)])
  end
  Seed.set_ref("quiz:second", made.id)
  Seed.fixture(:course2QuizId, made.id)
end

Seed.step("quizzes.second_submissions") do
  rng = Seed.rng("quizzes.second_submissions")
  z = Quizzes::Quiz.find(Seed.ref("quiz:second"))
  Seed.users(:second_students).each_with_index do |u, i|
    next if i % 6 == 5

    Seed::Quiz.take(z, u, rng, p: 0.5 + (rng.rand * 0.5), finished_at: z.due_at - rng.rand(1..40).hours)
  end
end
