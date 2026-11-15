# Canvas LMS image for the n8n-nodes-canvas integration battery.
# Build context: a checkout of instructure/canvas-lms (branch `prod`).
# Extra context `extra`: a directory that may contain `ca.crt` (a corporate/proxy
# root CA to trust during the build); an empty directory is fine.
# Not named RUBY: rake reads $RUBY as the interpreter path when building native gems.
ARG RUBY_SERIES=3.4
FROM instructure/ruby-passenger:${RUBY_SERIES}-jammy

ARG RUBY_SERIES
ENV APP_HOME=/usr/src/app/
ENV RAILS_ENV=development
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8
ENV CANVAS_RAILS=8.0
ENV GEM_HOME=/home/docker/.gem/${RUBY_SERIES}
ENV PATH=${APP_HOME}bin:${GEM_HOME}/bin:${PATH}
ENV BUNDLE_APP_CONFIG=/home/docker/.bundle

WORKDIR ${APP_HOME}
USER root

RUN --mount=type=bind,from=extra,target=/extra \
    if [ -f /extra/ca.crt ]; then \
      cp /extra/ca.crt /usr/local/share/ca-certificates/extra-ca.crt && update-ca-certificates; \
    fi

RUN apt-get update -qq \
  && apt-get install -qqy --no-install-recommends \
       libxmlsec1-dev python3-lxml python-is-python3 libicu-dev libidn11-dev \
       libpq-dev postgresql-client-14 tzdata unzip git build-essential \
  && rm -rf /var/lib/apt/lists/*

RUN gem install bundler --no-document -v 2.5.10 \
  && mkdir -p /home/docker/.bundle ${GEM_HOME} \
  && chown -R docker:docker /home/docker

COPY --chown=docker:docker . ${APP_HOME}
USER docker

# Bundler/Net::HTTP only tunnel through a proxy reliably when http_proxy is set too.
RUN if [ -n "${https_proxy:-}" ]; then export http_proxy="$https_proxy"; fi; \
    bundle install --jobs 4

RUN cp docker-compose/config/*.yml config/ \
  && sed -i 's#redis://redis#redis://127.0.0.1:6379#' config/redis.yml \
  && mkdir -p log tmp/pids tmp/files public/dist
