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
  TABLE = "n8n_seed_steps"
  BASE_URL = ENV.fetch("SEED_CANVAS_URL", "http://localhost:3000")
  PASSWORD = "BatteryPass123!"

  class NullNotifier
    def send_notification(*)
      []
    end
  end

  class << self
    attr_reader :fx, :tokens, :refs

    def conn
      ActiveRecord::Base.connection
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
      @null_notifier = NullNotifier.new
      BroadcastPolicy.notifier = @null_notifier
      Rails.logger.level = :warn if Rails.logger.respond_to?(:level=)
      @t0 = Time.now
      @now = Time.zone.now.change(min: 0, sec: 0)
      load_state
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

    def done?(name)
      @done[name]
    end

    def step(name, tx: true)
      return unless selected?(name)

      if @done[name]
        log "skip  #{name} (already done)"
        return
      end
      log "start #{name}"
      @cur = { "fixtures" => {}, "tokens" => {}, "refs" => {} }
      t = Time.now
      body = lambda do
        yield
        conn.execute(ActiveRecord::Base.sanitize_sql_array(
                       ["INSERT INTO #{TABLE} (name, data, seconds) VALUES (?, ?, ?)", name, @cur.to_json, Time.now - t]
                     ))
      end
      begin
        if tx
          ActiveRecord::Base.transaction(&body)
        else
          body.call
        end
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
      yield
    ensure
      BroadcastPolicy.notifier = @null_notifier
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
      io = StringIO.new(content.dup.force_encoding("BINARY"))
      data = Canvas::UploadedFile.new(io, content_type, name) rescue nil # rubocop:disable Style/RescueModifier
      att = Attachment.new(context:, display_name: name, filename: name, content_type:, **attrs)
      att.folder = folder if folder
      att.user = user if user
      att.uploaded_data = data || uploaded_io(content, content_type, name)
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
