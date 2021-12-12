#!/bin/env python3

import json, subprocess

quals = dict(
    Worker_PercentAssignmentsApproved = '000000000000000000L0',
    Worker_Locale = '00000000000000000071')

import deploy
deploy.main('mturk')

subprocess.check_call([str(x) if type(x) is not str else x for x in (
    'aws', 'mturk',
    #'--endpoint-url=https://mturk-requester-sandbox.us-east-1.amazonaws.com',
    'create-hit',
    '--max-assignments', 1,
    '--lifetime-in-seconds', 24 * 60*60,
    '--assignment-duration-in-seconds', 1 * 60*60,
    '--auto-approval-delay-in-seconds', 3 * 24*60*60,
    '--reward', 4.0,
    '--qualification-requirements', json.dumps([
        dict(QualificationTypeId = quals['Worker_PercentAssignmentsApproved'],
            Comparator = 'GreaterThanOrEqualTo',
            IntegerValues = [90]),
        dict(QualificationTypeId = quals['Worker_Locale'],
            Comparator = 'EqualTo',
            LocaleValues = [{'Country': 'US'}])]),
    '--title', 'Real-Life Decisions',
    '--description',
        "Answer questions about a weighty real-life decision you "
        "expect to make soon. You can only do this HIT if (1) you "
        "have such a decision to describe, and (2) you haven't already "
        "done one of my HITs named \"Real-Life Decisions\".",
    '--keywords', 'psychology,study,experiment',
    '--question', 'file:///tmp/mturk_layout.xml')])
