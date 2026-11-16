import json
from pathlib import Path

from django.core.management.base import BaseCommand

from chat import rag


class Command(BaseCommand):
    help = "Measure retrieval hit-rate, answer correctness and refusal accuracy on a labelled question set."

    def add_arguments(self, parser):
        parser.add_argument("--file", default="evaluation/questions.json")
        parser.add_argument("--no-llm", action="store_true", help="Only evaluate retrieval (free, instant).")
        parser.add_argument("--verbose", action="store_true")

    def handle(self, *args, **opts):
        items = json.loads(Path(opts["file"]).read_text())
        stats = {"retr_total": 0, "retr_hit": 0, "ans_total": 0, "ans_ok": 0, "refuse_total": 0, "refuse_ok": 0}
        for it in items:
            chunks = rag.retrieve(it["q"], it["role"])
            answerable = it.get("answerable", True)
            if answerable:
                stats["retr_total"] += 1
                hit = any(c["document"] == it["doc"] and any(k.lower() in c["content"].lower() for k in it["keywords"]) for c in chunks)
                stats["retr_hit"] += hit
                verdict = "retrieval " + ("HIT" if hit else "MISS")
                if not opts["no_llm"]:
                    res = rag.generate_answer(it["q"], chunks, [])
                    ok = res["found"] and all(k.lower() in res["answer"].lower() for k in it["keywords"])
                    stats["ans_total"] += 1
                    stats["ans_ok"] += ok
                    verdict += " | answer " + ("OK" if ok else "WRONG")
            else:
                stats["refuse_total"] += 1
                if opts["no_llm"]:
                    refused = not chunks
                else:
                    refused = not rag.generate_answer(it["q"], chunks, [])["found"]
                stats["refuse_ok"] += refused
                verdict = "refusal " + ("OK" if refused else "FAILED (answered an unanswerable question)")
            self.stdout.write(f"[{it['role']:8}] {it['q'][:58]:58} -> {verdict}")

        def pct(a, b):
            return f"{a}/{b} ({100 * a / b:.0f}%)" if b else "n/a"

        self.stdout.write("")
        self.stdout.write(f"Retrieval hit rate : {pct(stats['retr_hit'], stats['retr_total'])}")
        if not opts["no_llm"]:
            self.stdout.write(f"Answer correctness : {pct(stats['ans_ok'], stats['ans_total'])}")
        self.stdout.write(f"Correct refusals   : {pct(stats['refuse_ok'], stats['refuse_total'])}")
