# Viberank Data Validation System

This document explains how viberank validates submissions to ensure fair competition and data integrity.

## Overview

The validation system has two levels:
1. **Hard Rejection** - Data that is clearly invalid or tampered with
2. **Soft Flagging** - Data that is unusual but potentially legitimate

## Hard Rejection (Submission Fails)

These validations will cause the submission to be rejected with an error message:

### 1. Token Math Verification
```javascript
inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens = totalTokens
```
- Must match within 1 token (floating point tolerance)
- Prevents manual data tampering
- Ensures data comes from official ccusage tool

### 2. Negative Values
- No negative values allowed anywhere in the data
- Applies to all token counts and costs

### 3. Date Validation
- Dates must be in YYYY-MM-DD format
- No future dates allowed
- Prevents accidental or intentional date manipulation

### 4. Extreme Values
- Total cost > $1,825,000 (365 days × $5,000/day)
- Total tokens > 18.25 billion (365 days × 50M/day)
- Cost per token ratio outside 0.000001 to 0.1 range

### 5. Data Consistency
- Daily token sums must match daily totals
- Each day's data is validated independently

## Soft Flagging (Hidden from Leaderboard)

These submissions are accepted but flagged for review:

### 1. High Daily Usage
- Daily cost > $25,000
- Daily tokens > 250 million
- These are possible but rare (limits increased 5x to reduce false positives)

### 2. High Average Usage
- Average daily cost > $12,500
- Indicates sustained high usage

### 3. Flagging Behavior
- Submissions are stored but marked with `flaggedForReview: true`
- Includes `flagReasons` array explaining why it was flagged
- Hidden from main leaderboard by default
- Can be shown with `includeFlagged: true` parameter

## Multiple Submissions Handling

When users submit overlapping date ranges:

1. **Find Overlap**: Check if any existing submission has overlapping dates
2. **Merge Daily Data**: 
   - Keep days from old submission that aren't in new one
   - Update days that exist in both
   - Add new days from new submission
3. **Recalculate Totals**: Sum all tokens and costs from merged daily data
4. **Update Date Range**: Expand to cover all dates
5. **Preserve History**: No data is lost in the merge

## Example Validation Flow

```javascript
// 1. Check token math
if (Math.abs(calculatedTotal - providedTotal) > 1) {
  throw Error("Token totals don't match");
}

// 2. Check each day
for (const day of dailyData) {
  if (day.cost < 0) throw Error("Negative values not allowed");
  if (day.cost > 5000) flag("High daily cost");
  if (new Date(day.date) > today) throw Error("Future date");
}

// 3. Check totals
if (costPerToken < 0.000001) throw Error("Unrealistic cost/token");

// 4. If flagged, still accept but mark
if (flagged) {
  submission.flaggedForReview = true;
  submission.flagReasons = reasons;
}
```

## Why These Limits?

- **$5,000/day**: Based on heavy commercial usage patterns
- **50M tokens/day**: Roughly 100 million words of processing
- **Cost/token ratios**: Based on Claude's actual pricing
- **Future dates**: Prevents pre-dating submissions

## Future Improvements

- Admin dashboard to review flagged submissions
- Auto-verification for consistent high-usage accounts
- User appeals process for false positives
- Dynamic limits based on historical data

## For Developers

If you're building tools that submit to viberank:

1. Use official ccusage tool for data generation
2. Don't modify the JSON structure
3. Submit data promptly (avoid batching months of data)
4. Contact us if you have legitimate high usage that gets flagged

## Questions?

If your legitimate submission is being flagged or rejected, please open an issue on GitHub with:
- The error message you received
- General description of your usage pattern
- Date range of your submission

We're committed to maintaining a fair and accurate leaderboard for the Claude Code community!