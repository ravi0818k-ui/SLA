"""Build the 3 policy pages (privacy-policy.html, terms.html, refund-policy.html) from about.html's
head, menu, styles and footer, so they always look like the About page.
Run: python scripts/build-legal-pages.py   (after changing about.html's header/menu/footer or the text below)
The policy TEXT lives here. Keep it true to how the site really works (see CLAUDE.md "Footer + policy pages").
"""
import re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPDATED = "26 November 2026"
EMAIL = '<a href="mailto:support@superlearneracademy.in">support@superlearneracademy.in</a>'

PAGES = [
    {
        "file": "privacy-policy.html", "page": "privacy",
        "title": "Privacy Policy | Super Learner Academy",
        "desc": "What personal data Super Learner Academy collects, why, who it is shared with, how long it is kept, and how to see, correct or delete it.",
        "eyebrow": "Privacy Policy", "h1": "Privacy Policy",
        "lead": "In short: we collect only what we need to run your classes, we never sell it, and you can ask us to delete it at any time.",
        "body": f"""
        <section class="about-card" id="who">
            <h2>Who we are</h2>
            <p>Super Learner Academy (&ldquo;we&rdquo;, &ldquo;us&rdquo;) runs the website www.superlearneracademy.in and teaches live online classes on learning skills. It is run by Abhishek Ranjan and operates online from India. For anything about your data, email {EMAIL}.</p>
        </section>

        <section class="about-card" id="what-we-collect">
            <h2>What we collect and why</h2>
            <h3 style="margin-top:0;">When you register for a class</h3>
            <p>Your name, email address and phone number, entered on our registration form or sent to us on WhatsApp. We use them to send you the class details and joining link, to remind you about sessions and to answer your questions. For a paid workshop, the payment itself is handled by our payment partner; we never see or store your card or UPI details.</p>
            <h3>In our WhatsApp group and live classes</h3>
            <p>Class updates are shared in a WhatsApp group, where other members can see your name and phone number, as in any WhatsApp group. Classes run on Zoom, where other participants can see the display name you choose. WhatsApp&rsquo;s and Zoom&rsquo;s own privacy policies apply to those apps.</p>
            <h3>When you email or message us</h3>
            <p>We keep your message and our reply so we can help you and follow up.</p>
            <h3>When you visit the website</h3>
            <p>We use Google Analytics and Google Ads tags. They use cookies and similar technology to tell us how many people visit, which pages they read, the type of device, the approximate location (city level) and which ad or link brought them here. This helps us improve the site and see whether our ads work. It does not tell us who you are.</p>
            <h3>What stays only in your browser</h3>
            <p>Your quiz answers, language choice, mind maps, notes you turn into a PDF, and small settings (for example, a closed banner) are saved in your own browser only. They are never sent to us. Clearing your browser data removes them.</p>
        </section>

        <section class="about-card" id="sharing">
            <h2>Who we share it with</h2>
            <p>We <strong>never sell</strong> your personal data. We share it only with the services we need to run the classes: our registration and payment partner, WhatsApp, Zoom and Google (analytics and ads measurement). We may also share it if the law requires us to.</p>
        </section>

        <section class="about-card" id="keeping">
            <h2>How long we keep it</h2>
            <p>We keep your registration details while you take part in our classes and for as long as we need them to answer questions about your registration. Payment records are kept for as long as Indian law requires. After that, we delete them. You can ask us to delete your details earlier (see below).</p>
        </section>

        <section class="about-card" id="your-rights">
            <h2>Your rights</h2>
            <p>Under India&rsquo;s Digital Personal Data Protection Act, 2023, you can ask us to:</p>
            <ul class="about-list">
                <li>tell you what personal data we hold about you;</li>
                <li>correct or update it;</li>
                <li>delete it, or stop using it (withdraw your consent);</li>
                <li>look into a complaint about how we handled it.</li>
            </ul>
            <p>Email {EMAIL} from the email address or with the phone number you registered with. We will reply as soon as we can.</p>
            <p><strong>Grievance contact:</strong> Abhishek Ranjan, {EMAIL}</p>
        </section>

        <section class="about-card" id="children">
            <h2>Students under 18</h2>
            <p>Many of our students are school students. If you are under 18, please register with your parent&rsquo;s or guardian&rsquo;s permission. A parent or guardian can email us at any time to see or delete their child&rsquo;s details.</p>
        </section>

        <section class="about-card" id="cookies">
            <h2>Cookies: your choices</h2>
            <p>You can block or delete cookies in your browser settings. You can also turn off Google Analytics with the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">Google Analytics opt-out add-on</a>, and control personalised Google ads in <a href="https://myadcenter.google.com/" target="_blank" rel="noopener noreferrer">My Ad Center</a>. The website works without these cookies.</p>
        </section>

        <section class="about-card" id="security">
            <h2>Keeping it safe</h2>
            <p>Only the people who run the classes can see your registration details, and the website uses a secure (https) connection. No system is perfectly secure, but we take reasonable care, and we will tell you if a problem affects your data.</p>
        </section>

        <section class="about-card" id="changes">
            <h2>Changes to this policy</h2>
            <p>If we change how we use personal data, we will update this page and the date below.</p>
        </section>
""",
    },
    {
        "file": "terms.html", "page": "terms",
        "title": "Terms & Conditions | Super Learner Academy",
        "desc": "The terms for using the Super Learner Academy website, free tools and live online classes: registration, fees, conduct, course material and what we do and don't promise.",
        "eyebrow": "Terms & Conditions", "h1": "Terms &amp; Conditions",
        "lead": "The rules for using this website and joining our live classes, in plain words.",
        "body": f"""
        <section class="about-card" id="about-terms">
            <h2>About these terms</h2>
            <p>These terms apply to the website www.superlearneracademy.in, its free tools and the live online classes of Super Learner Academy, run by Abhishek Ranjan from India. By using the website or registering for a class, you agree to them. If you are under 18, please register with your parent&rsquo;s or guardian&rsquo;s permission.</p>
        </section>

        <section class="about-card" id="classes">
            <h2>Our classes</h2>
            <p>We teach learning skills (memory techniques, focus, study methods and mindset) in live online sessions on Zoom, mostly in Hinglish. The date, time and what is included are shown on the registration page. If a session has to move, we will tell you in advance on WhatsApp or by email.</p>
        </section>

        <section class="about-card" id="fees">
            <h2>Registration and fees</h2>
            <p>The fee is the one shown on the registration page when you book. Some batches are free; for those, no payment is taken. Payments for paid batches are handled by our payment partner. Refunds follow our <a href="refund-policy.html">Refund &amp; Cancellation Policy</a>.</p>
        </section>

        <section class="about-card" id="results">
            <h2>What we promise, and what we don&rsquo;t</h2>
            <p>We promise to teach the techniques we describe, live, and to answer your questions. How much a student improves depends on their subject, starting point and how much they practise. So we do <strong>not</strong> promise any marks, rank, admission, exam result or job.</p>
        </section>

        <section class="about-card" id="conduct">
            <h2>Being part of a class</h2>
            <ul class="about-list">
                <li>Be respectful to the coach and other students in class and in the WhatsApp group.</li>
                <li>Don&rsquo;t share your joining link with people who haven&rsquo;t registered.</li>
                <li>Don&rsquo;t post advertising, spam or anything offensive in the group.</li>
            </ul>
            <p>We may remove anyone who disrupts a class or the group.</p>
        </section>

        <section class="about-card" id="content">
            <h2>Course material</h2>
            <p>The sessions, slides, worksheets and other material belong to Super Learner Academy. You may use them for your own study. Please don&rsquo;t record the sessions, or copy, share or sell the material, without our written permission. The free e-book, printables and tools on this website are for personal study use.</p>
        </section>

        <section class="about-card" id="free-tools">
            <h2>Free tools and website content</h2>
            <p>The quizzes, mind-map tool and notes generator are free and provided as they are. We try to keep them accurate and working, but we may change or remove them at any time. The quizzes are for self-reflection; they are not a medical or psychological diagnosis.</p>
        </section>

        <section class="about-card" id="third-party">
            <h2>Other services</h2>
            <p>Registration, payment, WhatsApp, Zoom and Google services are run by other companies, and their own terms apply when you use them. We are not responsible for their websites or apps.</p>
        </section>

        <section class="about-card" id="liability">
            <h2>Limits of our responsibility</h2>
            <p>As far as the law allows, we are not responsible for indirect losses, and our total responsibility for a class is limited to the fee you paid for it.</p>
        </section>

        <section class="about-card" id="law">
            <h2>Law and changes</h2>
            <p>These terms are governed by the laws of India. We may update them; the date below shows the latest version. Questions? Email {EMAIL}.</p>
        </section>
""",
    },
    {
        "file": "refund-policy.html", "page": "refund",
        "title": "Refund & Cancellation Policy | Super Learner Academy",
        "desc": "When and how Super Learner Academy refunds a paid workshop, what happens if a session is cancelled, and how to ask for a refund.",
        "eyebrow": "Refund & Cancellation Policy", "h1": "Refund &amp; Cancellation Policy",
        "lead": "Simple and fair: if the workshop didn&rsquo;t add value for you, you get your money back.",
        "body": f"""
        <section class="about-card" id="free-batches">
            <h2>Free batches</h2>
            <p>When a batch is free, no payment is taken, so there is nothing to refund. If you can&rsquo;t attend, just let us know on WhatsApp or by email so we can give your seat to someone else.</p>
        </section>

        <section class="about-card" id="refunds">
            <h2>Paid workshop: our refund promise</h2>
            <p>If you attend the full workshop and feel it didn&rsquo;t add value, contact us <strong>within 24 hours of the final session</strong> for a <strong>complete refund</strong>.</p>
            <h3>How to ask</h3>
            <p>Email {EMAIL} with the name and email address you registered with. You don&rsquo;t have to give a reason.</p>
            <h3>How you get the money back</h3>
            <p>We refund the full amount to the payment method you used. After we send it, the time it takes to reach your account depends on your bank or payment app.</p>
        </section>

        <section class="about-card" id="cancellations">
            <h2>If we cancel or move a session</h2>
            <p>If we have to cancel or reschedule a session, we will tell you in advance on WhatsApp or by email. You can then join the new date or a later batch, or ask for a full refund.</p>
        </section>

        <section class="about-card" id="questions">
            <h2>Questions</h2>
            <p>Write to {EMAIL}. A real person reads every message. See also our <a href="terms.html">Terms &amp; Conditions</a> and <a href="privacy-policy.html">Privacy Policy</a>.</p>
        </section>
""",
    },
]

about = open(os.path.join(ROOT, "about.html"), encoding="utf-8").read()
head, rest = about.split('<header class="about-hero">', 1)
foot = rest.split("</main>", 1)[1]

for p in PAGES:
    h = head
    url = "https://www.superlearneracademy.in/" + p["file"]
    h = re.sub(r"<title>.*?</title>", "<title>%s</title>" % p["title"].replace("&", "&amp;"), h, flags=re.S)
    h = re.sub(r'(<meta name="description" content=")[^"]*', lambda m: m.group(1) + p["desc"], h)
    h = re.sub(r'(<link rel="canonical" href=")[^"]*', lambda m: m.group(1) + url, h)
    h = re.sub(r'(<meta property="og:title" content=")[^"]*', lambda m: m.group(1) + p["title"].replace("&", "&amp;"), h)
    h = re.sub(r'(<meta property="og:description" content=")[^"]*', lambda m: m.group(1) + p["desc"], h)
    h = re.sub(r'(<meta property="og:url" content=")[^"]*', lambda m: m.group(1) + url, h)
    ld = ('<script type="application/ld+json">\n    {\n      "@context": "https://schema.org",\n      "@type": "WebPage",\n'
          '      "name": "%s",\n      "url": "%s",\n      "dateModified": "2026-11-26",\n'
          '      "publisher": { "@type": "Organization", "name": "Super Learner Academy", "url": "https://www.superlearneracademy.in/", "email": "support@superlearneracademy.in" }\n    }\n    </script>'
          % (p["eyebrow"], url))
    h = re.sub(r'<!-- Publisher \+ author identity.*?</script>', ld, h, flags=re.S)
    h = h.replace('<body data-page="about">', '<body data-page="%s">' % p["page"])
    page = (h + '<header class="about-hero">\n        <span class="about-eyebrow">%s</span>\n        <h1>%s</h1>\n        <p>%s</p>\n    </header>\n\n'
            '    <main class="about-wrap">\n%s\n        <p class="about-updated">Last updated: %s</p>\n\n    </main>' % (p["eyebrow"].replace("&", "&amp;"), p["h1"], p["lead"], p["body"], UPDATED)) + foot
    open(os.path.join(ROOT, p["file"]), "w", encoding="utf-8", newline="").write(page)
    print("wrote", p["file"])
