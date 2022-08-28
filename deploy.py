#!/bin/env python3
# Provide the path to a clone of Artiruno core (i.e., the VDA code) as a
# command-line argument.
#
# This program only generates some files. To deploy the task to the
# server on which it will run, copy 'task.html' and
# `artiruno_for_pyodide.tar.gz` to the appropriate places on the
# server.

import sys, os, re, runpy, shutil
from subprocess import run, DEVNULL
from pathlib import Path
from html import escape as html_escape
import iso3166

default_country = 'us'
submit_url = '/artiruno/submit'

def main(artiruno_core_path, test_session_key):
    artiruno_core_path = Path(artiruno_core_path)

    here = os.getcwd()
    try:
        os.chdir(artiruno_core_path)
        runpy.run_path('pyodide_testing.py', dict(quiet = True))
    finally:
        os.chdir(here)

    def read(x):
        return Path(x).read_text()

    task_version = run(('git', 'log', '-1', '--format=%H'),
        check = True, capture_output = True,
        encoding = "ASCII").stdout.strip()

    webi_text = read(artiruno_core_path / 'webi.html')
    def artiruno_webi(regex):
        return re.search(regex, webi_text, flags = re.DOTALL).group(1)

    html = (read('task.html')
        .replace('</style>',
            '</style>' +
                artiruno_webi('<!-- SCRIPSTY -->(.+?)<!-- SCRIPSTY -->'),
            1)
        .replace('[CONSENT]', read('consent'))
        .replace('[DEBRIEFING]', read('debriefing'))
        .replace('[COUNTRIES]', '\n'.join(
            '<option value="{}"{}>{}</option>'.format(
               x.alpha2.lower(),
               ' selected' if x.alpha2.lower() == default_country else '',
               x.name)
            for x in iso3166.countries)))
    html = re.sub(
        r'\[RATING (.+?)\]',
        lambda m: rating_scale(m.group(1)),
        html, flags = re.DOTALL)
    html = re.sub(
        '<script src="task.js"></script>',
        '<script>{}</script>'.format(
            artiruno_webi("<script id='defs'>(.+?)</script>") +
            read('task.js')
                .replace('[TASK_VERSION]', repr(task_version))
                .replace('[SUBMIT_URL]', repr(submit_url))).replace('\\', '\\\\'),
        html, count = 1)

    d = Path('/tmp/Arfernet-artiruno-data')
    d.mkdir(exist_ok = True)
    (d / 'task.html').write_text(html)

    # Create a test database.
    (d / 'artiruno.sqlite').unlink(missing_ok = True)
    run(check = True, stdout = DEVNULL, args = (
        'sqlite3', d / 'artiruno.sqlite',
        '.read artiruno.sql',
        "insert into Subjects values (0, 'fake_test_subject')",
        *("insert into Sessions values ({}, 'test{}_{}', 0, {}, 2000000000, 0, null)".format(
                i, i + 1, test_session_key, i + 1)
            for i in range(3))))
    sys.argv = [None, d / 'artiruno.sqlite', '10']
    runpy.run_path('add_conditions.py')

    d = Path('/tmp/Arfernet-exp/artiruno')
    d.mkdir(parents = True, exist_ok = True)
    shutil.copy2(
        '/tmp/artiruno_pyodide_testing_SNtl1aBcvhoD5PO8upr4/artiruno_for_pyodide.tar.gz',
        d)

def rating_scale(text):
    name, question, *choices = text.splitlines()
    esc = lambda x: html_escape(x, quote = True)
    return '<p>{}\n<ul>\n{}\n</ul>'.format(
       esc(question),
       '\n'.join(
          '<li><label><input name="{}" value="{}" type="radio">{}</label>'.format(
              esc('eval_rate_' + name),
              len(choices) - i,
              esc(c.removeprefix('- ')))
          for i, c in enumerate(choices)))

if __name__ == '__main__':
    main(*sys.argv[1:])
