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
- `pending` → `confirmed`: Or when the **creator** confirms it by hand
  (`POST /groups/:id/events/:eventId/confirm`), without waiting for the last answer.
  Only from `pending`: confirming an already confirmed or a cancelled event is a 400.
- `confirmed` → `pending`: When ANY attendee changes to `declined`.
- `pending`/`confirmed` → `cancelled`: Creator manually cancels.
- Only the **creator** can cancel, confirm or delete.
- Removing the last member who had still to answer also confirms the event: the check
  runs again after a member leaves or is kicked, instead of leaving it stuck in
  `pending` with nobody left to press the button.

### Who hears about it

- All confirmed: everybody who confirmed, **except** the attendee whose answer completed
  the round — they are looking at the screen that did it. (After a member is removed
  there is no actor, so everybody is notified.)
- Born confirmed from a unanimous proposal: no `event_confirmed`, only
  `proposal_converted`. One conversion, one push.

## Poll (La pregunta) States

```
                   ┌──────────────────┐
                   │       open       │ (asking, accepting answers)
                   └───────┬──────────┘
                           │
              ┌────────────┼────────────┐
              ▼                         ▼
   ┌──────────────────┐     ┌──────────────────┐
   │    completed      │     │      closed       │
   │ (everybody: yes)  │     │ (creator closes)  │
   └────────┬─────────┘     └──────────────────┘
            │
            ▼ (somebody swaps their yes)
   ┌──────────────────┐
   │       open       │ (reopens, in silence)
   └──────────────────┘
```

- `open` → `completed`: when EVERY current member has answered `yes`. Also re-evaluated
  after a member leaves or is kicked, so losing the last person still to answer closes
  the ring instead of leaving it open for good.
- `completed` → `open`: the moment unanimity breaks (somebody swaps their `yes`). The
  ring shows the current state, so this is automatic — and **silent**: no push.
- `open`/`completed` → `closed`: only the **creator**, by hand. `closed` is final: a
  closed poll accepts no more answers and leaves the deck.
- Answers are `yes` | `no` | `unsure`. A `yes` also merges the day (or slot) into the
  answerer's availability — never replacing what they had already marked.

### Notification

- «El aro se cierra» goes out **once per poll, ever** (`completed_notified_at`), to the
  group except whoever closed it. A poll that reopens and closes again does so quietly.
- At most **one** `new_poll` push per group per day. Later polls are still created — they
  just arrive silently in the deck; the response says `notified: false` so the asker
  knows.
- A partial unique index keeps two `open` polls for the same day and slot from existing;
  the second attempt is a 409.

### El mazo (the deck)

`GET /groups/:id/polls` returns the `open` and `completed` polls, newest first, capped at
50. `closed` ones are gone from it. Creating a poll answers `yes` for its creator, so the
ring lights up without a second tap.

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
| Event: pending      | -          | -       | -       | Attendee \*\* | Attendee   | Creator | Creator | Creator |
| Event: confirmed    | -          | -       | -       | -        | Attendee\* | Creator | Creator | Creator |
| Event: cancelled    | -          | -       | -       | -        | -          | -       | Creator | -       |
| Poll: open          | Any member | -       | Creator | -        | -          | -       | -       | -       |
| Poll: completed     | Any member | -       | Creator | -        | -          | -       | -       | -       |
| Poll: closed        | -          | -       | -       | -        | -          | -       | -       | -       |

\*Attendee can switch from confirmed → declined, which reverts event to pending.

\*\*The creator can also confirm the whole event from `pending` without waiting for the
rest (`POST /groups/:id/events/:eventId/confirm`).

For polls, "Vote" is answering (`yes`/`no`/`unsure`) and "Close" is the creator's manual
close. There is no convert: a poll becomes a quedada by someone creating one for the day
it settled on.
