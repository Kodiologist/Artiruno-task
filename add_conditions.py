#!/usr/bin/env python3

import sys, random, sqlite3

_, db_path, n_conds = sys.argv
n_conds = int(n_conds)

conditions = ['vda', 'control']

assert n_conds % len(conditions) == 0

try:
    db = sqlite3.connect(db_path, isolation_level = None)
    r = random.SystemRandom()
    db.execute('begin')
    [[n]] = db.execute('select max(cn) from Conditions')
    if n is None:
        n = -1
    for _ in range(n_conds // len(conditions)):
        for cond in r.sample(conditions, len(conditions)):
            n += 1
            db.execute('insert into Conditions (cn, cond) values (?, ?)',
                (n, cond))
    db.execute('commit')
finally:
    db.close()
