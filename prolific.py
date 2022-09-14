#!/bin/env python3
# Create Prolific studies for the task or estimate costs.
# https://docs.prolific.co/docs/api-docs/public

'''
Reminders for the procedure for allowing subjects to do additional sessions:
- Make a Prolific study for this phase, if there isn't one already.
  - Insert the study in the database.
- Increase the Prolific study's subject count, if necessary.
- Create new sessions in the database for the subjects (`add_sessions.py`).
- Add more conditions to the database (`add_conditions.py`), if necessary.
- Add the subjects to the Prolific study's whitelist.
  ("They will automatically be emailed with an invitation to take part within one hour of the study being published." - http://web.archive.org/web/202209/https://researcher-help.prolific.co/hc/en-gb/articles/360015365674 )
- Ensure the Prolific study is published.
'''

import sys, random, string
from pathlib import Path

import requests

upcharge = 1/3

platform_info = ' (The task uses some heavy JavaScript and can be particularly slow on phones and tablets, so I recommend using a desktop or laptop computer.)'

studies = dict(
    screening = dict(
        name = 'Screener for Real-Life Decision-Making',
        internal_name = 'artiruno-screener',
        description = "Describe an important decision that you haven't yet made, for your possible participation in a future study. You'll be paid for this screener within 48 hours."
            + platform_info,
        estimated_completion_minutes = 5,
        reward_cents = 100,
        english_only = True,
        estimated_total_n = 100),
    scenario = dict(
        name = 'Real-Life Decision-Making',
        internal_name = 'artiruno-scenario',
        description = 'Answer questions about your decision situation, plus demographic questions.'
            + platform_info,
        estimated_completion_minutes = 15,
        reward_cents = 300,
        estimated_total_n = 80),
    followup = dict(
        name = 'Real-Life Decision-Making (follow-up)',
        internal_name = 'artiruno-followup',
        description = 'Answer questions about the outcome of your decision.'
            + platform_info,
        estimated_completion_minutes = 10,
        reward_cents = 400,
        estimated_total_n = 40))

def api(verb, endpoint, **kwargs):
    r = requests.request(verb,
        'https://api.prolific.co/api/v1/' + endpoint,
        headers = dict(Authorization = 'Token ' + token),
        **kwargs)
    r.raise_for_status()
    return r

def make_study(
        name, internal_name, description,
        estimated_completion_minutes, reward_cents,
        english_only = False, estimated_total_n = 'IGNORED'):

    first_lang_criterion = next(result
        for result in api('GET', 'eligibility-requirements').json()['results']
        if result['query']['question'] == 'What is your first language?')

    study = api('POST', 'studies/', json = dict(

        name = name,
        internal_name = internal_name,
        description = description,
        completion_code = ''.join(random.SystemRandom().choices(string.ascii_letters, k = 10)),
        estimated_completion_time = estimated_completion_minutes,
        reward = reward_cents,

        eligibility_requirements = ([] if not english_only else [dict(
          # Require the subject's first language to be English.
            _cls = first_lang_criterion['_cls'],
            query = dict(id = first_lang_criterion['query']['id']),
            attributes = [dict(value = True, index = next(
                attribute['index']
                for attribute in first_lang_criterion['attributes']
                if attribute['name'] == 'English'))])]),

        external_study_url = task_url + '?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}',
        device_compatibility = ['desktop'],
        prolific_id_option = 'url_parameters',
        completion_option = 'url',
        total_available_places = 1,
        peripheral_requirements = [])).json()

    print(study['name'])
    print('insert into ProlificStudies ' +
        '(prolific_study, completion_code) ' +
        f'values (X{study["id"]!r}, {study["completion_code"]!r})')

if __name__ == '__main__':
    mode = sys.argv[1]

    if mode == 'make-study':
        phase, task_url = sys.argv[2:]
        token = Path('/tmp/prolific-api-token').read_text().strip()
        make_study(**studies[phase])

    elif mode == 'estimate-cost':
        print(.01 * round(sum(
            study['estimated_total_n'] * study['reward_cents'] *
                (1 + upcharge)
            for study in studies.values())))

    else:
        raise ValueError()
