#!/bin/env python3

import sys, re, subprocess, html
import iso3166

default_country = 'us'

def main(artiruno_webi_path, submit_url):
    def read(x):
        with open(x, 'rt') as o:
            return o.read()

    task_version = subprocess.check_output(
        ('git', 'log', '-1', '--format=%H'), encoding = "ASCII").strip()

    def artiruno_webi(regex, text = read(artiruno_webi_path)):
        return re.search(regex, text, flags = re.DOTALL).group(1)

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

    with open('/tmp/artiruno_pyodide_testing_SNtl1aBcvhoD5PO8upr4/task.html', 'wt') as o:
        o.write(html)

def rating_scale(text):
    name, question, *choices = text.splitlines()
    esc = lambda x: html.escape(x, quote = True)
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
