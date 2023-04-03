#!/bin/env python3
# Send messages to ask if subjects are ready for the follow-up phase.

import prolific

import sys, json
from time import time

msg_fmt = '''In the previous session, you said you expected to face this decision: "{}". I'd like to invite you to another session once you've made this decision and gotten to see at least a little of the outcome. Have you yet? If not, suggest a date (in the format YYYY-MM-DD) on which you'd like me to ask you again.'''

def main(tracking_file_path, n_to_invite):
    with open(tracking_file_path, 'rt') as o:
        track = json.load(o)

    to_reinvite = sorted(
        (sn for sn, d in track.items() if d['message_sent'] is None),
        key = int)[: n_to_invite]
    if not to_reinvite:
        print('All subjects notified.')
        return

    for sn in to_reinvite:
        d = track[sn]
        prolific.api('POST', 'messages/', json = dict(
            recipient_id = d['prolific_pid'],
            body = msg_fmt.format(d['desc']),
            study_id = d['prolific_study']))
        print(f'Sent message to {sn}.')
        track[sn]['message_sent'] = int(time())
        with open(tracking_file_path, 'wt') as o:
            json.dump(track, o, indent = 2)

if __name__ == '__main__':
    main(sys.argv[1], int(sys.argv[2]))
