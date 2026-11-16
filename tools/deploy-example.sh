set -e
A=/srv/answrit/app; B=/srv/answrit/prev-20261112-155517-hints-question-pages
mkdir -p $B/static/beta $B/data
cp -p $A/app.py $B/; cp -p $A/static/beta/app.js $A/static/beta/app.css $A/static/beta/index.html $B/static/beta/; cp -rp $A/static/beta/hints $B/static/beta/; cp -p $A/data/ccna-1-v7-modules-1-3-basic-network-connectivity-and-communications-exam-answers.json $B/data/
rm -rf /tmp/hints; mkdir /tmp/hints; tar xzf /tmp/hints.tgz -C /tmp/hints 2>/dev/null
for f in app.py static/beta/app.js static/beta/app.css static/beta/index.html data/ccna-1-v7-modules-1-3-basic-network-connectivity-and-communications-exam-answers.json; do install -o answrit -g answrit -m 664 /tmp/hints/$f $A/$f; done
for f in /tmp/hints/static/beta/hints/*.json; do install -o answrit -g answrit -m 664 "$f" $A/static/beta/hints/; done
cd $A && sudo -u answrit /srv/answrit/venv/bin/python - <<'PY'
import re, app as A
c = A.app.test_client(); idx = A.question_index(); slug = sorted(idx["by_slug"])[10]
bad = 0
for u in ["/", "/study/", "/exams/ccna-2-v7-modules-5-6-redundant-networks-exam-answers/", f"/questions/{slug}/", "/api/exams", "/sitemap.xml", "/beta/hints/ccna-1-v70-final-exam-answers-full-introduction-to-networks.json"]:
    r = c.get(u); b = r.get_data(as_text=True)
    left = re.findall(r"\$[A-Z_]+\$", b)
    print(r.status_code, u[:80], "why:", b.count("Why"), "left:", left)
    bad += r.status_code != 200 or bool(left)
print("question pages:", len(idx["by_slug"]), "sitemap urls:", c.get("/sitemap.xml").get_data(as_text=True).count("<url>"))
print("BAD" if bad else "ALLGOOD")
PY
echo backup $B
