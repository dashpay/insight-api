FROM node:16-alpine

RUN apk add --update --no-cache \
                            git \
                            curl \
                            libzmq \
                            zeromq-dev \
                            python3 \
                            make \
                            cmake \
                            g++

WORKDIR /insight

# Copy dashcore-node
RUN git clone --branch master --single-branch --depth 1 https://github.com/dashevo/dashcore-node.git .

# Copy config file
COPY dashcore-node.json .

ARG VERSION

# Install npm packages
RUN npm ci

# Install Insight API module
RUN bin/dashcore-node install @dashevo/insight-api@${VERSION}

FROM node:16-alpine

LABEL maintainer="Dash Developers <dev@dash.org>"
LABEL description="Dockerised Insight API"

WORKDIR /insight

# Copy project files
COPY --from=0 /insight/ .

EXPOSE 3001

CMD ["bin/dashcore-node", "start"]
