# Quedamos — State Flows Reference

## Proposal States

```
                   ┌──────────────────┐
                   │      open        │ (created, accepting votes)
                   └───────┬──────────┘
                           │
              ┌────────────┼────────────┐
              ▼                         ▼
   ┌──────────────────┐     ┌──────────────────┐
   │    converted      │     │     closed        │
   │  (→ event created)│     │  (manually closed)│
   └──────────────────┘     └──────────────────┘
```

- `open` → `converted`: Creator converts to quedada (with date/time). Votes transfer to attendee statuses.
- `open` → `closed`: Creator manually closes. No event created.
- Only the **creator** can convert or close.
- Votes (`yes`/`no`) can be cast or changed while status is `open`.

## Event (Quedada) States

```
                   ┌──────────────────┐
                   │     pending      │ (created, awaiting responses)
                   └───────┬──────────┘
                           │
              ┌────────────┼────────────┐
              ▼                         ▼
   ┌──────────────────┐     ┌──────────────────┐
   │    confirmed      │     │    cancelled      │
   │ (all confirmed)   │     │ (creator cancels) │
   └────────┬─────────┘     └──────────────────┘
            │
            ▼ (someone declines)
   ┌──────────────────┐
   │     pending      │ (reverts)
   └──────────────────┘
```

- `pending` → `confirmed`: When ALL attendees have status `confirmed`.
- `confirmed` → `pending`: When ANY attendee changes to `declined`.
- `pending`/`confirmed` → `cancelled`: Creator manually cancels.
- Only the **creator** can cancel or delete.

## Attendee States

```
   ┌──────────┐     ┌──────────┐     ┌──────────┐
   │ pending  │ ──► │confirmed │ ◄──►│ declined │
   └──────────┘     └──────────┘     └──────────┘
```

- Created as `pending` (or `confirmed` if creator, or transferred from proposal vote).
- Can toggle between `confirmed` ↔ `declined` freely (unless past event).

## Proposal → Event Conversion

```
Proposal votes:
  yes  → EventAttendee status = confirmed (+ respondedAt set)
  no   → EventAttendee status = declined  (+ respondedAt set)

Non-voters (group members who didn't vote):
  → EventAttendee status = pending

Creator:
  → Always confirmed (regardless of vote)

After creating attendees:
  → Check if all confirmed → event.status = 'confirmed'
  → Otherwise → event.status = 'pending'
```

## Decision Table

| State               | Vote       | Convert | Close   | Confirm  | Decline    | Cancel  | Delete  | Edit    |
| ------------------- | ---------- | ------- | ------- | -------- | ---------- | ------- | ------- | ------- |
| Proposal: open      | Any member | Creator | Creator | -        | -          | -       | -       | Creator |
| Proposal: converted | -          | -       | -       | -        | -          | -       | -       | -       |
| Proposal: closed    | -          | -       | -       | -        | -          | -       | -       | -       |
| Event: pending      | -          | -       | -       | Attendee | Attendee   | Creator | Creator | Creator |
| Event: confirmed    | -          | -       | -       | -        | Attendee\* | Creator | Creator | Creator |
| Event: cancelled    | -          | -       | -       | -        | -          | -       | Creator | -       |

\*Attendee can switch from confirmed → declined, which reverts event to pending.
