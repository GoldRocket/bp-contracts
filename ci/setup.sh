#!/bin/bash

source ./ci/common.sh

log "Installing global dependencies..."
npm install -g yarn

log "Running 'yarn'..."
yarn config set cache-folder /builds/BlitzPick/bp-contracts/.yarn
yarn
elapsed
