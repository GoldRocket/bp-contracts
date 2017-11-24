#!/bin/bash

source ./ci/common.sh

log "Running 'yarn'..."
yarn config set cache-folder /builds/dacarley/bp-contracts/.yarn
yarn
elapsed
