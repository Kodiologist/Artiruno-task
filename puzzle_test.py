#!/usr/bin/env python3

# Test how well the clues given to the logic puzzle eliminate possible
# permutations.

import random
from itertools import permutations

objects = ('feather', 'ball', 'cup', 'hat')
all_perms = tuple(permutations(objects))

answer = random.choice([p for p in all_perms if p[0] != 'feather'])
print(answer)

pairs = [[2, 3], [1, 0], [3, 1], [2, 1]]
   # random.sample(itertools.combinations(objects, 2), 6)
possible = all_perms

while len(possible) > 1:
    [o1, o2] = (answer[i] for i in pairs.pop(0))
    now_possible = [p
        for p in possible
        if (p.index(o1) < p.index(o2)) ==
            (answer.index(o1) < answer.index(o2))]
    if not len(now_possible) < len(possible):
        continue
    possible = now_possible
    print('The {} is somewhere to the {} of the {}.'.format(
        o1,
        'left' if answer.index(o1) < answer.index(o2) else 'right',
        o2))
    print('Possibilities left:', len(possible))
