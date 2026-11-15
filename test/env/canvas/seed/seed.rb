# frozen_string_literal: true

# Canvas battery seed loader. Run inside the Canvas app:
#   bundle exec rails runner /path/to/seed/seed.rb
# (see run.sh, which copies this directory into the container and merges the result into
# test/.state.json).
#
# Environment:
#   SEED_ONLY=accounts,users.personas   run only steps whose name matches (prefix / glob)
#   SEED_FILES="0[1-5]_*"                run only the steps of matching phase files
#   SEED_FORCE=step.name                re-run a finished (idempotent) step
#   SEED_NO_FIXTURES=1                  do not print the FIXTURES_JSON lines
#   SEED_NO_DRAIN=1                     do not work the loader's job queue off after each phase

dir = File.dirname(File.expand_path(__FILE__))
require File.join(dir, "lib.rb")
Seed.setup!
Seed.log "Canvas battery seed starting (#{Rails.env}, root account #{Seed.root.id} '#{Seed.root.name}')"

emit = lambda do
  next if Seed.flag?("SEED_NO_FIXTURES")

  Seed.load_state
  puts "FIXTURES_JSON=#{{ tokens: Seed.tokens, fixtures: Seed.fx }.to_json}"
end

# SEED_FILES="0[1-5]_*,13_*" limits which phase files run their steps (run.sh uses this to
# run independent phases in two processes at once). Every file is still loaded, because
# later phases reuse helper modules defined by earlier ones.
patterns = ENV["SEED_FILES"].to_s.split(",").map(&:strip).reject(&:empty?)
begin
  Dir[File.join(dir, "[0-9][0-9]_*.rb")].sort.each do |file|
    base = File.basename(file, ".rb")
    Seed.active = patterns.empty? || patterns.any? { |pat| File.fnmatch(pat, base) }
    load file
    next unless Seed.active?

    Seed.drain_jobs(base) unless Seed.flag?("SEED_NO_DRAIN")
    emit.call # run.sh merges this into test/.state.json after every phase
  end
  Seed.log "seed complete#{" (#{patterns.join(",")})" if patterns.any?}"
ensure
  emit.call
end
