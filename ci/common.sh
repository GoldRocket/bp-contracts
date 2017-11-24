#!/bin/bash

set -e  # Exit immediately on any failure

TIMESTAMP=$(date +%s)

function color() {
    if [[ "$TERM" == "dumb" ]]; then
        return 0
    fi

    tput setaf $1
}

function reset() {
    if [[ "$TERM" == "dumb" ]]; then
        return 0
    fi

    if [[ "$OSTYPE" == "darwin"* ]]; then
        tput sgr0 # Back to default color
    else
        tput setaf 9 # Back to default color
    fi
}

function elapsed() {
    NEW_TIMESTAMP=$(date +%s)

    color 2 # Green
    echo $[NEW_TIMESTAMP-TIMESTAMP] seconds elapsed
    echo
    reset

    TIMESTAMP=$NEW_TIMESTAMP
}

function log() {
    color 2 # Green
    echo $1
    reset
}
