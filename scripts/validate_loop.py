import json
import re
import sys
import urllib.request

PAYLOAD = {
  "title": "Brutal Idea Validator — multi-agent startup idea stress-tester",
  "description": "A single-page web app for early-stage founders who need a brutally specific critique before they build. Seven AI personas — VC, senior engineer, indie hacker, PM, UX designer, skeptical real user, and devil advocate — critique the idea in parallel via OpenAI. The system emphasizes real substitutes, named competitors, pricing risk, and a concrete pivot path, and the roadmap adds a human-expert review layer so the product is not just another generic AI wrapper. Features: SSE streaming as agents finish, voice dictation into form fields, and a dark tribunal UI. The structured critique grammar is the actual moat.",
  "targetUser": "Solo founders, indie hackers, and early-stage builders who have an idea but no co-founder or advisor network to pressure-test it before spending months building",
  "problem": "Founders validate ideas with ChatGPT (too nice), friends (too polite), or Twitter polls (too shallow). They need a skeptical room — VC + engineer + user — that attacks assumptions, names competitors, and gives a clear verdict before they commit time.",
  "solution": "Submit idea once, get 7 independent expert critiques streamed in ~45 seconds plus a synthesized verdict with scores across market, technical, launch, UX, and retention. Voice input for fast capture. History saved locally.",
  "differentiator": "Not generic AI advice — the room compares the idea against real substitutes and actual competitors, forces a budget/pricing plan and a sharp target user, and outputs a concrete pivot path. The moat is the structured critique grammar plus a hybrid AI + human-expert layer for trust, not the model alone.",
  "businessModel": "Hybrid SaaS for solo founders: a freemium validator tier plus a paid expert-review layer and teardown packs for accelerators, mentors, and founder communities",
  "pricing": "$0 for 3 validations/month, $12/mo Pro, $29/mo for teams",
  "distribution": "Product Hunt, indie hacker Twitter/X, r/SaaS, r/startups, founder newsletters, build-in-public posts showing brutal verdicts on famous ideas",
  "competitors": "ChatGPT/Claude (generic, too nice), ValidatorAI, IdeaProof, various GPT wrappers on Product Hunt, founder communities and accelerators (human, slow)",
  "constraints": "Solo dev, OpenAI API costs per run (~7+1 calls), no accounts yet, no live competitor search yet (planned Phase 4)",
  "successMetric": "40% of users who complete one validation run a second idea within 7 days; 8% convert to paid within 30 days; 20% share a teardown with a cofounder or advisor",
  "timeline": "MVP shipped (current). Next: competitor search, persistence, polish. Monetization in 4-6 weeks.",
  "context": "This validation IS the product validating itself. Built with Next.js 14, App Router, SSE streaming, Web Speech API for voice. The prompts are the product moat."
}


def main():
    req = urllib.request.Request(
        'http://localhost:3000/api/start?format=json',
        data=json.dumps(PAYLOAD).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    with urllib.request.urlopen(req, timeout=1200) as resp:
        data = json.load(resp)

    output = data.get('synthesis', {}).get('output', '')
    verdict_match = re.search(r'<verdict>\s*(SHIP IT|PIVOT|KILL IT)\s*</verdict>', output, re.I)
    verdict = verdict_match.group(1).upper() if verdict_match else 'UNKNOWN'
    scores = data.get('synthesis', {}).get('scores', {})
    print(json.dumps({
        'verdict': verdict,
        'scores': scores,
        'summary': re.sub(r'<[^>]+>', '', output)[:2500]
    }, indent=2))


if __name__ == '__main__':
    main()
