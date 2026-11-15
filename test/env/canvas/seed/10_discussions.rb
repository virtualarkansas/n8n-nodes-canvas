# frozen_string_literal: true

# Discussion topics (~65 incl. group child topics) with deep threads, attachments, deleted /
# edited entries, ratings, read state and subscriptions; announcements (~45) incl. delayed and
# section-specific ones; an announcement external feed.

module Seed
  module Disc
    class << self
      def topic(context, title:, user:, message: nil, state: "active", assignment: nil, sections: nil, **attrs)
        t = context.discussion_topics.build(title:, message:, user:, **attrs)
        t.workflow_state = state
        if sections
          t.is_section_specific = true
          t.course_sections = sections
        end
        if assignment
          a = context.assignments.build(submission_types: "discussion_topic", title:, **assignment)
          a.workflow_state = state == "unpublished" ? "unpublished" : "published"
          a.saved_by = :discussion_topic
          t.assignment = a
        end
        t.saving_user = user
        t.save!
        t
      end

      # builds a reply tree; returns all entries created. depth => max nesting level.
      def thread(topic, users, rng, roots:, depth: 3, fanout: 2)
        made = []
        walk = lambda do |parent, level|
          return if level > depth

          rng.rand(level == 1 ? 1..fanout : 0..fanout).times do
            e = begin
              parent.reply_from(user: users[rng.rand(users.size)], html: "<p>#{Seed::Text.paragraph(rng, rng.rand(1..3))}</p>")
            rescue IncomingMail::Errors::ReplyToLockedTopic, IncomingMail::Errors::InvalidParticipant
              nil # e.g. a student whose enrollment has been concluded
            end
            next unless e

            made << e
            walk.call(e, level + 1)
          end
        end
        roots.times do
          e = begin
            topic.reply_from(user: users[rng.rand(users.size)], html: "<p>#{Seed::Text.paragraph(rng, rng.rand(1..4))}</p>")
          rescue IncomingMail::Errors::ReplyToLockedTopic, IncomingMail::Errors::InvalidParticipant
            nil # e.g. a concluded enrollment
          end
          next unless e

          made << e
          walk.call(e, 2)
        end
        made
      end

      # spread created/posted timestamps of a topic and its entries over the past
      def backdate(topic, posted_at, rng)
        DiscussionTopic.where(id: topic.id).update_all(posted_at:, created_at: posted_at)
        t = posted_at
        last = nil
        topic.discussion_entries.order(:id).pluck(:id).each do |id|
          t += rng.rand(5..600).minutes
          t = Seed.now - rng.rand(1..120).minutes if t > Seed.now
          DiscussionEntry.where(id:).update_all(created_at: t, updated_at: t)
          last = t
        end
        DiscussionTopic.where(id: topic.id).update_all(last_reply_at: last) if last
      end
    end
  end
end

Seed.step("discussions.topics") do
  d = Seed::Disc
  a = Seed::Assign
  main = Seed.course(:main)
  rng = Seed.rng("discussions.topics")
  teacher = Seed.user(:teacher)
  ta = Seed.user(:ta)
  student = Seed.user(:student)
  student2 = Seed.user(:student2)
  students = Seed.users(:main_students)
  group = AssignmentGroup.find(Seed.ref("assignment_group:discussions"))
  lab_cat = GroupCategory.find(Seed.ref("group_category:lab"))
  proj_cat = GroupCategory.find(Seed.ref("group_category:project"))
  p1, p2, p4, = CourseSection.where(id: Seed.ref("sections:main")).order(:id).to_a
  body = -> { Seed::Text.html(rng, paragraphs: rng.rand(1..3), rich: rng.rand < 0.3) }
  made = {}
  graded = []
  Seed.bulk_assignments(main) do
    mk = lambda do |key, title, user: teacher, **attrs|
      made[key] = d.topic(main, title:, user:, message: attrs.key?(:message) ? attrs.delete(:message) : body.call, **attrs)
      Seed.set_ref("topic:#{key}", made[key].id)
      made[key]
    end
    # --- ungraded, well populated
    mk.call(:intro, "Introduce Yourself 👋", discussion_type: "threaded", pinned: true, position: 1)
    mk.call(:qa, "Course Q&A (ask anything)", discussion_type: "threaded", pinned: true, position: 2)
    mk.call(:deep, "Debate: Are viruses alive? (deeply nested thread)", discussion_type: "threaded")
    mk.call(:flat, "Lab Partner Finder (not threaded)", discussion_type: "not_threaded")
    mk.call(:side, "Chapter 3 Reactions (side comments)", discussion_type: "side_comment")
    mk.call(:rated, "Best Study Tips (liking enabled, sorted by likes)", discussion_type: "threaded", allow_rating: true, sort_by_rating: true)
    mk.call(:graders_rate, "Peer Answers (only graders can like)", discussion_type: "threaded", allow_rating: true, only_graders_can_rate: true)
    mk.call(:podcast, "Weekly Podcast Feed", podcast_enabled: true, podcast_has_student_posts: true)
    mk.call(:initial_post, "Case Study Reactions (must post before seeing replies)", discussion_type: "threaded", require_initial_post: true)
    mk.call(:pinned3, "Syllabus Questions", pinned: true, position: 3)
    # --- availability / state
    mk.call(:locked, "Exam 1 Review (closed for comments)", locked: true)
    mk.call(:locked2, "Week 1 Icebreaker (closed)", locked: true)
    mk.call(:lock_past, "Unit 1 Wrap-up (lock date passed)", lock_at: a.due(-30))
    mk.call(:lock_future, "Unit 3 Kickoff (locks next week)", lock_at: a.due(7))
    mk.call(:delayed, "Finals Study Group Sign-up (delayed post)", delayed_post_at: a.at(12))
    mk.call(:delayed2, "Winter Break Reading (delayed post)", delayed_post_at: a.at(30), lock_at: a.due(60))
    mk.call(:delayed_past, "Field Trip Recap (delayed post, now visible)", delayed_post_at: a.at(-9))
    4.times { |i| mk.call(i.zero? ? :unpublished : :"unpublished#{i}", "DRAFT discussion: #{Seed::Text.title(rng, 2, 4)}", state: "unpublished") }
    # --- audience
    mk.call(:section, "Period 2 Only: Lab Schedule Swap", sections: [p2])
    mk.call(:section2, "Honors Reading Circle (Period 4)", sections: [p4], discussion_type: "threaded")
    mk.call(:group_ungraded, "Project Brainstorm (group discussion)", group_category: proj_cat, discussion_type: "threaded")
    # --- student / TA authored
    mk.call(:student_topic, "Anyone have notes from Tuesday?", user: student, discussion_type: "threaded")
    mk.call(:student_topic2, "Study group this weekend — ¿quién viene?", user: student2)
    3.times { |i| mk.call(:"student_topic#{i + 3}", "#{Seed::Text.title(rng, 2, 4)}?", user: students[10 + i]) }
    mk.call(:ta_topic, "TA Office Hours Thread", user: ta)
    # --- anonymous
    begin
      mk.call(:anonymous, "Anonymous Feedback on the Course", anonymous_state: "full_anonymity", discussion_type: "threaded")
      mk.call(:partial_anon, "Ask Without Embarrassment (optional anonymity)", anonymous_state: "partial_anonymity", is_anonymous_author: false, discussion_type: "threaded")
    rescue => e
      Seed.log "  anonymous discussions skipped: #{e.message[0, 100]}"
    end
    # --- odd content
    mk.call(:unicode, "多言語スレッド — Hilo multilingüe — موضوع متعدد اللغات", message: Seed::Text::UNICODE_SNIPPETS.map { |s| "<p>#{ERB::Util.html_escape(s)}</p>" }.join)
    mk.call(:long, "Reading: Excerpt for Discussion (very long message)", message: Seed::Text.html(rng, paragraphs: 150, rich: true))
    mk.call(:empty_msg, "Topic With No Message", message: nil)
    mk.call(:todo, "Planner item: Watch the documentary", todo_date: Seed.now + 3.days)
    3.times { |i| mk.call(:"dup#{i + 1}", "Weekly Check-in") }
    mk.call(:html_title, "<b>Bold</b> & \"quoted\" discussion title #1")
    6.times { |i| mk.call(:"filler#{i + 1}", "Discussion: #{Seed::Text.title(rng, 2, 5)}", discussion_type: %w[threaded not_threaded][i % 2]) }
    3.times { |i| mk.call(:"deleted#{i + 1}", "Deleted Discussion #{i + 1}").destroy }

    # --- graded discussions
    8.times do |i|
      opts = { points_possible: [10, 10, 15, 20, 5, 10, 25, 10][i], assignment_group: group, due_at: a.due(-66 + (i * 10)) }
      opts[:grading_type] = "pass_fail" if i == 4
      opts[:peer_reviews] = true if i == 5
      extra = {}
      extra[:require_initial_post] = true if i == 2
      extra[:lock_at] = a.due(-50) if i == 1
      t = mk.call(:"graded#{i + 1}", "Discussion #{i + 1}: #{Seed::Text.title(rng, 2, 4)}", assignment: opts, discussion_type: i.even? ? "threaded" : "not_threaded", **extra)
      graded << t.id
    end
    gg = mk.call(:group_graded, "Lab Team Reflection (graded group discussion)", group_category: lab_cat, discussion_type: "threaded",
                                                                                assignment: { points_possible: 10, assignment_group: group, due_at: a.due(-13) })
    graded << gg.id
    mk.call(:graded_unpublished, "Discussion 9: Draft Prompt (unpublished, graded)", state: "unpublished", assignment: { points_possible: 10, assignment_group: group, due_at: a.due(21) })
    made[:group_ungraded].refresh_subtopics
    gg.refresh_subtopics
  end

  Seed.set_ref("topics:graded", graded)
  Seed.fixture(:discussionTopicId, made[:intro].id)
  Seed.fixture(:deepDiscussionTopicId, made[:deep].id)
  Seed.fixture(:gradedDiscussionTopicId, made[:graded1].id)
  Seed.fixture(:discussionAssignmentId, made[:graded1].assignment_id)
  Seed.fixture(:groupDiscussionTopicId, made[:group_graded].id)
  Seed.fixture(:ungradedGroupDiscussionTopicId, made[:group_ungraded].id)
  Seed.fixture(:pinnedDiscussionTopicId, made[:qa].id)
  Seed.fixture(:lockedDiscussionTopicId, made[:locked].id)
  Seed.fixture(:delayedDiscussionTopicId, made[:delayed].id)
  Seed.fixture(:unpublishedDiscussionTopicId, made[:unpublished].id)
  Seed.fixture(:sectionDiscussionTopicId, made[:section].id)
  Seed.fixture(:studentDiscussionTopicId, made[:student_topic].id)
  Seed.fixture(:ratedDiscussionTopicId, made[:rated].id)
  Seed.fixture(:requireInitialPostTopicId, made[:initial_post].id)
  Seed.fixture(:deletedDiscussionTopicId, made[:deleted1].id)
  Seed.fixture(:anonymousDiscussionTopicId, made[:anonymous].id) if made[:anonymous]
  Seed.log "  #{main.discussion_topics.where(type: nil).count} course discussion topics"
end

Seed.step("discussions.entries") do
  d = Seed::Disc
  main = Seed.course(:main)
  rng = Seed.rng("discussions.entries")
  teacher = Seed.user(:teacher)
  ta = Seed.user(:ta)
  student = Seed.user(:student)
  student2 = Seed.user(:student2)
  students = Seed.users(:main_students)
  everyone = students + [teacher, ta]
  topic = ->(k) { DiscussionTopic.find(Seed.ref("topic:#{k}")) }
  count = 0

  # the showcase thread: persona student root entry, replies, nesting, attachment, edit, delete
  intro = topic.call(:intro)
  root = intro.reply_from(user: student, html: "<p>Hi everyone, I'm Sam! I like frogs 🐸 and hiking.</p>")
  reply = root.reply_from(user: teacher, html: "<p>Welcome, Sam! Great to have you.</p>")
  nested = reply.reply_from(user: student, html: "<p>Thanks Ms. Marlowe!</p>")
  nested.reply_from(user: student2, html: "<p>¡Hola Sam! Me encantan las ranas también.</p>")
  att = Seed.upload(context: student2, name: "my-pet-frog.png", content: Seed::Files::PNG_1X1 + "frog", content_type: "image/png", user: student2)
  with_file = intro.reply_from(user: student2, html: "<p>Here's a photo of my frog.</p>")
  with_file.update!(attachment: att)
  edited = intro.reply_from(user: students[4], html: "<p>Original text with a typo.</p>")
  edited.update!(message: "<p>Edited text (typo fixed).</p>", editor: students[4])
  mod_edit = intro.reply_from(user: students[5], html: "<p>Please remove my phone number: 555-0100</p>")
  mod_edit.update!(message: "<p>[personal information removed by instructor]</p>", editor: teacher)
  deleted = intro.reply_from(user: students[6], html: "<p>Posted in the wrong thread, sorry.</p>")
  deleted.reply_from(user: teacher, html: "<p>No problem — reply stays even though the parent is deleted.</p>")
  deleted.destroy
  count += d.thread(intro, everyone, rng, roots: 40, depth: 3, fanout: 2).size

  # 9 levels deep chain plus bushy side threads
  deep = topic.call(:deep)
  e = deep.reply_from(user: teacher, html: "<p>Opening position: #{Seed::Text.sentence(rng)}</p>")
  chain = [e]
  9.times do |i|
    e = e.reply_from(user: everyone[(i * 7) % everyone.size], html: "<p>Level #{i + 2}: #{Seed::Text.sentence(rng)}</p>")
    chain << e
  end
  count += d.thread(deep, everyone, rng, roots: 12, depth: 6, fanout: 2).size

  # ratings
  rated = topic.call(:rated)
  entries = d.thread(rated, students.first(30), rng, roots: 18, depth: 2, fanout: 2)
  entries.each_with_index do |en, i|
    students.sample([0, 1, 2, 5, 12][i % 5], random: rng).each { |u| en.change_rating(1, u) }
  end
  entries.first.change_rating(1, student)
  entries.first.change_rating(0, student2) # liked then un-liked
  count += entries.size
  gr = topic.call(:graders_rate)
  d.thread(gr, students.first(20), rng, roots: 8, depth: 2).each_with_index { |en, i| en.change_rating(1, i.even? ? teacher : ta) if i % 3 == 0 }

  # general population
  %i[qa flat side podcast pinned3 lock_future delayed_past section2 student_topic student_topic2 ta_topic unicode todo dup1 dup2 filler1 filler2 filler3 filler4].each do |k|
    t = topic.call(k)
    users = t.is_section_specific? ? everyone.select { |u| u == teacher || t.course_sections.first.enrollments.where(user_id: u.id).exists? } : everyone
    count += d.thread(t, users, rng, roots: rng.rand(2..9), depth: t.discussion_type == "threaded" ? 3 : 1, fanout: 2).size
  end
  %i[anonymous partial_anon].each do |k|
    next unless Seed.ref?("topic:#{k}")

    t = topic.call(k)
    students.first(6).each { |u| t.discussion_entries.create!(message: "<p>#{Seed::Text.sentence(rng)}</p>", user: u, is_anonymous_author: true) }
  rescue => err
    Seed.log "  anonymous entries skipped: #{err.message[0, 100]}"
  end
  # require-initial-post: only some students have posted
  ip = topic.call(:initial_post)
  students.first(12).each { |u| ip.reply_from(user: u, html: "<p>#{Seed::Text.paragraph(rng, 2)}</p>") }
  # closed topics had activity before closing
  %i[locked locked2 lock_past].each do |k|
    t = topic.call(k)
    was = [t.locked, t.lock_at]
    t.update_columns(locked: false, lock_at: nil)
    count += d.thread(t.reload, everyone, rng, roots: 5, depth: 2).size
    t.update_columns(locked: was[0], lock_at: was[1])
  end

  # group discussions: entries in the per-group child topics
  [topic.call(:group_ungraded), topic.call(:group_graded)].each do |parent|
    parent.child_topics.order(:id).each_with_index do |child, i|
      members = child.context.users.order(:id).to_a
      next if members.empty? || i % 6 == 5

      count += d.thread(child, members, rng, roots: rng.rand(2..5), depth: 3, fanout: 2).size
    end
  end
  child = topic.call(:group_graded).child_topics.where(context_id: Seed.ref("groups:lab").first, context_type: "Group").first

  # graded discussions: posts become submissions; teacher grades most
  graders = [teacher, ta]
  DiscussionTopic.where(id: Seed.ref("topics:graded")).order(:id).each_with_index do |t, n|
    next if t.id == Seed.ref("topic:group_graded")

    was = [t.locked, t.lock_at]
    t.update_columns(locked: false, lock_at: nil)
    t.reload
    posters = students.each_with_index.select { |_, i| i < 2 || rng.rand < Seed::Subs.diligence(i) - 0.15 }.map(&:first)
    posters.each { |u| t.reply_from(user: u, html: "<p>#{Seed::Text.paragraph(rng, rng.rand(2..4))}</p>") }
    count += posters.size
    count += d.thread(t, posters, rng, roots: 0, depth: 0).size
    t.discussion_entries.where(parent_id: nil).order(:id).limit(15).each do |en|
      en.reply_from(user: posters[rng.rand(posters.size)], html: "<p>#{Seed::Text.sentence(rng)}</p>")
      count += 1
    end
    t.update_columns(locked: was[0], lock_at: was[1])
    next if n == 7 # most recent one is still ungraded

    asg = t.assignment
    posters.each_with_index do |u, i|
      next if rng.rand < 0.15

      asg.grade_student(u, grade: Seed::Subs.grade_value(asg, Seed::Subs.diligence(i), rng), grader: graders[rng.rand(2)])
    end
  end
  gasg = topic.call(:group_graded).assignment
  students.first(30).each_with_index { |u, i| gasg.grade_student(u, grade: 6 + (i % 5), grader: teacher) if i % 4 != 3 }

  # read state / subscriptions for the personas
  DiscussionTopic.where(context: main, type: nil).active.order(:id).each_with_index do |t, i|
    t.change_all_read_state("read", student) if i.even?
    t.change_read_state("read", teacher)
    t.change_all_read_state("read", teacher) if i % 3 != 0
  end
  intro.change_all_read_state("read", student)
  chain.last.change_read_state("unread", student, forced: true)
  topic.call(:qa).subscribe(student)
  topic.call(:qa).subscribe(student2)
  topic.call(:deep).unsubscribe(teacher)
  topic.call(:flat).subscribe(ta)

  # spread everything over the term
  DiscussionTopic.where(context: main, type: nil).order(:id).each_with_index do |t, i|
    d.backdate(t, Seed.now - (75 - (i % 70)).days - rng.rand(0..600).minutes, rng)
  end

  Seed.fixture(:discussionEntryId, root.id)
  Seed.fixture(:discussionReplyEntryId, reply.id)
  Seed.fixture(:nestedDiscussionEntryId, nested.id)
  Seed.fixture(:deepDiscussionEntryId, chain.last.id)
  Seed.fixture(:deepDiscussionEntryDepth, chain.size)
  Seed.fixture(:entryWithAttachmentId, with_file.id)
  Seed.fixture(:editedDiscussionEntryId, edited.id)
  Seed.fixture(:deletedDiscussionEntryId, deleted.id)
  Seed.fixture(:ratedDiscussionEntryId, entries.first.id)
  Seed.fixture(:groupChildDiscussionTopicId, child.id) if child
  Seed.log "  ~#{count} entries; total #{DiscussionEntry.count} (deleted: #{DiscussionEntry.where(workflow_state: "deleted").count})"
end

Seed.step("discussions.announcements") do
  d = Seed::Disc
  a = Seed::Assign
  main = Seed.course(:main)
  rng = Seed.rng("announcements")
  teacher = Seed.user(:teacher)
  ta = Seed.user(:ta)
  students = Seed.users(:main_students)
  _, p2, p4, p6 = CourseSection.where(id: Seed.ref("sections:main")).order(:id).to_a
  made = {}
  ann = lambda do |key, title, user: teacher, course: main, posted: nil, sections: nil, **attrs|
    t = course.announcements.build(title:, message: attrs.key?(:message) ? attrs.delete(:message) : Seed::Text.html(rng, paragraphs: rng.rand(1..3), rich: rng.rand < 0.25), user:, **attrs)
    if sections
      t.is_section_specific = true
      t.course_sections = sections
    end
    t.saving_user = user
    t.save!
    DiscussionTopic.where(id: t.id).update_all(posted_at: posted, created_at: posted) if posted
    made[key] = t if key
    t
  end

  first = ann.call(:welcome, "Welcome to Biology 101!", posted: Seed.now - 88.days)
  22.times do |i|
    ann.call(nil, ["Reminder: #{Seed::Text.title(rng, 2, 4)}", "Week #{i + 1} Agenda", "Lab #{(i / 3) + 1} materials list", "Grades posted for #{Seed::Text.title(rng, 1, 2)}"][i % 4],
             user: i % 6 == 5 ? ta : teacher, posted: Seed.now - (84 - (i * 3.7)).days)
  end
  ann.call(:latest, "Exam 2 moved to Thursday ⚠️", posted: Seed.now - 3.hours)
  ann.call(:delayed, "Final Exam Logistics (scheduled)", delayed_post_at: a.at(20))
  ann.call(:delayed2, "Happy Winter Break! ❄️ (scheduled)", delayed_post_at: a.at(34), lock_at: a.due(60))
  ann.call(:delayed_past, "Field Trip Permission Slips (was scheduled, now posted)", delayed_post_at: a.at(-20), posted: Seed.now - 20.days)
  ann.call(:section, "Period 2: Room change on Friday", sections: [p2], posted: Seed.now - 6.days)
  ann.call(:section2, "Periods 4 & 6: Combined lab next week", sections: [p4, p6], posted: Seed.now - 2.days)
  ann.call(:locked, "Lab Fee Reminder (comments off)", locked: true, posted: Seed.now - 30.days)
  with_file = ann.call(:attachment, "Updated Syllabus Attached", posted: Seed.now - 60.days)
  with_file.update!(attachment: Seed.upload(context: main, name: "syllabus-v2.pdf", content: Seed::Files::PDF_MIN + "%v2\n", content_type: "application/pdf", user: teacher))
  ann.call(:unicode, "¡Feria de ciencias! 科学フェア — معرض العلوم 🔬", message: Seed::Text::UNICODE_SNIPPETS.first(6).map { |s| "<p>#{ERB::Util.html_escape(s)}</p>" }.join, posted: Seed.now - 12.days)
  ann.call(:long, "Detailed Feedback on the Midterm (long)", message: Seed::Text.html(rng, paragraphs: 60, rich: true), posted: Seed.now - 22.days)
  2.times { |i| ann.call(nil, "Substitute teacher tomorrow", posted: Seed.now - (40 + i).days) } # duplicate titles
  2.times { |i| ann.call(nil, "Posted by mistake #{i + 1}").destroy }
  # replies on announcements
  d.thread(first, students.first(25) + [teacher], rng, roots: 9, depth: 2)
  d.thread(made[:latest], students.first(25), rng, roots: 4, depth: 1)
  first.change_all_read_state("read", Seed.user(:student))

  # announcements in other courses the personas belong to
  second = Seed.course(:second)
  6.times { |i| ann.call(nil, "Algebra II: #{Seed::Text.title(rng, 2, 4)}", course: second, posted: Seed.now - (50 - (i * 9)).days) }
  ann.call(nil, "Algebra II: Quiz Friday (scheduled)", course: second, delayed_post_at: a.at(4))
  Course.where(id: Seed.ref("courses:catalog")).where(workflow_state: "available").order(:id).limit(30).each_with_index do |course, i|
    next unless i % 3 == 0

    author = course.teachers.order(:id).first
    next unless author

    rng.rand(1..3).times { |j| ann.call(nil, "#{course.course_code}: #{Seed::Text.title(rng, 2, 4)}", course:, user: author, posted: Seed.now - (30 - (j * 8)).days) }
  end

  # external feeds
  feed = main.external_feeds.create!(url: "https://example.com/biology-news.rss", user: teacher, verbosity: "full")
  main.external_feeds.create!(url: "https://example.org/science/feed.atom?topic=cells&lang=en", user: teacher, verbosity: "truncate", header_match: "cell")
  second.external_feeds.create!(url: "https://example.com/math-daily.xml", user: teacher, verbosity: "link_only")

  Seed.fixture(:announcementId, first.id)
  Seed.fixture(:latestAnnouncementId, made[:latest].id)
  Seed.fixture(:delayedAnnouncementId, made[:delayed].id)
  Seed.fixture(:sectionAnnouncementId, made[:section].id)
  Seed.fixture(:lockedAnnouncementId, made[:locked].id)
  Seed.fixture(:announcementWithAttachmentId, with_file.id)
  Seed.fixture(:externalFeedId, feed.id)
  Seed.log "  #{main.announcements.count} announcements in the main course, #{Announcement.count} total"
end
