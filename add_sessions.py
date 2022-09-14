#!/usr/bin/env python3

import sys, sqlite3

_, db_path, prolific_study, phase, *prolific_pids = sys.argv

try:
    db = sqlite3.connect(db_path, isolation_level = None)
    db.execute('pragma foreign_keys = true')

    visits = (
        # For phase == 'screening', sessions are added automatically
        # by the server.
        [1, 2]  if phase == 'scenario' else
        [3]     if phase == 'followup' else
        fail())

    db.execute('begin')
    subject_nums = dict(db.execute(
        'select prolific_pid, subject from Subjects'))
    db.executemany(
        '''insert into Sessions
            (prolific_study, subject, visit, done)
            values (?, ?, ?, 0)''',
        [(bytes.fromhex(prolific_study), subject_nums[bytes.fromhex(prolific_pid)], visit)
            for prolific_pid in prolific_pids
            for visit in visits])
    db.execute('commit')

finally:
    db.close()
