-- Location routes are now ordered stops only; remove legacy transitionTimes payloads.

UPDATE journal_entries
SET location = location - 'transitionTimes'
WHERE location ? 'transitionTimes';
