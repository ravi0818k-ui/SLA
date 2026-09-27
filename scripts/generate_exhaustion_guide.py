#!/usr/bin/env python3
"""
Builds the downloadable guide linked from the Exhaustion Check result
(quiz.html#/results/tiredness):

    Resources-pdf/Super_Learner_Academy_Exhaustion_Guide.pdf

The copy lives in this file (there is no other source for it). It follows the
four domains and plans in QuizQuestions/tiredness.json - if those change,
change the matching section here and re-run:

    py -3 scripts/generate_exhaustion_guide.py

Needs reportlab (py -3 -m pip install reportlab). Uses the Lato files already
bundled in generatenotes/fonts (SIL OFL), so no system font is embedded.
Lato has no emoji, so each type is marked with a coloured badge instead.
"""

import os

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    CondPageBreak, Image, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate,
    Spacer, Table, TableStyle,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'Resources-pdf', 'Super_Learner_Academy_Exhaustion_Guide.pdf')
LOGO = os.path.join(ROOT, 'Images', 'Logo.png')
FONTS = os.path.join(ROOT, 'generatenotes', 'fonts')

pdfmetrics.registerFont(TTFont('Lato', os.path.join(FONTS, 'print_r.ttf')))
pdfmetrics.registerFont(TTFont('Lato-Bold', os.path.join(FONTS, 'print_b.ttf')))
pdfmetrics.registerFontFamily('Lato', normal='Lato', bold='Lato-Bold',
                              italic='Lato', boldItalic='Lato-Bold')

# Site tokens (style.css / quiz.css :root) and the quiz's domain colours.
NAVY = colors.HexColor('#0B2A5B')
BLUE = colors.HexColor('#1E5EFF')
ORANGE = colors.HexColor('#FF6B00')
INK = colors.HexColor('#2B2B2B')
MUTED = colors.HexColor('#6B7280')
SOFT = colors.HexColor('#F6F8FC')
LINE = colors.HexColor('#E3E8F2')
RED = colors.HexColor('#E53935')

TYPES = {
    'Mental': colors.HexColor('#1E5EFF'),
    'Physical': colors.HexColor('#34A853'),
    'Emotional': colors.HexColor('#FF6B00'),
    'Stress': colors.HexColor('#6A3DE8'),
}


def tint(c, amount=0.9):
    """Mix a colour towards white - used for section backgrounds."""
    return colors.Color(c.red + (1 - c.red) * amount,
                        c.green + (1 - c.green) * amount,
                        c.blue + (1 - c.blue) * amount)


# --- Styles ----------------------------------------------------------------

def style(name, **kw):
    base = dict(fontName='Lato', fontSize=10, leading=14, textColor=INK)
    base.update(kw)
    return ParagraphStyle(name, **base)


S = {
    'brand': style('brand', fontName='Lato-Bold', fontSize=26, leading=32,
                   textColor=NAVY, alignment=TA_CENTER),
    'title': style('title', fontName='Lato-Bold', fontSize=19, leading=25,
                   textColor=ORANGE, alignment=TA_CENTER),
    'sub': style('sub', fontSize=11.5, leading=17, textColor=MUTED, alignment=TA_CENTER),
    'h1': style('h1', fontName='Lato-Bold', fontSize=16, leading=21, textColor=NAVY,
                spaceBefore=6, spaceAfter=6),
    'h2': style('h2', fontName='Lato-Bold', fontSize=11.5, leading=15, textColor=NAVY,
                spaceBefore=7, spaceAfter=2),
    'body': style('body', spaceAfter=4),
    'bullet': style('bullet', leftIndent=16, firstLineIndent=-11, spaceAfter=1.5),
    'num': style('num', leftIndent=16, firstLineIndent=-13, spaceAfter=1.5),
    'cell': style('cell', fontSize=9.5, leading=13),
    'cellHead': style('cellHead', fontName='Lato-Bold', fontSize=9.5, leading=13,
                      textColor=colors.white),
    'callout': style('callout', fontSize=10, leading=14.5, textColor=NAVY),
    'typeTitle': style('typeTitle', fontName='Lato-Bold', fontSize=17, leading=22,
                       textColor=colors.white),
    'typeQuote': style('typeQuote', fontSize=11, leading=15, textColor=colors.white),
    'small': style('small', fontSize=9, leading=13, textColor=MUTED),
    'closing': style('closing', fontName='Lato-Bold', fontSize=15, leading=21,
                     textColor=NAVY, alignment=TA_CENTER),
    'center': style('center', fontSize=10, leading=15, textColor=MUTED, alignment=TA_CENTER),
}

CONTENT_W = A4[0] - 36 * mm


# --- Building blocks --------------------------------------------------------

def p(text, st='body'):
    return Paragraph(text, S[st])


def bullets(items, color=BLUE):
    hexc = color.hexval()[2:]
    return [Paragraph('<font color="#%s">&#8226;</font>&nbsp;&nbsp;%s' % (hexc, t), S['bullet'])
            for t in items]


def numbered(items):
    return [Paragraph('<b>%d.</b>&nbsp;&nbsp;%s' % (i + 1, t), S['num']) for i, t in enumerate(items)]


def avoid(items):
    return [Paragraph('<font color="#E53935"><b>&#215;</b></font>&nbsp;&nbsp;%s' % t, S['bullet'])
            for t in items]


def box(flowables, bg=SOFT, bar=BLUE, pad=9):
    """A tinted panel with a coloured left bar - the PDF twin of .result-tip."""
    t = Table([[flowables]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg),
        ('LINEBEFORE', (0, 0), (0, -1), 4, bar),
        ('LEFTPADDING', (0, 0), (-1, -1), pad + 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), pad),
        ('TOPPADDING', (0, 0), (-1, -1), pad),
        ('BOTTOMPADDING', (0, 0), (-1, -1), pad),
    ]))
    return t


def rule(text, color):
    return KeepTogether([Spacer(1, 6), box([p('<b>Rule:</b> ' + text, 'callout')],
                                            bg=tint(color, 0.88), bar=color)])


def table(rows, widths, head_color=NAVY):
    data = [[Paragraph(c, S['cellHead']) for c in rows[0]]]
    data += [[Paragraph(c, S['cell']) for c in r] for r in rows[1:]]
    t = Table(data, colWidths=[CONTENT_W * w for w in widths], repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), head_color),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, SOFT]),
        ('GRID', (0, 0), (-1, -1), 0.5, LINE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    return t


def type_header(number, name, label, quote):
    color = TYPES[name]
    t = Table([[p('%d. %s' % (number, label), 'typeTitle')],
               [p('&ldquo;%s&rdquo;' % quote, 'typeQuote')]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), color),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
        ('TOPPADDING', (0, 0), (0, 0), 12),
        ('BOTTOMPADDING', (0, -1), (-1, -1), 12),
        ('TOPPADDING', (0, 1), (-1, 1), 0),
    ]))
    return t


def h2(text, color=NAVY):
    return Paragraph('<font color="%s">%s</font>' % ('#' + color.hexval()[2:], text), S['h2'])


# --- Page chrome ------------------------------------------------------------

def on_page(canvas, doc):
    w, h = A4
    canvas.saveState()
    canvas.setFillColor(ORANGE)
    canvas.rect(0, h - 5, w, 5, stroke=0, fill=1)
    canvas.setFillColor(MUTED)
    canvas.setFont('Lato', 8.5)
    if doc.page > 1:
        canvas.drawString(18 * mm, h - 12 * mm, 'Super Learner Academy')
        canvas.drawRightString(w - 18 * mm, h - 12 * mm, 'The Four Kinds of Exhaustion')
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 14 * mm, w - 18 * mm, 14 * mm)
    canvas.drawString(18 * mm, 9 * mm, 'www.superlearneracademy.in')
    canvas.drawRightString(w - 18 * mm, 9 * mm, 'Page %d' % doc.page)
    canvas.restoreState()


# --- Content ----------------------------------------------------------------

def cover():
    out = []
    if os.path.exists(LOGO):
        out += [Image(LOGO, width=30 * mm, height=30 * mm), Spacer(1, 4)]
    out += [
        p('Super Learner Academy', 'brand'),
        Spacer(1, 6),
        p('Tired Before You Study?<br/>Find Your Type, Then Fix It', 'title'),
        Spacer(1, 4),
        p('A guide to the four kinds of exhaustion &mdash; and what to do about each one', 'sub'),
        Spacer(1, 14),
        p('Why this guide exists', 'h1'),
        p('&ldquo;I&rsquo;m tired&rdquo; can mean four different things. Your mind may be '
          'overloaded, your body may need something, you may be emotionally drained, or you '
          'may be holding too many worries at once. Each one has a different fix. When you '
          'use the wrong fix (more coffee for an emotional problem, pushing on when you&rsquo;re '
          'actually sleepy), you lose the hour and get almost nothing from it.'),
        p('This guide helps you do three things:'),
        *numbered([
            '<b>Name</b> the kind of tiredness you have.',
            '<b>Fix</b> it with steps that suit that kind.',
            '<b>Choose</b> study work your current state can actually handle.',
        ]),
        Spacer(1, 8),
        box([
            p('<b>The 4-step rule: STOP &rarr; CHECK &rarr; CHOOSE &rarr; STUDY</b>', 'callout'),
            Spacer(1, 3),
            p('Don&rsquo;t force yourself straight into work. First check which kind of '
              'exhaustion this is. Then choose what your current state lets you do well, and '
              'study that.', 'callout'),
        ], bg=tint(ORANGE, 0.9), bar=ORANGE),
        Spacer(1, 8),
        p('You can have more than one type at the same time. If two types scored high on the '
          'Exhaustion Check, read both sections and start with whichever feels heavier.'),
        Spacer(1, 10),
        p('The four types at a glance', 'h2'),
        table([
            ['Type', 'It sounds like&hellip;'],
            ['<font color="#1E5EFF"><b>1. Mental Exhaustion</b></font>',
             '&ldquo;My brain won&rsquo;t take anything in.&rdquo;'],
            ['<font color="#34A853"><b>2. Physical Exhaustion</b></font>',
             '&ldquo;My body is heavy.&rdquo;'],
            ['<font color="#FF6B00"><b>3. Emotional Exhaustion</b></font>',
             '&ldquo;I just don&rsquo;t want to do anything.&rdquo;'],
            ['<font color="#6A3DE8"><b>4. Stress / Overload</b></font>',
             '&ldquo;Too much, and I don&rsquo;t know where to start.&rdquo;'],
        ], [0.4, 0.6]),
    ]
    return out


def mental():
    c = TYPES['Mental']
    return [
        PageBreak(),
        type_header(1, 'Mental', 'Mental Exhaustion', 'My brain won&rsquo;t take anything in'),
        h2('How it feels', c),
        *bullets([
            'You read the same sentence three times and it still doesn&rsquo;t go in.',
            'Simple problems feel oddly hard.',
            'You can&rsquo;t hold your attention on one thing.',
            'Your head feels full, like there&rsquo;s no room left.',
        ], c),
        h2('Why it happens', c),
        p('Focusing, understanding and problem-solving all use <b>working memory</b>, and '
          'working memory has a small capacity. After a long stretch of hard thinking, a lot '
          'of switching between tasks, or a lot of scrolling, that capacity is used up. Your '
          'brain is still working, but new and difficult material now costs much more effort '
          'than usual.'),
        h2('Quick reset (10&ndash;15 minutes)', c),
        *bullets([
            '<b>Screen-free break.</b> Scrolling isn&rsquo;t rest for your brain; it&rsquo;s more '
            'input. Look out of a window, walk, or sit quietly.',
            '<b>Walk for 5&ndash;10 minutes</b>, outdoors if you can.',
            '<b>Rest your eyes.</b> Look at something far away for a while, away from any screen.',
            '<b>Drink a glass of water.</b>',
        ], c),
        h2('Study tasks that fit this state', c),
        p('Warm your brain up before you go deep. The order is:'),
        box([p('<b>reset &rarr; light recall &rarr; easy task &rarr; difficult task</b>', 'callout')],
            bg=tint(c, 0.9), bar=c, pad=7),
        Spacer(1, 4),
        *bullets([
            'Revise something you&rsquo;ve already learned',
            'Flashcards or a quick self-quiz',
            'Draw a mind map of a topic you know',
            'Explain a concept you already understand out loud, as if teaching a friend',
            'Tidy and organise your notes',
            'A short round of retrieval practice: close the book, write what you remember, then check',
        ], c),
        h2('Avoid', RED),
        *avoid(['&ldquo;Let me learn this completely new and difficult chapter right now.&rdquo;']),
        h2('Stop it coming back', c),
        *bullets([
            'Study in focused blocks of 25&ndash;45 minutes with real breaks in between. Don&rsquo;t '
            'do three unbroken hours.',
            'Do one task at a time. Put the phone in another room, not just face-down.',
            'Do your hardest subject when your mind is freshest, which for most students is '
            'earlier in the day.',
        ], c),
        rule('Reduce the load before you increase the difficulty.', c),
    ]


def physical():
    c = TYPES['Physical']
    return [
        PageBreak(),
        type_header(2, 'Physical', 'Physical Exhaustion', 'My body is heavy'),
        h2('How it feels', c),
        *bullets([
            'Your body feels heavy or drained.',
            'You&rsquo;re sleepy and your eyes keep closing.',
            'Even sitting up straight feels tiring.',
            'You&rsquo;re hungry, thirsty or stiff, or you&rsquo;ve been sitting still for hours.',
        ], c),
        h2('Why it happens', c),
        p('Your brain runs on the same body that feels tired. When sleep, food, water or '
          'movement is missing, attention and memory are the first things to suffer. Sleep '
          'matters most, because that&rsquo;s when your brain consolidates what you studied '
          'during the day. A late night of studying followed by poor sleep often means you '
          'keep less of what you learned.'),
        h2('The body check: ask four questions', c),
        table([
            ['Question', 'If the answer is &ldquo;no&rdquo;&hellip;'],
            ['Did I sleep properly last night?',
             'Take a short nap (15&ndash;20 minutes, before evening), or plan an early night'],
            ['Have I eaten in the last 3&ndash;4 hours?',
             'Have a light snack: fruit, nuts, curd, roti. Avoid a heavy, oily meal'],
            ['Have I had water recently?', 'Drink a full glass now'],
            ['Have I moved in the last hour?', 'Stand up, stretch, walk for 5 minutes'],
        ], [0.42, 0.58], head_color=c),
        h2('Quick reset', c),
        *bullets([
            '<b>Move:</b> 5 minutes of stretching, stairs or a walk.',
            '<b>Fix your space:</b> turn on brighter light, open a window, sit at a desk instead '
            'of on the bed.',
            '<b>Splash cold water on your face</b> if you just need to feel more awake.',
            '<b>Rest properly:</b> lie down with your eyes closed for 10 minutes. A scrolling '
            'break doesn&rsquo;t count as rest.',
        ], c),
        h2('Study tasks that fit this state', c),
        box([p('<b>meet the physical need &rarr; re-check your energy &rarr; choose the task</b>',
               'callout')], bg=tint(c, 0.9), bar=c, pad=7),
        Spacer(1, 4),
        *bullets([
            'If you feel better after the reset, do a normal study block.',
            'If you still feel heavy, do light work: revision, flashcards, listening to a recorded '
            'explanation, or planning tomorrow.',
        ], c),
        h2('Avoid', RED),
        *avoid([
            'Pushing through another hour while genuinely sleepy. It takes the time and gives '
            'back almost no retention.',
            'Using energy drinks or late-evening coffee instead of sleep. It helps tonight and '
            'makes tomorrow worse.',
        ]),
        h2('Stop it coming back', c),
        *bullets([
            'Keep sleep and wake times regular, including before exams.',
            'Stop using screens a while before bed.',
            'Stand up and move at least once an hour while studying.',
        ], c),
        rule('If you&rsquo;re genuinely sleepy, sleeping is the smarter study decision.', c),
    ]


def emotional():
    c = TYPES['Emotional']
    return [
        PageBreak(),
        type_header(3, 'Emotional', 'Emotional Exhaustion', 'I just don&rsquo;t want to do anything'),
        h2('How it feels', c),
        *bullets([
            'You feel drained even though your body isn&rsquo;t tired.',
            'You get irritated, frustrated or upset easily.',
            '&ldquo;I don&rsquo;t want to do anything&rdquo;, even when you have the energy.',
            'Just thinking about studying feels overwhelming.',
        ], c),
        h2('Why it happens', c),
        p('Emotions use up energy too. An argument, a bad test result, feeling left out, '
          'pressure from home, or worry about a friend all keep running in the background. '
          'That background load drains the energy you would normally use to start work. '
          '<b>This isn&rsquo;t laziness.</b> Calling it laziness adds guilt on top, and the '
          'next hour gets harder.'),
        h2('The main fix: get it out of your head and onto paper', c),
        p('Writing about what&rsquo;s bothering you helps you step back from it. Once it&rsquo;s '
          'written down, your mind can stop replaying it.'),
        box([
            p('<b>Thought-writing (10 minutes)</b>', 'callout'),
            Spacer(1, 3),
            *numbered([
                'Take a plain sheet of paper. A diary is fine too, but paper you can throw away '
                'works best.',
                'Set a timer for 10 minutes.',
                'Write non-stop about what you&rsquo;re feeling and why. Don&rsquo;t worry about '
                'spelling or grammar or whether it makes sense. Nobody will read it.',
                'When the timer ends, finish with one line: <b>&ldquo;What I can do about this '
                'right now is&hellip;&rdquo;</b>',
                'Keep the page or tear it up. Either is fine.',
            ]),
        ], bg=tint(c, 0.9), bar=c),
        Spacer(1, 4),
        h2('If you don&rsquo;t know what to write, use these prompts', c),
        *bullets([
            'Right now I&rsquo;m feeling ______ because ______.',
            'The thing that&rsquo;s really bothering me is ______.',
            'What I wish someone understood is ______.',
            'If my best friend felt this way, I would tell them ______.',
            'One thing that&rsquo;s in my control today is ______.',
            'One thing that went okay today is ______.',
        ], c),
        h2('Other things that help', c),
        *bullets([
            '<b>Step away properly for a few minutes.</b> Get up and go to another room.',
            '<b>Name the feeling in one word</b>: angry, hurt, worried, lonely, disappointed. '
            'Just naming it often makes it less intense.',
            '<b>Breathe slowly:</b> breathe in through your nose for 4 counts and out through '
            'your mouth for 6 counts. Repeat 5&ndash;6 times. A longer out-breath helps your '
            'body calm down.',
            '<b>Talk to someone</b> you trust: a friend, a sibling, a parent, a teacher.',
            '<b>Speak to yourself kindly.</b> Swap &ldquo;I&rsquo;m useless&rdquo; for '
            '&ldquo;I&rsquo;m having a hard day, and I can still do one small thing.&rdquo;',
        ], c),
        h2('Study tasks that fit this state', c),
        box([p('<b>step away &rarr; name it &rarr; write it down &rarr; one small, familiar task</b>',
               'callout')], bg=tint(c, 0.9), bar=c, pad=7),
        Spacer(1, 4),
        *bullets([
            'Choose a tiny target: &ldquo;I&rsquo;ll revise one concept for 15 minutes.&rdquo;',
            'Start with something you already know, not something new.',
            'Let yourself stop once that small target is done. Finishing something small '
            'rebuilds momentum.',
        ], c),
        h2('Avoid', RED),
        *avoid(['&ldquo;I have to study chemistry for three hours.&rdquo; A target that big is '
                'what stops you starting at all.']),
        h2('Stop it coming back', c),
        *bullets([
            'Write a few lines before bed every day, not only on bad days.',
            'Stay connected to people. Studying alone for weeks on end drains you emotionally.',
            'Keep one thing each day that&rsquo;s just for you: music, a sport, a hobby.',
        ], c),
        rule('Swap the three-hour target for a 15-minute one. Starting is the win.', c),
    ]


def stress():
    c = TYPES['Stress']
    sort_grid = Table(
        [[Paragraph('<b>Must do today</b>', S['cellHead']),
          Paragraph('<b>Can do tomorrow</b>', S['cellHead']),
          Paragraph('<b>Can wait / not in my control</b>', S['cellHead'])]]
        + [['', '', ''] for _ in range(4)],
        colWidths=[CONTENT_W / 3] * 3, rowHeights=[None] + [9 * mm] * 4)
    sort_grid.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), RED),
        ('BACKGROUND', (1, 0), (1, 0), colors.HexColor('#E0A800')),
        ('BACKGROUND', (2, 0), (2, 0), colors.HexColor('#34A853')),
        ('GRID', (0, 0), (-1, -1), 0.6, LINE),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, 0), 5),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 5),
    ]))
    return [
        Spacer(1, 10),
        CondPageBreak(120 * mm),
        type_header(4, 'Stress', 'Stress / Overload',
                    'Too much, and I don&rsquo;t know where to start'),
        h2('How it feels', c),
        *bullets([
            'Your mind keeps jumping to exams, deadlines and unfinished work.',
            'You&rsquo;re trying to study while worrying about five other things.',
            'You feel a heavy pressure that you <i>must</i> study, but you can&rsquo;t pick '
            'where to begin.',
        ], c),
        h2('Why it happens', c),
        p('Unfinished tasks keep taking up your attention until you either do them or make a '
          'clear plan for them. When ten worries are all fighting for space in your head, '
          'there&rsquo;s very little attention left for the chapter in front of you. The '
          'subject isn&rsquo;t what&rsquo;s blocking you. The load is.'),
        h2('The main fix: brain dump &rarr; sort &rarr; pick ONE', c),
        p('<b>Step 1: Brain dump (5 minutes).</b> On a sheet of paper, write down '
          '<i>everything</i> on your mind: every test, assignment, chapter, errand and worry. '
          'Don&rsquo;t sort anything yet. Just empty your head.'),
        p('<b>Step 2: Sort each item</b> into one of three columns. You can fill this one in:'),
        sort_grid,
        Spacer(1, 6),
        p('<b>Step 3: Pick ONE item from the red column.</b> Break it into a first step small '
          'enough to start in the next two minutes. For example: &ldquo;Open Physics chapter 4 '
          'and read the summary box&rdquo;, not &ldquo;finish Physics.&rdquo;'),
        p('<b>Step 4: Start that one thing only.</b> Everything else is on paper now, so your '
          'head doesn&rsquo;t have to hold it.'),
        h2('Other things that help', c),
        *bullets([
            '<b>Write a &ldquo;worry parking&rdquo; line</b> for any worry that keeps coming '
            'back: &ldquo;I&rsquo;ll think about this at 7 pm.&rdquo; Then actually give it time '
            'at 7 pm.',
            '<b>Breathe slowly:</b> take 2 short breaths in through your nose, then one long '
            'breath out through your mouth. Repeat 3 times.',
            '<b>Plan tomorrow tonight.</b> Write tomorrow&rsquo;s top 3 tasks before bed so you '
            'don&rsquo;t lie awake going over them.',
            '<b>Tidy your desk.</b> A clear space means less for your mind to take in.',
        ], c),
        h2('Avoid', RED),
        *avoid([
            'Trying to study while mentally re-checking every deadline at once.',
            'Making a perfect timetable for the whole month instead of starting today&rsquo;s one task.',
        ]),
        h2('Stop it coming back', c),
        *bullets([
            'Keep one running to-do list, either on paper or in one app, so your head never has '
            'to hold it.',
            'Once a week (Sunday works well), look ahead at tests and deadlines.',
            'Break big syllabus goals into weekly chunks so the whole mountain isn&rsquo;t in '
            'front of you every day.',
        ], c),
        rule('What&rsquo;s written down doesn&rsquo;t have to be remembered.', c),
    ]


def planning():
    return [
        Spacer(1, 14),
        CondPageBreak(80 * mm),
        p('When you have more than one type', 'h1'),
        table([
            ['Combination', 'Start with'],
            ['Physical + anything', '<b>Physical.</b> Sleep, food, water and movement come first. '
             'Nothing else works on an empty tank.'],
            ['Emotional + Stress', '<b>Brain dump first</b>, then thought-writing about the thing '
             'that feels heaviest.'],
            ['Mental + Stress', '<b>Brain dump</b>, then a light recall task.'],
            ['Mental + Emotional', '<b>Step away and write</b>, then revise something familiar.'],
            ['All four are high', '<b>Recovery is the right choice today.</b> If you must do '
             'something, spend 10 minutes revising what you already know. Nothing new.'],
        ], [0.3, 0.7]),
        Spacer(1, 12),
        CondPageBreak(75 * mm),
        p('Match the task to the tank', 'h1'),
        table([
            ['Your energy', 'Best use of it'],
            ['<font color="#34A853"><b>Good to go</b></font>',
             'Your hardest chapter, the problem set you&rsquo;ve been avoiding, new concepts'],
            ['<font color="#C99700"><b>Some drag</b></font>',
             'A 25-minute active recall block: close the book, write what you remember, check'],
            ['<font color="#FF6B00"><b>Noticeably drained</b></font>',
             '10&ndash;15 minutes of flashcards or revision on familiar material. Stop when the '
             'timer stops; that counts.'],
            ['<font color="#E53935"><b>Running on empty</b></font>',
             'Rest. Or 10 minutes of revising what you already know, and nothing new.'],
        ], [0.3, 0.7]),
        Spacer(1, 10),
        box([p('Before you start any study session, ask yourself:', 'callout'),
             Spacer(1, 3),
             p('<b>&ldquo;What&rsquo;s the smallest useful thing I can do right now?&rdquo;</b>',
               'callout')], bg=tint(ORANGE, 0.9), bar=ORANGE),
        Spacer(1, 14),
        CondPageBreak(70 * mm),
        p('One-page quick reference', 'h1'),
        table([
            ['Type', 'Sign', 'First fix', 'Study this', 'Avoid'],
            ['<font color="#1E5EFF"><b>Mental</b></font>', 'Re-reading, can&rsquo;t focus',
             'Screen-free break, walk', 'Recall, flashcards, mind map', 'A brand-new hard chapter'],
            ['<font color="#34A853"><b>Physical</b></font>', 'Sleepy, heavy body',
             'Sleep, food, water, movement', 'Light revision after the reset',
             'Pushing through while sleepy'],
            ['<font color="#FF6B00"><b>Emotional</b></font>',
             '&ldquo;Don&rsquo;t want to do anything&rdquo;', 'Write your thoughts on paper',
             'One small, familiar task', 'Huge 3-hour targets'],
            ['<font color="#6A3DE8"><b>Stress</b></font>', 'Too many worries, no starting point',
             'Brain dump &rarr; sort &rarr; pick one', 'That one task only',
             'Juggling every deadline at once'],
        ], [0.15, 0.21, 0.22, 0.21, 0.21]),
    ]


def closing():
    return [
        Spacer(1, 12),
        CondPageBreak(130 * mm),
        p('When to talk to someone', 'h1'),
        p('This guide is for self-reflection. It isn&rsquo;t a medical or psychological test. '
          'Please speak to a doctor, a counsellor or another health professional if:'),
        *bullets([
            'you feel tired most days for more than two weeks, even after proper sleep,',
            'you have trouble sleeping regularly, or you sleep much more than usual,',
            'your mood stays low, or you&rsquo;ve stopped enjoying things you used to like,',
            'you can&rsquo;t get through normal daily life.',
        ]),
        Spacer(1, 6),
        box([p('If you ever feel hopeless or think about hurting yourself, talk to a trusted adult '
               'today or call a helpline. In India, <b>Tele-MANAS (14416 or 1-800-891-4416)</b> is '
               'free and available 24/7. Asking for help is a strong thing to do.', 'callout')],
            bg=tint(RED, 0.9), bar=RED),
        Spacer(1, 30),
        p('Don&rsquo;t always fight exhaustion.<br/>Understand it first.', 'closing'),
        Spacer(1, 22),
        p('<b>Super Learner Academy</b> &middot; www.superlearneracademy.in', 'center'),
        p('Take the free Exhaustion Check again any time:<br/>'
          '<link href="https://www.superlearneracademy.in/quiz.html#/quiz/tiredness" color="#1E5EFF">'
          'www.superlearneracademy.in/quiz.html#/quiz/tiredness</link>', 'center'),
    ]


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    doc = SimpleDocTemplate(
        OUT, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm, topMargin=17 * mm, bottomMargin=18 * mm,
        title='Super Learner Academy - The Four Kinds of Exhaustion',
        author='Super Learner Academy',
        subject='What kind of tired are you, and what to do about it',
    )
    story = cover() + mental() + physical() + emotional() + stress() + planning() + closing()
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print('Wrote', os.path.relpath(OUT, ROOT), '(%d KB)' % (os.path.getsize(OUT) // 1024))


if __name__ == '__main__':
    main()
