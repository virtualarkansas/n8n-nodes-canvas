# frozen_string_literal: true

# Pages (~70) and files (~300 tiny files in a folder tree five levels deep) with the usual
# real-world mess: unpublished/deleted, revisions, Unicode, very long bodies and names,
# duplicate names, hidden/locked/scheduled files and folders, user files and group files.

Seed.step("content.pages") do
  main = Seed.course(:main)
  rng = Seed.rng("content.pages")
  teacher = Seed.user(:teacher)
  ta = Seed.user(:ta)
  student = Seed.user(:student)
  made = {}
  page = lambda do |key, title, body: nil, user: teacher, published: true, course: main, **attrs|
    p = course.wiki_pages.build(title:, body: body || Seed::Text.html(rng, paragraphs: rng.rand(1..4), rich: rng.rand < 0.5), user:, **attrs)
    p.workflow_state = published ? "active" : "unpublished"
    p.save!
    made[key] = p if key
    p
  end

  hw1 = Seed.ref("assignment:hw1")
  front = page.call(:front, "Welcome to Biology 101 🧬", body: <<~HTML)
    <h1>Welcome to Biology 101</h1>
    <p>Start with the <a href="/courses/#{main.id}/pages/course-policies">course policies</a>, then
    <a href="/courses/#{main.id}/assignments/#{hw1}">HW 1</a>. Office hours: Tue/Thu 3–4pm.</p>
    #{Seed::Text.html(rng, paragraphs: 2, rich: true)}
    <p><iframe title="Intro video" src="https://example.com/embed/intro" width="480" height="270"></iframe></p>
  HTML
  front.set_as_front_page!
  main.reload.update!(default_view: "wiki")

  page.call(:policies, "Course Policies", body: Seed::Text.html(rng, paragraphs: 5, rich: true))
  page.call(:safety, "Lab Safety Rules", body: "<ol>#{Array.new(12) { "<li>#{Seed::Text.sentence(rng)}</li>" }.join}</ol>#{Seed::Text.html(rng, rich: true)}")
  8.times { |i| page.call(:"unit#{i + 1}", "Unit #{i + 1} Overview: #{Seed::Text.title(rng, 1, 3)}", body: Seed::Text.html(rng, paragraphs: 3, rich: true)) }
  # duplicate-ish titles (Canvas de-duplicates the URL slug, not the title)
  dup = ["Study Guide", "Study Guide", "Study guide ", "STUDY GUIDE", "Study-Guide", "Study Guide (Unit 1)", "Study Guide (Unit 1) "].map { |t| page.call(nil, t) }
  # unicode / awkward titles
  page.call(:unicode, "用語集 (Glossary) — Glosario", body: Seed::Text::UNICODE_SNIPPETS.map { |s| "<p>#{ERB::Util.html_escape(s)}</p>" }.join)
  ["Résumé du chapitre 3", "🧪 Lab Notebook Tips", "Q&A: Exam 1?", "50% Rule / Late Work", "C++ & C# (off-topic)", "a", "2026", "Page #7 — \"quoted\" & <tagged>",
   "Glosario — Español", "   Padded title   ", "ALL CAPS ANNOUNCEMENT PAGE", "under_scores_and.dots.in.title"].each { |t| page.call(nil, t) }
  page.call(:long_title, "Long title #{"that just keeps going and going " * 8}"[0, 250])
  page.call(:long_body, "Lab Manual (very long page)", body: Seed::Text.html(rng, paragraphs: 900, rich: true))
  page.call(:empty_body, "Empty Page (no body)", body: "")
  page.call(:table, "Periodic Data Tables", body: "<table>#{Array.new(40) { |r| "<tr>#{Array.new(8) { |c| "<td>#{r}×#{c}=#{r * c}</td>" }.join}</tr>" }.join}</table>")
  page.call(:links, "Useful Links & Embedded Media", body: <<~HTML)
    <p><a href="https://example.com/a?b=1&amp;c=2#frag">query + fragment</a> · <a href="mailto:teacher.persona@example.edu">mail</a> ·
    <a href="/courses/#{main.id}/files">course files</a> · <a href="/courses/#{main.id}/modules">modules</a></p>
    <p><img src="https://example.com/img/cell.png" alt="cell"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="inline"></p>
    <p><img class="equation_image" title="\\frac{a}{b}" src="/equation_images/%255Cfrac%257Ba%257D%257Bb%257D" alt="LaTeX: \\frac{a}{b}"></p>
    <p><video controls src="https://example.com/v.mp4"></video><audio controls src="https://example.com/a.mp3"></audio></p>
  HTML
  # unpublished
  6.times { |i| page.call(i.zero? ? :unpublished : nil, "DRAFT: #{Seed::Text.title(rng, 2, 4)}", published: false) }
  # editing roles / authorship
  page.call(:student_editable, "Class Notes Wiki (students can edit)", editing_roles: "teachers,students")
  page.call(:public_editable, "Shared Vocabulary List (anyone can edit)", editing_roles: "teachers,students,public")
  page.call(:student_authored, "Sam's Study Notes (student-created)", user: student, editing_roles: "teachers,students")
  page.call(:ta_page, "TA Review Session Notes", user: ta)
  # planner dates
  4.times { |i| page.call(i.zero? ? :todo : nil, "To-do: Read #{Seed::Text.title(rng, 2, 3)}", todo_date: Seed.now + ((i * 4) - 3).days) }
  # filler
  14.times { |i| page.call(nil, "#{%w[Reading Notes Handout Reference][i % 4]}: #{Seed::Text.title(rng, 2, 4)}") }
  # revisions by different editors
  [[:revised, "Midterm Review Sheet (many revisions)", 12], [:revised2, "Field Trip Logistics", 5], [:revised3, "Grading FAQ", 3]].each do |key, title, n|
    p = page.call(key, title)
    n.times do |i|
      p.user = [teacher, ta, student][i % 3]
      p.body = "<p>Revision #{i + 2}.</p>#{Seed::Text.html(rng, paragraphs: 1 + (i % 3))}"
      p.title = "#{title} (updated)" if i == n - 1 && key == :revised2
      p.save!
    end
  end
  made[:student_editable].tap do |p|
    p.user = student
    p.body = "#{p.body}<p>Student addition: #{Seed::Text.sentence(rng)}</p>"
    p.save!
  end
  # deleted
  dead = Array.new(3) { |i| page.call(nil, "Deleted Page #{i + 1}").tap(&:destroy) }

  Seed.set_ref("pages:units", (1..8).map { |i| made[:"unit#{i}"].id })
  Seed.set_ref("page:safety", made[:safety].id)
  Seed.set_ref("page:policies", made[:policies].id)
  Seed.fixture(:pageUrl, made[:safety].url)
  Seed.fixture(:pageId, made[:safety].id)
  Seed.fixture(:frontPageUrl, front.url)
  Seed.fixture(:frontPageId, front.id)
  Seed.fixture(:unpublishedPageUrl, made[:unpublished].url)
  Seed.fixture(:pageWithRevisionsUrl, made[:revised].url)
  Seed.fixture(:pageRevisionCount, made[:revised].versions.count)
  Seed.fixture(:longPageUrl, made[:long_body].url)
  Seed.fixture(:unicodePageUrl, made[:unicode].url)
  Seed.fixture(:duplicateTitlePageUrls, dup.map(&:url))
  Seed.fixture(:studentEditablePageUrl, made[:student_editable].url)
  Seed.fixture(:deletedPageUrl, dead.first.url)

  # second course + a group get pages too
  second = Seed.course(:second)
  sfront = page.call(nil, "Algebra II Home", course: second)
  sfront.set_as_front_page!
  7.times { |i| page.call(nil, "Chapter #{i + 1} Notes", course: second, published: i != 5) }
  Seed.fixture(:course2PageUrl, second.wiki_pages.where(title: "Chapter 1 Notes").first.url)
  club = Group.find(Seed.ref("group:student_club"))
  gp = club.wiki_pages.create!(title: "Study Plan", body: Seed::Text.html(rng), user: student)
  club.wiki_pages.create!(title: "Meeting Notes — 会議メモ", body: Seed::Text.html(rng), user: Seed.user(:student2))
  Seed.fixture(:groupPageUrl, gp.url)
  Seed.log "  #{main.wiki_pages.count} pages in the main course"
end

Seed.step("content.files") do
  main = Seed.course(:main)
  rng = Seed.rng("content.files")
  teacher = Seed.user(:teacher)
  now = Seed.now
  root = Folder.root_folders(main).first
  count = 0
  dir = lambda do |parent, name, ctx: main, **attrs|
    f = ctx.folders.build(name:, parent_folder: parent)
    attrs.each { |k, v| f.public_send("#{k}=", v) }
    f.save!
    f
  end
  file = lambda do |folder, name, ext: nil, ctx: main, user: teacher, **attrs|
    ext ||= name.include?(".") ? name.split(".").last.downcase : ""
    content, type = Seed::Files.payload(ext, rng)
    count += 1
    Seed.upload(context: ctx, name:, content:, content_type: type, folder:, user:, **attrs)
  end

  unit1 = dir.call(root, "Unit 1 - Cells")
  labs = dir.call(unit1, "Labs")
  lab1 = dir.call(labs, "Lab 1 — Microscopy")
  data = dir.call(lab1, "Data")
  deep = dir.call(data, "Raw (trial 1)") # five levels below the root folder
  deeper = dir.call(deep, "even deeper & deeper")
  unit2 = dir.call(root, "Unit 2 - Energy")
  u2labs = dir.call(unit2, "Labs")
  handouts = dir.call(root, "Handouts & Worksheets")
  images = dir.call(root, "Images")
  media = dir.call(root, "Media (audio & video)")
  hidden = dir.call(root, "Teacher Only (hidden)", hidden: true)
  locked = dir.call(root, "Locked Until Finals", locked: true)
  scheduled = dir.call(root, "Scheduled (unlocks later)", unlock_at: now + 20.days)
  expired = dir.call(root, "Expired (lock date passed)", lock_at: now - 20.days)
  unicode = dir.call(root, "Ünïcödé — 資料 📁")
  long_dir = dir.call(root, "folder with a very long name #{"lorem ipsum dolor sit amet " * 8}"[0, 200].strip)
  empty = dir.call(root, "Empty Folder")
  dir.call(empty, "Nested Empty Folder")
  dead_dir = dir.call(root, "Old Semester (deleted)")
  file.call(dead_dir, "old-syllabus.pdf")
  dead_dir.destroy

  txt = file.call(unit1, "Unit 1 Notes.txt")
  pdf = file.call(unit1, "Cell Diagram.pdf")
  %w[notes.txt notes.txt README Makefile .hidden-dotfile report.final.v2.tar.gz DATA.CSV].each { |n| file.call(unit1, n) }
  [labs, lab1, data, deep, deeper, unit2, u2labs].each_with_index do |f, i|
    file.call(f, "notes.txt") # same name in many folders
    (3 + (i % 4)).times { |j| file.call(f, "#{Seed::Text.title(rng, 1, 3)} #{j + 1}.#{%w[pdf docx csv txt md json xlsx][rng.rand(7)]}") }
  end
  30.times { |i| file.call(handouts, "Worksheet #{format("%02d", i + 1)} - #{Seed::Text.title(rng, 1, 3)}.#{%w[pdf docx pptx][i % 3]}") }
  png = nil
  24.times do |i|
    f = file.call(images, "#{%w[cell mitosis leaf frog microscope][i % 5]}-#{i + 1}.#{%w[png gif svg png PNG][i % 5]}")
    png ||= f
  end
  8.times { |i| file.call(media, "Lecture #{i + 1} recording.#{i.even? ? "mp4" : "mp3"}") }
  ["100% final+draft #2.txt", "Students' answers (period 4), v3.docx", "résumé — façade.pdf", "講義ノート 第3回.pdf", "ملف الدرس.txt", "emoji 🧬🔬 notes.md",
   "a&b=c?d.txt", "semi;colon,comma.csv", "  leading space.txt", "UPPER CASE FILE.TXT", "con.txt", "file.with.many.dots.in.name.json", "no_extension_at_all",
   "#{"very long file name " * 11}".strip[0, 240] + ".txt", "tab\there.txt", "back\\slash.txt", "index.html", "page.htm", "script.py", "archive.zip"].each do |n|
    file.call(unicode, n)
  end
  6.times { |i| file.call(long_dir, "Copy of Copy of handout (#{i + 1}).docx") }
  4.times { |i| file.call(hidden, "Answer Key #{i + 1}.pdf") }
  4.times { |i| file.call(locked, "Final Exam Review #{i + 1}.pdf") }
  3.times { |i| file.call(scheduled, "Week #{i + 12} slides.pptx") }
  3.times { |i| file.call(expired, "Old quiz #{i + 1}.pdf") }
  # individual file states
  hidden_file = file.call(root, "hidden-file (link only).pdf", file_state: "hidden")
  locked_file = file.call(root, "locked-file.pdf", locked: true)
  file.call(root, "unlocks-in-two-weeks.pdf", unlock_at: now + 14.days)
  file.call(root, "locked-since-last-month.pdf", lock_at: now - 30.days)
  file.call(root, "window-file.pdf", unlock_at: now - 5.days, lock_at: now + 5.days)
  deleted_file = file.call(root, "deleted-file.txt")
  deleted_file.destroy
  # an overwritten file (old version is kept and points at its replacement)
  v1 = file.call(root, "syllabus.pdf")
  v2 = file.call(root, "syllabus.pdf")
  v2.handle_duplicates(:overwrite)
  # usage rights on a few files
  ur_own = main.usage_rights.create!(use_justification: "own_copyright", legal_copyright: "(C) #{now.year} T. Marlowe")
  ur_cc = main.usage_rights.create!(use_justification: "creative_commons", license: "cc_by_sa", legal_copyright: "CC BY-SA Example Author")
  Attachment.where(id: [txt.id, pdf.id]).update_all(usage_rights_id: ur_own.id)
  Attachment.where(id: png.id).update_all(usage_rights_id: ur_cc.id)
  # bulk filler so listing a folder paginates (>100 files in one folder)
  bulk = dir.call(root, "Archive (120 scanned worksheets)")
  120.times { |i| file.call(bulk, "scan_#{format("%04d", i + 1)}.#{i % 10 == 9 ? "txt" : "pdf"}") }

  Seed.set_ref("files:module_items", [pdf.id, txt.id, png.id])
  Seed.fixture(:rootFolderId, root.id)
  Seed.fixture(:folderId, unit1.id)
  Seed.fixture(:deepFolderId, deep.id)
  Seed.fixture(:deepFolderPath, deep.full_name)
  Seed.fixture(:hiddenFolderId, hidden.id)
  Seed.fixture(:lockedFolderId, locked.id)
  Seed.fixture(:emptyFolderId, empty.id)
  Seed.fixture(:unicodeFolderId, unicode.id)
  Seed.fixture(:bigFolderId, bulk.id)
  Seed.fixture(:deletedFolderId, dead_dir.id)
  Seed.fixture(:fileId, txt.id)
  Seed.fixture(:pdfFileId, pdf.id)
  Seed.fixture(:imageFileId, png.id)
  Seed.fixture(:hiddenFileId, hidden_file.id)
  Seed.fixture(:lockedFileId, locked_file.id)
  Seed.fixture(:deletedFileId, deleted_file.id)
  Seed.fixture(:replacedFileId, v1.id)
  Seed.fixture(:replacementFileId, v2.id)
  Seed.fixture(:usageRightsFileId, txt.id)

  # ---- second course --------------------------------------------------------------------
  second = Seed.course(:second)
  sroot = Folder.root_folders(second).first
  sdir = dir.call(sroot, "Problem Sets", ctx: second)
  12.times { |i| file.call(sdir, "Problem Set #{i + 1}.pdf", ctx: second) }
  4.times { |i| file.call(sroot, "Formula Sheet v#{i + 1}.pdf", ctx: second) }
  Seed.fixture(:course2FolderId, sdir.id)
  Seed.fixture(:course2FileId, second.attachments.order(:id).first.id)

  # ---- user files -------------------------------------------------------------------------
  [[:student, Seed.user(:student)], [:teacher, teacher], [:student2, Seed.user(:student2)]].each do |key, u|
    uroot = Folder.root_folders(u).first
    notes = dir.call(uroot, "School Notes", ctx: u)
    sub = dir.call(notes, "Biology", ctx: u)
    f = nil
    5.times { |i| f = file.call(i < 3 ? sub : uroot, "#{key} personal file #{i + 1}.#{%w[txt pdf png docx md][i]}", ctx: u, user: u) }
    next unless key == :student

    Seed.fixture(:userFolderId, notes.id)
    Seed.fixture(:userRootFolderId, uroot.id)
    Seed.fixture(:userFileId, f.id)
  end

  # ---- group files ------------------------------------------------------------------------
  group = Group.find(Seed.ref("groups:lab").first)
  groot = Folder.root_folders(group).first
  gdir = dir.call(groot, "Poster Drafts", ctx: group)
  member = group.users.order(:id).first
  gf = nil
  6.times { |i| gf = file.call(i < 4 ? gdir : groot, "poster draft #{i + 1}.#{%w[png pdf pptx][i % 3]}", ctx: group, user: member) }
  club = Group.find(Seed.ref("group:student_club"))
  3.times { |i| file.call(Folder.root_folders(club).first, "flashcards #{i + 1}.csv", ctx: club, user: Seed.user(:student)) }
  Seed.fixture(:groupFolderId, gdir.id)
  Seed.fixture(:groupFileId, gf.id)
  Seed.log "  #{count} files uploaded (#{main.attachments.count} in the main course, #{main.folders.count} folders)"
end
