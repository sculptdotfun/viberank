#!/bin/bash

# Claude Code usage submission script
# Submits cc usage data once per day with cleanup and duplicate prevention
# Usage: submit-ccusage.sh <email@company.com>

set -e

# Check if email argument is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <email@company.com>"
    echo "Example: $0 john.doe@company.com"
    exit 1
fi

USER_EMAIL="$1"

# Configuration
SERVER_URL="http://98.81.226.83/api/submit"
LOCK_FILE="/tmp/ccusage-submitted-$(date +%Y-%m-%d)"
LOG_FILE="/tmp/ccusage-submit.log"
ERROR_LOG="/tmp/ccusage-submit-error.log"
CC_DATA_FILE="/tmp/cc-usage-$(date +%Y%m%d-%H%M%S).json"

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

# Generate cc.json data using ccusage command
log_message "Generating Claude Code usage data..."
if ! command -v ccusage &> /dev/null; then
    log_error "ccusage command not found. Please install with: npm install -g ccusage"
    exit 1
fi

# Generate usage data to temp file
if ! ccusage > "$CC_DATA_FILE" 2>> "$ERROR_LOG"; then
    log_error "Failed to generate Claude Code usage data"
    exit 1
fi

log_message "Generated usage data at: $CC_DATA_FILE"

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
    
    # Clean up temp file after successful submission
    rm -f "$CC_DATA_FILE"
    log_message "Cleaned up temporary data file"
    
else
    log_error "Failed to submit Claude Code usage data"
    # Clean up temp file on failure too
    rm -f "$CC_DATA_FILE"
    exit 1
fi

# Cleanup old files
cleanup_old_files

log_message "Script completed successfully"