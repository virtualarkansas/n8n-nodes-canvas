# frozen_string_literal: true

# Collaboration & communication: more groups, conversations (~210), calendar events (~150),
# appointment groups with reservations, blackout dates, planner notes/overrides, bookmarks,
# favorites, ePortfolios, polls, notification preferences, account calendars, conferences
# and collaborations (local fake plugin config; nothing external is contacted).
#
# Self-scoped APIs (/users/self/..., /planner_notes, /polls, /conversations) only return the
# caller's own records, so the admin user is given the same kinds of records as the personas:
# un-prefixed fixtures (bookmarkId, plannerNoteId, pollId, ...) belong to the admin token.

Seed.step("comms.admin_enroll") do
  admin = Seed.admin
  e = Seed::Enroll.add(Seed.course(:main), admin, :teacher)
  Seed::Enroll.add(Seed.course(:second), admin, :teacher)
  Seed.fixture(:adminEnrollmentId, e.id)
  cc = admin.communication_channels.active.order(:id).first
  Seed.fixture(:adminCommunicationChannelId, cc.id) if cc
end

Seed.step("groups.more") do
  rng = Seed.rng("groups.more")
  second = Seed.course(:second)
  students = Seed.users(:second_students)
  cat = second.group_categories.create!(name: "Problem Set Teams", self_signup: "enabled", group_limit: 6)
  teams = students.each_slice(6).each_with_index.map do |members, i|
    g = cat.groups.create!(name: "Team #{%w[Alpha Beta Gamma Delta Epsilon Zeta][i]}", context: second)
    members.each { |u| g.add_user(u, "accepted") }
    g.update!(leader: members.first)
    g
  end
  Seed.fixture(:course2GroupCategoryId, cat.id)
  Seed.fixture(:course2GroupId, teams.first.id)

  # account-level groups (communities)
  root = Seed.root
  teachers = Seed.users(:teachers)
  acat = root.group_categories.create!(name: "District Committees")
  sci = acat.groups.create!(name: "Science Curriculum Committee", context: root, description: Seed::Text.sentence(rng), join_level: "invitation_only")
  ([Seed.user(:teacher), Seed.user(:teacher2), Seed.admin] + teachers.first(6)).each { |u| sci.add_user(u, "accepted") }
  sci.update!(leader: Seed.user(:teacher))
  tech = acat.groups.create!(name: "Technology Committee 💻", context: root, join_level: "parent_context_request")
  teachers[6, 5].each { |u| tech.add_user(u, "accepted") }
  tech.add_user(Seed.user(:teacher), "invited")
  acat.groups.create!(name: "Empty Committee", context: root)
  rhs_cat = Seed.account(:rhs).group_categories.create!(name: "RHS Clubs")
  club = rhs_cat.groups.create!(name: "Robotics Boosters", context: Seed.account(:rhs))
  teachers[11, 3].each { |u| club.add_user(u, "accepted") }
  Seed.fixture(:accountGroupCategoryId, acat.id)
  Seed.fixture(:accountGroupId, sci.id)

  # groups in the large course so its group list is non-trivial
  large = Seed.course(:large)
  lcat = large.group_categories.create!(name: "Seminar Pods")
  pods = large.students.order(:id).limit(48).to_a
  pods.each_slice(8).each_with_index do |members, i|
    g = lcat.groups.create!(name: "Pod #{i + 1}", context: large)
    members.each { |u| g.add_user(u, "accepted") }
  end
  Seed.fixture(:largeCourseGroupCategoryId, lcat.id)
  Seed.log "  #{Group.active.count} active groups, #{GroupMembership.count} memberships"
end

Seed.step("comms.conversations") do
  rng = Seed.rng("conversations")
  main = Seed.course(:main)
  second = Seed.course(:second)
  admin = Seed.admin
  teacher = Seed.user(:teacher)
  teacher2 = Seed.user(:teacher2)
  ta = Seed.user(:ta)
  student = Seed.user(:student)
  student2 = Seed.user(:student2)
  observer = Seed.user(:observer)
  students = Seed.users(:main_students)
  subjects = ["Question about HW", "Absent tomorrow", "Lab makeup?", "Grade question", "Re: Field trip form", "Extra credit?", "Thank you!", "Missing assignment",
              "Tutoring schedule", "¿Puedo entregar tarde?", "Re: Re: Fwd: Permission slip", "(no subject)", "Group project — who is doing what?", "URGENT!!! quiz access", "質問があります"]
  all = []
  convo = lambda do |sender, recipients, n_msgs: 1, subject: :pick, course: main, group: nil, attachment: false|
    subject = subjects[rng.rand(subjects.size)] if subject == :pick
    subject = nil if subject == "(no subject)"
    private_conv = group.nil? ? recipients.size == 1 : !group
    cp = sender.initiate_conversation(recipients, private_conv, subject:, context_type: "Course", context_id: course.id)
    c = cp.conversation
    opts = { tags: ["course_#{course.id}"] }
    if attachment
      att = Seed.upload(context: sender, name: "note-#{rng.rand(10_000)}.#{%w[pdf png txt][rng.rand(3)]}", content: "attachment #{rng.rand(1_000_000)}", content_type: "text/plain",
                        folder: sender.conversation_attachments_folder, user: sender)
      opts[:attachment_ids] = [att.id]
    end
    cp.add_message(Seed::Text.paragraph(rng, rng.rand(1..3)), opts)
    people = [sender] + recipients
    (n_msgs - 1).times do |i|
      author = people[(i + 1) % people.size]
      c.add_message(author, rng.rand < 0.1 ? Seed::Text.unicode(rng) : Seed::Text.paragraph(rng, rng.rand(1..2)), tags: ["course_#{course.id}"])
    end
    all << c
    c
  end
  state = lambda do |c, user, workflow_state: nil, starred: nil|
    cp = c.conversation_participants.where(user_id: user.id).first
    next unless cp

    cp.workflow_state = workflow_state if workflow_state
    cp.starred = starred unless starred.nil?
    cp.save!
    cp
  end

  # the showcase conversation: admin + teacher + student persona are all participants
  main_c = convo.call(admin, [teacher, student], n_msgs: 6, subject: "Welcome to the battery — schedule check", group: true, attachment: true)
  state.call(main_c, admin, workflow_state: "read", starred: true)
  state.call(main_c, teacher, workflow_state: "read", starred: true)
  # teacher <-> individual students (teacher has > 100 conversations so paging is exercised)
  teacher_convs = []
  students.each_with_index do |u, i|
    teacher_convs << if i.even?
                       convo.call(teacher, [u], n_msgs: rng.rand(1..5), attachment: i % 10 == 0)
                     else
                       convo.call(u, [teacher], n_msgs: rng.rand(1..6), attachment: i % 15 == 1)
                     end
  end
  Seed.users(:second_students).each_with_index { |u, i| teacher_convs << convo.call(i.even? ? teacher : u, [i.even? ? u : teacher], n_msgs: rng.rand(1..3), course: second) if u.id != student.id && u.id != student2.id }
  Seed.users(:observers).first(12).each { |o| teacher_convs << convo.call(o, [teacher], n_msgs: rng.rand(1..4), subject: "Question from a parent") }
  long = convo.call(teacher, [student], n_msgs: 60, subject: "Long thread: research paper feedback")
  # group conversations
  groups = []
  10.times { |i| groups << convo.call(teacher, students.sample(rng.rand(3..12), random: rng), n_msgs: rng.rand(1..8), subject: "Lab Team #{i + 1} logistics", group: true) }
  6.times { groups << convo.call(students[rng.rand(20)], students.sample(rng.rand(2..5), random: rng) + [student], n_msgs: rng.rand(2..10), subject: "Study group chat", group: true) }
  4.times { groups << convo.call(student, students.sample(3, random: rng), n_msgs: rng.rand(1..5), group: true) }
  3.times { convo.call(admin, [teacher, teacher2, ta], n_msgs: rng.rand(1..4), subject: "Staff: gradebook deadline", group: true) }
  # "send individual messages" style: same subject, separate private conversations
  students.first(12).each { |u| convo.call(teacher2, [u], subject: "Reminder: bring goggles Friday") }
  # student persona's own threads
  students[2, 14].each_with_index { |u, i| convo.call(i.even? ? student : u, [i.even? ? u : student], n_msgs: rng.rand(1..6)) }
  convo.call(student, [ta], n_msgs: 4, subject: "Lab report question")
  convo.call(observer, [teacher2], n_msgs: 2, subject: "Conference time?")
  convo.call(student2, [teacher], n_msgs: 3, subject: "¿Puedo entregar tarde?")
  # admin's own inbox
  students.first(8).each { |u| convo.call(admin, [u], n_msgs: rng.rand(1..3), subject: "From the district office") }
  convo.call(Seed.user(:subaccountAdmin), [admin], n_msgs: 5, subject: "Sub-account settings")
  # background noise between other people
  pool = Seed.users(:students)
  35.times { convo.call(pool[rng.rand(120)], [pool[rng.rand(120..250)]], n_msgs: rng.rand(1..4)) }

  # per-participant state
  teacher_convs.each_with_index do |c, i|
    case i % 9
    when 0 then state.call(c, teacher, workflow_state: "archived")
    when 1 then state.call(c, teacher, starred: true, workflow_state: "read")
    when 2, 3, 4 then state.call(c, teacher, workflow_state: "read")
    when 5 then state.call(c, teacher, workflow_state: "unread")
    end
  end
  state.call(long, teacher, workflow_state: "read", starred: true)
  state.call(long, student, workflow_state: "read")
  groups.first(5).each { |c| state.call(c, student, workflow_state: "archived") }
  groups.last(3).each { |c| state.call(c, student, starred: true) }
  # messages deleted from one participant's view; a conversation fully removed for the teacher
  cp = teacher_convs[7].conversation_participants.where(user_id: teacher.id).first
  msgs = cp.messages.to_a.sort_by(&:id)
  cp.remove_messages(msgs.first) if msgs.size > 1
  gone = teacher_convs[8].conversation_participants.where(user_id: teacher.id).first
  gone.remove_messages(:all)
  # forwarded message
  fwd = convo.call(teacher, [teacher2], subject: "Fwd: parent question")
  src = teacher_convs[20].conversation_messages.order(:id).first
  fwd.add_message(teacher, "Forwarding this for your input.", forwarded_message_ids: [src.id]) if src

  # spread over the term: messages get past timestamps; participants' cached times follow
  all.uniq.each_with_index do |c, i|
    t = Seed.now - rng.rand(1..80).days - rng.rand(0..1400).minutes
    last = t
    c.conversation_messages.order(:id).pluck(:id).each do |mid|
      ConversationMessage.where(id: mid).update_all(created_at: last)
      last += rng.rand(3..2000).minutes
      last = Seed.now - rng.rand(1..300).minutes if last > Seed.now
    end
    final = c.conversation_messages.maximum(:created_at)
    ConversationParticipant.where(conversation_id: c.id).where.not(last_message_at: nil).update_all(last_message_at: final)
    ConversationParticipant.where(conversation_id: c.id).where.not(visible_last_authored_at: nil).update_all(visible_last_authored_at: final, last_authored_at: final)
    Conversation.where(id: c.id).update_all(updated_at: final) if i.even?
  end

  Seed.fixture(:conversationId, main_c.id)
  Seed.fixture(:conversationMessageId, main_c.conversation_messages.order(:id).first.id)
  Seed.fixture(:conversationParticipantUserIds, [admin.id, teacher.id, student.id])
  Seed.fixture(:longConversationId, long.id)
  Seed.fixture(:groupConversationId, groups.first.id)
  Seed.fixture(:archivedConversationId, teacher_convs[0].id)
  Seed.fixture(:starredConversationId, teacher_convs[1].id)
  Seed.fixture(:teacherConversationCount, ConversationParticipant.where(user_id: teacher.id).where.not(last_message_at: nil).count)
  Seed.log "  #{Conversation.count} conversations, #{ConversationMessage.count} messages (teacher persona is in #{ConversationParticipant.where(user_id: teacher.id).count})"
end

Seed.step("comms.calendar") do
  rng = Seed.rng("calendar")
  now = Seed.now
  main = Seed.course(:main)
  second = Seed.course(:second)
  teacher = Seed.user(:teacher)
  student = Seed.user(:student)
  admin = Seed.admin
  zone = ActiveSupport::TimeZone["America/Chicago"]
  at = ->(days, hour = 9, min = 0) { zone.at(now + days.days).change(hour:, min:) }
  count = 0
  ev = lambda do |context, title, start_at, end_at = nil, user: teacher, **attrs|
    e = context.calendar_events.build(title:, start_at:, end_at: end_at || start_at + 50.minutes, **attrs)
    e.updating_user = user
    e.save!
    count += 1
    e
  end

  first = ev.call(main, "Unit 1 Kickoff", at.call(-70), nil, description: Seed::Text.html(rng, rich: true), location_name: "Room 214", location_address: "100 Riverside Dr, Springfield")
  20.times do |i|
    d = -63 + (i * 7)
    ev.call(main, ["Lab Day: #{Seed::Text.title(rng, 1, 2)}", "Guest Speaker", "Review Session", "Field Work"][i % 4], at.call(d, 8 + (i % 6)), nil,
            location_name: ["Lab 3", "Room 214", nil, "Greenhouse 🌱"][i % 4], description: (i.even? ? Seed::Text.html(rng) : nil))
  end
  ev.call(main, "Science Fair (all day)", at.call(18, 0), at.call(18, 0), all_day: true)
  ev.call(main, "Thanksgiving Break (multi-day, all day)", at.call(11, 0), at.call(13, 0), all_day: true)
  ev.call(main, "Overnight Field Trip (crosses midnight)", at.call(24, 18), at.call(25, 10), location_name: "State Park")
  ev.call(main, "Zero-length reminder", at.call(2, 15), at.call(2, 15))
  ev.call(main, "Important date: Course withdrawal deadline", at.call(9, 0), at.call(9, 0), all_day: true, important_dates: true)
  ev.call(main, "Event with a very long title #{"— details " * 20}"[0, 250], at.call(5, 13))
  ev.call(main, "イベント — Événement — حدث 🎉", at.call(6, 10), nil, description: Seed::Text::UNICODE_SNIPPETS.first(4).join("<br>"))
  ev.call(main, "No description, no location", at.call(-2, 11))
  3.times { |i| ev.call(main, "Cancelled Event #{i + 1}", at.call(3 + i, 14)).destroy }
  # one event with different times per section (child events)
  secs = CourseSection.where(id: Seed.ref("sections:main")).order(:id).to_a
  sectioned = main.calendar_events.build(title: "Unit 3 Lab Practical (per-section times)", description: "Each period has its own slot.")
  sectioned.updating_user = teacher
  sectioned.child_event_data = secs.each_with_index.to_h { |s, i| [i.to_s, { start_at: at.call(8, 8 + (i * 2)).iso8601, end_at: at.call(8, 9 + (i * 2)).iso8601, context_code: s.asset_string }] }
  sectioned.save!
  count += 1 + secs.size

  # personal calendars
  15.times { |i| ev.call(teacher, ["Dentist", "Department meeting", "Grade papers", "Parent call", "PD workshop"][i % 5], at.call(-20 + (i * 4), 16), nil, user: teacher) }
  15.times { |i| ev.call(student, ["Soccer practice ⚽", "Study for bio", "Piano lesson", "Dentist", "Birthday party"][i % 5], at.call(-12 + (i * 3), 17), nil, user: student) }
  5.times { |i| ev.call(Seed.user(:student2), "Cita #{i + 1}", at.call(i * 5, 18), nil, user: Seed.user(:student2)) }
  6.times { |i| ev.call(admin, ["Board meeting", "SIS sync window", "Budget review"][i % 3], at.call(-10 + (i * 6), 13), nil, user: admin) }
  # groups
  lab_team = Group.find(Seed.ref("groups:lab").first)
  leader = lab_team.users.order(:id).first
  6.times { |i| ev.call(lab_team, "Poster work session #{i + 1}", at.call(-14 + (i * 5), 15), nil, user: leader, location_name: "Library") }
  club = Group.find(Seed.ref("group:student_club"))
  4.times { |i| ev.call(club, "Study buddies meetup", at.call(i * 7, 16), nil, user: student) }
  # other courses
  10.times { |i| ev.call(second, "Algebra II: #{["Quiz", "Review", "Problem session"][i % 3]}", at.call(-30 + (i * 6), 10)) }
  Course.where(id: Seed.ref("courses:catalog")).where(workflow_state: "available").order(:id).limit(45).each_with_index do |course, i|
    next unless i % 3 == 0

    t = course.teachers.order(:id).first
    2.times { |j| ev.call(course, "#{course.course_code}: #{Seed::Text.title(rng, 1, 3)}", at.call(-15 + (j * 20) + (i % 7), 9 + (i % 5)), nil, user: t || admin) }
  end

  # account calendars: visibility toggles + events
  root = Seed.root
  rhs = Seed.account(:rhs)
  lms = Seed.account(:lms)
  root.update!(account_calendar_visible: true, account_calendar_subscription_type: "auto")
  rhs.update!(account_calendar_visible: true, account_calendar_subscription_type: "manual")
  lms.update!(account_calendar_visible: true)
  Seed.account(:rhs_sci).update!(account_calendar_visible: false)
  acct_ev = ev.call(root, "District: No School (staff development)", at.call(15, 0), at.call(15, 0), user: admin, all_day: true)
  ev.call(root, "District: Winter Concert", at.call(28, 19), at.call(28, 21), user: admin, location_name: "Auditorium")
  ev.call(root, "District: Board Meeting (past)", at.call(-21, 18), nil, user: admin)
  3.times { |i| ev.call(rhs, "RHS: #{["Homecoming", "Picture Day", "PSAT"][i]}", at.call(-5 + (i * 9), 8), nil, user: admin) }
  ev.call(lms, "LMS: Science Fair Judging", at.call(19, 9), nil, user: admin)
  [student, teacher].each { |u| u.set_preference(:enabled_account_calendars, [rhs.id]) }

  Seed.fixture(:calendarEventId, first.id)
  Seed.fixture(:sectionCalendarEventId, sectioned.id)
  Seed.fixture(:userCalendarEventId, CalendarEvent.where(context: teacher).order(:id).first.id)
  Seed.fixture(:studentCalendarEventId, CalendarEvent.where(context: student).order(:id).first.id)
  Seed.fixture(:adminCalendarEventId, CalendarEvent.where(context: admin).order(:id).first.id)
  Seed.fixture(:groupCalendarEventId, CalendarEvent.where(context: lab_team).order(:id).first.id)
  Seed.fixture(:accountCalendarEventId, acct_ev.id)
  Seed.fixture(:accountCalendarAccountId, rhs.id)
  Seed.fixture(:hiddenAccountCalendarAccountId, Seed.ref("account:rhs_sci"))
  Seed.log "  #{count} calendar events"
end

Seed.step("comms.appointments") do
  now = Seed.now
  main = Seed.course(:main)
  second = Seed.course(:second)
  teacher = Seed.user(:teacher)
  students = Seed.users(:main_students)
  zone = ActiveSupport::TimeZone["America/Chicago"]
  slot = ->(days, hour, min, len = 15) { s = zone.at(now + days.days).change(hour:, min:); [s, s + len.minutes] }
  ag = lambda do |title, contexts, slots, publish: true, **attrs|
    g = AppointmentGroup.new(title:, contexts:, new_appointments: slots, **attrs)
    g.save!
    g.publish! if publish
    g
  end
  office = ag.call("Office Hours Sign-up", [main], (0..7).map { |i| slot.call(3 + (i / 4), 15, (i % 4) * 15) } + (0..3).map { |i| slot.call(-4, 15, i * 15) },
                   participants_per_appointment: 1, max_appointments_per_participant: 2, min_appointments_per_participant: 1, participant_visibility: "protected",
                   description: "Sign up for a 15 minute slot.", location_name: "Room 214")
  appts = office.appointments.order(:start_at).to_a
  future = appts.select { |a| a.start_at > now }
  past = appts - future
  res = future[0].reserve_for(Seed.user(:student), Seed.user(:student))
  future[1].reserve_for(Seed.user(:student2), Seed.user(:student2))
  future[3].reserve_for(students[5], students[5], comments: "Need help with the lab report")
  past.first(3).each_with_index { |a, i| a.reserve_for(students[10 + i], teacher) }
  lab_cat = GroupCategory.find(Seed.ref("group_category:lab"))
  team = ag.call("Lab Team Check-ins (group sign-up)", [main], (0..5).map { |i| slot.call(6, 13, i * 10, 10) }, sub_context_codes: [lab_cat.asset_string], participants_per_appointment: 1)
  lab_groups = Group.where(id: Seed.ref("groups:lab")).order(:id).to_a
  team.appointments.order(:start_at).first(3).each_with_index { |a, i| a.reserve_for(lab_groups[i], lab_groups[i].users.order(:id).first) }
  ag.call("Parent-Teacher Conferences (unpublished, two courses)", [main, second], (0..9).map { |i| slot.call(20, 16 + (i / 4), (i % 4) * 15) }, publish: false, participant_visibility: "private")
  review = ag.call("Midterm Review Slots (all in the past)", [main], (0..5).map { |i| slot.call(-26, 14, i * 20, 20) }, participants_per_appointment: 4)
  review.appointments.order(:start_at).each_with_index { |a, i| students[20 + (i * 2), 2].each { |u| a.reserve_for(u, u) } }
  dead = ag.call("Cancelled Sign-up (deleted)", [main], [slot.call(9, 9, 0)])
  dead.destroy
  Seed.fixture(:appointmentGroupId, office.id)
  Seed.fixture(:appointmentId, future[0].id)
  Seed.fixture(:openAppointmentId, future[5].id)
  Seed.fixture(:reservationId, res.id)
  Seed.fixture(:groupAppointmentGroupId, team.id)
  Seed.fixture(:unpublishedAppointmentGroupId, AppointmentGroup.where(workflow_state: "pending").order(:id).last.id)
end

Seed.step("comms.planner") do
  rng = Seed.rng("planner")
  now = Seed.now
  main = Seed.course(:main)
  admin = Seed.admin
  student = Seed.user(:student)
  teacher = Seed.user(:teacher)
  note = lambda do |user, title, days, course: nil, **attrs|
    PlannerNote.create!(user:, title:, details: attrs.delete(:details) || Seed::Text.sentence(rng), todo_date: now + days.days, course:, **attrs)
  end
  s_notes = [["Buy poster board", 2, nil], ["Email Ms. Marlowe about lab makeup", -3, main], ["Flashcards: organelles", 1, main], ["Return library book 📚", 5, nil],
             ["Finish reading ch. 7", 0, main], ["Sign field trip form", -10, nil], ["Study group @ 4pm", 3, main], ["Practice presentation", 9, main],
             ["Plan science fair project — ideas?", 14, main], ["Old note from September", -60, nil], ["Call grandma", 1, nil], ["Note with a long title #{"… and more " * 15}"[0, 250], 4, nil]]
           .map { |t, d, c| note.call(student, t, d, course: c) }
  s_notes[5].destroy
  t_note = note.call(teacher, "Order dissection kits", 6)
  4.times { |i| note.call(teacher, "Prep: #{Seed::Text.title(rng, 1, 3)}", i * 3, course: main) }
  a_note = note.call(admin, "Review SIS import errors", 1)
  5.times { |i| note.call(admin, ["Check term dates", "Approve course requests", "Audit sub-account admins", "Renew LTI keys", "Archive old courses"][i], (i * 4) - 6, course: (i.even? ? main : nil)) }
  3.times { |i| note.call(Seed.user(:student2), "Tarea #{i + 1}", i + 1, course: main) }

  ov = lambda do |user, plannable, **attrs|
    PlannerOverride.create!(user:, plannable_type: plannable.class.base_class.name == "AbstractAssignment" ? "Assignment" : plannable.class.to_s, plannable_id: plannable.id, **attrs)
  end
  asg = ->(k) { Assignment.find(Seed.ref("assignment:#{k}")) }
  first = ov.call(student, asg.call(:due_tomorrow), marked_complete: true)
  ov.call(student, asg.call(:hw10), marked_complete: true)
  ov.call(student, asg.call(:all_dates), marked_complete: false, dismissed: true)
  ov.call(student, asg.call(:future2), marked_complete: true, dismissed: true)
  ov.call(student, Quizzes::Quiz.find(Seed.ref("quiz:in_progress")), marked_complete: true)
  ov.call(student, DiscussionTopic.find(Seed.ref("topic:todo")), marked_complete: true)
  ov.call(student, s_notes[0], marked_complete: true)
  ov.call(student, WikiPage.where(context: main).where.not(todo_date: nil).order(:id).first, marked_complete: false)
  a_ov = ov.call(admin, a_note, marked_complete: true)
  ov.call(admin, asg.call(:due_today), marked_complete: true)
  ov.call(teacher, t_note, marked_complete: true)

  Seed.fixture(:plannerNoteId, a_note.id)
  Seed.fixture(:plannerOverrideId, a_ov.id)
  Seed.fixture(:studentPlannerNoteId, s_notes[0].id)
  Seed.fixture(:studentPlannerOverrideId, first.id)
  Seed.fixture(:teacherPlannerNoteId, t_note.id)
  Seed.fixture(:deletedPlannerNoteId, s_notes[5].id)
end

Seed.step("comms.personal") do
  rng = Seed.rng("personal")
  main = Seed.course(:main)
  second = Seed.course(:second)
  admin = Seed.admin
  teacher = Seed.user(:teacher)
  student = Seed.user(:student)
  student2 = Seed.user(:student2)

  # bookmarks
  marks = { admin => [["Main course gradebook", "/courses/#{main.id}/gradebook"], ["SIS imports", "/accounts/1/sis_import"], ["Sub-accounts", "/accounts/1/sub_accounts"],
                      ["People search — Zoë", "/accounts/1/users?search_term=Zo%C3%AB"], ["External: status page", "https://status.example.com/"]],
            teacher => [["SpeedGrader HW 1", "/courses/#{main.id}/gradebook/speed_grader?assignment_id=#{Seed.ref("assignment:hw1")}"], ["Modules", "/courses/#{main.id}/modules"],
                        ["Lab safety page", "/courses/#{main.id}/pages/lab-safety-rules"], ["Algebra II files", "/courses/#{second.id}/files"]],
            student => [["Biology grades", "/courses/#{main.id}/grades"], ["Calendar", "/calendar"], ["My files", "/files"], ["Study guide — «guía»", "/courses/#{main.id}/pages/study-guide"],
                        ["Bookmark with a very long name #{"lorem " * 30}"[0, 250], "/courses/#{main.id}"], ["Inbox", "/conversations"], ["Quiz 2", "/courses/#{main.id}/quizzes/#{Seed.ref("quiz:auto")}"],
                        ["Query string & fragment", "/courses/#{main.id}/assignments?search=lab&sort=due#upcoming"]] }
  ids = {}
  marks.each do |user, list|
    list.each_with_index do |(name, url), i|
      b = Bookmarks::Bookmark.create!(user_id: user.id, name:, url:, json: (i.zero? ? { "icon" => "course" }.to_json : nil))
      ids[user.id] ||= b.id
    end
  end
  Seed.fixture(:bookmarkId, ids[admin.id])
  Seed.fixture(:teacherBookmarkId, ids[teacher.id])
  Seed.fixture(:studentBookmarkId, ids[student.id])

  # favorites, nicknames, colors, dashboard positions
  fav = ->(user, ctx) { user.favorites.where(context: ctx).first_or_create!(root_account_id: Seed.root.id) }
  [admin, teacher, student, student2].each { |u| fav.call(u, main) }
  [admin, teacher, student].each { |u| fav.call(u, second) }
  fav.call(student, Seed.course(:large))
  fav.call(student, Group.find(Seed.ref("group:student_club")))
  fav.call(student, Group.find(Seed.ref("groups:lab").first))
  fav.call(teacher, Seed.course(:blueprint))
  student.set_preference(:course_nicknames, main.id, "Bio w/ Ms. M 🧬")
  student.set_preference(:course_nicknames, second.id, "Math (ugh)")
  teacher.set_preference(:course_nicknames, main.id, "BIO101 — P1/P2/P4/P6")
  student.set_preference(:custom_colors, { "course_#{main.id}" => "#008400", "course_#{second.id}" => "#D41E00", "user_#{student.id}" => "#0076B8" })
  teacher.set_preference(:custom_colors, { "course_#{main.id}" => "#8F3E97" })
  student.set_dashboard_positions("course_#{main.id}" => 0, "course_#{second.id}" => 1) if student.respond_to?(:set_dashboard_positions)
  Seed.fixture(:favoriteCourseId, main.id)
  Seed.fixture(:favoriteGroupId, Seed.ref("group:student_club"))

  # ePortfolios
  folio = lambda do |user, name, public:, pages:|
    ep = Eportfolio.create!(user:, name:, public:)
    ep.ensure_defaults
    cat = ep.eportfolio_categories.create!(name: "Science Work")
    pages.each do |title|
      entry = ep.eportfolio_entries.build(eportfolio_category: cat, name: title, allow_comments: true, show_comments: true)
      entry.content = [{ section_type: "rich_text", content: Seed::Text.html(rng, paragraphs: 2) }, { section_type: "html", content: "<p><strong>#{Seed::Text.sentence(rng)}</strong></p>" }]
      entry.save!
    end
    ep.eportfolio_categories.create!(name: "Reflections — reflexiones")
    ep
  end
  a_ep = folio.call(admin, "Admin Showcase Portfolio", public: true, pages: ["Welcome", "Conference Talks", "Publications"])
  s_ep = folio.call(student, "Sam's Science Portfolio", public: true, pages: ["Cell Model Project", "Lab Reports", "Science Fair 🏆", "Reading Log"])
  folio.call(student, "Private Drafts", public: false, pages: ["Untitled"])
  folio.call(student2, "Portafolio de Stella", public: false, pages: ["Proyecto de ecosistemas"])
  t_ep = folio.call(teacher, "Teaching Portfolio", public: true, pages: ["Philosophy", "Sample Lessons"])
  folio.call(student2, "Deleted Portfolio", public: true, pages: ["Old"]).destroy
  Seed.fixture(:ePortfolioId, a_ep.id)
  Seed.fixture(:ePortfolioUserId, admin.id)
  Seed.fixture(:ePortfolioPageId, a_ep.eportfolio_entries.order(:id).first.id)
  Seed.fixture(:studentEPortfolioId, s_ep.id)
  Seed.fixture(:teacherEPortfolioId, t_ep.id)

  # polls (admin owns the un-prefixed fixtures; teacher has her own)
  students = Seed.users(:main_students)
  p2 = CourseSection.find(Seed.ref("sections:main")[1])
  poll = Polling::Poll.create!(user: admin, question: "Which organelle is the powerhouse of the cell?", description: "Warm-up question")
  choices = [["Nucleus", false], ["Mitochondria", true], ["Ribosome", false], ["Golgi apparatus", false]].each_with_index.map { |(text, ok), i| poll.poll_choices.create!(text:, is_correct: ok, position: i + 1) }
  open = poll.poll_sessions.create!(course: main, has_public_results: true)
  open.publish!
  students.first(34).each_with_index { |u, i| open.poll_submissions.create!(poll:, user: u, poll_choice: choices[[1, 1, 1, 0, 2, 1, 3][i % 7]]) }
  closed = poll.poll_sessions.create!(course: main, course_section: p2)
  closed.publish!
  p2.students.order(:id).limit(8).each_with_index { |u, i| closed.poll_submissions.create!(poll:, user: u, poll_choice: choices[i % 4]) }
  closed.close!
  poll.poll_sessions.create!(course: second) # never opened
  t_poll = Polling::Poll.create!(user: teacher, question: "How confident are you about mitosis? (1–5)")
  5.times { |i| t_poll.poll_choices.create!(text: (i + 1).to_s, position: i + 1) }
  t_sess = t_poll.poll_sessions.create!(course: main)
  t_sess.publish!
  students.first(20).each_with_index { |u, i| t_sess.poll_submissions.create!(poll: t_poll, user: u, poll_choice: t_poll.poll_choices[i % 5]) }
  Polling::Poll.create!(user: teacher, question: "Poll without choices yet")
  Polling::Poll.create!(user: teacher, question: "¿Entendiste la lección? 分かりましたか？", description: Seed::Text.unicode(rng)).tap do |pl|
    pl.poll_choices.create!(text: "Sí / はい", position: 1)
    pl.poll_choices.create!(text: "No / いいえ", position: 2)
  end
  Seed.fixture(:pollId, poll.id)
  Seed.fixture(:pollChoiceId, choices[1].id)
  Seed.fixture(:pollSessionId, open.id)
  Seed.fixture(:closedPollSessionId, closed.id)
  Seed.fixture(:pollSubmissionId, open.poll_submissions.order(:id).first.id)
  Seed.fixture(:teacherPollId, t_poll.id)
  Seed.fixture(:teacherPollSessionId, t_sess.id)

  # blackout dates (course + account level)
  bd = BlackoutDate.create!(context: main, root_account: Seed.root, start_date: (Seed.now + 11.days).to_date, end_date: (Seed.now + 13.days).to_date, event_title: "Thanksgiving Break")
  BlackoutDate.create!(context: main, root_account: Seed.root, start_date: (Seed.now - 40.days).to_date, end_date: (Seed.now - 40.days).to_date, event_title: "Snow Day ❄️")
  BlackoutDate.create!(context: Seed.course(:paced), root_account: Seed.root, start_date: (Seed.now + 30.days).to_date, end_date: (Seed.now + 44.days).to_date, event_title: "Winter Break")
  abd = BlackoutDate.create!(context: Seed.root, root_account: Seed.root, start_date: (Seed.now + 36.days).to_date, end_date: (Seed.now + 47.days).to_date, event_title: "District Winter Recess")
  BlackoutDate.create!(context: Seed.root, root_account: Seed.root, start_date: (Seed.now + 120.days).to_date, end_date: (Seed.now + 124.days).to_date, event_title: "Spring Break")
  BlackoutDate.create!(context: Seed.account(:rhs), root_account: Seed.root, start_date: (Seed.now + 60.days).to_date, end_date: (Seed.now + 60.days).to_date, event_title: "RHS Staff Day")
  Seed.fixture(:blackoutDateId, bd.id)
  Seed.fixture(:accountBlackoutDateId, abd.id)
end

Seed.step("comms.notifications") do
  # explicit notification preferences for a few users (needs the real notification catalog)
  Seed.loud do
    { Seed.user(:student) => { "Announcement" => "daily", "Due Date" => "weekly", "Grading" => "immediately", "Discussion" => "never", "Conversation Message" => "immediately" },
      Seed.user(:teacher) => { "Submission Comment" => "immediately", "Late Grading" => "daily", "Announcement" => "never", "Course Content" => "weekly" },
      Seed.admin => { "Announcement" => "weekly", "Conversation Message" => "daily" },
      Seed.user(:multi_channel) => { "Announcement" => "immediately", "Grading" => "weekly" } }.each do |user, prefs|
      cc = user.communication_channels.active.where(path_type: "email").order(:id).first
      next unless cc

      NotificationPolicy.find_all_for(cc) # make sure the default rows exist
      prefs.each { |category, freq| NotificationPolicy.find_or_update_for_category(cc, category, freq) }
    end
    # a course-level override: student mutes announcements for one course
    cc = Seed.user(:student).communication_channels.active.order(:id).first
    NotificationPolicyOverride.create_or_update_for(cc, "Announcement", "never", Seed.course(:second))
  end
  Seed.fixture(:notificationPreferenceChannelId, Seed.user(:student).communication_channels.active.order(:id).first.id)
  Seed.fixture(:notificationPreferenceCategory, "announcement")
  Seed.fixture(:notificationName, "new_announcement")

  # a realistic sample of delivered notifications for the CommMessages API: one announcement
  # and a few graded submissions go through the real notification pipeline
  Seed.loud do
    main = Seed.course(:main)
    teacher = Seed.user(:teacher)
    a = main.announcements.build(title: "Lab notebooks due Friday (sent with notifications)", message: "<p>Please bring your notebooks. This announcement was sent through the real notification pipeline.</p>", user: teacher)
    a.saving_user = teacher
    a.save!
    hw = Assignment.find(Seed.ref("assignment:hw11"))
    Seed.users(:main_students).first(6).each_with_index do |u, i|
      hw.grade_student(u, grade: 7 + (i % 3), grader: teacher)
      hw.update_submission(u, author: teacher, comment: "Graded with notifications on.")
    end
  end
end

Seed.step("comms.conferences") do
  main = Seed.course(:main)
  second = Seed.course(:second)
  teacher = Seed.user(:teacher)
  students = Seed.users(:main_students)
  # Collaborations: EtherPad needs no API call to create a document (just a generated URL).
  made = []
  if Collaboration.collaboration_types.any? { |c| c["name"] == "EtherPad" }
    [["Lab Team 1 shared notes", "Shared pad for the poster project", students.first(6)], ["Class glossary (everyone)", "Add terms as we go", students.first(25)],
     ["Exam 2 study guide — borrador", nil, students[6, 5]], ["Empty collaboration (only the owner)", "", []]].each do |title, desc, members|
      c = Collaboration.typed_collaboration_instance("EtherPad")
      c.context = main
      c.user = teacher
      c.title = title
      c.description = desc
      c.save!
      c.update_members(members.dup, [])
      made << c
    end
    g = Collaboration.typed_collaboration_instance("EtherPad")
    g.context = main
    g.user = Seed.user(:student)
    g.title = "Study buddies pad (student-owned, shared with a group)"
    g.save!
    g.update_members([Seed.user(:student2)], [Seed.ref("group:student_club")])
    made << g
    dead = Collaboration.typed_collaboration_instance("EtherPad")
    dead.context = second
    dead.user = teacher
    dead.title = "Deleted collaboration"
    dead.save!
    dead.destroy
    Seed.fixture(:collaborationId, made.first.id)
    Seed.fixture(:studentCollaborationId, g.id)
  else
    Seed.log "  collaborations skipped (EtherPad plugin not available)"
  end

  # Conferences: BigBlueButton plugin with a fake host. Records only; never started (starting
  # or joining would call the BBB API).
  if WebConference.plugins.any? { |p| p.id == "big_blue_button" } && WebConference.conference_types(main).any?
    type = WebConference.conference_types(main).first["conference_type"]
    conf = lambda do |ctx, title, user: teacher, invitees: [], **attrs|
      c = ctx.web_conferences.build(title:, conference_type: type, user:, **attrs)
      c.settings[:record] = false
      c.save!
      c.add_initiator(user)
      invitees.each { |u| c.add_invitee(u) }
      c
    end
    upcoming = conf.call(main, "Exam 2 Review Session (online)", duration: 60, description: "Bring questions.", invitees: students.first(30))
    conf.call(main, "Office Hours (no time limit)", duration: nil, description: "Drop in.", invitees: students.first(5))
    past = conf.call(main, "Unit 1 Recap (concluded)", duration: 45, invitees: students.first(20))
    past.update_columns(start_at: Seed.now - 30.days, started_at: Seed.now - 30.days, end_at: Seed.now - 30.days + 45.minutes, ended_at: Seed.now - 30.days + 50.minutes)
    conf.call(main, "Parent Night Q&A — «preguntas» 🎤", duration: 90, description: Seed::Text.unicode(Seed.rng("conf")))
    conf.call(second, "Algebra II Help Session", duration: 30, invitees: Seed.users(:second_students).first(10))
    club = Group.find(Seed.ref("group:student_club"))
    conf.call(club, "Study buddies call", user: Seed.user(:student), duration: 30, invitees: [Seed.user(:student2)])
    Seed.fixture(:conferenceId, upcoming.id)
    Seed.fixture(:concludedConferenceId, past.id)
    Seed.fixture(:conferenceType, type)
  else
    Seed.log "  conferences skipped (no web conference plugin enabled)"
  end
end
