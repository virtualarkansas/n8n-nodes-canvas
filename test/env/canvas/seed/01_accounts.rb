# frozen_string_literal: true

# Accounts, terms, roles, account-level settings, grading schemes/periods, developer keys,
# external tools, authentication providers, account notifications.

Seed.step("accounts.bootstrap") do
  root = Seed.root
  admin = Seed.admin
  # token the seed itself uses for the REST calls it makes (SIS imports, exports, ...)
  tok = admin.access_tokens.create!(purpose: "n8n battery seed loader (internal)")
  Seed.set_ref("token:seed_admin", tok.full_token)
  Seed.fixture(:accountId, root.id)
  Seed.fixture(:adminUserId, admin.id)
  Seed.fixture(:siteAdminAccountId, Account.site_admin.id)
  Seed.fixture(:defaultPassword, Seed::PASSWORD)

  root.settings[:can_add_pronouns] = true
  root.settings[:enable_eportfolios] = true
  root.settings[:enable_profiles] = true
  root.settings[:restrict_student_future_view] = { value: false, locked: false }
  root.settings[:sis_syncing] = { value: true, locked: false }
  root.settings[:sis_default_grade_export] = { value: true, locked: false }
  root.settings[:allow_gradebook_show_first_last_names] = true
  root.default_time_zone = "America/Chicago"
  root.allow_sis_import = true
  root.enable_service(:avatars) rescue nil # rubocop:disable Style/RescueModifier
  root.save!

  # page views in the database so /users/:id/page_views and /users/self/history have data
  Setting.set("enable_page_views", "db")
end

Seed.step("accounts.tree") do
  root = Seed.root
  made = {}
  mk = lambda do |key, name, parent, sis: nil, **attrs|
    acct = Account.where(root_account_id: root.id, parent_account_id: parent.id, name:).first
    acct ||= Account.create!(name:, parent_account: parent, root_account: root, sis_source_id: sis, **attrs)
    made[key] = acct
    Seed.set_ref("account:#{key}", acct.id)
    acct
  end

  rhs = mk.call(:rhs, "Riverside High School", root, sis: "SCH-RHS", default_time_zone: "America/Chicago")
  sci = mk.call(:rhs_sci, "Science Department", rhs, sis: "RHS-SCI")
  mk.call(:rhs_bio, "Biology", sci, sis: "RHS-SCI-BIO")
  mk.call(:rhs_phy, "Physics & Chemistry", sci, sis: "RHS-SCI-PHYCHEM")
  mk.call(:rhs_math, "Mathematics", rhs, sis: "RHS-MATH")
  hum = mk.call(:rhs_hum, "Humanities", rhs, sis: "RHS-HUM")
  mk.call(:rhs_ela, "English Language Arts", hum, sis: "RHS-HUM-ELA")
  mk.call(:rhs_hist, "History & Social Studies", hum) # no SIS id on purpose
  mk.call(:rhs_arts, "Arts & Música 🎨", rhs, sis: "RHS-ARTS")
  lms = mk.call(:lms, "Lakeview Middle School", root, sis: "SCH-LMS", default_time_zone: "America/Denver")
  mk.call(:lms_g6, "Grade 6", lms, sis: "LMS-G6")
  mk.call(:lms_g78, "Grades 7/8 (combined)", lms, sis: "LMS-G7/8")
  mk.call(:nge, "Northgate Elementary", root) # no SIS id
  doa = mk.call(:doa, "District Online Academy", root, sis: "SCH-DOA", default_time_zone: "UTC")
  mk.call(:doa_pd, "Continuing Ed & Professional Development", doa, sis: "DOA-PD")
  mk.call(:doa_lang, "World Languages — Idiomas / 外国語", doa, sis: "DOA-LANG")
  closed = mk.call(:closed, "Closed Campus (deleted sub-account)", root, sis: "SCH-CLOSED")
  closed.destroy unless closed.workflow_state == "deleted"

  Seed.fixture(:subAccountId, made[:rhs].id)
  Seed.fixture(:subAccountSisId, "SCH-RHS")
  Seed.fixture(:midSubAccountId, made[:rhs_sci].id)
  Seed.fixture(:deepSubAccountId, made[:rhs_bio].id)
  Seed.fixture(:secondSubAccountId, made[:lms].id)
  Seed.fixture(:deletedSubAccountId, closed.id)
  Seed.log "  #{made.size} sub-accounts"
end

Seed.step("accounts.terms") do
  root = Seed.root
  now = Seed.now
  season = lambda do |d|
    s = if d.month <= 4 then "Spring"
        elsif d.month <= 7 then "Summer"
        else
          "Fall"
        end
    ["#{s} #{d.year}", "TERM-#{d.year}-#{s[0, 2].upcase}"]
  end
  specs = {
    past2: [now - 15.months, now - 11.months],
    past1: [now - 10.months, now - 6.months],
    past0: [now - 165.days, now - 100.days],
    current: [now - 90.days, now + 45.days],
    future1: [now + 60.days, now + 180.days],
    future2: [now + 200.days, now + 270.days]
  }
  used = {}
  specs.each do |key, (s, e)|
    name, sis = season.call(s)
    if used[name]
      name = "#{name} (#{key})"
      sis = "#{sis}-#{key}"
    end
    used[name] = true
    term = root.enrollment_terms.where(sis_source_id: sis).first ||
           root.enrollment_terms.create!(name:, sis_source_id: sis, start_at: s.beginning_of_day, end_at: e.end_of_day)
    Seed.set_ref("term:#{key}", term.id)
  end
  nodates = root.enrollment_terms.where(name: "Ongoing / Self-Paced (no dates)").first ||
            root.enrollment_terms.create!(name: "Ongoing / Self-Paced (no dates)", sis_source_id: "TERM-ONGOING")
  Seed.set_ref("term:nodates", nodates.id)
  nosis = root.enrollment_terms.where(name: "Intersession (no SIS id)").first ||
          root.enrollment_terms.create!(name: "Intersession (no SIS id)", start_at: now + 46.days, end_at: now + 58.days)
  Seed.set_ref("term:intersession", nosis.id)
  dead = root.enrollment_terms.where(name: "Cancelled Term (deleted)").first ||
         root.enrollment_terms.create!(name: "Cancelled Term (deleted)", sis_source_id: "TERM-CANCELLED")
  dead.destroy unless dead.workflow_state == "deleted"
  Seed.set_ref("term:default", root.default_enrollment_term.id)

  # per-role date overrides on the current term (teachers get in early, students locked out late)
  cur = Seed.term(:current)
  cur.enrollment_dates_overrides.where(enrollment_type: "TeacherEnrollment").first ||
    cur.enrollment_dates_overrides.create!(enrollment_type: "TeacherEnrollment", start_at: cur.start_at - 21.days, end_at: cur.end_at + 14.days, context: root)
  cur.enrollment_dates_overrides.where(enrollment_type: "StudentEnrollment").first ||
    cur.enrollment_dates_overrides.create!(enrollment_type: "StudentEnrollment", start_at: cur.start_at - 2.days, end_at: cur.end_at + 3.days, context: root)

  Seed.fixture(:termId, cur.id)
  Seed.fixture(:termSisId, cur.sis_source_id)
  Seed.fixture(:pastTermId, Seed.ref("term:past1"))
  Seed.fixture(:olderPastTermId, Seed.ref("term:past2"))
  Seed.fixture(:futureTermId, Seed.ref("term:future1"))
  Seed.fixture(:noDatesTermId, nodates.id)
  Seed.fixture(:defaultTermId, root.default_enrollment_term.id)
  Seed.fixture(:deletedTermId, dead.id)
end

Seed.step("accounts.roles") do
  root = Seed.root
  role = lambda do |key, name, base|
    r = root.roles.where(name:).first_or_initialize
    r.base_role_type = base
    r.workflow_state = "active" if r.new_record?
    r.save!
    Seed.set_ref("role:#{key}", r.id)
    r
  end
  lead_ta = role.call(:lead_ta, "Lead TA", "TaEnrollment")
  auditor = role.call(:auditor, "Auditor (no credit)", "StudentEnrollment")
  coteach = role.call(:co_teacher, "Co-Teacher", "TeacherEnrollment")
  parent = role.call(:parent_volunteer, "Parent Volunteer", "ObserverEnrollment")
  reviewer = role.call(:reviewer, "Curriculum Reviewer", "DesignerEnrollment")
  retired = role.call(:retired, "Retired Grader (inactive role)", "TaEnrollment")
  registrar = role.call(:registrar, "Registrar", Role::DEFAULT_ACCOUNT_TYPE)
  helpdesk = role.call(:helpdesk, "Help Desk — Tier 1", Role::DEFAULT_ACCOUNT_TYPE)
  readonly = role.call(:readonly, "Read-Only Auditor", Role::DEFAULT_ACCOUNT_TYPE)
  retired.deactivate! if retired.workflow_state == "active"

  ov = lambda do |r, perm, enabled, locked: false, ctx: root|
    RoleOverride.where(context: ctx, role: r, permission: perm.to_s).first_or_initialize.tap do |o|
      o.enabled = enabled
      o.locked = locked
      o.save!
    end
  end
  known = RoleOverride.permissions.keys.map(&:to_s)
  {
    lead_ta => { manage_grades: true, view_all_grades: true, moderate_forum: true, send_messages_all: true, manage_students: true },
    auditor => { post_to_forum: false, participate_in_groups: false, send_messages: false },
    coteach => { manage_course_content_delete: false, manage_grades: true },
    parent => { read_forum: true, send_messages: true },
    reviewer => { read_reports: true, manage_grades: false },
    registrar => { manage_sis: true, import_sis: true, manage_students: true, read_roster: true, view_all_grades: true, read_reports: true, manage_courses_admin: true },
    helpdesk => { become_user: true, read_roster: true, view_notifications: true, manage_user_logins: true },
    readonly => { read_course_content: true, read_reports: true, view_all_grades: true, read_sis: true, view_statistics: true }
  }.each do |r, perms|
    perms.each { |perm, en| ov.call(r, perm, en, locked: perm == :become_user) if known.include?(perm.to_s) }
  end
  # a sub-account level override on a built-in role
  ta_role = Role.get_built_in_role("TaEnrollment", root_account_id: root.id)
  ov.call(ta_role, :manage_grades, false, ctx: Seed.account(:lms)) if known.include?("manage_grades")

  Seed.fixture(:customRoleId, lead_ta.id)
  Seed.fixture(:customStudentRoleId, auditor.id)
  Seed.fixture(:customTeacherRoleId, coteach.id)
  Seed.fixture(:customObserverRoleId, parent.id)
  Seed.fixture(:accountRoleId, registrar.id)
  Seed.fixture(:inactiveRoleId, retired.id)
  %w[StudentEnrollment TeacherEnrollment TaEnrollment DesignerEnrollment ObserverEnrollment AccountAdmin].each do |t|
    Seed.fixture("#{t.sub("Enrollment", "").downcase}RoleId".sub("accountadmin", "accountAdmin"), Role.get_built_in_role(t, root_account_id: root.id).id)
  end
end

Seed.step("accounts.features") do
  root = Seed.root
  defs = Feature.definitions
  set = lambda do |ctx, feature, state|
    next unless defs.key?(feature.to_s)

    case state
    when :on then ctx.enable_feature!(feature)
    when :off then ctx.disable_feature!(feature)
    when :allowed then ctx.allow_feature!(feature)
    end
  rescue => e
    Seed.log "  feature #{feature} on #{ctx.class}##{ctx.id}: #{e.message[0, 120]}"
  end
  set.call(root, :rubric_criterion_range, :on)
  set.call(root, :filter_speed_grader_by_student_group, :on)
  set.call(root, :new_user_tutorial, :off)
  set.call(root, :account_level_mastery_scales, :on)
  set.call(root, :final_grades_override, :allowed)
  set.call(root, :anonymous_instructor_annotations, :allowed)
  set.call(Account.site_admin, :account_level_blackout_dates, :on)
  set.call(Seed.account(:rhs), :epub_export, :on)
  set.call(Seed.account(:rhs), :apply_score_to_ungraded, :on)
  set.call(Seed.account(:lms), :outcome_gradebook, :on)
  set.call(Seed.account(:doa), :quiz_log_auditing, :off)
  set.call(Seed.account(:rhs_sci), :student_outcome_gradebook, :on)
  Seed.fixture(:featureFlagName, "epub_export")
  Seed.fixture(:rootFeatureFlagName, "rubric_criterion_range")
  Seed.fixture(:courseFeatureFlagName, "outcome_gradebook")

  # Local-only plugin configuration so collaborations / conferences can exist without any
  # external service being contacted at creation time (see README).
  ps = PluginSetting.where(name: "etherpad").first_or_initialize
  ps.settings = { domain: "etherpad.example.com", name: "EtherPad (fake, local battery)" }
  ps.disabled = false
  ps.save!
  ps = PluginSetting.where(name: "big_blue_button").first_or_initialize
  ps.settings = { domain: "bbb.example.invalid", secret: "battery-fake-secret", recording_enabled: false, replace_with_alternatives: false, free_trial: false }
  ps.disabled = false
  ps.save!
end

Seed.step("accounts.grading") do
  root = Seed.root
  std = lambda do |ctx, title, rows, **attrs|
    gs = ctx.grading_standards.where(title:).first
    gs ||= ctx.grading_standards.create!(title:, data: rows, user: Seed.admin, **attrs)
    gs
  end
  letter = std.call(root, "District Letter Grades (+/-)", [["A", 0.93], ["A-", 0.90], ["B+", 0.87], ["B", 0.83], ["B-", 0.80], ["C+", 0.77], ["C", 0.73], ["C-", 0.70], ["D", 0.60], ["F", 0.0]])
  std.call(root, "Pass / No Pass", [["Pass", 0.6], ["No Pass", 0.0]])
  std.call(root, "Standards-Based 4–1 ⭐", [["4 – Exceeds", 0.9], ["3 – Meets", 0.75], ["2 – Approaching", 0.5], ["1 – Beginning", 0.0]])
  gpa = std.call(root, "GPA Scale 4.0", [["4.0", 0.94], ["3.7", 0.90], ["3.3", 0.87], ["3.0", 0.84], ["2.7", 0.80], ["2.3", 0.77], ["2.0", 0.74], ["1.7", 0.70], ["1.3", 0.67], ["1.0", 0.64], ["0.0", 0.0]])
  std.call(Seed.account(:rhs), "RHS Honors Weighted", [["A", 0.9], ["B", 0.8], ["C", 0.7], ["D", 0.6], ["F", 0.0]])
  std.call(Seed.account(:lms), "Middle School E/S/N/U", [["E", 0.9], ["S", 0.7], ["N", 0.5], ["U", 0.0]])
  old = std.call(root, "Legacy 2019 Scheme (deleted)", [["A", 0.9], ["B", 0.8], ["F", 0.0]])
  old.destroy unless old.workflow_state == "deleted"
  Seed.set_ref("grading_standard:letter", letter.id)
  Seed.set_ref("grading_standard:gpa", gpa.id)
  Seed.fixture(:gradingStandardId, letter.id)
  Seed.fixture(:accountGradingStandardId, letter.id)

  # grading period sets attached to terms
  group = lambda do |title, term_keys, weighted, periods|
    g = root.grading_period_groups.where(title:).first
    unless g
      g = root.grading_period_groups.create!(title:, weighted:, display_totals_for_all_grading_periods: weighted)
      term_keys.each { |k| g.enrollment_terms << Seed.term(k) }
      periods.each do |ptitle, s, e, close, weight|
        g.grading_periods.create!(title: ptitle, start_date: s, end_date: e, close_date: close, weight:)
      end
    end
    g
  end
  cur = Seed.term(:current)
  mid = cur.start_at + ((cur.end_at - cur.start_at) / 2)
  g_cur = group.call("#{cur.name} Quarters", [:current], true, [
                       # Quarter 1 has ended but stays open for grading (teachers cannot grade in a closed period)
                       ["Quarter 1", cur.start_at, mid, mid + 30.days, 40.0],
                       ["Quarter 2", mid, cur.end_at, cur.end_at + 10.days, 60.0]
                     ])
  p1 = Seed.term(:past1)
  third = (p1.end_at - p1.start_at) / 3
  group.call("#{p1.name} Trimesters (closed)", %i[past1 past2], false, [
               ["Trimester A", p1.start_at, p1.start_at + third, p1.start_at + third + 5.days, nil],
               ["Trimester B", p1.start_at + third, p1.start_at + (2 * third), p1.start_at + (2 * third) + 5.days, nil],
               ["Trimester C", p1.start_at + (2 * third), p1.end_at, p1.end_at + 5.days, nil]
             ])
  f1 = Seed.term(:future1)
  group.call("#{f1.name} Semester (future)", [:future1], false, [["Whole Semester", f1.start_at, f1.end_at, f1.end_at + 14.days, nil]])
  empty = root.grading_period_groups.where(title: "Unused Set (no terms, no periods)").first ||
          root.grading_period_groups.create!(title: "Unused Set (no terms, no periods)")
  periods = g_cur.grading_periods.order(:start_date).to_a
  Seed.fixture(:gradingPeriodSetId, g_cur.id)
  Seed.fixture(:emptyGradingPeriodSetId, empty.id)
  Seed.fixture(:gradingPeriodId, periods.first.id)
  Seed.fixture(:currentGradingPeriodId, periods.last.id)

  # custom gradebook statuses (root account)
  if defined?(CustomGradeStatus)
    [["Makeup Pending", "#F0E8EF"], ["Integrity Hold", "#FFE8E5"]].each do |name, color|
      root.custom_grade_statuses.where(name:).first || root.custom_grade_statuses.create!(name:, color:, created_by: Seed.admin)
    end
    Seed.set_ref("custom_grade_status:makeup", root.custom_grade_statuses.where(name: "Makeup Pending").first.id)
  end
end

Seed.step("accounts.devkeys") do
  root = Seed.root
  mk = lambda do |name, **attrs|
    k = DeveloperKey.where(account_id: root.id, name:).first
    k ||= DeveloperKey.create!(name:, account: root, email: "integrations@example.edu", **attrs)
    k.developer_key_account_bindings.where(account_id: root.id).update_all(workflow_state: "on")
    k
  end
  plain = mk.call("Battery API Key (no enforced scopes)", notes: "Seeded: unrestricted API key", redirect_uris: ["https://example.com/oauth/callback"])
  scoped_list = %w[
    url:GET|/api/v1/courses url:GET|/api/v1/courses/:id url:GET|/api/v1/users/:user_id/profile
    url:GET|/api/v1/courses/:course_id/assignments url:GET|/api/v1/accounts
  ] & TokenScopes.all_scopes
  scoped = mk.call("Battery Scoped Key (enforced scopes)", require_scopes: true, scopes: scoped_list,
                                                         redirect_uris: ["https://example.com/oauth/callback"], notes: "Seeded: scopes enforced")
  oauth = mk.call("n8n OAuth2 (authorization code)", redirect_uris: ["http://localhost:5678/rest/oauth2-credential/callback"],
                                                    redirect_uri: "http://localhost:5678/rest/oauth2-credential/callback",
                                                    icon_url: "https://example.com/n8n.png", vendor_code: "n8n", notes: "Seeded: used by the OAuth2 credential test")
  off = DeveloperKey.where(account_id: root.id, name: "Battery Key (turned off)").first ||
        DeveloperKey.create!(name: "Battery Key (turned off)", account: root, email: "old@example.edu")
  off.developer_key_account_bindings.where(account_id: root.id).update_all(workflow_state: "off")
  inactive = mk.call("Battery Key (inactive)")
  inactive.deactivate! if inactive.workflow_state == "active"
  gone = mk.call("Battery Key (deleted)")
  gone.destroy unless gone.workflow_state == "deleted"

  Seed.fixture(:developerKeyId, plain.id)
  Seed.fixture(:scopedDeveloperKeyId, scoped.id)
  Seed.fixture(:scopedDeveloperKeyScopes, scoped_list)
  Seed.fixture(:oauthDeveloperKeyId, oauth.id)
  Seed.fixture(:oauthDeveloperKeyClientId, oauth.global_id.to_s)
  Seed.fixture(:oauthDeveloperKeySecret, oauth.api_key)
  Seed.fixture(:oauthRedirectUri, "http://localhost:5678/rest/oauth2-credential/callback")
  Seed.fixture(:inactiveDeveloperKeyId, inactive.id)
end

Seed.step("accounts.tools") do
  root = Seed.root
  mk = lambda do |ctx, name, **attrs, &blk|
    t = ctx.context_external_tools.where(name:).first
    unless t
      t = ctx.context_external_tools.new(name:, consumer_key: "battery-#{name.parameterize}", shared_secret: "s3cret-#{name.parameterize}", **attrs)
      blk&.call(t)
      t.save!
    end
    t
  end
  acct_tool = mk.call(root, "Battery LTI 1.1 Tool (account)", url: "https://lti.example.com/launch", domain: "lti.example.com",
                                                              description: "Seeded LTI 1.1 tool. Launches go nowhere.", privacy_level: "public") do |t|
    t.course_navigation = { enabled: true, text: "Battery Tool", visibility: "members", default: "disabled" }
    t.account_navigation = { enabled: true, text: "Battery Admin Tool" }
    t.editor_button = { enabled: true, icon_url: "https://lti.example.com/icon.png", selection_width: 500, selection_height: 400 }
    t.assignment_selection = { enabled: true }
    t.custom_fields = { "district" => "battery", "term" => "$Canvas.term.name" }
  end
  mk.call(root, "Anonymous Polling Widget", url: "https://polls.example.org/lti", privacy_level: "anonymous") do |t|
    t.user_navigation = { enabled: true, text: "Polls" }
  end
  mk.call(Seed.account(:rhs), "RHS Library Search (sub-account)", domain: "library.example.edu", privacy_level: "name_only") do |t|
    t.resource_selection = { enabled: true, url: "https://library.example.edu/select", selection_width: 800, selection_height: 600 }
    t.homework_submission = { enabled: true, url: "https://library.example.edu/submit" }
  end
  dead = mk.call(root, "Retired Plagiarism Checker (deleted)", url: "https://old.example.com/lti", privacy_level: "email_only")
  dead.destroy unless dead.workflow_state == "deleted"
  Seed.set_ref("tool:account", acct_tool.id)
  Seed.fixture(:externalToolId, acct_tool.id)
  Seed.fixture(:externalToolUrl, "https://lti.example.com/launch")
end

Seed.step("accounts.auth") do
  root = Seed.root
  canvas = root.authentication_providers.active.where(auth_type: "canvas").first
  saml = root.authentication_providers.where(auth_type: "saml").first ||
         root.authentication_providers.create!(auth_type: "saml", idp_entity_id: "https://idp.example.edu/saml2/idp/metadata",
                                               log_in_url: "https://idp.example.edu/saml2/idp/SSOService", log_out_url: "https://idp.example.edu/saml2/idp/SLO",
                                               certificate_fingerprint: "AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01",
                                               identifier_format: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress", login_attribute: "NameID", jit_provisioning: false)
  cas = root.authentication_providers.where(auth_type: "cas").first ||
        root.authentication_providers.create!(auth_type: "cas", auth_base: "https://cas.example.edu/cas", log_in_url: "https://cas.example.edu/cas/login")
  # LDAP is created and immediately soft-deleted: an *active* LDAP provider is consulted on
  # every password login (Pseudonym#valid_arbitrary_credentials?) and would add timeouts.
  ldap = root.authentication_providers.where(auth_type: "ldap").first ||
         root.authentication_providers.create!(auth_type: "ldap", auth_host: "ldap.example.invalid", auth_port: 636, auth_over_tls: "simple_tls",
                                               auth_base: "ou=people,dc=example,dc=edu", auth_filter: "(uid={{login}})", auth_username: "cn=canvas,dc=example,dc=edu", auth_password: "not-a-real-password")
  ldap.destroy unless ldap.workflow_state == "deleted"
  # keep the built-in Canvas login first so /login keeps redirecting to /login/canvas
  canvas.update_columns(position: 1) if canvas.position != 1
  Seed.set_ref("auth:saml", saml.id)
  Seed.fixture(:authenticationProviderId, saml.id)
  Seed.fixture(:canvasAuthenticationProviderId, canvas.id)
  Seed.fixture(:casAuthenticationProviderId, cas.id)
  Seed.fixture(:deletedAuthenticationProviderId, ldap.id)
  Seed.log "  auth providers: #{root.authentication_providers.active.order(:position).pluck(:position, :auth_type).inspect}"
end

Seed.step("accounts.notifications") do
  root = Seed.root
  now = Seed.now
  rng = Seed.rng("account_notifications")
  mk = lambda do |acct, subject, s, e, icon: "information", roles: [], **attrs|
    n = acct.announcements.where(subject:).first
    unless n
      n = acct.announcements.build(subject:, message: Seed::Text.html(rng, paragraphs: 2), icon:, **attrs)
      n.start_at = s
      n.end_at = e
      n.user = Seed.admin
      roles.each { |r| n.account_notification_roles.build(role: r) }
      n.save!
    end
    n
  end
  student_role = Role.get_built_in_role("StudentEnrollment", root_account_id: root.id)
  teacher_role = Role.get_built_in_role("TeacherEnrollment", root_account_id: root.id)
  admin_role = Role.get_built_in_role("AccountAdmin", root_account_id: root.id)
  current = mk.call(root, "Scheduled maintenance this weekend", now - 2.days, now + 12.days, icon: "warning")
  mk.call(root, "Welcome back! ¡Bienvenidos! 欢迎回来 🎉", now - 5.days, now + 30.days, icon: "information")
  mk.call(root, "Report cards available in the portal", now - 1.day, now + 6.days, icon: "calendar", roles: [student_role])
  mk.call(root, "Grades due Friday at 4pm (teachers only)", now - 3.days, now + 4.days, icon: "error", roles: [teacher_role])
  mk.call(root, "Admin-only: SIS sync window", now - 1.day, now + 2.days, icon: "question", roles: [admin_role])
  past = mk.call(root, "Snow day — all campuses closed (past)", now - 40.days, now - 39.days, icon: "warning")
  mk.call(root, "Last year's enrollment deadline (past)", now - 400.days, now - 380.days)
  future = mk.call(root, "Spring registration opens (future)", now + 20.days, now + 50.days, icon: "calendar")
  mk.call(root, "Summer school sign-up (future, students)", now + 150.days, now + 200.days, roles: [student_role])
  mk.call(Seed.account(:rhs), "RHS: Picture day is Thursday", now - 1.day, now + 9.days, icon: "information")
  mk.call(Seed.account(:lms), "LMS: Science fair entries due", now - 10.days, now + 20.days, icon: "calendar")
  mk.call(root, "Very long title #{"— please read carefully " * 8}".strip, now - 1.day, now + 3.days)
  Seed.fixture(:accountNotificationId, current.id)
  Seed.fixture(:pastAccountNotificationId, past.id)
  Seed.fixture(:futureAccountNotificationId, future.id)
end
