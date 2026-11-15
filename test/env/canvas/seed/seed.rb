# frozen_string_literal: true

# Canvas battery seed loader. Run inside the Canvas app:
#   bundle exec rails runner /path/to/seed/seed.rb
# (see run.sh, which copies this directory into the container and merges the result into
# test/.state.json).
#
# Environment:
#   SEED_ONLY=accounts,users.personas   run only steps whose name matches (prefix / glob)
#   SEED_NO_FIXTURES=1                  do not print the FIXTURES_JSON line

dir = File.dirname(File.expand_path(__FILE__))
require File.join(dir, "lib.rb")
Seed.setup!
Seed.log "Canvas battery seed starting (#{Rails.env}, root account #{Seed.root.id} '#{Seed.root.name}')"

emit = lambda do
  next if ENV["SEED_NO_FIXTURES"]

  Seed.load_state
  puts "FIXTURES_JSON=#{{ tokens: Seed.tokens, fixtures: Seed.fx }.to_json}"
end

begin
  Dir[File.join(dir, "[0-9][0-9]_*.rb")].sort.each do |file|
    load file
    emit.call # run.sh merges this into test/.state.json after every phase
  end
  Seed.log "seed complete"
ensure
  emit.call
end
