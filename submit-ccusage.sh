#!/bin/bash

# Claude Code usage submission script
# Submits cc usage data once per day with cleanup and duplicate prevention

set -e

# Configuration
SERVER_URL="http://98.81.226.83/api/submit"
LOCK_FILE="/tmp/ccusage-submitted-$(date +%Y-%m-%d)"
LOG_FILE="/tmp/ccusage-submit.log"
ERROR_LOG="/tmp/ccusage-submit-error.log"
CC_DATA_FILE="$HOME/.config/claude-code/cc.json"

# Function to log messages
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Function to log errors
log_error() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - ERROR: $1" | tee -a "$ERROR_LOG" >&2
}

# Cleanup old files (older than 7 days)
cleanup_old_files() {
    log_message "Cleaning up old files..."
    find /tmp -name "ccusage-submitted-*" -mtime +7 -delete 2>/dev/null || true
    find /tmp -name "ccusage-submit*.log" -mtime +7 -delete 2>/dev/null || true
    log_message "Cleanup completed"
}

# Check if already submitted today
if [ -f "$LOCK_FILE" ]; then
    log_message "Usage data already submitted today. Skipping..."
    cleanup_old_files
    exit 0
fi

# Check if cc.json exists
if [ ! -f "$CC_DATA_FILE" ]; then
    log_error "Claude Code data file not found: $CC_DATA_FILE"
    exit 1
fi

# Get user email from environment variable or prompt for input
if [ -z "$CC_USER_EMAIL" ]; then
    echo "Please enter your company email address:"
    read -r USER_EMAIL
    if [ -z "$USER_EMAIL" ]; then
        log_error "Email address is required"
        exit 1
    fi
else
    USER_EMAIL="$CC_USER_EMAIL"
fi

# Basic email validation
if [[ ! "$USER_EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
    log_error "Invalid email format: $USER_EMAIL"
    exit 1
fi

log_message "Starting Claude Code usage submission for $USER_EMAIL"

# Submit the data
if curl -X POST \
    -H "Content-Type: application/json" \
    -H "X-User-Email: $USER_EMAIL" \
    -H "X-CLI-Version: automated-v1.0" \
    --data @"$CC_DATA_FILE" \
    --max-time 30 \
    --silent \
    --show-error \
    --fail \
    "$SERVER_URL" >> "$LOG_FILE" 2>> "$ERROR_LOG"; then
    
    log_message "Successfully submitted Claude Code usage data"
    
    # Create lock file to prevent duplicate submissions
    touch "$LOCK_FILE"
    
    # Optional: Archive the submitted data
    ARCHIVE_DIR="$HOME/.config/claude-code/submitted"
    mkdir -p "$ARCHIVE_DIR"
    cp "$CC_DATA_FILE" "$ARCHIVE_DIR/cc-$(date +%Y-%m-%d-%H%M%S).json"
    log_message "Data archived to $ARCHIVE_DIR"
    
else
    log_error "Failed to submit Claude Code usage data"
    exit 1
fi

# Cleanup old files
cleanup_old_files

log_message "Script completed successfully"