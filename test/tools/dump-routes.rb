# Dump the route table of the running Canvas into test/fixtures/canvas-routes.json, the
# fixture behind the unit route audit (test/unit/routes.test.ts) and test/ROUTE_GAPS.md.
# Run it again whenever the local Canvas is rebuilt from a newer canvas-lms, so the audit
# checks the node against the Canvas the battery runs on:
#
#   docker cp test/tools/dump-routes.rb canvas-web:/tmp/dump-routes.rb
#   docker exec -e SOURCE="instructure/canvas-lms prod @ <commit> (<release>)" canvas-web \
#     bundle exec rails runner /tmp/dump-routes.rb > test/fixtures/canvas-routes.json
#   npm test && npx tsx test/tools/route-gaps.ts
#
# (the commit is `git -C <canvas-lms checkout> rev-parse --short=8 HEAD`; the release is the
# newest `stable/...` branch it belongs to). Every route under /api/ is listed with its HTTP
# verb, its path, the controller action it reaches and whether Instructure documents it.
require "json"

# "documented" = the comment block right above the action carries @API and no @internal.
documented = {}
Dir[Rails.root.join("{app,gems/plugins/*/app}/controllers/**/*_controller.rb").to_s].each do |file|
  controller = file.sub(%r{.*/controllers/}, "").sub(/_controller\.rb\z/, "")
  comment = []
  File.foreach(file) do |line|
    if line.match?(/^\s*#/)
      comment << line
    elsif (action = line[/^\s*def\s+([a-z_0-9]+[?!]?)/, 1])
      text = comment.join
      documented["#{controller}##{action}"] = text.include?("@API") && !text.include?("@internal")
      comment = []
    elsif !line.strip.empty?
      comment = []
    end
  end
end

routes = Rails.application.routes.routes.filter_map do |route|
  path = route.path.spec.to_s.sub("(.:format)", "")
  verb = route.verb.to_s
  next unless path.start_with?("/api/") && !verb.empty? && route.defaults[:controller]

  to = "#{route.defaults[:controller]}##{route.defaults[:action]}"
  { "verb" => verb, "path" => path, "to" => to, "documented" => documented[to] == true }
end

data = {
  "source" => ENV.fetch("SOURCE", "instructure/canvas-lms (commit not stated)"),
  # Where two routes share verb and path, Rails serves the one defined first.
  "routes" => routes.uniq { |route| [route["verb"], route["path"]] }.sort_by { |route| [route["path"], route["verb"]] },
  "documentedNote" => "documented = the controller action carries an @API comment in the Canvas source " \
                      "(and is not marked @internal); these are the endpoints Instructure publishes in its API docs."
}
$stdout.puts JSON.pretty_generate(data, indent: "")
