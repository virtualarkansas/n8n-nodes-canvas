# frozen_string_literal: true

# Modules (~27 in the main course) with every item type, prerequisites, completion
# requirements, sequential progress, unpublished / locked / scheduled modules, and module
# progressions for the students (so "completed / unlocked / locked" states all occur).

Seed.step("modules.main") do
  main = Seed.course(:main)
  rng = Seed.rng("modules.main")
  now = Seed.now
  asg = ->(k) { Seed.ref("assignment:#{k}") }
  quiz = ->(k) { Seed.ref("quiz:#{k}") }
  topic = ->(k) { Seed.ref("topic:#{k}") }
  unit_pages = Seed.ref("pages:units")
  pdf, txt, png = Seed.ref("files:module_items")
  made = {}
  first_item = nil

  mod = lambda do |key, name, items, published: true, requirements: {}, prereq: nil, **attrs|
    m = main.context_modules.build(name:, **attrs)
    m.workflow_state = published ? "active" : "unpublished"
    m.save!
    tags = {}
    items.each_with_index do |(type, ref, opts), i|
      opts ||= {}
      params = { type: type.to_s, indent: opts[:indent] || 0 }
      case type
      when :sub_header then params.merge!(type: "context_module_sub_header", title: ref)
      when :external_url then params.merge!(title: ref, url: opts[:url], new_tab: opts[:new_tab])
      when :external_tool then params.merge!(type: "context_external_tool", title: ref, url: opts[:url], new_tab: opts[:new_tab])
      else params[:id] = ref
      end
      tag = m.add_item(params)
      next unless tag

      if opts[:unpublished]
        tag.update!(workflow_state: "unpublished") if tag.workflow_state == "active"
      elsif %i[sub_header external_url external_tool].include?(type) && tag.workflow_state == "unpublished"
        tag.update!(workflow_state: "active") # these item types are created unpublished
      end
      tags[i] = tag
      first_item ||= tag if type == :assignment
    end
    reqs = requirements.filter_map do |idx, req|
      tags[idx] && { id: tags[idx].id }.merge(req.is_a?(Hash) ? req : { type: req.to_s })
    end
    m.completion_requirements = reqs if reqs.any?
    m.prerequisites = Array(prereq).map { |p| { id: made[p].id, type: "context_module", name: made[p].name } } if prereq
    m.save! if reqs.any? || prereq
    made[key] = m
    m
  end

  mod.call(:start, "Start Here", [[:sub_header, "Read me first"], [:wiki_page, Seed.ref("page:policies")], [:wiki_page, Seed.ref("page:safety")],
                                  [:assignment, asg.call(:pass_fail)], [:discussion_topic, topic.call(:intro)], [:external_url, "District Handbook (external)", { url: "https://example.com/handbook.pdf", new_tab: true }]],
           requirements: { 1 => :must_view, 2 => :must_mark_done, 3 => :must_submit, 4 => :must_contribute })
  mod.call(:unit1, "Unit 1: Cells", [[:sub_header, "Readings"], [:wiki_page, unit_pages[0], { indent: 1 }], [:attachment, pdf, { indent: 1 }], [:attachment, txt, { indent: 1 }],
                                    [:sub_header, "Practice"], [:assignment, asg.call(:hw1), { indent: 1 }], [:assignment, asg.call(:hw2), { indent: 1 }], [:quiz, quiz.call(:practice), { indent: 2 }],
                                    [:sub_header, "Assessment"], [:quiz, quiz.call(:all_types), { indent: 1 }], [:assignment, asg.call(:exam1), { indent: 1 }],
                                    [:external_tool, "Virtual Microscope (LTI)", { url: "https://course-tool.example.com/launch?module=microscope" }]],
           prereq: :start, requirements: { 1 => :must_view, 5 => :must_submit, 6 => { type: "min_score", min_score: 6 }, 9 => { type: "min_score", min_score: 10 } })
  mod.call(:unit2, "Unit 2: Membranes & Transport", [[:wiki_page, unit_pages[1]], [:assignment, asg.call(:hw3)], [:assignment, asg.call(:hw4)], [:assignment, asg.call(:lab1)],
                                                    [:quiz, quiz.call(:auto)], [:discussion_topic, topic.call(:graded1)], [:attachment, png]],
           prereq: :unit1, require_sequential_progress: true, requirements: { 0 => :must_view, 1 => :must_submit, 2 => :must_submit, 4 => { type: "min_score", min_score: 5 }, 5 => :must_contribute })
  mod.call(:unit3, "Unit 3: Energy — Photosynthesis & Respiration", [[:wiki_page, unit_pages[2]], [:assignment, asg.call(:hw5)], [:assignment, asg.call(:lab2)], [:quiz, quiz.call(:bank_group)],
                                                                    [:quiz, quiz.call(:inline_group)], [:assignment, asg.call(:external_tool)], [:discussion_topic, topic.call(:graded2)]],
           prereq: %i[unit1 unit2], requirement_count: 1, requirements: { 1 => :must_submit, 3 => :must_submit, 4 => :must_submit })
  mod.call(:unit4, "Unit 4: Cell Division", [[:wiki_page, unit_pages[3]], [:assignment, asg.call(:hw6)], [:assignment, asg.call(:lab3)], [:assignment, asg.call(:midterm)],
                                            [:assignment, asg.call(:unpublished), { unpublished: true }], [:quiz, quiz.call(:unpublished)]],
           prereq: :unit3, requirements: { 0 => :must_view, 1 => :must_submit })
  mod.call(:unit5, "Unit 5: Genetics (opens next week)", [[:wiki_page, unit_pages[4]], [:quiz, quiz.call(:future)], [:assignment, asg.call(:future2)]], unlock_at: now + 7.days)
  mod.call(:unit6, "Unit 6: Evolution (unpublished)", [[:wiki_page, unit_pages[5]], [:assignment, asg.call(:unpublished_nodate)]], published: false)
  mod.call(:unit7, "Unit 7: Ecology (unpublished, scheduled)", [[:wiki_page, unit_pages[6]]], published: false, unlock_at: now + 30.days)
  mod.call(:projects, "Semester Projects", [[:assignment, asg.call(:paper_draft)], [:assignment, asg.call(:paper_final)], [:assignment, asg.call(:poster)], [:assignment, asg.call(:media)],
                                           [:discussion_topic, topic.call(:group_graded)]], requirements: { 0 => :must_submit, 1 => :must_submit })
  mod.call(:exams, "Exam Review & Exams", [[:discussion_topic, topic.call(:locked)], [:assignment, asg.call(:manual_post)], [:quiz, quiz.call(:locked)], [:assignment, asg.call(:future)]])
  mod.call(:resources, "Resources (no requirements)", [[:external_url, "Khan-style video: Mitosis", { url: "https://example.org/videos/mitosis?t=30s&lang=en" }],
                                                      [:external_url, "Interactive cell model (new tab)", { url: "https://example.com/cell-model", new_tab: true }],
                                                      [:external_url, "URL with unicode — café/ñ", { url: "https://example.com/caf%C3%A9/%C3%B1" }],
                                                      [:external_url, "Unpublished link (draft)", { url: "https://example.com/draft", unpublished: true }],
                                                      [:external_tool, "Library Search (account LTI tool)", { url: "https://lti.example.com/launch?q=cells", new_tab: true }],
                                                      [:attachment, pdf], [:wiki_page, Seed.ref("page:safety")]])
  mod.call(:empty, "Empty Module", [])
  mod.call(:headers_only, "Module With Only Text Headers", [[:sub_header, "Coming soon"], [:sub_header, "— TBD —"]])
  mod.call(:deep_indent, "Indentation Showcase", [[:sub_header, "Level 0"], [:wiki_page, unit_pages[7], { indent: 1 }], [:assignment, asg.call(:hw7), { indent: 2 }],
                                                 [:assignment, asg.call(:hw8), { indent: 3 }], [:attachment, txt, { indent: 4 }], [:external_url, "Deep link", { url: "https://example.com/deep", indent: 5 }]])
  mod.call(:dup_items, "Duplicates: same item twice + item in two modules", [[:assignment, asg.call(:hw1)], [:assignment, asg.call(:hw1)], [:wiki_page, Seed.ref("page:safety")]])
  mod.call(:locked_chain, "Honors Extension (locked behind Unit 4)", [[:assignment, asg.call(:section_only)], [:quiz, quiz.call(:section_only)]], prereq: :unit4, require_sequential_progress: true,
                                                                   requirements: { 0 => :must_submit })
  mod.call(:unicode, "Módulo multilingüe — モジュール — وحدة 🌍", [[:sub_header, "资源 / Ресурсы"], [:wiki_page, unit_pages[0]], [:discussion_topic, topic.call(:unicode)]])
  mod.call(:long_name, "Module with a very long name #{"that keeps going " * 12}"[0, 250], [[:assignment, asg.call(:long_title)]])
  6.times do |i|
    mod.call(:"week#{i + 1}", "Week #{i + 1} Checklist", [[:sub_header, "This week"], [:assignment, asg.call(:"participation#{i + 1}")], [:wiki_page, unit_pages[i % 8]],
                                                         [:external_url, "Exit ticket form", { url: "https://example.com/forms/exit-#{i + 1}" }]],
             requirements: { 1 => :must_mark_done, 2 => :must_view }, published: i != 5)
  end
  2.times { |i| mod.call(:"deleted#{i + 1}", "Deleted Module #{i + 1}", [[:assignment, asg.call(:hw9)]]).destroy }
  # an item removed from a module, and a renamed item title
  removed = made[:resources].content_tags.not_deleted.order(:position).last
  removed.destroy
  renamed = made[:unit1].content_tags.where(content_type: "Attachment").order(:id).first
  renamed.update!(title: "Cell Diagram (renamed in module only)")
  ContextModule.where(id: made.values.map(&:id)).each(&:touch)

  item = made[:unit1].content_tags.active.where(content_type: "Assignment").order(:position).first
  Seed.set_ref("modules:main", made.reject { |k, _| k.to_s.start_with?("deleted") }.transform_values(&:id).transform_keys(&:to_s))
  Seed.fixture(:moduleId, made[:unit1].id)
  Seed.fixture(:moduleItemId, item.id)
  Seed.fixture(:moduleItemAssignmentId, item.content_id)
  Seed.fixture(:firstModuleId, made[:start].id)
  Seed.fixture(:sequentialModuleId, made[:unit2].id)
  Seed.fixture(:prerequisiteModuleId, made[:unit2].id)
  Seed.fixture(:unpublishedModuleId, made[:unit6].id)
  Seed.fixture(:scheduledModuleId, made[:unit5].id)
  Seed.fixture(:emptyModuleId, made[:empty].id)
  Seed.fixture(:deletedModuleId, made[:deleted1].id)
  Seed.fixture(:externalUrlModuleItemId, made[:resources].content_tags.not_deleted.where(content_type: "ExternalUrl").order(:position).first.id)
  Seed.fixture(:subHeaderModuleItemId, made[:start].content_tags.not_deleted.where(content_type: "ContextModuleSubHeader").first.id)
  Seed.fixture(:pageModuleItemId, made[:start].content_tags.active.where(content_type: "WikiPage").order(:position).first.id)
  Seed.fixture(:fileModuleItemId, renamed.id)
  Seed.fixture(:quizModuleItemId, made[:unit2].content_tags.active.where(content_type: "Quizzes::Quiz").first.id)
  Seed.fixture(:discussionModuleItemId, made[:start].content_tags.active.where(content_type: "DiscussionTopic").first.id)
  Seed.fixture(:externalToolModuleItemId, made[:unit1].content_tags.not_deleted.where(content_type: "ContextExternalTool").first&.id)
  Seed.log "  #{main.context_modules.count} modules, #{ContentTag.where(context: main, tag_type: "context_module").count} items"
end

Seed.step("modules.progress") do
  main = Seed.course(:main)
  rng = Seed.rng("modules.progress")
  students = Seed.users(:main_students)
  ids = Seed.ref("modules:main")
  mods = ContextModule.where(id: ids.values).order(:position).to_a
  by_key = ids.to_h { |k, id| [k, mods.detect { |m| m.id == id }] }
  # simulate students working through the first modules (views / mark-done / contributions);
  # submissions and scores already exist, so evaluate_for picks those requirements up itself
  students.each_with_index do |u, i|
    reach = i < 2 ? 1.0 : Seed::Subs.diligence(i)
    %w[start unit1 unit2 week1 week2 week3].each do |key|
      m = by_key[key]
      next unless m && rng.rand < reach + 0.05

      m.content_tags.active.each do |tag|
        req = m.completion_requirements.to_a.detect { |r| r[:id] == tag.id }
        next unless req && rng.rand < reach

        case req[:type]
        when "must_view" then m.update_for(u, :read, tag)
        when "must_mark_done" then m.update_for(u, :done, tag)
        when "must_contribute" then m.update_for(u, :contributed, tag)
        end
      end
    end
    next unless i < 40

    mods.each { |m| m.evaluate_for(u) }
  end
  states = ContextModuleProgression.where(context_module_id: mods.map(&:id)).group(:workflow_state).count
  Seed.fixture(:moduleProgressUserId, students[0].id)
  Seed.log "  module progressions: #{states.inspect}"
  main.touch
end

Seed.step("modules.second") do
  second = Seed.course(:second)
  quiz_id = Seed.ref("quiz:second")
  pages = second.wiki_pages.active.order(:id).pluck(:id)
  files = second.attachments.not_deleted.order(:id).limit(4).pluck(:id)
  prev = nil
  first = nil
  4.times do |i|
    m = second.context_modules.create!(name: "Chapter #{i + 1}", workflow_state: i == 3 ? "unpublished" : "active")
    m.add_item(type: "wiki_page", id: pages[i + 1]) if pages[i + 1]
    m.add_item(type: "attachment", id: files[i]) if files[i]
    m.add_item(type: "quiz", id: quiz_id) if i.zero?
    m.add_item(type: "external_url", title: "Practice problems", url: "https://example.com/algebra/ch#{i + 1}")
    if prev
      m.prerequisites = [{ id: prev.id, type: "context_module", name: prev.name }]
      m.save!
    end
    prev = m
    first ||= m
  end
  Seed.fixture(:course2ModuleId, first.id)
end
