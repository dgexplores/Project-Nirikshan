"""Ask Detective (spec engine 16 / FR-07).

Scoped question answering over stored evidence with citation-first output:

1. Retrieval scores profiles, quality observations and findings against the
   question tokens (deterministic TF-style scoring).
2. If no evidence clears the threshold -> refusal (never speculate).
3. Synthesis: LLM mode when BDD_LLM_* configured, else deterministic template.
   Both modes MUST cite evidence as [E1]..[En]; the safety gate rewrites any
   answer that accuses, speculates beyond evidence, or drops citations.

The LLM never calculates facts; every number in a cited snippet was produced
by deterministic engines upstream.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

import httpx
from bdd_contracts.finding import ConfidenceLevel
from sqlalchemy import select

from bdd_api.config import get_settings
from bdd_api.db import ArtifactRow, FindingRow, db_session

logger = logging.getLogger("bdd.ask")

_STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "of", "in", "on", "for", "to", "and", "or",
    "what", "which", "who", "whom", "how", "why", "when", "where", "does", "do", "did", "any",
    "show", "tell", "me", "about", "give", "list", "with", "by", "at", "as", "be", "been",
}

# Governance wording guard: BDD flags potential inconsistencies for review,
# it must never assert wrongdoing. Covers English and Hindi since Ask
# Detective is explicitly a bilingual (Hindi/English) feature.
_BANNED_PATTERN = re.compile(
    r"\b(fraud|fraudulent|corrupt|corruption|guilty|culprit|scam|cheat(?:ed|ing)?|"
    r"embezzl\w*|fake|faked|forgery|falsif\w*|misappropriat\w+|is wrong|are wrong|"
    r"committed a crime|criminal)\b|"
    r"(भ्रष्टाचार|घोटाला|"
    r"धोखाधड़ी|जालसाज़ी|"
    r"दोषी|अपराधी|फ़र्ज़ी)",
    re.IGNORECASE,
)
_REFUSAL = (
    "I could not find enough stored evidence to answer that safely. "
    "Upload a dataset or run a comparison first - I only report what the frozen artifacts support.\n"
    "मुझे सुरक्षित उत्तर देने के लिए पर्याप्त सबूत नहीं मिले। कृपया पहले कोई फ़ाइल अपलोड करें।"
)


@dataclass
class EvidenceCard:
    ref: str
    artifact_id: str
    locator: str
    snippet: str
    kind: str = "artifact"
    severity: str | None = None


# A small, curated Hindi-to-English keyword bridge for retrieval. This is
# not machine translation, just enough domain-word overlap for a Devanagari
# question to reach the same evidence an equivalent English one would.
# Stored data and column names stay in English/romanized form until real
# Hindi NLU (Bhashini/Sarvam) lands, see README roadmap.
_HINDI_ALIASES: dict[str, str] = {
    "लाभार्थी": "beneficiaries",
    "लाभार्थियों": "beneficiaries",
    "जिला": "district",
    "जिले": "district",
    "गांव": "village",
    "गाँव": "village",
    "राशि": "amount",
    "भुगतान": "payment",
    "गुणवत्ता": "quality",
    "समस्या": "issue",
    "आंकड़े": "data",
    "आंकड़ों": "data",
    "तुलना": "compare",
    "असामान्य": "unusual",
    "गड़बड़ी": "anomaly",
    "किसान": "farmer",
    "फसल": "crop",
    "स्कूल": "school",
    "विद्यालय": "school",
    "नामांकन": "enrollment",
    "पानी": "water",
    "सिंचाई": "irrigation",
    "योजना": "scheme",
    "रिपोर्ट": "report",
    "खोज": "finding",
    "खोजें": "finding",
    "विसंगति": "anomaly",
    "बकाया": "dues",
    "सब्सिडी": "subsidy",
    "अनुदान": "subsidy",
}


_TOKEN_PATTERN = re.compile(r"[a-z0-9_]+|[ऀ-ॿ]+")


def _tokens(text: str) -> list[str]:
    words = _TOKEN_PATTERN.findall(text.lower())
    tokens: list[str] = []
    for t in words:
        alias = _HINDI_ALIASES.get(t)
        if alias:
            tokens.append(alias)
        elif len(t) > 2 and t not in _STOPWORDS:
            tokens.append(t)
    return tokens


def _collect_evidence(question: str, artifact_ids: list[str] | None) -> tuple[list[EvidenceCard], dict[str, str]]:
    q_tokens = set(_tokens(question))
    cards: list[tuple[float, EvidenceCard]] = []

    def add(score: float, artifact_id: str, locator: str, snippet: str,
            kind: str = "artifact", severity: str | None = None) -> None:
        if score <= 0:
            return
        cards.append((score, EvidenceCard(ref="", artifact_id=artifact_id, locator=locator, snippet=snippet[:280], kind=kind, severity=severity)))

    with db_session() as session:
        art_query = select(ArtifactRow).order_by(ArtifactRow.created_at.desc())  # type: ignore[attr-defined]
        if artifact_ids:
            art_query = art_query.where(ArtifactRow.artifact_id.in_(artifact_ids))  # type: ignore[attr-defined]
        for row in session.scalars(art_query).all():
            name_score = sum(1.0 for t in q_tokens if t in (row.artifact_id or "").lower())
            title_score = sum(0.5 for t in q_tokens if row.title and t in row.title.lower()) * 4
            source_score = sum(0.5 for t in q_tokens if t in (row.source_id or "").lower()) * 3
            base = max(name_score, title_score, source_score)
            add(base, row.artifact_id, f"artifact:{row.artifact_id}", f"Artifact {row.artifact_id} ({row.media_type}, {row.byte_size} bytes, sha256 {row.sha256[:12]}...)")
            profile = row.profile_json or {}
            for col in profile.get("columns", []):
                col_text = f"{col['name']} {col['dtype']}"
                score = sum(2.0 for t in q_tokens if t in col_text.lower())
                if score:
                    hints = ", ".join(h["hint_type"] for h in col.get("pii_hints", []))
                    detail = f"column '{col['name']}' ({col['dtype']}), {col['null_ratio']:.0%} nulls, {col['unique_count']} unique" + (f"; PII hints: {hints}" if hints else "")
                    add(score + base * 0.5, row.artifact_id, f"{row.artifact_id}#column={col['name']}", detail)
            for obs in profile.get("quality_observations", []):
                obs_text = f"{obs['code']} {obs.get('description', '')}"
                score = sum(2.5 for t in q_tokens if t in obs_text.lower())
                add(score, row.artifact_id, f"{row.artifact_id}#{obs['code']}", f"{obs['severity'].upper()} {obs['code']}: {obs.get('description', '')}")

        find_query = select(FindingRow).order_by(FindingRow.created_at.desc()).limit(400)  # type: ignore[attr-defined]
        for frow in session.scalars(find_query).all():
            if artifact_ids and not set(artifact_ids) & set(map(str, frow.artifact_ids or [])):
                continue
            text_blob = f"{frow.title} {frow.summary} {frow.kind}"
            score = sum(3.0 for t in q_tokens if t in text_blob.lower())
            if score > 0 and frow.severity in ("high", "critical"):
                score += 0.5
            add(score, (frow.artifact_ids or ["-"])[0], f"finding:{frow.finding_id}", f"{frow.title} - {frow.summary}", kind=frow.kind, severity=frow.severity)

    cards.sort(key=lambda pair: pair[0], reverse=True)
    top = [c for _, c in cards[:6]]
    for i, card in enumerate(top, start=1):
        card.ref = f"E{i}"
    titles = {}
    with db_session() as session:
        for row in session.scalars(select(ArtifactRow)).all():
            titles[row.artifact_id] = row.title or row.source_id
    return top, titles


_ROLE_MARKER = re.compile(r"(?im)^\s*(system|assistant|user)\s*:")


def _sanitize_for_prompt(text: str) -> str:
    """Evidence snippets can carry attacker-controlled text (a column name,
    a quality-observation description) straight from an uploaded file. Flatten
    it to one line and defuse fake role markers before it reaches the LLM
    prompt, this is a floor, not a full injection defense.
    """
    flat = " ".join(text.split())
    return _ROLE_MARKER.sub("[blocked]:", flat)


def _llm_answer(question: str, evidence: list[EvidenceCard]) -> str | None:
    """Call OpenAI-compatible chat completions. Returns None on any failure."""
    settings = get_settings()
    if not (settings.llm_base_url and settings.llm_api_key and settings.llm_model):
        return None
    blocks = "\n\n".join(f"[{c.ref}] ({c.locator}) {_sanitize_for_prompt(c.snippet)}" for c in evidence)
    system = (
        "You are the Bharat Data Detective analyst. You answer ONLY from the numbered evidence snippets.\n"
        "Rules:\n"
        "- Cite every factual statement with its [E#] reference.\n"
        "- Never invent numbers, sources or citations.\n"
        "- Describe potential inconsistencies neutrally; NEVER accuse anyone of fraud or wrongdoing; "
        "the system flags items for human review, it does not judge truth.\n"
        "- Reply in the same language as the question (Hindi or English), citations like [E1] stay as is.\n"
        "- If the evidence is insufficient, reply exactly with INSUFFICIENT_EVIDENCE."
    )
    user = f"Question: {question}\n\nEvidence:\n{blocks}"
    try:
        resp = httpx.post(
            f"{settings.llm_base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.llm_api_key}"},
            json={
                "model": settings.llm_model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "temperature": 0.2,
                "max_tokens": 500,
            },
            timeout=settings.llm_timeout_s,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"].strip()
        # Smaller models often elaborate past the exact refusal token
        # ("INSUFFICIENT_EVIDENCE, because..."), match the prefix, not the
        # whole string, so the refusal still routes to the safe fallback.
        return None if content.upper().startswith("INSUFFICIENT_EVIDENCE") else content
    except Exception:
        logger.exception("LLM call failed; falling back to deterministic synthesis")
        return None


_KIND_PLAIN: dict[str, str] = {
    "anomaly": "unusual number",
    "drift": "changed definition",
    "contradiction": "sources disagree",
    "consensus": "copies of one source",
    "benford": "unusual digit pattern",
}

_HINDI_LEAD = "आपके प्रश्न से जुड़े सबूत मिले हैं, विवरण नीचे अंग्रेज़ी में है:"


def _is_hindi(text: str) -> bool:
    return bool(re.search(r"[ऀ-ॿ]", text))


def _deterministic_answer(question: str, evidence: list[EvidenceCard], titles: dict[str, str]) -> str:
    """Direct answer first, grouped evidence after.

    Problems flagged lead (that is what the user asked about), files and
    columns follow as context. Every card keeps its [E#] citation.
    """
    problems = [c for c in evidence if c.locator.startswith("finding:")]
    context = [c for c in evidence if not c.locator.startswith("finding:")]
    kinds = sorted({_KIND_PLAIN.get(c.kind, c.kind) for c in problems})

    lines = []
    if _is_hindi(question):
        lines.append(_HINDI_LEAD)
    direct = f"Yes - {len(problems)} flagged problem(s)"
    if kinds:
        direct += f" ({', '.join(kinds)})"
    direct += f' across {len({c.artifact_id for c in evidence})} file(s) relevant to "{question}".'
    if not problems:
        direct = f'No flagged problems match "{question}", but {len(context)} file/column description(s) do:'
    lines.append(direct)

    if problems:
        lines.append("\nProblems flagged (open each in the Findings queue to review):")
        for c in problems:
            label = titles.get(c.artifact_id, c.artifact_id)
            sev = f", {c.severity} severity" if c.severity else ""
            lines.append(f"  [{c.ref}] {c.snippet} (in {label}{sev})")
    if context:
        lines.append("\nFiles and columns behind them:")
        for c in context:
            label = titles.get(c.artifact_id, c.artifact_id)
            lines.append(f"  [{c.ref}] {c.snippet} (in {label})")
    lines.append("\nThese are observations for review, not verdicts on correctness.")
    return "\n".join(lines)


def _safety_gate(answer: str, evidence: list[EvidenceCard], mode: str) -> tuple[str, str]:
    """Returns (final_answer, effective_mode). Rewrites unsafe answers."""
    has_citation = bool(re.search(r"\[E\d+\]", answer))
    banned = _BANNED_PATTERN.search(answer)
    if mode == "llm" and (banned or not has_citation):
        reason = "unsafe wording removed" if banned else "missing citations"
        logger.warning("LLM answer rejected (%s); using deterministic synthesis", reason)
        return "", "deterministic"
    if banned and mode == "deterministic":
        answer = _BANNED_PATTERN.sub("[redacted judgment word]", answer)
    return answer, mode


def ask(question: str, artifact_ids: list[str] | None = None) -> dict:
    question = (question or "").strip()
    if not question:
        from bdd_api.errors import AppError

        raise AppError(422, "empty_question", "question must not be empty")

    evidence, titles = _collect_evidence(question, artifact_ids)

    if not evidence:
        return {
            "question": question,
            "answer": _REFUSAL,
            "mode": "refusal",
            "confidence": "low",
            "citations": [],
            "suggested_next": [
                "Upload a dataset on the Datasets page",
                "Compare two datasets on the Compare page",
                "Browse open findings in the Findings queue",
            ],
        }

    raw_mode = "llm"
    answer = _llm_answer(question, evidence)
    if answer is None:
        raw_mode = "deterministic"
        answer = _deterministic_answer(question, evidence, titles)
    final_answer, mode = _safety_gate(answer, evidence, raw_mode)
    if mode == "deterministic" and raw_mode == "llm":
        final_answer = _deterministic_answer(question, evidence, titles)

    confidence: ConfidenceLevel = "low"
    if len(evidence) >= 5:
        confidence = "high"
    elif len(evidence) >= 3:
        confidence = "moderate"

    suggested: list[str] = []
    artifact_refs = sorted({c.artifact_id for c in evidence})
    if len(artifact_refs) >= 2:
        suggested.append(f"Compare {artifact_refs[0]} with {artifact_refs[1]}")
    suggested.append(f"Open dataset {artifact_refs[0]}")
    suggested.append("Review open findings in the queue")

    return {
        "question": question,
        "answer": final_answer,
        "mode": mode,
        "confidence": confidence,
        "citations": [
            {"ref": c.ref, "artifact_id": c.artifact_id, "locator": c.locator, "snippet": c.snippet}
            for c in evidence
        ],
        "suggested_next": suggested,
    }
