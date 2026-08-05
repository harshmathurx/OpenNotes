/**
 * Templates extension — curated built-in templates.
 *
 * Each template ships with the whole extension: ids are stable (they back
 * slash-item and command ids), bodies lean on the engine's variable tokens
 * ({{title}}, {{date}}, {{date:FORMAT}}, {{time}}, {{datetime}}, {{cursor}})
 * and provide sensible placeholder structure so a note is useful the
 * moment it is inserted.
 */

/** A built-in, read-only template shipped with the extension. */
export interface BuiltinTemplate {
  id: string
  name: string
  description: string
  body: string
}

export const BUILTIN_TEMPLATES: readonly BuiltinTemplate[] = [
  {
    id: "meeting-notes",
    name: "Meeting notes",
    description: "Attendees, agenda, discussion, and action items",
    body: `# {{title}}

**Date:** {{date:dddd, MMMM D, YYYY}} · **Time:** {{time}}
**Attendees:**

## Agenda

1. {{cursor}}

## Notes

-

## Decisions

-

## Action items

- [ ]  —
`,
  },
  {
    id: "daily-journal",
    name: "Daily journal",
    description: "Intentions, log, and reflection for the day",
    body: `# {{date:dddd, MMMM D, YYYY}}

## Intentions

- Top priority:
- Also today:

## Log

- {{time}} — {{cursor}}

## Gratitude

1.
2.
3.

## Reflection

**Went well:**

**Tomorrow:**
`,
  },
  {
    id: "weekly-review",
    name: "Weekly review",
    description: "Week-in-review: wins, lessons, and next week's focus",
    body: `# Week of {{date:MMMM D, YYYY}}

## Wins

-

## In progress

- [ ]

## Lessons learned

-

## Metrics

-

## Next week

**Focus:** {{cursor}}

- [ ]
`,
  },
  {
    id: "project-brief",
    name: "Project brief",
    description: "Problem, goals, scope, and milestones for a project",
    body: `# Project brief: {{title}}

**Status:** Draft
**Owner:**
**Created:** {{date}}

## Problem

{{cursor}}

## Goals

-

## Non-goals

-

## Scope

## Milestones

- [ ]  — target:

## Open questions

-
`,
  },
  {
    id: "reading-notes",
    name: "Reading notes",
    description: "Source capture: key ideas, quotes, and takeaways",
    body: `# Reading: {{title}}

**Source:**
**Author:**
**Read on:** {{date}}

## Summary

{{cursor}}

## Key ideas

-

## Quotes

>

## My takeaways

-

## Related notes

-
`,
  },
  {
    id: "decision-log",
    name: "Decision log (ADR)",
    description: "Architecture decision record: context, options, outcome",
    body: `# ADR: {{title}}

**Date:** {{date}}
**Status:** Proposed

## Context

{{cursor}}

## Decision

## Options considered

1. **Option A** —
2. **Option B** —

## Consequences

**Positive:**

**Negative:**

## Follow-ups

- [ ]
`,
  },
  {
    id: "brainstorm",
    name: "Brainstorm",
    description: "Freeform ideation: spark, ideas, and next steps",
    body: `# Brainstorm: {{title}}

**When:** {{datetime}}

## Spark

{{cursor}}

## Ideas

1.
2.
3.

## Wild cards

-

## Shortlist

- [ ]

## Next steps

- [ ]
`,
  },
  {
    id: "book-summary",
    name: "Book summary",
    description: "Chapter-by-chapter summary with rating and notes",
    body: `# {{title}}

**Author:**
**Started:** {{date}}
**Rating:** /5

## One-sentence summary

{{cursor}}

## Chapter notes

### Chapter 1

-

## Favorite passages

>

## How I'll apply this

-

## Verdict

`,
  },
] as const
