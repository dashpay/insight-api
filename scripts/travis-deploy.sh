#! /bin/sh

set -xe

# Ensure the tag matches the one in package.json, otherwise abort.
PACKAGE_TAG=v"$(jq -r .version package.json)"
if [[ "$PACKAGE_TAG" != "$TRAVIS_TAG" ]]; then
  echo "Travis tag (\"$TRAVIS_TAG\") is not equal to package.json tag (\"$PACKAGE_TAG\"). Please push a correct tag and try again."
  exit 1
fi

# Publish the npm module
npm publish

IMAGE_NAME="dashpay/insight-api"

MAJOR_VERSION="$( cut -d '.' -f 1 <<< "$PACKAGE_TAG" )"

# Build Docker image
docker build -t "${IMAGE_NAME}:latest" \
             -t "${IMAGE_NAME}:${PACKAGE_TAG}" \
             --build-arg "MAJOR_VERSION=${MAJOR_VERSION}" \
             --build-arg "VERSION=${PACKAGE_TAG}" \
             .

# Login to Docker Hub
echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin

# Push images to the registry
docker push "${IMAGE_NAME}:latest"
docker push "${IMAGE_NAME}:${PACKAGE_TAG}"
