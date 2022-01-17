#!/bin/env python3

import sys, re, subprocess
import iso3166

default_country = 'us'

def main(mode, submit_url = ''):
    assert mode in ('plain', 'mturk')
    assert mode == 'mturk' or submit_url

    def read(x):
        with open(x, 'rt') as o:
            return o.read()

    task_version = subprocess.check_output(
        ('git', 'log', '-1', '--format=%H'), encoding = "ASCII").strip()

    html = re.sub(
        '<script.+?</script>',
        (("<script src='https://s3.amazonaws.com/mturk-public/externalHIT_v1.js'></script>"
            if mode == 'mturk' else '') +
            '\n<script>' +
            read('task.js')
                .replace('TASK_VERSION', task_version)
                .replace('SUBMIT_URL', submit_url) +
            '</script>').replace('\\', '\\\\'),
        read('task.html')
            .replace('CONSENT', read('consent'))
            .replace('COUNTRIES', '\n'.join(
                '<option value="{}"{}>{}</option>'.format(
                   x.alpha2.lower(),
                   ' selected' if x.alpha2.lower() == default_country else '',
                   x.name)
                for x in iso3166.countries)),
        count = 1)

    if mode == 'plain':

        with open('/tmp/task.html', 'wt') as o:
            o.write(html)

    else:

        xml = ('<HTMLQuestion xmlns="http://mechanicalturk.amazonaws.com/AWSMechanicalTurkDataSchemas/2011-11-11/HTMLQuestion.xsd">\n' +
            '<HTMLContent><![CDATA[\n' +
            html +
            ']]></HTMLContent>' +
            '<FrameHeight>0</FrameHeight>' +
            '</HTMLQuestion>\n')

        with open('/tmp/mturk_layout.xml', 'wt') as o:
            o.write(xml)

if __name__ == '__main__':
    main(*sys.argv[1:])
