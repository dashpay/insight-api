FROM node:8-alpine

RUN apk add --update --no-cache \
                            git \
                            libzmq \
                            zeromq-dev \
                            python \
                            make \
                            g++

WORKDIR /insight

# Copy dashcore-node
RUN git clone --branch master --single-branch --depth 1 https://github.com/dashevo/dashcore-node.git /insight

ARG VERSION

# Install npm packages
RUN npm ci

# Install Insight API module
RUN /insight/bin/dashcore-node install @dashevo/insight-api@${VERSION}

FROM node:8-alpine

LABEL maintainer="Dash Developers <dev@dash.org>"
LABEL description="Dockerised Insight API"

# Copy project files
COPY --from=0 /insight/ /insight

WORKDIR /insight

EXPOSE 3001

CMD ["/insight/bin/dashcore-node", "start"]
