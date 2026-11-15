# frozen_string_literal: true

# Framework for the Canvas battery seed loader (loaded by seed.rb inside `rails runner`).
#
#   Seed.step("name") { ... }   one atomic, marker-guarded unit of work (a DB transaction
#                               unless tx: false). A finished step is recorded in the
#                               n8n_seed_steps table together with the fixtures / tokens /
#                               refs it produced, so a re-run skips it and still knows
#                               everything it created.
#   Seed.fixture(:courseId, 5)  value published under canvas.fixtures.<name>
#   Seed.token(:teacher, "..")  value published under canvas.tokens.<persona>
#   Seed.set_ref / Seed.ref     internal cross-step lookups (ids, id lists)
#   Seed.rng("label")           deterministic Random derived from the fixed seed + label

require "json"
require "zlib"
require "net/http"
require "stringio"

module Seed
  RNG_SEED = 20_261_115
  TABLE = "public.n8n_seed_steps" # Canvas (switchman) runs with an empty search_path
  BASE_URL = ENV.fetch("SEED_CANVAS_URL", "http://localhost:3000")
  PASSWORD = "BatteryPass123!"

  class NullNotifier
    def send_notification(*)
      []
    end
  end

  # With no notification found, BroadcastPolicy returns before computing recipient lists.
  class NullNotificationFinder
    def by_name(_name)
      nil
    end
    alias_method :find_by_name, :by_name
  end

  class << self
    attr_reader :fx, :tokens, :refs

    def conn
      ActiveRecord::Base.connection
    end

    def flag?(name)
      !ENV[name].to_s.strip.empty?
    end

    # seed.rb loads every phase file (later phases reuse helpers defined in earlier ones) but
    # only the files selected by SEED_FILES are "active": steps in inactive files are no-ops.
    attr_accessor :active

    def active?
      @active != false
    end

    def setup!
      $stdout.sync = true
      conn.execute(<<~SQL.squish)
        CREATE TABLE IF NOT EXISTS #{TABLE} (
          name varchar(255) PRIMARY KEY,
          data text NOT NULL,
          seconds double precision,
          finished_at timestamp NOT NULL DEFAULT now()
        )
      SQL
      @real_notifier = BroadcastPolicy.notifier
      @real_finder = BroadcastPolicy.notification_finder
      @null_notifier = NullNotifier.new
      @null_finder = NullNotificationFinder.new
      BroadcastPolicy.notifier = @null_notifier
      BroadcastPolicy.notification_finder = @null_finder
      Rails.logger.level = :warn if Rails.logger.respond_to?(:level=)
      # audio/video uploads would otherwise queue Kaltura jobs (no media server locally); the
      # hook runs after commit, so the switch stays on for the whole process
      Attachment.instance_variable_set(:@skip_media_object_creation, true)
      @t0 = Time.now
      @now = Time.zone.now.change(min: 0, sec: 0)
      queue_background_work!
      load_state
    end

    # Background work. Outside production Canvas runs every `delay_if_production` job inline,
    # which for a bulk load means e.g. a whole-course grade recalculation per saved record.
    # The loader queues them like production does (so singleton/strand jobs coalesce), but
    # into its own queue: the canvas-jobs container never sees them, and Seed.drain_jobs works
    # them off in this process, where notifications are silenced. (Jobs created by the REST
    # calls the loader makes - SIS imports, exports, migrations - still go to canvas-jobs.)
    QUEUE = "n8n_seed"

    def queue_background_work!
      return if flag?("SEED_SYNC_JOBS")

      Delayed::Settings.queue = QUEUE
      Delayed::Job.singleton_class.prepend(SkipNoopJobs)
      CanvasDelayedMessageSending.module_eval do
        def delay_if_production(sender: nil, **kwargs)
          sender ||= __calculate_sender_for_delay
          delay(sender:, **kwargs.merge(synchronous: false))
        end
      end
    end

    # Jobs that are pure overhead for a bulk load: no LTI asset processors exist, and module
    # progressions are evaluated explicitly once the modules are in place (08).
    SKIPPED_JOBS = %w[
      Lti::AssetProcessorNotifier.notify_asset_processors
      Course#resubmission_for
      Assignment#multiple_module_actions
      Submission#context_module_action
      Assignment#recalculate_module_progressions
      Quizzes::Quiz#recalculate_module_progressions
      DiscussionEntry#context_module_action
      Lti::AssetProcessorDiscussionNotifier.notify_asset_processors_of_discussion
      MediaObject#retrieve_details_ensure_codecs
      MediaObject.create_if_id_exists
      Submission#update_body_word_count
    ].freeze # (MediaObject jobs call Kaltura, which is not configured locally; word counts are computed lazily)

    module SkipNoopJobs
      def enqueue(object, **opts)
        name = object.respond_to?(:display_name) ? object.display_name : nil
        return nil if name && SKIPPED_JOBS.include?(name)

        case name
        when "Enrollment.recompute_final_score"
          # per-student grade recalculations collapse into one whole-course singleton job
          return Seed.queue_course_grades(object.args[1])
        when "Course#recompute_student_scores_without_send_later"
          return Seed.queue_course_grades(object.object.id) unless opts[:singleton]
        when "Assignment#update_submissions", "SubAssignment#update_submissions"
          # re-saves every submission after a points/grading-type change; a brand-new
          # assignment has nothing to re-save
          return nil if object.object.saved_change_to_id?
        when "ConversationMessage#create_stream_items"
          return nil unless Seed.vip_user?(object.object.author_id)
        when "LatePolicyApplicator#process"
          # one late-policy pass per course instead of one job per touched assignment
          if opts[:singleton].to_s.include?(":Assignment:")
            return Seed.queue_course_late_policy(object.object.instance_variable_get(:@course))
          end
        when "Submission#generate_stream_items", "AssessmentRequest#create_stream_items"
          return nil unless Seed.vip_user?(object.object.user_id)
        when "SubmissionComment#create_stream_items"
          return nil unless Seed.vip_user?(object.object.author_id)
        when "DiscussionEntry#create_stream_items"
          # the topic's own stream item still exists for everyone; per-reply refreshes of it
          # are only done for replies written by the personas
          return nil unless Seed.vip_user?(object.object.user_id)
        end
        super
      end
    end

    def queue_course_grades(course_id)
      @grade_jobs_queued ||= {}
      return nil if @grade_jobs_queued[course_id]

      @grade_jobs_queued[course_id] = true
      course = (@grade_courses ||= {})[course_id] ||= Course.find(course_id)
      Delayed::Job.enqueue(Delayed::PerformableMethod.new(course, :recompute_student_scores_without_send_later, args: [nil]),
                           singleton: "recompute_student_scores:#{course.global_id}", max_attempts: 10)
    end

    def queue_course_late_policy(course)
      @late_jobs_queued ||= {}
      return nil if course.nil? || @late_jobs_queued[course.id]

      @late_jobs_queued[course.id] = true
      LatePolicyApplicator.for_course(course)
    end

    # Activity-stream items for submissions / comments / peer reviews are only generated for
    # the personas; for everyone else those jobs are skipped.
    VIP_KEYS = %w[teacher ta student student2 observer designer subaccountAdmin teacher2].freeze

    def vip_user?(user_id)
      @vip ||= VIP_KEYS.filter_map { |k| @refs["user:#{k}"] }.to_h { |i| [i, true] }
      @vip[user_id]
    end

    def pending_jobs
      Delayed::Job.where(queue: QUEUE, run_at: ..(Time.now.utc + 10.seconds)).count
    end

    # Work the loader's own job queue off until it is empty.
    def drain_jobs(label = "jobs", timeout: 1200)
      t = Time.now
      ran = 0
      tally = Hash.new { |h, k| h[k] = [0, 0.0] }
      worker = Delayed::Worker.new
      name = "n8n-seed:#{Process.pid}"
      loop do
        while (job = Delayed::Job.get_and_lock_next_available(name, QUEUE, 0, Delayed::MAX_PRIORITY))
          jt = Time.now
          worker.perform(job)
          tally[job.tag][0] += 1
          tally[job.tag][1] += Time.now - jt
          ran += 1
        end
        left = pending_jobs
        break if left.zero?
        raise "timed out draining jobs (#{left} left)" if Time.now - t > timeout

        sleep 1
      end
      return if ran.zero?

      log format("drained %s: ran %d jobs in %.1fs (failed jobs so far: %d)", label, ran, Time.now - t, Delayed::Job::Failed.count)
      tally.sort_by { |_, (_, secs)| -secs }.first(6).each { |tag, (n, secs)| log format("        %5d x %-60s %6.1fs", n, tag, secs) }
    end

    # Reference "now" for all generated dates (start of the current hour).
    attr_reader :now

    def days(n)
      @now + n.days
    end

    def load_state
      @fx = {}
      @tokens = {}
      @refs = {}
      @done = {}
      conn.select_rows("SELECT name, data FROM #{TABLE} ORDER BY finished_at, name").each do |name, data|
        d = JSON.parse(data)
        @done[name] = true
        @fx.merge!(d["fixtures"] || {})
        @tokens.merge!(d["tokens"] || {})
        @refs.merge!(d["refs"] || {})
      end
    end

    def log(msg)
      puts format("[seed %6.1fs] %s", Time.now - @t0, msg)
    end

    def only
      @only ||= ENV["SEED_ONLY"].to_s.split(",").map(&:strip).reject(&:empty?)
    end

    def selected?(name)
      only.empty? || only.any? { |pat| name == pat || name.start_with?("#{pat}.") || File.fnmatch(pat, name) }
    end

    # SEED_FORCE=step.name re-runs a finished step (only sensible for idempotent steps)
    def force?(name)
      @force ||= ENV["SEED_FORCE"].to_s.split(",").map(&:strip).reject(&:empty?)
      @force.include?(name)
    end

    def done?(name)
      @done[name]
    end

    # One atomic unit of work. The marker row is written in the same transaction as the
    # data, so a step either happened completely (and is skipped next time) or not at all.
    def step(name, tx: true)
      return unless @active != false && selected?(name)

      if @done[name] && !force?(name)
        log "skip  #{name} (already done)"
        return
      end
      load_state # pick up refs written by a loader process running in parallel
      log "start #{name}"
      @grade_jobs_queued = {}
      @late_jobs_queued = {}
      @vip = nil
      @cur = { "fixtures" => {}, "tokens" => {}, "refs" => {} }
      t = Time.now
      body = lambda do |*|
        yield
        conn.execute(ActiveRecord::Base.sanitize_sql_array(
                       ["INSERT INTO #{TABLE} (name, data, seconds) VALUES (?, ?, ?) " \
                        "ON CONFLICT (name) DO UPDATE SET data = EXCLUDED.data, seconds = EXCLUDED.seconds, finished_at = now()",
                        name, @cur.to_json, Time.now - t]
                     ))
      end
      attempts = 0
      begin
        attempts += 1
        if tx
          ActiveRecord::Base.transaction(&body)
        else
          body.call
        end
      rescue ActiveRecord::Deadlocked, ActiveRecord::LockWaitTimeout => e
        # two loader processes run in parallel (see run.sh); a step is atomic, so retry it
        raise unless tx && attempts < 4

        log "retry #{name} after #{e.class.name.demodulize} (attempt #{attempts})"
        @cur = { "fixtures" => {}, "tokens" => {}, "refs" => {} }
        @grade_jobs_queued = {}
        @late_jobs_queued = {}
        load_state
        sleep attempts
        retry
      rescue Exception => e # rubocop:disable Lint/RescueException
        # roll the in-memory view back to what is persisted
        load_state
        log "FAIL  #{name}: #{e.class}: #{e.message.to_s[0, 600]}"
        (e.backtrace || []).select { |l| l.include?("n8n-seed") || l.include?("/usr/src/app/app") || l.include?("/usr/src/app/lib") }.first(12).each { |l| puts "        #{l}" }
        raise
      end
      @done[name] = true
      @cur = nil
      log format("done  %s (%.1fs)", name, Time.now - t)
    end

    def fixture(key, value)
      raise "fixture outside step" unless @cur

      @fx[key.to_s] = value
      @cur["fixtures"][key.to_s] = value
    end

    def token(persona, value)
      raise "token outside step" unless @cur

      @tokens[persona.to_s] = value
      @cur["tokens"][persona.to_s] = value
    end

    def set_ref(key, value)
      raise "ref outside step" unless @cur

      @refs[key.to_s] = value
      @cur["refs"][key.to_s] = value
    end

    def ref(key)
      @refs.fetch(key.to_s) { raise "seed ref #{key} not set (did an earlier step run?)" }
    end

    def ref?(key)
      @refs.key?(key.to_s)
    end

    def rng(label)
      Random.new(RNG_SEED ^ Zlib.crc32(label.to_s))
    end

    # Notifications are silenced by default (hundreds of users x thousands of events would
    # bloat the messages table); Seed.loud { } lets a block through the real pipeline so a
    # realistic sample of Message rows exists for the CommMessages API.
    def loud
      BroadcastPolicy.notifier = @real_notifier
      BroadcastPolicy.notification_finder = @real_finder
      yield
    ensure
      BroadcastPolicy.notifier = @null_notifier
      BroadcastPolicy.notification_finder = @null_finder
    end

    # Create/modify many assignments (or overrides) in a course without queueing one
    # due-date/grade recomputation per record; a single recompute runs when the block ends.
    def bulk_assignments(course, update_grades: true)
      result = Assignment.suspend_due_date_caching { yield }
      conn.after_transaction_commit do
        SubmissionLifecycleManager.recompute_course(course, run_immediately: true, update_grades:)
      end
      result
    end

    # ---- record lookups -------------------------------------------------------------
    def root
      @root ||= Account.default
    end

    def admin
      @admin ||= User.find(1)
    end

    def user(key)
      User.find(ref("user:#{key}"))
    end

    def users(key)
      ids = ref("users:#{key}")
      by_id = User.where(id: ids).index_by(&:id)
      ids.map { |i| by_id[i] }
    end

    def course(key)
      Course.find(ref("course:#{key}"))
    end

    def account(key)
      Account.find(ref("account:#{key}"))
    end

    def term(key)
      EnrollmentTerm.find(ref("term:#{key}"))
    end

    # ---- HTTP API ---------------------------------------------------------------------
    # Returns [status, parsed_json_or_body, headers]
    def api(method, path, token: nil, params: nil, json: nil, multipart: nil, raw: nil, content_type: nil)
      token ||= ref("token:seed_admin")
      uri = URI.join(BASE_URL, path)
      if params && %i[get delete].include?(method)
        q = URI.encode_www_form(flatten_params(params))
        uri.query = [uri.query, q].compact.join("&")
      end
      klass = { get: Net::HTTP::Get, post: Net::HTTP::Post, put: Net::HTTP::Put, delete: Net::HTTP::Delete }.fetch(method)
      req = klass.new(uri)
      req["Authorization"] = "Bearer #{token}"
      if json
        req["Content-Type"] = "application/json"
        req.body = json.to_json
      elsif multipart
        req.set_form(multipart, "multipart/form-data")
      elsif raw
        req["Content-Type"] = content_type || "application/octet-stream"
        req.body = raw
      elsif params && !%i[get delete].include?(method)
        req.set_form_data(flatten_params(params).to_h { |k, v| [k, v] }) if flatten_params(params).map(&:first).uniq.size == flatten_params(params).size
        req.body = URI.encode_www_form(flatten_params(params)) unless req.body
        req["Content-Type"] ||= "application/x-www-form-urlencoded"
      end
      res = Net::HTTP.start(uri.host, uri.port, read_timeout: 180, open_timeout: 15) { |h| h.request(req) }
      body = res.body.to_s
      parsed = begin
        JSON.parse(body.sub(/\Awhile\(1\);/, ""))
      rescue JSON::ParserError
        body
      end
      [res.code.to_i, parsed, res]
    end

    def api!(method, path, **)
      code, body, res = api(method, path, **)
      raise "API #{method.upcase} #{path} -> #{code}: #{body.to_s[0, 500]}" unless (200..299).cover?(code)

      [body, res]
    end

    def flatten_params(params, prefix = nil)
      out = []
      params.each do |k, v|
        key = prefix ? "#{prefix}[#{k}]" : k.to_s
        case v
        when Hash then out.concat(flatten_params(v, key))
        when Array then v.each { |x| x.is_a?(Hash) ? out.concat(flatten_params(x, "#{key}[]")) : out << ["#{key}[]", x.to_s] }
        when nil then next
        else out << [key, v.to_s]
        end
      end
      out
    end

    # Poll until block returns truthy (or timeout). Returns the value.
    def wait_for(label, timeout: 600, interval: 2)
      t = Time.now
      loop do
        v = yield
        return v if v
        raise "timed out waiting for #{label}" if Time.now - t > timeout

        sleep interval
      end
    end

    # ---- attachments ------------------------------------------------------------------
    def upload(context:, name:, content:, content_type: "text/plain", folder: nil, user: nil, **attrs)
      att = Attachment.new(context:, display_name: name, **attrs)
      att.folder = folder if folder
      att.user = user if user
      att.uploaded_data = uploaded_io(content, content_type, name)
      att.save!
      att
    end

    def uploaded_io(content, content_type, name)
      io = StringIO.new(content.dup.force_encoding("BINARY"))
      io.define_singleton_method(:original_filename) { name }
      io.define_singleton_method(:content_type) { content_type }
      io
    end
  end

  # ---- deterministic text ---------------------------------------------------------------
  module Text
    WORDS = %w[
      analysis cell membrane energy system model evidence data graph report essay draft review
      chapter unit lab field notes summary question response reading practice problem set project
      group peer rubric outcome standard theme source primary secondary argument claim reasoning
      photosynthesis ecosystem variable hypothesis control sample revision reflection journal
      vocabulary timeline map equation function ratio fraction theorem proof sequence pattern
      culture history poetry narrative character setting conflict resolution experiment observation
    ].freeze
    UNICODE_SNIPPETS = [
      "Ünïcödé façade naïve coöperate", "日本語のテキスト", "中文内容测试", "한국어 텍스트", "Текст на русском",
      "نص عربي للاختبار", "טקסט בעברית", "Ελληνικό κείμενο", "हिन्दी पाठ", "ข้อความภาษาไทย",
      "emoji 🎓📚✏️🧪🌍", "math ∑∫√∞≠≤≥ π≈3.14159", "quotes “smart” ‘single’ «guillemets»",
      "zero​width & <angle> \"quotes\" 'apos'", "Tiếng Việt có dấu", "Zażółć gęślą jaźń"
    ].freeze

    module_function

    def words(rng, n)
      Array.new(n) { WORDS[rng.rand(WORDS.size)] }
    end

    def sentence(rng, min = 5, max = 14)
      w = words(rng, rng.rand(min..max))
      "#{w.join(" ").capitalize}#{[".", ".", ".", "?", "!"][rng.rand(5)]}"
    end

    def paragraph(rng, sentences = nil)
      Array.new(sentences || rng.rand(2..6)) { sentence(rng) }.join(" ")
    end

    def title(rng, min = 2, max = 5)
      words(rng, rng.rand(min..max)).map(&:capitalize).join(" ")
    end

    def unicode(rng)
      UNICODE_SNIPPETS[rng.rand(UNICODE_SNIPPETS.size)]
    end

    def html(rng, paragraphs: nil, rich: false)
      n = paragraphs || rng.rand(1..4)
      parts = Array.new(n) { "<p>#{paragraph(rng)}</p>" }
      if rich
        parts << "<h2>#{title(rng)}</h2>"
        parts << "<ul>#{Array.new(rng.rand(2..5)) { "<li>#{sentence(rng, 3, 8)}</li>" }.join}</ul>"
        parts << "<table border=\"1\"><thead><tr><th>Term</th><th>Definition</th><th>Pts</th></tr></thead><tbody>" \
                 "#{Array.new(rng.rand(2..4)) { |i| "<tr><td>#{title(rng, 1, 2)}</td><td>#{sentence(rng, 3, 7)}</td><td>#{i * 2.5}</td></tr>" }.join}</tbody></table>"
        parts << "<p><a href=\"https://example.com/resources/#{rng.rand(1000)}?q=a%20b&amp;x=1\">External link</a> " \
                 "&amp; <strong>bold</strong> <em>#{unicode(rng)}</em></p>"
        parts << "<p><img src=\"https://example.com/images/diagram-#{rng.rand(50)}.png\" alt=\"Diagram: #{title(rng)}\" width=\"320\" height=\"200\"></p>"
        parts << "<blockquote>#{sentence(rng)}</blockquote><pre>x = #{rng.rand(100)} &lt; y &amp;&amp; z &gt; 0</pre>"
      end
      parts.join("\n")
    end
  end

  # ---- tiny file payloads -------------------------------------------------------------------
  module Files
    PNG_1X1 = ["89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63f8cfc0f01f00050001ff6dd7a8640000000049454e44ae426082"].pack("H*").freeze
    GIF_1X1 = ["47494638396101000100800000ffffff00000021f90401000000002c00000000010001000002024401003b"].pack("H*").freeze
    PDF_MIN = "%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" \
              "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"

    module_function

    # [content, content_type] for an extension, unique per (rng) so files are not all de-duplicated
    def payload(ext, rng)
      case ext
      when "png" then [PNG_1X1 + rng.bytes(8), "image/png"]
      when "gif" then [GIF_1X1, "image/gif"]
      when "pdf" then [PDF_MIN + "%#{rng.rand(1_000_000)}\n", "application/pdf"]
      when "csv" then ["id,name,score\n#{Array.new(rng.rand(3..12)) { |i| "#{i},#{Text.title(rng, 1, 2)},#{rng.rand(100)}" }.join("\n")}\n", "text/csv"]
      when "json" then [{ id: rng.rand(10_000), title: Text.title(rng), tags: Text.words(rng, 3) }.to_json, "application/json"]
      when "html", "htm" then ["<!doctype html><html><body>#{Text.html(rng, rich: true)}</body></html>", "text/html"]
      when "md" then ["# #{Text.title(rng)}\n\n#{Text.paragraph(rng)}\n\n- #{Text.sentence(rng)}\n", "text/markdown"]
      when "svg" then ["<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"#{rng.rand(10..90)}\" height=\"40\"><circle cx=\"20\" cy=\"20\" r=\"#{rng.rand(3..18)}\"/></svg>", "image/svg+xml"]
      when "docx" then ["PK\u0003\u0004 fake docx #{Text.paragraph(rng)}", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
      when "xlsx" then ["PK\u0003\u0004 fake xlsx #{rng.rand(1_000_000)}", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]
      when "pptx" then ["PK\u0003\u0004 fake pptx #{rng.rand(1_000_000)}", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]
      when "zip" then ["PK\u0005\u0006#{"\u0000" * 18}", "application/zip"]
      when "mp3" then ["ID3\u0003\u0000\u0000\u0000\u0000\u0000\u0000#{rng.bytes(64)}", "audio/mpeg"]
      when "mp4" then ["\u0000\u0000\u0000\u0018ftypmp42#{rng.bytes(64)}", "video/mp4"]
      when "py" then ["# #{Text.title(rng)}\nprint(#{rng.rand(100)} + #{rng.rand(100)})\n", "text/x-python"]
      when "" then ["no extension #{Text.sentence(rng)}\n", "application/octet-stream"]
      else ["#{Text.paragraph(rng)}\n#{Text.unicode(rng)}\n", "text/plain"]
      end
    end
  end
end
