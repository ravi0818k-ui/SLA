# -*- coding: utf-8 -*-
"""Validate the Hindi sidecars in QuizQuestions/hi/ against the English files.

The sidecars are a structural overlay (see quiz.js's mergeTranslation): arrays
merge by INDEX and objects by KEY, so a sidecar whose shape has drifted from
its English original silently shows the wrong Hindi line against the right
English scoring. This script is the guard against that drift.

Run by hand after editing any QuizQuestions/*.json:

    py -3 scripts/check_translations.py
"""
from __future__ import print_function

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EN_DIR = os.path.join(ROOT, 'QuizQuestions')
HI_DIR = os.path.join(EN_DIR, 'hi')

# Keys a sidecar may add that have no English counterpart. Everything else must
# already exist in the English file, or it is a typo that would never render.
NEW_KEYS_OK = set([
    '_note',          # a comment for whoever edits the file next
    'ringCaption',    # Hindi has no 'Your ' prefix to strip off resultsTitle
    'categoryLabels', # display names for VARK / Social Type category KEYS
    'closingTitle',   # the 'STOP -> CHECK -> ...' heading
    'advice',         # the study-strategy tag -> advice table
    'label',          # a Hindi display name for a domain whose KEY is English
    'domains',        # EQ has no English domains map; Hindi adds one for labels
])

# Keys that must NEVER be translated: the scorers match on them. `poles` is
# NOT here - poleBand() matches band.poleAbove against the pole's INDEX, so the
# two pole names are display-only and may be translated in place.
FROZEN = set([
    'id', 'scorer', 'widget', 'optionType', 'domain', 'category', 'key', 'tag',
    'score', 'correct', 'reverse', 'min', 'max', 'iqMin', 'threshold',
    'poleAbove', 'color', 'questions', 'wordLists', 'categories',
    'perQuestionMax', 'coDominantWithin', 'dominantFloor', 'maxDominant',
    'iqScale', 'strategies', 'profiles', 'plans', 'domains', 'levels', 'bands',
    'domainBands', 'sections', 'quizzes', 'options',
])
# ...of those, the container keys below may appear in a sidecar because their
# CHILDREN are translated; only their own keys/indices must line up.
CONTAINERS = set([
    'questions', 'options', 'sections', 'quizzes', 'profiles', 'plans',
    'domains', 'levels', 'bands', 'strategies', 'iqScale',
])

errors = []
warnings = []


def load(path):
    with io.open(path, encoding='utf-8') as fh:
        return json.load(fh)


def walk(en, hi, path, top):
    if isinstance(hi, list):
        if not isinstance(en, list):
            errors.append('%s: %s is a list in Hindi but %s in English'
                          % (top, path, type(en).__name__))
            return
        if len(hi) != len(en):
            errors.append('%s: %s has %d entries in Hindi but %d in English '
                          '(arrays merge by index)' % (top, path, len(hi), len(en)))
            return
        for i, item in enumerate(hi):
            walk(en[i], item, '%s[%d]' % (path, i), top)
        return

    if isinstance(hi, dict):
        if not isinstance(en, dict):
            errors.append('%s: %s is an object in Hindi but %s in English'
                          % (top, path, type(en).__name__))
            return
        for key, value in hi.items():
            here = '%s.%s' % (path, key) if path else key
            if key not in en:
                if key not in NEW_KEYS_OK:
                    errors.append('%s: %s is not a key in the English file' % (top, here))
                continue
            if key in FROZEN and key not in CONTAINERS:
                errors.append('%s: %s must not be translated - the scorers read it'
                              % (top, here))
                continue
            walk(en[key], value, here, top)
        return

    # A leaf. It should be a string that actually differs from the English one.
    if isinstance(en, (dict, list)):
        errors.append('%s: %s is a scalar in Hindi but a %s in English'
                      % (top, path, type(en).__name__))
    elif isinstance(hi, str) and isinstance(en, str) and hi == en:
        # Numbers, symbols and short letter tokens ('42', 'EV', 'Bob') are the
        # answer itself in the IQ items - they are meant to stay as they are.
        if any(c.isalpha() for c in en) and len(en) > 3:
            warnings.append('%s: %s is identical to the English text' % (top, path))


def main():
    if not os.path.isdir(HI_DIR):
        print('No QuizQuestions/hi/ directory.')
        return 1

    en_files = sorted(f for f in os.listdir(EN_DIR) if f.endswith('.json'))
    hi_files = sorted(f for f in os.listdir(HI_DIR) if f.endswith('.json'))

    # reading-texts.json feeds the Speed Reading tool, not a quiz.
    expected = [f for f in en_files if f != 'reading-texts.json']
    missing = [f for f in expected if f not in hi_files]
    extra = [f for f in hi_files if f not in en_files]

    for f in extra:
        errors.append('%s: no matching English file' % f)

    for name in hi_files:
        if name in extra:
            continue
        walk(load(os.path.join(EN_DIR, name)), load(os.path.join(HI_DIR, name)), '', name)

    for w in warnings:
        print('WARN  ' + w)
    for e in errors:
        print('ERROR ' + e)
    if missing:
        print('MISSING translations: ' + ', '.join(missing))

    print('\n%d Hindi files checked, %d errors, %d warnings, %d missing.'
          % (len(hi_files), len(errors), len(warnings), len(missing)))
    return 1 if (errors or missing) else 0


if __name__ == '__main__':
    sys.exit(main())
