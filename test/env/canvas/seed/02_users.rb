# frozen_string_literal: true

# ~470 users created through the models (the SIS import in 03 adds ~130 more):
# personas with API tokens, deliberately awkward "special" users, and bulk pools.

module Seed
  module Users
    FIRST = %w[
      Aaliyah Aarav Abigail Ahmed Aiko Alejandro Amara Anan Andrei Anika Antonio Arjun Ava Ayesha Beatriz
      Benjamin Bo Camila Carlos Chiara Chloe Daniel Daria David Diego Dmitri Elena Elif Emeka Emma Ethan
      Fatima Felix Freya Gabriel Grace Hana Hassan Hiroshi Ibrahim Imani Ingrid Isabella Ivan Jamal Jasmine
      Javier Jin Jorge Julia Kai Kamala Karim Kenji Kiran Kofi Lars Layla Leila Liam Lin Lucas Lucia Luis Mai
      Malik Maria Mateo Maya Mei Miguel Mina Mohamed Naomi Nia Nikolai Noah Nora Olivia Omar Oscar Paolo Priya
      Quinn Rafael Rania Ravi Rosa Ryan Sana Santiago Sara Sasha Sofia Soren Tariq Thabo Thi Tomas Uma
      Valentina Victor Wei Xavier Yara Yuki Yusuf Zainab Zoe
    ].freeze
    LAST = %w[
      Abdi Adeyemi Ahmed Ali Andersson Baker Banerjee Bianchi Brown Castillo Chen Cho Clark Cohen Costa Cruz
      Dang Davis Diaz Dubois Evans Fernandez Fischer Flores Garcia Gonzalez Gupta Haddad Hall Hansen Harris
      Hernandez Hoang Hussein Ibrahim Ivanov Jackson Jensen Johnson Jones Kaya Khan Kim Kowalski Kumar Lee
      Lewis Li Lopez Martin Martinez Mbeki Miller Mohammed Moore Morales Müller Murphy Nakamura Nguyen Novak
      Okafor Okonkwo Ortiz Park Patel Perez Petrov Popescu Ramirez Reyes Rivera Robinson Rodriguez Rossi
      Sanchez Sato Schmidt Silva Singh Smith Suzuki Tanaka Taylor Thomas Thompson Torres Tran Turner Walker
      Wang White Williams Wilson Wong Wright Yamamoto Yang Yilmaz Young Zhang
    ].freeze
    LOCALES = %w[es fr de ja zh-Hans pt-BR ar ru it nl ko he].freeze
    ZONES = ["America/Chicago", "America/Denver", "America/New_York", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu",
             "Europe/London", "Europe/Berlin", "Asia/Kolkata", "Asia/Tokyo", "Asia/Kathmandu", "Australia/Adelaide", "Pacific/Auckland",
             "America/Sao_Paulo", "Africa/Lagos", "UTC"].freeze
    PRONOUNS = ["She/Her", "He/Him", "They/Them"].freeze

    class << self
      def template_pseudonym
        @template ||= begin
          u = User.create!(name: "Seed Password Template")
          p = u.pseudonyms.create!(unique_id: "seed.password.template@example.invalid", password: Seed::PASSWORD, password_confirmation: Seed::PASSWORD, account: Seed.root)
          crypted = [p.crypted_password, p.password_salt]
          p.destroy
          u.destroy
          crypted
        end
      end

      # Creates a registered user with one login and (optionally) one confirmed e-mail channel.
      # The scrypt hash for the shared password is computed once and copied (10x faster).
      def make(name:, login:, email: :login, sis: nil, integration_id: nil, state: "registered", full_policies: false, cc_state: "active", **attrs)
        u = User.new(name:)
        attrs.each { |k, v| u.public_send("#{k}=", v) unless v.nil? }
        u.workflow_state = state
        u.save!
        add_login(u, login, sis:, integration_id:) if login
        email = login if email == :login
        add_channel(u, email, state: cc_state, full_policies:) if email
        u
      end

      def add_login(user, unique_id, sis: nil, integration_id: nil, provider: nil, state: "active")
        p = user.pseudonyms.build(unique_id:, account: Seed.root)
        p.crypted_password, p.password_salt = template_pseudonym
        p.sis_user_id = sis
        p.integration_id = integration_id
        p.authentication_provider = provider if provider
        p.workflow_state = state
        p.save!
        p
      end

      def add_channel(user, path, type: "email", state: "active", full_policies: false)
        cc = user.communication_channels.build(path:, path_type: type)
        cc.workflow_state = state
        if full_policies
          cc.save!
        else
          # skip the ~90 NotificationPolicy inserts per channel; Canvas builds them lazily
          CommunicationChannel.suspend_callbacks(:consider_building_notification_policies) { cc.save! }
        end
        cc
      end

      def token_for(user, purpose, **attrs)
        user.access_tokens.create!(purpose:, **attrs)
      end
    end
  end
end

Seed.step("users.personas") do
  root = Seed.root
  specs = {
    teacher: ["Teresa Marlowe", "teacher.persona@example.edu", "P-TEACHER-01", { short_name: "Ms. Marlowe", time_zone: "America/Chicago", pronouns: "She/Her" }],
    ta: ["Tariq Assistant-Nakamura", "ta.persona@example.edu", "P-TA-01", { time_zone: "America/Chicago" }],
    student: ["Sam Student", "student.persona@example.edu", "P-STUDENT-01", { short_name: "Sam", sortable_name: "Student, Sam", time_zone: "America/Chicago", pronouns: "They/Them" }],
    student2: ["Stella Estudiante-Ruiz", "student2.persona@example.edu", "P-STUDENT-02", { locale: "es", time_zone: "America/Denver" }],
    observer: ["Olive Observer", "observer.persona@example.edu", nil, { short_name: "Olive (Sam's parent)" }],
    designer: ["Desmond Designer", "designer.persona@example.edu", "P-DESIGNER-01", {}],
    subaccountAdmin: ["Sunita Subadmin", "subadmin.persona@example.edu", "P-SUBADMIN-01", { time_zone: "America/Chicago" }]
  }
  logins = {}
  specs.each do |key, (name, login, sis, attrs)|
    u = Pseudonym.active.where(account_id: root.id, unique_id: login).first&.user
    u ||= Seed::Users.make(name:, login:, sis:, full_policies: true, **attrs)
    u.accept_terms
    u.save!
    Seed.set_ref("user:#{key}", u.id)
    Seed.fixture("#{key}UserId", u.id)
    Seed.token(key, Seed::Users.token_for(u, "n8n battery persona: #{key}").full_token)
    logins[key] = login
  end
  Seed.fixture(:personaLogins, logins)
  Seed.fixture(:teacherSisUserId, "P-TEACHER-01")
  Seed.fixture(:studentSisUserId, "P-STUDENT-01")
  Seed.fixture(:studentLoginId, "student.persona@example.edu")

  # supporting cast with stable keys
  extras = {
    teacher2: ["Marcus Okonkwo-Reyes", "marcus.okonkwo@example.edu", "T-0002", { short_name: "Mr. O" }],
    registrar: ["Regina Registrar", "regina.registrar@example.edu", "A-REG-01", {}],
    deep_admin: ["Bao Biology-Chair", "bao.chair@example.edu", "A-BIO-01", {}],
    helpdesk: ["Hank Helpdesk", "hank.helpdesk@example.edu", nil, {}],
    root_admin2: ["Priya Principal", "priya.principal@example.edu", "A-ROOT-02", {}]
  }
  extras.each do |key, (name, login, sis, attrs)|
    u = Pseudonym.active.where(account_id: root.id, unique_id: login).first&.user
    u ||= Seed::Users.make(name:, login:, sis:, full_policies: true, **attrs)
    Seed.set_ref("user:#{key}", u.id)
  end
  Seed.fixture(:teacher2UserId, Seed.ref("user:teacher2"))

  # a spare token per kind for AccessToken tests (never used for auth by the battery)
  t = Seed.user(:teacher)
  spare = Seed::Users.token_for(t, "Spare token (safe to regenerate/delete)")
  expired = Seed::Users.token_for(t, "Expired token", permanent_expires_at: Seed.now - 30.days)
  scoped = Seed::Users.token_for(t, "Scoped token (courses read only)", scopes: ["url:GET|/api/v1/courses"] & TokenScopes.all_scopes)
  Seed.fixture(:accessTokenId, spare.id)
  Seed.fixture(:expiredAccessTokenId, expired.id)
  Seed.fixture(:scopedAccessTokenId, scoped.id)
  Seed.fixture(:scopedAccessToken, scoped.full_token)
end

Seed.step("users.admins") do
  root = Seed.root
  add = lambda do |acct, user, role|
    acct.account_users.where(user_id: user.id, role_id: role.id).first || acct.account_users.create!(user:, role:)
  end
  admin_role = Role.get_built_in_role("AccountAdmin", root_account_id: root.id)
  sub = add.call(Seed.account(:rhs), Seed.user(:subaccountAdmin), admin_role)
  add.call(root, Seed.user(:root_admin2), admin_role)
  reg = add.call(root, Seed.user(:registrar), Role.find(Seed.ref("role:registrar")))
  add.call(Seed.account(:rhs_bio), Seed.user(:deep_admin), admin_role)
  add.call(Seed.account(:lms), Seed.user(:deep_admin), Role.find(Seed.ref("role:readonly")))
  add.call(root, Seed.user(:helpdesk), Role.find(Seed.ref("role:helpdesk")))
  add.call(Seed.account(:doa), Seed.user(:helpdesk), Role.find(Seed.ref("role:helpdesk")))
  removed = add.call(Seed.account(:nge), Seed.user(:teacher2), admin_role)
  removed.destroy
  Seed.fixture(:subaccountAdminAccountUserId, sub.id)
  Seed.fixture(:registrarUserId, Seed.ref("user:registrar"))
  Seed.fixture(:registrarAccountUserId, reg.id)
end

Seed.step("users.specials") do
  root = Seed.root
  long = "Wolfeschlegelsteinhausenbergerdorff #{"Hubert Blaine Adolph Charles David Earl Frederick Gerald " * 3}".strip
  long = "#{long} #{"x" * 250}"[0, 254] # 254: the derived sortable name ("Last, First") gains one char
  specs = [
    [:unicode, "王小明", { sortable_name: "王, 小明", locale: "zh-Hans", time_zone: "Asia/Shanghai" }, "wang.xiaoming@example.edu", "S-ÜNÏ-王-001"],
    [:japanese, "山田 太郎", { locale: "ja", time_zone: "Asia/Tokyo", short_name: "太郎" }, "yamada.taro@example.edu", "S-JP-0002"],
    [:korean, "김민준", { locale: "ko", time_zone: "Asia/Seoul" }, "kim.minjun@example.edu", nil],
    [:rtl, "محمد بن عبد الله الهاشمي", { locale: "ar", time_zone: "Asia/Riyadh", sortable_name: "الهاشمي, محمد بن عبد الله" }, "mohammed.alhashimi@example.edu", "S-AR-0004"],
    [:hebrew, "שרה כהן", { locale: "he", time_zone: "Asia/Jerusalem" }, "sarah.cohen.il@example.edu", "S-HE-0005"],
    [:cyrillic, "Дмитрий Иванович Соколов", { locale: "ru", time_zone: "Europe/Moscow" }, "d.sokolov@example.edu", "S-RU-0006"],
    [:greek, "Αλέξανδρος Παπαδόπουλος", { time_zone: "Europe/Athens" }, "a.papadopoulos@example.edu", nil],
    [:hindi, "आरव शर्मा", { time_zone: "Asia/Kolkata" }, "aarav.sharma@example.edu", "S-HI-0008"],
    [:vietnamese, "Nguyễn Thị Minh Khai", { time_zone: "Asia/Ho_Chi_Minh", sortable_name: "Nguyễn, Thị Minh Khai" }, "nguyen.minhkhai@example.edu", "S-VI-0009"],
    [:emoji, "Zoë 🎓 Quinn-O'Malley ✨", { short_name: "Zoë ✨", pronouns: "They/Them" }, "zoe.quinn@example.edu", "S-EMOJI-0010"],
    [:long_name, long, { short_name: "Hubert W." }, "hubert.w@example.edu", "S-LONG-#{"9" * 40}"],
    [:apostrophe, "Siobhán O'Brien", {}, "siobhan.o'brien@example.edu", "S-O'BRIEN"],
    [:curly_apostrophe, "Seán O’Connor", {}, "sean.oconnor@example.edu", nil],
    [:hyphen, "Mary-Kate Smith-Jones", {}, "mary-kate.smith-jones@example.edu", "S-HYPHEN-0013"],
    [:jean_baptiste, "D'Angelo Jean-Baptiste", {}, "dangelo.jb@example.edu", "S_UNDERSCORE_0014"],
    [:multi_surname, "José María de la Cruz y García", { sortable_name: "de la Cruz y García, José María", locale: "es" }, "jm.delacruz@example.edu", "S.DOT.0015"],
    [:particle, "Ludwig van der Berg", { sortable_name: "van der Berg, Ludwig" }, "l.vanderberg@example.edu", "s lower with spaces 0016"],
    [:mononym, "Madonna", { sortable_name: "Madonna" }, "madonna@example.edu", "0000017"],
    [:suffix, "Dr. Henry Walton Jones, Jr.", { sortable_name: "Jones, Henry Walton, Jr.", short_name: "Indy" }, "indy.jones@example.edu", "S/SLASH:COLON;0018"],
    [:allcaps, "LOUD ALLCAPS STUDENT", {}, "LOUD.STUDENT@EXAMPLE.EDU", "S-UPPER-0019"],
    [:lowercase, "e. e. lowercase", {}, "ee.lowercase@example.edu", "s-lower-0020"],
    [:bobby_tables, "Robert'); DROP TABLE Students;--", { short_name: "Bobby Tables" }, "bobby.tables@example.edu", "S-'; DROP--0021"],
    [:html_name, "<b>Bold</b> & <script>alert(1)</script> Tester", {}, "html.tester@example.edu", "S-<HTML>&0022"],
    [:null_name, "Null Undefined", { short_name: "null" }, "null.undefined@example.edu", "null"],
    [:quotes, "Anne-Marie \"Annie\" Müller", { time_zone: "Europe/Berlin", locale: "de" }, "annie.mueller@example.edu", "S-\"QUOTE\"-0024"],
    [:comma, "Test, Comma", {}, "comma.test@example.edu", "S,COMMA,0025"],
    [:digits, "X Æ A-12 Musk", {}, "x.ae.a12@example.edu", "S+PLUS=EQ-0026"],
    [:sortable_mismatch, "Bill Gates", { sortable_name: "Gates III, William Henry", short_name: "Billy" }, "bill.gates3@example.edu", "S%25PCT-0027"],
    [:whitespace, "  Padded   Name  ", {}, "padded.name@example.edu", "S-PAD-0028"],
    [:polish, "Zażółć Gęślą-Jaźń", { time_zone: "Europe/Warsaw" }, "zazolc@example.edu", "S-PL-0029"],
    [:turkish, "İbrahim Çağlar Öztürk Şahin", { time_zone: "Europe/Istanbul" }, "ibrahim.sahin@example.edu", "S-TR-İ-0030"]
  ]
  ids = []
  specs.each do |key, name, attrs, login, sis|
    u = Pseudonym.where(account_id: root.id, unique_id: login).first&.user
    u ||= Seed::Users.make(name:, login:, sis:, **attrs)
    Seed.set_ref("user:#{key}", u.id)
    ids << u.id
  end
  Seed.set_ref("users:special_students", ids)
  Seed.fixture(:unicodeUserId, Seed.ref("user:unicode"))
  Seed.fixture(:rtlUserId, Seed.ref("user:rtl"))
  Seed.fixture(:emojiUserId, Seed.ref("user:emoji"))
  Seed.fixture(:longNameUserId, Seed.ref("user:long_name"))
  Seed.fixture(:oddSisUserId, Seed.ref("user:suffix"))
  Seed.fixture(:oddSisUserSisId, "S/SLASH:COLON;0018")

  # --- no e-mail at all: username login, no communication channel
  noemail = Seed::Users.make(name: "Nomail Nguyen", login: "nomail.nguyen", email: nil, sis: "S-NOEMAIL-0031")
  Seed.set_ref("user:no_email", noemail.id)
  Seed.fixture(:noEmailUserId, noemail.id)

  # --- several logins (one SIS, one username, one tied to the SAML provider, one deleted)
  multi = Seed::Users.make(name: "Multi Login López", login: "multi.login@example.edu", sis: "S-MULTI-0032", integration_id: "INT-MULTI-0032")
  p2 = Seed::Users.add_login(multi, "mlopez")
  p3 = Seed::Users.add_login(multi, "multi.lopez@idp.example.edu", sis: "S-MULTI-0032-SAML", provider: AuthenticationProvider.find(Seed.ref("auth:saml")))
  p4 = Seed::Users.add_login(multi, "old.multi.login@example.edu")
  p4.destroy
  Seed.set_ref("user:multi_login", multi.id)
  Seed.fixture(:multiLoginUserId, multi.id)
  Seed.fixture(:loginId, multi.pseudonyms.active.order(:id).first.id)
  Seed.fixture(:secondLoginId, p2.id)
  Seed.fixture(:samlLoginId, p3.id)
  Seed.fixture(:deletedLoginId, p4.id)

  # --- several communication channels in different states
  many = Seed::Users.make(name: "Many Channels Chen", login: "many.channels@example.edu", sis: "S-CHAN-0033", full_policies: true)
  second = Seed::Users.add_channel(many, "mchen.personal@example.org", full_policies: true)
  unconf = Seed::Users.add_channel(many, "mchen.unconfirmed@example.org", state: "unconfirmed")
  retired = Seed::Users.add_channel(many, "mchen.old@example.net", state: "retired")
  sms = Seed::Users.add_channel(many, "5015550133@txt.example.com", type: "sms", state: "unconfirmed") rescue nil # rubocop:disable Style/RescueModifier
  Seed.set_ref("user:multi_channel", many.id)
  Seed.fixture(:multiChannelUserId, many.id)
  Seed.fixture(:communicationChannelId, many.communication_channels.order(:id).first.id)
  Seed.fixture(:secondCommunicationChannelId, second.id)
  Seed.fixture(:unconfirmedCommunicationChannelId, unconf.id)
  Seed.fixture(:retiredCommunicationChannelId, retired.id)
  Seed.fixture(:smsCommunicationChannelId, sms.id) if sms

  # --- lifecycle states
  suspended = Seed::Users.make(name: "Suspended Sven Svensson", login: "suspended.sven@example.edu", sis: "S-SUSP-0034")
  suspended.pseudonyms.each { |p| p.update!(workflow_state: "suspended") }
  Seed.set_ref("user:suspended", suspended.id)
  Seed.fixture(:suspendedUserId, suspended.id)

  pending = Seed::Users.make(name: "Pending Invite Pat", login: "pending.pat@example.edu", state: "pre_registered", cc_state: "unconfirmed")
  Seed.set_ref("user:pending", pending.id)
  Seed.fixture(:pendingUserId, pending.id)

  invited = Seed::Users.make(name: "invited.only@example.org", login: nil, email: "invited.only@example.org", state: "creation_pending", cc_state: "unconfirmed")
  Seed.set_ref("user:creation_pending", invited.id)

  deleted = Seed::Users.make(name: "Deleted Dana Departed", login: "deleted.dana@example.edu", sis: "S-DEL-0035")
  Seed.set_ref("user:deleted", deleted.id) # destroyed after enrollments exist (04)
  Seed.fixture(:deletedUserId, deleted.id)

  # --- merged user (source is soft-deleted and points at the target)
  target = Seed::Users.make(name: "Merge Target Morgan", login: "merge.target@example.edu", sis: "S-MERGE-T")
  source = Seed::Users.make(name: "Merge Source Morgan (duplicate)", login: "merge.source@example.edu", sis: "S-MERGE-S")
  Seed.set_ref("user:merge_target", target.id)
  Seed.set_ref("user:merge_source", source.id) # merged in 04 once both have enrollments
  Seed.fixture(:mergeTargetUserId, target.id)
  Seed.fixture(:mergedUserId, source.id)

  # --- avatars / profile
  root.enable_service(:avatars)
  root.save!
  [[Seed.user(:teacher), "approved"], [Seed.user(:student), "approved"], [Seed.user(:emoji), "reported"], [Seed.user(:bobby_tables), "locked"]].each_with_index do |(u, state), i|
    u.avatar_image_url = "https://example.com/avatars/#{i}.png"
    u.avatar_image_source = "external"
    u.avatar_state = state
    u.save!
  end
  { teacher: ["Biology teacher, robotics coach. Office hours Tue/Thu.", "Science Faculty"],
    student: ["Sophomore. Likes frogs 🐸 and long walks to the lab.", nil] }.each do |k, (bio, title)|
    prof = Seed.user(k).profile
    prof.bio = bio
    prof.title = title
    prof.save!
  end
end

Seed.step("users.bulk") do
  root = Seed.root
  rng = Seed.rng("users.bulk")
  first = Seed::Users::FIRST
  last = Seed::Users::LAST
  used = {}
  seq = 0
  gen = lambda do |kind, domain, sis_prefix, sis_ratio|
    seq += 1
    f = first[rng.rand(first.size)]
    l = last[rng.rand(last.size)]
    l = "#{l}-#{last[rng.rand(last.size)]}" if rng.rand < 0.06
    name = "#{f} #{l}"
    name = "#{f} #{("A".."Z").to_a[rng.rand(26)]}. #{l}" if rng.rand < 0.08
    base = "#{f}.#{l}".downcase.tr("ü", "u").gsub(/[^a-z.\-]/, "")
    login = "#{base}#{seq}@#{domain}"
    login = "#{base}#{seq}" if rng.rand < 0.12 # username-style login
    raise "dup login" if used[login]

    used[login] = true
    attrs = {}
    attrs[:locale] = Seed::Users::LOCALES[rng.rand(Seed::Users::LOCALES.size)] if rng.rand < 0.12
    attrs[:time_zone] = Seed::Users::ZONES[rng.rand(Seed::Users::ZONES.size)] if rng.rand < 0.35
    attrs[:pronouns] = Seed::Users::PRONOUNS[rng.rand(3)] if rng.rand < 0.12
    attrs[:short_name] = f if rng.rand < 0.15
    sis = (format("%s%05d", sis_prefix, seq) if rng.rand < sis_ratio)
    email = login.include?("@") ? login : "#{login}@#{domain}"
    email = nil if rng.rand < 0.03 # a few more users without any e-mail
    Seed::Users.make(name:, login:, email:, sis:, integration_id: (sis && rng.rand < 0.2 ? "INT-#{sis}" : nil), **attrs)
  end
  pools = { teachers: [40, "example.edu", "T-", 0.85], tas: [25, "example.edu", "TA-", 0.6], designers: [6, "example.edu", "D-", 0.5],
            observers: [35, "parents.example.org", "O-", 0.0], students: [330, "students.example.edu", "S", 0.8] }
  pools.each do |pool, (n, domain, prefix, ratio)|
    ids = Array.new(n) { gen.call(pool, domain, prefix, ratio).id }
    Seed.set_ref("users:#{pool}", ids)
    Seed.log "  #{pool}: #{n}"
  end
  # a handful of the bulk students get a second, unconfirmed e-mail
  User.where(id: Seed.ref("users:students").first(12)).find_each do |u|
    Seed::Users.add_channel(u, "alt.#{u.id}@mail.example.org", state: "unconfirmed")
  end
  Seed.fixture(:sampleStudentUserIds, Seed.ref("users:students").first(5))
end
