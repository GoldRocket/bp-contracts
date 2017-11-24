#!/bin/bash

source ./ci/common.sh

log "Installing global dependencies..."
curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
apt-get update
apt-get install yarn
elapsed

log "Running 'yarn'..."
yarn config set cache-folder /builds/BlitzPick/bp-contracts/.yarn
yarn
elapsed
